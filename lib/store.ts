/**
 * DB-backed store — replaces the old in-memory store.
 * All functions now accept a projectId and persist to Neon via Prisma.
 */

import { prisma } from "./prisma";
import { extractFromText } from "./ai/extraction";
import { callLLM, parseLLMJson } from "./ai/client";
import { emptyState, type Source, type Message, type Snapshot, type ProjectState } from "./types";
import { demoImports } from "./demoData";

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

function dbMessageToMessage(m: {
  id: string; source: string; sender: string; content: string;
  timestamp: Date; tags: string[]; label: string | null;
}): Message {
  return {
    id: m.id,
    source: m.source as Source,
    sender: m.sender,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    tags: m.tags,
    label: m.label ?? undefined,
  };
}

function dbSnapshotToSnapshot(s: {
  id: string; createdAt: Date; state: unknown; changes: string[];
}): Snapshot {
  return {
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    state: s.state as ProjectState,
    changes: s.changes,
  };
}

// ---------------------------------------------------------------------------
// getData — fetch all messages + snapshots for a project
// ---------------------------------------------------------------------------

export async function getData(projectId: string): Promise<{
  messages: Message[];
  snapshots: Snapshot[];
}> {
  const [dbMessages, dbSnapshots] = await Promise.all([
    prisma.message.findMany({
      where: { projectId },
      orderBy: { timestamp: "asc" },
    }),
    prisma.projectStateSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    messages: dbMessages.map(dbMessageToMessage),
    snapshots: dbSnapshots.map(dbSnapshotToSnapshot),
  };
}

// ---------------------------------------------------------------------------
// parseMessages — parse raw text into message objects (helper, no DB write)
// ---------------------------------------------------------------------------

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

function sourceFromText(text: string, fallback: Source): Source {
  return /whatsapp/i.test(text) ? "whatsapp"
    : /meeting transcript/i.test(text) ? "meeting"
    : /from:|subject:/i.test(text) ? "email"
    : fallback;
}

function parseSender(line: string): string {
  const m = line.match(/(?:\]\s*)?([^:\n]+?)(?:\s*\([^)]*\))?\s*:/);
  return m?.[1]?.replace(/^From\s*/i, "").trim() || "Project team";
}

export function parseMessages(rawText: string, source: Source, label?: string): Message[] {
  const chunks = rawText
    .split(/\n(?=(?:\[\d|From:|Meeting transcript|WhatsApp|[A-Z][^\n:]{1,30}(?:\s*\([^)]*\))?:))/)
    .map(x => x.trim())
    .filter(Boolean);
  return chunks.map((content, i) => ({
    id: uid("msg"),
    source: sourceFromText(content, source),
    sender: parseSender(content),
    content,
    timestamp: new Date(Date.now() + i).toISOString(),
    tags: [],
    label,
  }));
}

// ---------------------------------------------------------------------------
// ingest — parse + extract + persist to DB
// ---------------------------------------------------------------------------

export async function ingest(
  projectId: string,
  rawText: string,
  source: Source,
  label?: string
): Promise<{ state: ProjectState; changes: string[]; messages: Message[] }> {
  console.log(`[ingest] Starting for project ${projectId}, source=${source}`);

  // Parse raw text into message objects
  const parsedMessages = parseMessages(rawText, source, label);
  console.log(`[ingest] Parsed ${parsedMessages.length} messages`);

  // Get prior project state for context
  const priorSnapshot = await prisma.projectStateSnapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const priorState = priorSnapshot ? (priorSnapshot.state as ProjectState) : null;

  // AI extraction (Gemini → Groq → rule-based)
  console.log("[ingest] Running AI extraction...");
  let extractedState: ProjectState;
  let changes: string[];
  let extractionProvider: string;

  try {
    const result = await extractFromText(rawText, priorState);
    const partial = result.state as Partial<ProjectState>;

    // Merge AI result with prior state (AI returns only what changed)
    const base = priorState ? { ...priorState } : { ...emptyState };
    extractedState = {
      summary: partial.summary ?? base.summary,
      decisions: [...(base.decisions ?? []), ...(partial.decisions ?? [])],
      actionItems: [...(base.actionItems ?? []), ...(partial.actionItems ?? [])],
      pendingDecisions: [...(base.pendingDecisions ?? []), ...(partial.pendingDecisions ?? [])],
      blockers: [...(base.blockers ?? []), ...(partial.blockers ?? [])],
      risks: [...(base.risks ?? []), ...(partial.risks ?? [])],
      deadlines: [...(base.deadlines ?? []), ...(partial.deadlines ?? [])],
      updates: [...(base.updates ?? []), ...(partial.updates ?? [])],
      conflicts: [...(base.conflicts ?? []), ...(partial.conflicts ?? [])],
      people: partial.people?.length ? partial.people.map(p => ({
        name: p.name, role: (p as any).role ?? "Team member", openItems: [],
      })) : base.people ?? [],
    };
    changes = result.changes;
    extractionProvider = result.provider;
    console.log(`[ingest] Extraction via ${extractionProvider}: ${changes.length} changes`);
  } catch (err) {
    console.error("[ingest] Extraction error:", err);
    extractedState = priorState ? { ...priorState } : { ...emptyState };
    changes = ["New communication added to project timeline."];
    extractionProvider = "error-fallback";
  }

  // Persist to DB in a transaction
  console.log("[ingest] Writing to DB...");
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create import batch
      const batch = await tx.importBatch.create({
        data: { projectId, label: label ?? null, source },
      });

      // Persist messages
      await tx.message.createMany({
        data: parsedMessages.map(m => ({
          id: m.id,
          projectId,
          batchId: batch.id,
          source: m.source,
          sender: m.sender,
          content: m.content,
          timestamp: new Date(m.timestamp),
          tags: m.tags,
          label: m.label ?? null,
        })),
      });

      // Persist snapshot
      const snapshot = await tx.projectStateSnapshot.create({
        data: {
          projectId,
          batchId: batch.id,
          state: extractedState as object,
          changes,
        },
      });

      return { batch, snapshot };
    });

    console.log(`[ingest] ✓ DB write complete. BatchId=${result.batch.id}`);
  } catch (dbErr) {
    console.error("[ingest] DB write error:", dbErr);
    throw new Error("Failed to save import to database: " + (dbErr instanceof Error ? dbErr.message : String(dbErr)));
  }

  return { state: extractedState, changes, messages: parsedMessages };
}

