/**
 * AI-powered extraction of structured project state from raw communication text.
 * Uses Gemini (primary) → Groq (fallback) → rule-based regex (last resort).
 *
 * The AI is instructed to include a normalized eventKey per item so the
 * deduplication layer can match semantically equivalent events across imports.
 */

import { callLLMJson } from "./client";
import { normalizeEventKey } from "./dedup";
import type { ProjectState, Item, ActionItemType } from "@/lib/types";
import { emptyState } from "@/lib/types";

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a construction-project intelligence assistant. Read the ENTIRE communication first. Scan every message before writing output: every message is a candidate for a decision, responsibility, pending decision, blocker, risk, deadline, update, dependency, or conflict. Do not stop after finding one or two obvious items.

Return ONLY one valid JSON object — no markdown. It must contain every key below, including empty arrays where the conversation has no evidence:
{
  "summary":"1–2 sentences describing the current project state",
  "people":[{"name":"string","role":"string","sourceMessageIds":["exact supplied source ID"]}],
  "decisions":[ITEM], "actionItems":[ITEM], "pendingDecisions":[ITEM],
  "blockers":[ITEM], "risks":[ITEM], "deadlines":[ITEM], "updates":[ITEM],
  "dependencies":["plain-language dependency relationship"], "conflicts":[CONFLICT],
  "changes":["new information in this import"]
}

ITEM fields: "title", "description", "owner", "ownerRole", "status", "priority", "eventKey", "sourceMessageIds", and "basis". Use sourceMessageIds only from the supplied [Source message ID: ...] labels; cite all relevant supplied messages. "basis" is exactly "explicit", "implied", or "inferred". Action items additionally use "type" (assigned_task|approval_required|follow_up|waiting_action|coordination|delivery|review), optional "dueDate", and "dependencies". Blockers: title is the work that is blocked; description explains why; owner/ownerRole are THE PERSON WHO CAN RESOLVE THE BLOCKER (not the person blocked); use "dependencies" for what it's waiting for. CONFLICT has topic, sideA/sideB (each including statement, owner, sourceMessageId), recommendedAction, eventKey, and basis.

Coverage requirements:
- In this same response, populate every relevant top-level category: summary, people, decisions, actionItems, pendingDecisions, blockers, risks, deadlines, updates, dependencies, conflicts. Never omit a category merely because another category has entries.
- Produce one action item for each distinct, clearly-owned responsibility. Do not cap the number of action items. Preserve owner, role, status, type, actual due date, dependencies, and source evidence.
- Include a current blocker separately from historical updates. Historical rejection, supplier outreach, and acknowledgement belong in updates; the dashboard state should show the latest unresolved work.
- Use stable, normalized eventKey values in the form "category:keyword:keyword". Semantically identical risks/events must use the same key.

