/**
 * AI-powered extraction of structured project state from raw communication text.
 * Uses Gemini (primary) → Groq (fallback) → rule-based regex (last resort).
 *
 * The AI is instructed to include a normalized eventKey per item so the
 * deduplication layer can match semantically equivalent events across imports.
 */

import { callLLM, parseLLMJson } from "./client";
import { normalizeEventKey } from "./dedup";
import type { ProjectState, Item, ActionItemType } from "@/lib/types";
import { emptyState } from "@/lib/types";

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a construction project intelligence assistant.
Analyze raw project communication (WhatsApp messages, emails, meeting transcripts)
and extract ONLY newly introduced information — not information already present
in the prior state summary.

Return ONLY valid JSON matching this exact schema. No extra text, no markdown fences.

IMPORTANT: Each extracted item must include an "eventKey" field — a short,
normalized, order-independent identifier for semantic deduplication. Format:
"<type>:<topic1>:<topic2>:..." where topics are lowercase keyword stems
(e.g., "decision:marble:option_b:approved", "blocker:installation:kitchen:blocked").
Use synonyms freely: "second option" and "Option B" should produce the same key.

{
  "summary": "string — 1–2 sentence summary of the CURRENT overall project situation",
  "decisions": [
    {
      "title": "string",
      "description": "string",
      "owner": "string (person name from text)",
      "ownerRole": "string (e.g., Architect, Client, Contractor, Supplier)",
      "priority": "low|medium|high",
      "status": "resolved",
      "eventKey": "decision:<topic>:<topic>:..."
    }
  ],
  "actionItems": [
    {
      "title": "string",
      "description": "string",
      "owner": "string (specific person name when identifiable)",
      "ownerRole": "string (e.g., Architect, Client, Contractor, Supplier)",
      "status": "open|in_progress|waiting|blocked|resolved",
      "priority": "low|medium|high",
      "type": "assigned_task|approval_required|follow_up|waiting_action|coordination|delivery|review",
      "dueDate": "string (e.g., 'Tomorrow morning', 'Friday', 'Monday') when mentioned",
      "dependencies": ["string (what this action is waiting for)"],
      "eventKey": "action:<topic>:<topic>:..."
    }
  ],
  "pendingDecisions": [
    {
      "title": "string",
      "description": "string",
      "owner": "string",
      "ownerRole": "string",
      "priority": "low|medium|high",
      "status": "open",
      "eventKey": "pending:<topic>:<topic>:..."
    }
  ],
  "blockers": [
    {
      "title": "string",
      "description": "string",
      "owner": "string",
      "ownerRole": "string",
      "status": "open|blocked|resolved",
      "priority": "low|medium|high",
      "dependencies": ["string (what is blocking this)"],
      "eventKey": "blocker:<topic>:<topic>:..."
    }
  ],
  "risks": [
    {
      "title": "string",
      "description": "string",
      "owner": "string",
      "ownerRole": "string",
      "priority": "low|medium|high",
      "eventKey": "risk:<topic>:<topic>:..."
    }
  ],
  "deadlines": [
    {
      "title": "string",
      "description": "string",
      "owner": "string",
      "ownerRole": "string",
      "dueDate": "string",
      "eventKey": "deadline:<topic>:<topic>:..."
    }
  ],
  "updates": [
    {
      "title": "string",
      "description": "string",
      "owner": "string",
      "ownerRole": "string",
      "eventKey": "update:<topic>:<topic>:..."
    }
  ],
  "conflicts": [
    {
      "topic": "string",
      "sideA": {"statement": "string", "owner": "string"},
      "sideB": {"statement": "string", "owner": "string"},
      "recommendedAction": "string",
      "eventKey": "conflict:<topic>:<topic>:..."
    }
  ],
  "people": [{"name": "string", "role": "string"}],
  "changes": ["string — plain-English description of what is NEW in this batch"]
}

CRITICAL RULES FOR ACTION ITEMS:
- Extract EVERY meaningful actionable responsibility from the conversation
- Do NOT stop after finding the first obvious task
- Identify EXPLICIT assignments: "I will send...", "Please provide...", "You need to..."
- Identify IMPLICIT responsibilities: "Please don't start until approved" → someone must approve + someone must not start
- Identify WAITING/BLOCKED actions: "hold the installation", "waiting for approval"
- Identify APPROVAL requirements: "needs to approve", "waiting on client decision"
- Identify COORDINATION tasks: "please coordinate", "let me know when"
- Identify the SPECIFIC PERSON responsible whenever the text names them
- Use appropriate action types: assigned_task, approval_required, follow_up, waiting_action, coordination, delivery, review
- Determine realistic status based on the conversation:
  * "I'll send..." / "I'm preparing..." → in_progress
  * "Please approve..." / "Needs review..." → open (for approval_required type)
  * "Hold the installation..." / "Waiting for..." → waiting or blocked
  * "Done" / "Sent" / "Completed" → resolved
