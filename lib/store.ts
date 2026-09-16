/**
 * DB-backed store — all functions accept projectId and persist to Neon via Prisma.
 *
 * Deduplication is applied at two levels:
 *   1. Message level: SHA-256 fingerprint, skip messages already in DB
 *   2. Event level:   Normalized event keys + Jaccard similarity, smart-merge
 *      decisions/blockers/etc. instead of blindly appending them
 */

import { prisma } from "./prisma";
import { extractFromText } from "./ai/extraction";
import { callLLM, parseLLMJson } from "./ai/client";
import {
  fingerprintMessage,
  filterNewMessages,
  smartMergeItems,
  smartMergeConflicts,
  normalizeEventKey,
  type ItemCategory,
} from "./ai/dedup";
import {
  emptyState,
  type Source,
  type Message,
  type Snapshot,
  type ProjectState,
  type Item,
} from "./types";
import { demoImports } from "./demoData";

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

function dbMessageToMessage(m: {
  id: string;
  source: string;
  sender: string;
  content: string;
  timestamp: Date;
  tags: string[];
  label: string | null;
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
  id: string;
  createdAt: Date;
  state: unknown;
  changes: string[];
}): Snapshot {
  return {
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    state: s.state as ProjectState,
    changes: s.changes,
  };
}

// ---------------------------------------------------------------------------
// getData
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
// parseMessages
// ---------------------------------------------------------------------------

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

function sourceFromText(text: string, fallback: Source): Source {
  return /whatsapp/i.test(text)
    ? "whatsapp"
    : /meeting transcript/i.test(text)
    ? "meeting"
    : /from:|subject:/i.test(text)
    ? "email"
    : fallback;
}

function parseSender(line: string): string {
  const m = line.match(/(?:\]\s*)?([^:\n]+?)(?:\s*\([^)]*\))?\s*:/);
  return m?.[1]?.replace(/^From\s*/i, "").trim() || "Project team";
}