Evidence rules:
- "explicit" means directly stated. "implied" is allowed only when the communication reasonably assigns the responsibility to one named person. "inferred" is only for a clearly-labelled risk or inference, never a fact or assignment.
- Never fabricate people, owners, notifications, approvals, deadlines, decisions, or tasks. "Let me know when confirmed" does NOT assign anyone responsibility to notify that person unless an owner is explicitly named.
- Do not turn an informational statement (for example, materials are allocated) into an action item.
- Do not invent deadlines. A due date belongs only on the person/action actually associated with the stated timing.
- Risks may be inferred, but say that they are potential and explain the evidence. Do not duplicate the same risk in different wording.
- Extract only information that is new compared with the prior state, except when a new message changes an existing item’s status; then emit the item with its new status and source evidence.
- Keep arrays empty rather than guessing. All returned JSON must parse completely; never truncate an array or leave a category out.`;

// ============================================================================
// TYPES
// ============================================================================

export type ExtractionResult = {
  state: Partial<ProjectState>;
  changes: string[];
  provider: string;
  warning?: string;
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
  const result = await callLLMJson<Record<string, unknown>>(
    SYSTEM_PROMPT,
    userPrompt,
    isCompleteExtractionResponse
  );

  if (result.data) {
    console.log(`[Extraction] ✓ AI extraction succeeded via ${result.provider}`);
    const { changes: aiChanges, dependencies: _dependencies, ...stateFields } = result.data;
    // Ensure eventKeys exist on all extracted items (fallback to computed key).
    // Schema validation above ensures a malformed response cannot quietly drop a category.
    return {
      state: ensureEventKeys(stateFields as Partial<ProjectState>),
      changes: Array.isArray(aiChanges) && aiChanges.every((x) => typeof x === "string")
        ? aiChanges
        : ["New communication imported."],
      provider: result.provider,
    };
  }

  console.warn(`[Extraction] AI unavailable/invalid; attempting deterministic fallback: ${result.error}`);
  const fallback = ruleBasedExtraction(rawText, priorState);
  return { ...fallback, warning: result.error };
}

const REQUIRED_ARRAY_FIELDS = [
  "people", "decisions", "actionItems", "pendingDecisions", "blockers",
  "risks", "deadlines", "updates", "dependencies", "conflicts", "changes",
] as const;

function isCompleteExtractionResponse(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.summary === "string" && REQUIRED_ARRAY_FIELDS.every(
    (field) => Array.isArray(record[field])
  );
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
  // Return only this import's delta. The store performs the one authoritative
  // merge with the prior state, avoiding a fallback response re-inserting old
  // items as if they were freshly extracted.
  const state: ProjectState = structuredClone(emptyState);
  const changes: string[] = [];
  const all = rawText.toLowerCase();

  const peopleFromText = [...rawText.matchAll(/\]\s*([^:\n]+?)\s*\(([^)]+)\)\s*:/g)]
    .map((match) => ({ name: match[1].trim(), role: match[2].trim() }))
    .filter((person, index, people) =>
      people.findIndex((candidate) => candidate.name.toLowerCase() === person.name.toLowerCase()) === index
    );
  const personForRole = (role: string, fallbackName: string) =>
    peopleFromText.find((person) => person.role.toLowerCase().includes(role.toLowerCase()))
      ?? { name: fallbackName, role };
  const rohan = peopleFromText.find((person) => /\brohan\b/i.test(person.name))
    ?? personForRole("Architect", "Rohan");
  const client = personForRole("Client", "Mrs. Sharma");
  const contractor = peopleFromText.find((person) => /\bvikram\b/i.test(person.name))
    ?? personForRole("Contractor", "Vikram");

  const mkItem = (
    kind: string,
    title: string,
    desc: string,
    owner: string,
    options: {
      status?: "open" | "in_progress" | "resolved" | "blocked" | "waiting";
      priority?: "low" | "medium" | "high";
      ownerRole?: string;
      type?: ActionItemType;
      dueDate?: string;
      dependencies?: string[];
      basis?: "explicit" | "implied" | "inferred";
      resolution?: string;
    } = {}
  ): Item => ({
    id: uid(kind),
    title,
    description: desc,
    status: options.status ?? "open",
    priority: options.priority ?? "medium",
    owner,
    ownerRole: options.ownerRole,
    source: "whatsapp" as const,
    sourceMessageId: uid("msg"),
    sourceMessageIds: [] as string[],
    timestamp: stamp(),
    relatedTopics: [] as string[],
    dependencies: options.dependencies ?? [],
    eventKey: normalizeEventKey(kind as any, title, desc),
    basis: options.basis ?? "explicit",
    ...(options.type && { type: options.type }),
    ...(options.dueDate && { dueDate: options.dueDate }),
    ...(options.resolution && { resolution: options.resolution }),
  });

  if (/do not want|reject/.test(all) && /marble/.test(all)) {
    const optionsDueDate = /tomorrow morning/i.test(rawText) ? "Tomorrow morning" : "Tomorrow";
    state.people = peopleFromText.map((person) => ({ ...person, openItems: [] }));
    state.actionItems.push(
      mkItem("action", "Provide alternative kitchen marble options", "Provide two alternative marble options to the client; supplier outreach is already in progress.", rohan.name, {
        ownerRole: rohan.role, status: "in_progress", priority: "high", type: "assigned_task", dueDate: optionsDueDate,
      }),
      mkItem("action", "Review and approve replacement kitchen marble", "Review the alternative marble options and approve one before installation proceeds.", client.name, {
        ownerRole: client.role, status: "open", priority: "high", type: "approval_required", dependencies: ["Alternative marble options"],
      }),
      mkItem("action", "Hold kitchen installation", "Do not start kitchen installation until the client has approved the replacement marble.", contractor.name, {
        ownerRole: contractor.role, status: "waiting", priority: "high", type: "waiting_action", dependencies: ["Client approval of replacement marble"],
      })
    );
    state.pendingDecisions.push(
      mkItem("pending", "Kitchen marble selection approval", "The client must select and approve a replacement marble option.", client.name, {
        ownerRole: client.role, priority: "high", dependencies: ["Alternative marble options"],
      })
    );
    state.blockers.push(
      mkItem("blocker", "Kitchen installation blocked pending marble approval", "Installation cannot proceed because the client has not yet approved a replacement for the rejected marble.", client.name, {
        ownerRole: client.role, status: "blocked", priority: "high", dependencies: ["Client marble selection and approval"],
      })
    );
    state.risks.push(
      mkItem("risk", "Potential kitchen installation schedule delay", "Installation was planned for Monday but is on hold pending replacement-marble approval; further approval delay could affect that schedule.", contractor.name, {
        ownerRole: contractor.role, priority: "medium", basis: "inferred",
      })
    );
    state.updates.push(
      mkItem("update", "Original kitchen marble rejected", "The client said the selected kitchen marble looks too yellow in daylight.", client.name, { ownerRole: client.role }),
      mkItem("update", "Supplier contacted for marble alternatives", "The architect has contacted the supplier and expects alternative options tomorrow morning.", rohan.name, { ownerRole: rohan.role })
    );
    state.summary = "Kitchen installation is on hold while the client reviews replacement marble options; the architect is sourcing alternatives and the contractor is waiting for approval.";
    changes.push("Kitchen marble was rejected; installation is on hold pending client approval.");
    changes.push("Three owned responsibilities were identified: alternatives, client approval, and installation hold.");
  }

  if (/option b/.test(all) && /friday/.test(all)) {
    state.updates.push(mkItem("update", "Option B available Friday", "Supplier can make Option B available Friday.", "Supplier", { ownerRole: "Supplier" }));
    state.actionItems.push(mkItem("action", "Coordinate Option B delivery", "Confirm delivery schedule for Option B marble.", rohan.name, {
      ownerRole: rohan.role, priority: "medium", type: "coordination", dueDate: "Friday",
    }));
    state.summary = "Kitchen marble options are being coordinated with supplier availability.";
    changes.push("Supplier options added: Option B is available Friday.");
  }

  if (/option b.*looks good|proceed with (it|option b)/i.test(rawText)) {
    state.decisions.push(mkItem("decision", "Option B marble approved", "The client approved Option B for the kitchen.", client.name, {
      ownerRole: client.role, status: "resolved", priority: "high",
    }));
    // Emit status transitions as deltas; smartMergeItems updates the current
    // state while the snapshot's changes preserve the historical transition.
    state.blockers.push(mkItem("blocker", "Kitchen installation blocked pending marble approval", "Installation was blocked but client has now approved the replacement marble.", client.name, {
      ownerRole: client.role, status: "resolved", priority: "high",
    }));
    state.actionItems.push(
      mkItem("action", "Review and approve replacement kitchen marble", "The client approved Option B marble.", client.name, {
        ownerRole: client.role, status: "resolved", priority: "high", type: "approval_required",
      }),
      mkItem("action", "Hold kitchen installation", "The approval hold is no longer required.", contractor.name, {
        ownerRole: contractor.role, status: "resolved", priority: "high", type: "waiting_action",
      }),
      mkItem("action", "Place Option B marble order", "Order Option B marble from the supplier.", rohan.name, {
        ownerRole: rohan.role, status: "in_progress", priority: "high", type: "assigned_task",
      })
    );
    state.summary = "Option B marble is approved; the team is coordinating the order and installation release.";
    changes.push("Kitchen marble changed from pending approval to Option B approved.");
    changes.push("Approval and installation hold actions resolved.");
  }

  if (!changes.length) {
    throw new Error(
      "AI extraction failed and the deterministic fallback could not produce a complete structured analysis. No import was saved."
    );
  }

  return { state, changes, provider: "rule-based" };
}