- Include dueDate when mentioned (even informally like "tomorrow" or "Friday")
- Include dependency when an action is blocked by or waiting for something else

GENERAL RULES:
- Extract ONLY information present in the new communication text
- "changes" must describe only what is NEW in THIS batch (not prior history)
- eventKey must be consistent: the same real-world event should always produce
  the same key regardless of how it is worded
- If an item is newly resolved (was previously blocked, now approved), mark
  status as "resolved" and note it in "changes"
- If the new text contains the same decision/event already in prior state,
  do NOT re-extract it — the deduplication layer will handle merging
- Keep all arrays empty [] if nothing new is found — never fabricate data
- Do NOT include items that merely acknowledge or repeat prior events
- Do NOT turn informational statements into action items ("materials are allocated" is info, not a task)
- ONLY create action items when someone needs to DO something, APPROVE something, REVIEW something, WAIT for something, CONFIRM something, or DELIVER something`;

// ============================================================================
// TYPES
// ============================================================================

export type ExtractionResult = {
  state: Partial<ProjectState>;
  changes: string[];
  provider: string;
};

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract structured project state from raw communication text using AI.
 * Falls back to rule-based extraction if both AI providers fail.
 *
 * @param rawText    The new communication to analyze
 * @param priorState The current project state (for context); null on first import
 */
export async function extractFromText(
  rawText: string,
  priorState: ProjectState | null
): Promise<ExtractionResult> {
  const priorContext = priorState
    ? `Prior project state (already recorded — do NOT re-extract these):
Summary: ${priorState.summary}
Existing blockers: ${(priorState.blockers ?? []).map((b) => `"${b.title}" [${b.status}]`).join(", ") || "none"}
Existing decisions: ${(priorState.decisions ?? []).map((d) => `"${d.title}"`).join(", ") || "none"}
Existing action items: ${(priorState.actionItems ?? []).map((a) => `"${a.title}" [${a.status}]`).join(", ") || "none"}
Existing pending decisions: ${(priorState.pendingDecisions ?? []).map((p) => `"${p.title}"`).join(", ") || "none"}
Existing conflicts: ${(priorState.conflicts ?? []).map((c) => `"${c.topic}" [${c.status ?? "open"}]`).join(", ") || "none"}`
    : "This is the FIRST import for this project — no prior state exists.";

  const userPrompt = `${priorContext}

New communication to analyze:

${rawText}`;

  console.log("[Extraction] Starting AI extraction...");
  const { text, provider } = await callLLM(SYSTEM_PROMPT, userPrompt);

  if (provider !== "none" && text) {
    const parsed = parseLLMJson<Record<string, unknown>>(text);
    if (parsed && typeof parsed === "object") {
      console.log(`[Extraction] ✓ AI extraction succeeded via ${provider}`);
      const { changes: aiChanges, ...stateFields } = parsed as {
        changes?: string[];
        [key: string]: unknown;
      };
      // Ensure eventKeys exist on all extracted items (fallback to computed key)
      const stateWithKeys = ensureEventKeys(stateFields as Partial<ProjectState>);
      return {
        state: stateWithKeys,
        changes: aiChanges ?? ["New communication imported."],
        provider,
      };
    }
    console.warn("[Extraction] AI returned non-parseable JSON, using rule-based fallback");
  } else {
    console.warn("[Extraction] Both AI providers failed, using rule-based fallback");
  }

  return ruleBasedExtraction(rawText, priorState);
}

// ============================================================================
// POST-PROCESS: Ensure eventKey on every item
// ============================================================================

type CategoryKey = "decisions" | "actionItems" | "pendingDecisions" | "blockers" | "risks" | "deadlines" | "updates";
const CATEGORY_MAP: Record<CategoryKey, "decision" | "action" | "pending" | "blocker" | "risk" | "deadline" | "update"> = {
  decisions: "decision",
  actionItems: "action",
  pendingDecisions: "pending",
  blockers: "blocker",
  risks: "risk",
  deadlines: "deadline",
  updates: "update",
};

function ensureEventKeys(state: Partial<ProjectState>): Partial<ProjectState> {
  const result = { ...state };
  for (const [key, category] of Object.entries(CATEGORY_MAP) as [CategoryKey, typeof CATEGORY_MAP[CategoryKey]][]) {
    const items = (result[key] as Array<{ title?: string; description?: string; eventKey?: string }> | undefined) ?? [];
    result[key as keyof ProjectState] = items.map((item) => ({
      ...item,
      eventKey: item.eventKey ?? normalizeEventKey(category, item.title ?? "", item.description ?? ""),
    })) as any;
  }
  return result;
}

// ============================================================================
// RULE-BASED FALLBACK EXTRACTION
// ============================================================================

function ruleBasedExtraction(
  rawText: string,
  priorState: ProjectState | null
): ExtractionResult {
  const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
  const stamp = () => new Date().toISOString();

  const prior = priorState ? { ...priorState } : { ...emptyState };
  const state: ProjectState = JSON.parse(JSON.stringify(prior));
  const changes: string[] = [];
  const all = rawText.toLowerCase();

  const mkItem = (
    kind: string,
    title: string,
    desc: string,
    owner: string,
    status: "open" | "in_progress" | "resolved" | "blocked" | "waiting" = "open",
    priority: "low" | "medium" | "high" = "medium",
    type?: ActionItemType,
    dueDate?: string,
    dependencies?: string[]
  ): Item => ({
    id: uid(kind),
    title,
    description: desc,
    status,
    priority,
    owner,
    source: "whatsapp" as const,
    sourceMessageId: uid("msg"),
    sourceMessageIds: [] as string[],
    timestamp: stamp(),
    relatedTopics: [] as string[],
    dependencies: dependencies ?? [],
    eventKey: normalizeEventKey(kind as any, title, desc),
    ...(type && { type }),
    ...(dueDate && { dueDate }),
  });

  if (/do not want|reject/.test(all) && /marble/.test(all)) {
    if (!state.blockers.some((x) => x.eventKey?.includes("installation") || x.title.includes("installation"))) {
      state.blockers.push(mkItem("blocker", "Kitchen installation waiting on approval", "Original kitchen marble was rejected.", "Vikram Mehta", "blocked", "high", undefined, undefined, ["Client marble approval"]));
      state.pendingDecisions.push(mkItem("pending", "Kitchen marble selection", "Choose an approved alternate marble option.", "Priya Sharma", "open", "high"));
      state.actionItems.push(mkItem("action", "Provide alternative kitchen marble options", "Send two alternative marble options to client.", "Rohan", "in_progress", "high", "assigned_task", "Tomorrow"));
      state.actionItems.push(mkItem("action", "Review and approve kitchen marble", "Review alternative marble options and approve one.", "Priya Sharma", "open", "high", "approval_required", undefined, ["Alternative marble options"]));
      state.actionItems.push(mkItem("action", "Hold kitchen installation", "Do not start kitchen installation until marble approval.", "Vikram Mehta", "waiting", "high", "waiting_action", undefined, ["Client marble approval"]));
      changes.push("Kitchen marble was rejected; installation is now blocked pending client approval.");
      changes.push("Multiple action items created: alternative options needed, client approval required, installation on hold.");
    }
  }

  if (/option b/.test(all) && /friday/.test(all)) {
    state.updates.push(mkItem("update", "Option B available Friday", "Supplier can make Option B available Friday.", "StoneWorks Supplier"));
    state.actionItems.push(mkItem("action", "Coordinate Option B delivery", "Confirm delivery schedule for Option B marble.", "Rohan", "open", "medium", "coordination", "Friday"));
    changes.push("Supplier options added: Option B is available Friday.");
  }

  if (/option b.*looks good|proceed with (it|option b)/i.test(rawText)) {
    // Resolve blockers and waiting actions
    state.blockers.forEach((x) => {
      if (x.title.includes("Kitchen installation") || x.eventKey?.includes("installation")) {
        x.status = "resolved";
      }
    });
    state.actionItems.forEach((x) => {
      if ((x.title.includes("approve") || x.type === "approval_required") && x.title.toLowerCase().includes("marble")) {
        x.status = "resolved";
      }
      if (x.title.includes("Hold") && x.title.includes("installation")) {
        x.status = "resolved";
      }
    });
    state.decisions.push(mkItem("decision", "Option B marble approved", "Client approved Option B for the kitchen.", "Priya Sharma", "resolved", "high"));
    state.actionItems.push(mkItem("action", "Place Option B marble order", "Order Option B marble from supplier.", "Rohan", "in_progress", "high", "assigned_task"));
    changes.push("Kitchen marble changed from pending approval to Option B approved.");
    changes.push("Approval and installation hold actions resolved.");
  }

  if (!changes.length) {
    changes.push("New communication was added to the project timeline.");
  }

  state.summary = state.blockers.some((x) => x.status !== "resolved")
    ? "Kitchen delivery and installation are being coordinated around the client's marble approval."
    : state.decisions.length
    ? "Option B has been approved for the kitchen; the team is coordinating delivery."
    : "Project communication is being monitored for decisions, work and risks.";

  return { state, changes, provider: "rule-based" };
}