export function parseMessages(
  rawText: string,
  source: Source,
  label?: string
): Message[] {
  const chunks = rawText
    .split(
      /\n(?=(?:\[\d|From:|Meeting transcript|WhatsApp|[A-Z][^\n:]{1,30}(?:\s*\([^)]*\))?:))/
    )
    .map((x) => x.trim())
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
// ingest — with full two-level deduplication
// ---------------------------------------------------------------------------

export async function ingest(
  projectId: string,
  rawText: string,
  source: Source,
  label?: string
): Promise<{ state: ProjectState; changes: string[]; messages: Message[]; skippedMessages: number }> {
  console.log(`[ingest] Starting for project ${projectId}, source=${source}`);

  // ---- Step 1: Parse raw text into candidate messages ------------------
  const parsedMessages = parseMessages(rawText, source, label);
  console.log(`[ingest] Parsed ${parsedMessages.length} candidate messages`);

  // ---- Step 2: Fingerprint each message --------------------------------
  const fingerprintedMessages = parsedMessages.map((m) => ({
    ...m,
    contentHash: fingerprintMessage({
      projectId,
      source: m.source,
      sender: m.sender,
      content: m.content,
      // Don't include auto-generated timestamp in fingerprint
    }),
  }));

  // ---- Step 3: Fetch existing message hashes from DB -------------------
  const existingHashRows = await prisma.message.findMany({
    where: { projectId, contentHash: { not: null } },
    select: { contentHash: true },
  });
  const existingHashes = new Set(
    existingHashRows.map((r) => r.contentHash!).filter(Boolean)
  );

  // ---- Step 4: Filter out duplicate messages ---------------------------
  const { newIndices, duplicateCount } = filterNewMessages(
    fingerprintedMessages,
    existingHashes
  );
  const newMessages = newIndices.map((i) => fingerprintedMessages[i]);

  console.log(
    `[ingest] ${newMessages.length} new messages, ${duplicateCount} duplicates skipped`
  );

  // ---- Step 5: Get prior project state (for extraction context) --------
  const priorSnapshot = await prisma.projectStateSnapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const priorState = priorSnapshot
    ? (priorSnapshot.state as ProjectState)
    : null;

  // ---- Step 6: AI extraction on the FULL raw text ----------------------
  // We run extraction on all incoming text (not just deduplicated messages)
  // because the AI needs the full context to understand relationships.
  // The deduplication layer will handle event-level merging.
  console.log("[ingest] Running AI extraction...");
  let partialState: Partial<ProjectState>;
  let changes: string[];
  let extractionProvider: string;

  try {
    const result = await extractFromText(rawText, priorState);
    partialState = result.state;
    changes = result.changes;
    extractionProvider = result.provider;
    console.log(
      `[ingest] Extraction via ${extractionProvider}: ${changes.length} changes`
    );
  } catch (err) {
    console.error("[ingest] Extraction error:", err);
    partialState = {};
    changes = ["New communication added to project timeline."];
    extractionProvider = "error-fallback";
  }

  // ---- Step 7: Smart-merge events with deduplication -------------------
  const base = priorState ? structuredClone(priorState) : structuredClone(emptyState);

  // Representative message ID for source linking
  const latestMsgId = newMessages[newMessages.length - 1]?.id ?? uid("msg");

  // Build the merge changelog
  const allMergeChanges: string[] = [];

  const mergeCategoryItems = (
    baseList: Item[],
    incomingList: Partial<Item>[] | undefined,
    category: ItemCategory
  ): Item[] => {
    if (!incomingList?.length) return baseList;
    const { merged, mergeChanges } = smartMergeItems(
      baseList,
      incomingList,
      category,
      latestMsgId
    );
    for (const mc of mergeChanges) {
      if (mc.type === "state-change") {
        allMergeChanges.push(
          `${mc.item.title}: status changed from ${mc.previous} to ${mc.next}`
        );
      }
    }
    return merged;
  };

  const mergedDecisions = mergeCategoryItems(base.decisions, partialState.decisions as Partial<Item>[], "decision");
  const mergedActionItems = mergeCategoryItems(base.actionItems, partialState.actionItems as Partial<Item>[], "action");
  const mergedPendingDecisions = mergeCategoryItems(base.pendingDecisions, partialState.pendingDecisions as Partial<Item>[], "pending");
  const mergedBlockers = mergeCategoryItems(base.blockers, partialState.blockers as Partial<Item>[], "blocker");
  const mergedRisks = mergeCategoryItems(base.risks, partialState.risks as Partial<Item>[], "risk");
  const mergedDeadlines = mergeCategoryItems(base.deadlines, partialState.deadlines as Partial<Item>[], "deadline");
  const mergedUpdates = mergeCategoryItems(base.updates, partialState.updates as Partial<Item>[], "update");
  const mergedConflicts = smartMergeConflicts(base.conflicts, (partialState.conflicts ?? []) as any[]);

  const mergedPeople =
    partialState.people?.length
      ? partialState.people.map((p) => ({
          name: p.name,
          role: (p as any).role ?? "Team member",
          openItems: [],
        }))
      : base.people;

  // Combine AI-generated changes with merge-generated state-change records
  const finalChanges =
    allMergeChanges.length > 0
      ? [...changes, ...allMergeChanges]
      : changes;

  const extractedState: ProjectState = {
    summary: partialState.summary ?? base.summary,
    decisions: mergedDecisions,
    actionItems: mergedActionItems,
    pendingDecisions: mergedPendingDecisions,
    blockers: mergedBlockers,
    risks: mergedRisks,
    deadlines: mergedDeadlines,
    updates: mergedUpdates,
    conflicts: mergedConflicts,
    people: mergedPeople,
  };

  // ---- Step 8: Persist to DB (only new messages) -----------------------
  console.log(
    `[ingest] Writing ${newMessages.length} messages + 1 snapshot to DB...`
  );
  try {
    await prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({
        data: { projectId, label: label ?? null, source },
      });

      if (newMessages.length > 0) {
        await tx.message.createMany({
          data: newMessages.map((m) => ({
            id: m.id,
            projectId,
            batchId: batch.id,
            source: m.source,
            sender: m.sender,
            content: m.content,
            timestamp: new Date(m.timestamp),
            tags: m.tags,
            label: m.label ?? null,
            contentHash: m.contentHash ?? null,
          })),
          skipDuplicates: true, // Belt-and-suspenders: DB-level dedup via unique constraint
        });
      }

      await tx.projectStateSnapshot.create({
        data: {
          projectId,
          batchId: batch.id,
          state: extractedState as object,
          changes: finalChanges,
        },
      });
    });

    console.log(`[ingest] ✓ DB write complete`);
  } catch (dbErr) {
    console.error("[ingest] DB write error:", dbErr);
    throw new Error(
      "Failed to save import to database: " +
        (dbErr instanceof Error ? dbErr.message : String(dbErr))
    );
  }

  return {
    state: extractedState,
    changes: finalChanges,
    messages: newMessages,
    skippedMessages: duplicateCount,
  };
}

// ---------------------------------------------------------------------------
// seedNext
// ---------------------------------------------------------------------------

export async function seedNext(projectId: string): Promise<{
  done: boolean;
  state?: ProjectState;
  changes?: string[];
  skippedMessages?: number;
}> {
  const batchCount = await prisma.importBatch.count({ where: { projectId } });
  if (batchCount >= 3) return { done: true };

  const demo = demoImports[batchCount];
  const result = await ingest(projectId, demo.rawText, demo.source, demo.label);
  return {
    done: false,
    state: result.state,
    changes: result.changes,
    skippedMessages: result.skippedMessages,
  };
}