// ---------------------------------------------------------------------------
// seedNext — load next demo import batch into a project
// ---------------------------------------------------------------------------

export async function seedNext(projectId: string): Promise<{ done: boolean; state?: ProjectState; changes?: string[] }> {
  const batchCount = await prisma.importBatch.count({ where: { projectId } });
  if (batchCount >= 3) return { done: true };

  const demo = demoImports[batchCount];
  const result = await ingest(projectId, demo.rawText, demo.source, demo.label);
  return { done: false, state: result.state, changes: result.changes };
}

// ---------------------------------------------------------------------------
// answer — ask a question grounded in project data
// ---------------------------------------------------------------------------

export async function answer(
  projectId: string,
  question: string
): Promise<{ answer: string; sources: { messageId: string; snippet: string }[] }> {
  const { messages, snapshots } = await getData(projectId);
  const state = snapshots.at(-1)?.state ?? null;

  if (!state) {
    return {
      answer: "There is no project data yet — import communication first.",
      sources: [],
    };
  }

  const q = question.toLowerCase();
  const relevant = messages
    .filter(m => q.split(/\W+/).filter(w => w.length > 3).some(w => m.content.toLowerCase().includes(w)))
    .slice(-4);
  const sources = (relevant.length ? relevant : messages.slice(-3)).map(m => ({
    messageId: m.id,
    snippet: m.content.slice(0, 125),
  }));

  // Try AI-powered answer first
  const systemPrompt = `You are a project intelligence assistant. Answer questions about this construction project based ONLY on the provided context. Be concise (2–4 sentences). If you cannot answer from the context, say so clearly.`;

  const contextSummary = `Project state: ${state.summary}
Blockers: ${JSON.stringify(state.blockers?.filter(x => x.status !== "resolved").slice(0, 3) ?? [])}
Decisions: ${JSON.stringify(state.decisions?.slice(-3) ?? [])}
Action items: ${JSON.stringify(state.actionItems?.filter(x => x.status !== "resolved").slice(0, 3) ?? [])}
Recent messages: ${messages.slice(-5).map(m => `[${m.sender}]: ${m.content.slice(0, 200)}`).join("\n")}`;

  const userPrompt = `Context:\n${contextSummary}\n\nQuestion: ${question}`;

  const { text, provider } = await callLLM(systemPrompt, userPrompt);
  if (provider !== "none" && text) {
    const parsed = parseLLMJson<{ answer: string }>(text);
    const answerText = parsed?.answer ?? text;
    console.log(`[answer] Answered via ${provider}`);
    return { answer: answerText, sources };
  }

  // Rule-based fallback answers
  if (/why.*delay|delayed|installation/.test(q)) {
    return { answer: "Kitchen installation was delayed because the client rejected the original marble and asked the team not to start until an alternative was approved. Option B has since been approved, pending delivery confirmation.", sources };
  }
  if (/marble|option/.test(q)) {
    return { answer: "The client approved Option B for the kitchen. The supplier indicated it can be available Friday; the architect is to order it and confirm delivery before releasing installation.", sources };
  }
  return {
    answer: `Based on the project record: ${state.summary} ${
      (state.blockers ?? []).filter(x => x.status !== "resolved").length
        ? "There are still open coordination items to monitor."
        : "The main approval blocker has been resolved."
    }`,
    sources,
  };
}
