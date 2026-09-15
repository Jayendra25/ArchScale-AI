/**
 * AI-powered extraction of structured project state from raw communication text.
 * Uses Gemini (primary) → Groq (fallback) → rule-based regex (last resort).
 */

import { callLLM, parseLLMJson } from "./client";
import type { ProjectState, Message } from "@/lib/types";
import { emptyState } from "@/lib/types";

const SYSTEM_PROMPT = `You are a construction project intelligence assistant. Analyze raw project communication (WhatsApp messages, emails, meeting transcripts) and extract structured project state.

Return ONLY valid JSON matching this exact schema — no extra text, no markdown fences:

{
  "summary": "string — 1–2 sentence summary of the current project situation",
  "decisions": [{"title": "string", "description": "string", "owner": "string", "priority": "low|medium|high"}],
  "actionItems": [{"title": "string", "description": "string", "owner": "string", "status": "open|in_progress|blocked|resolved", "priority": "low|medium|high"}],
  "pendingDecisions": [{"title": "string", "description": "string", "owner": "string", "priority": "low|medium|high"}],
  "blockers": [{"title": "string", "description": "string", "owner": "string", "status": "open|blocked|resolved", "priority": "low|medium|high"}],
  "risks": [{"title": "string", "description": "string", "owner": "string", "priority": "low|medium|high"}],
  "deadlines": [{"title": "string", "description": "string", "owner": "string"}],
  "updates": [{"title": "string", "description": "string", "owner": "string"}],
  "conflicts": [{"topic": "string", "sideA": {"statement": "string", "owner": "string"}, "sideB": {"statement": "string", "owner": "string"}, "recommendedAction": "string"}],
  "people": [{"name": "string", "role": "string"}],
  "changes": ["string — plain-English description of what changed in this batch"]
}

Rules:
- Only extract information explicitly present in the text
- owner fields should be person names from the text
- changes array must list only NEW things found in THIS batch (not prior history)
- If something was previously blocked but is now resolved, note it in changes
- Keep all arrays empty [] if nothing relevant found — never fabricate data`;

export type ExtractionResult = {
  state: Partial<ProjectState>;
  changes: string[];
  provider: string;
};

/**
 * Extract structured project state from raw communication text using AI.
 * Falls back to a minimal rule-based pass if both AI providers fail.
 */
export async function extractFromText(
  rawText: string,
  priorState: ProjectState | null
): Promise<ExtractionResult> {
  const userPrompt = priorState
    ? `Prior project state summary: ${priorState.summary}\n\nNew communication to analyze:\n\n${rawText}`
    : `Communication to analyze (first import for this project):\n\n${rawText}`;

  console.log("[Extraction] Starting AI extraction...");
  const { text, provider } = await callLLM(SYSTEM_PROMPT, userPrompt);

  if (provider !== "none" && text) {
    const parsed = parseLLMJson<ExtractionResult & { changes: string[] }>(text);
    if (parsed && typeof parsed === "object") {
      console.log(`[Extraction] ✓ AI extraction succeeded via ${provider}`);
      const { changes: aiChanges, ...stateFields } = parsed;
      return {
        state: stateFields as Partial<ProjectState>,
        changes: aiChanges ?? ["New communication imported."],
        provider,
      };
    }
    console.warn("[Extraction] AI returned non-parseable JSON, using rule-based fallback");
  } else {
    console.warn("[Extraction] Both AI providers failed, using rule-based fallback");
  }

  // Rule-based fallback (preserves existing behavior)
  return ruleBasedExtraction(rawText, priorState);
}

/**
 * Rule-based extraction — the original regex logic, preserved as a fallback.
 */
function ruleBasedExtraction(
  rawText: string,
  priorState: ProjectState | null
): ExtractionResult {
  const { emptyState: es } = require("@/lib/types");
  const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
  const stamp = () => new Date().toISOString();

  const prior = priorState ? { ...priorState } : { ...emptyState };
  const state: ProjectState = JSON.parse(JSON.stringify(prior));
  const changes: string[] = [];
  const all = rawText.toLowerCase();

  // Simplified item factory
  const mkItem = (kind: string, title: string, desc: string, owner: string, status: "open" | "in_progress" | "resolved" | "blocked" = "open", priority: "low" | "medium" | "high" = "medium") => ({
    id: uid(kind), title, description: desc, status, priority, owner,
    source: "whatsapp" as const, sourceMessageId: uid("msg"),
    timestamp: stamp(), relatedTopics: [] as string[], dependencies: [] as string[],
  });

  if (/do not want|reject/.test(all) && /marble/.test(all)) {
    if (!state.blockers.some(x => x.title.includes("installation"))) {
      state.blockers.push(mkItem("blocker", "Kitchen installation waiting on approval", "Original kitchen marble was rejected.", "Priya Sharma", "blocked", "high"));
      state.pendingDecisions.push(mkItem("pending", "Kitchen marble selection", "Choose an approved alternate marble option.", "Priya Sharma", "open", "high"));
      changes.push("Kitchen marble was rejected; installation is now blocked pending client approval.");
    }
  }

  if (/option b/.test(all) && /friday/.test(all)) {
    state.updates.push(mkItem("update", "Option B available Friday", "Supplier can make Option B available Friday.", "StoneWorks Supplier"));
    changes.push("Supplier options added: Option B is available Friday.");
  }

  if (/option b.*looks good|proceed with (it|option b)/i.test(rawText)) {
    state.blockers.forEach(x => { if (x.title.includes("Kitchen installation")) x.status = "resolved"; });
    state.decisions.push(mkItem("decision", "Option B marble approved", "Client approved Option B for the kitchen.", "Priya Sharma", "resolved", "high"));
    changes.push("Kitchen marble changed from pending approval to Option B approved.");
  }

  if (!changes.length) {
    changes.push("New communication was added to the project timeline.");
  }

  state.summary = state.blockers.some(x => x.status !== "resolved")
    ? "Kitchen delivery and installation are being coordinated around the client's marble approval."
    : state.decisions.length
    ? "Option B has been approved for the kitchen; the team is coordinating delivery."
    : "Project communication is being monitored for decisions, work and risks.";

  return { state, changes, provider: "rule-based" };
}