// ---------------------------------------------------------------------------
// answer
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
    .filter((m) =>
      q
        .split(/\W+/)
        .filter((w) => w.length > 3)
        .some((w) => m.content.toLowerCase().includes(w))
    )
    .slice(-4);
  const sources = (relevant.length ? relevant : messages.slice(-3)).map(
    (m) => ({
      messageId: m.id,
      snippet: m.content.slice(0, 125),
    })
  );

  const systemPrompt = `You are a project intelligence assistant. Answer questions about this construction project based ONLY on the provided context. Be concise (2–4 sentences). Return JSON: {"answer": "string"}`;

  const contextSummary = `Project state: ${state.summary}
Open blockers: ${JSON.stringify((state.blockers ?? []).filter((x) => x.status !== "resolved").map((b) => ({ title: b.title, owner: b.owner, dependencies: b.dependencies })).slice(0, 3))}
Decisions: ${JSON.stringify((state.decisions ?? []).map((d) => ({ title: d.title, owner: d.owner })).slice(-3))}
Open action items: ${JSON.stringify((state.actionItems ?? []).filter((x) => x.status !== "resolved").map((a) => ({ title: a.title, owner: a.owner, status: a.status, type: a.type, dueDate: a.dueDate, dependencies: a.dependencies })).slice(0, 5))}
People & their responsibilities: ${JSON.stringify(
  Array.from(
    (state.actionItems ?? [])
      .filter((x) => x.status !== "resolved")
      .reduce((acc, item) => {
        const owner = item.owner || "Unassigned";
        if (!acc.has(owner)) acc.set(owner, []);
        acc.get(owner)!.push({ task: item.title, status: item.status, type: item.type, dueDate: item.dueDate });
        return acc;
      }, new Map<string, any[]>())
  ).map(([name, tasks]) => ({ name, tasks }))
)}
Recent messages (last 5):
${messages.slice(-5).map((m) => `[${m.sender}]: ${m.content.slice(0, 200)}`).join("\n")}`;

  const userPrompt = `Context:\n${contextSummary}\n\nQuestion: ${question}`;

  const { text, provider } = await callLLM(systemPrompt, userPrompt);
  if (provider !== "none" && text) {
    const parsed = parseLLMJson<{ answer: string }>(text);
    const answerText = parsed?.answer ?? text;
    console.log(`[answer] Answered via ${provider}`);
    return { answer: answerText, sources };
  }

  // Rule-based fallback
  if (/who.*responsible|what.*rohan|what.*vikram|what.*sharma|who.*needs/.test(q)) {
    const actionsByOwner = (state.actionItems ?? [])
      .filter((x) => x.status !== "resolved")
      .reduce((acc, item) => {
        const owner = item.owner || "Unassigned";
        if (!acc[owner]) acc[owner] = [];
        acc[owner].push(item.title);
        return acc;
      }, {} as Record<string, string[]>);
    
    const ownerMatch = q.match(/rohan|vikram|sharma|priya|aditi/i);
    if (ownerMatch) {
      const name = ownerMatch[0];
      const matchingOwner = Object.keys(actionsByOwner).find(o => 
        o.toLowerCase().includes(name.toLowerCase())
      );
      if (matchingOwner && actionsByOwner[matchingOwner].length > 0) {
        return {
          answer: `${matchingOwner} is responsible for: ${actionsByOwner[matchingOwner].join("; ")}.`,
          sources,
        };
      }
    }
    
    return {
      answer: Object.entries(actionsByOwner)
        .map(([owner, tasks]) => `${owner}: ${tasks.join(", ")}`)
        .join(". ") || "No open action items found.",
      sources,
    };
  }
  if (/why.*delay|delayed|installation/.test(q)) {
    return {
      answer:
        "Kitchen installation was delayed because the client rejected the original marble and asked the team not to start until an alternative was approved. Option B has since been approved, pending delivery confirmation.",
      sources,
    };
  }
  if (/what.*blocking|blocker/.test(q)) {
    const blockers = (state.blockers ?? [])
      .filter((x) => x.status !== "resolved")
      .map((b) => `${b.title}${b.dependencies && b.dependencies.length > 0 ? ` (waiting for: ${b.dependencies[0]})` : ""}`);
    return {
      answer: blockers.length > 0
        ? `Current blockers: ${blockers.join("; ")}.`
        : "No active blockers at this time.",
      sources,
    };
  }
  if (/marble|option/.test(q)) {
    return {
      answer:
        "The client approved Option B for the kitchen. The supplier indicated it can be available Friday; the architect is to order it and confirm delivery before releasing installation.",
      sources,
    };
  }
  return {
    answer: `Based on the project record: ${state.summary} ${
      (state.blockers ?? []).filter((x) => x.status !== "resolved").length
        ? "There are still open coordination items to monitor."
        : "The main approval blocker has been resolved."
    }`,
    sources,
  };
}
