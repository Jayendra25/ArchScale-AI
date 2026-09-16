"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Message, ProjectState } from "@/lib/types";
import { StateCard } from "./StateCards";

export function Dashboard({
  state,
  messages,
  onSource,
  projectId,
}: {
  state: ProjectState | null;
  messages: Message[];
  onSource: (m: Message) => void;
  projectId: string;
}) {
  if (!state)
    return (
      <section className="empty">
        <h2 style={{ color: "var(--ink)" }}>Your project intelligence starts here</h2>
        <p>
          Import a conversation or load the Sharma Residence scenario to build a
          live project record.
        </p>
        <Link className="button" href={`/projects/${projectId}/import`}>
          Import communication
        </Link>
      </section>
    );

  const open = (a: { status: string }[]) =>
    a.filter((x) => x.status !== "resolved").length;

  const stats = [
    ["Action items", open(state.actionItems ?? []), ""],
    ["Pending decisions", open(state.pendingDecisions ?? []), "amber"],
    ["Blockers", open(state.blockers ?? []), "coral"],
    ["Recent updates", (state.updates ?? []).length, ""],
    ["Risks", open(state.risks ?? []), "coral"],
  ] as [string, number, string][];

  return (
    <>
      <div className="stats">
        {stats.map(([l, n, c]) => (
          <div className={`stat ${c}`} key={l}>
            <div className="stat-num">{n}</div>
            <div className="stat-label">{l}</div>
          </div>
        ))}
      </div>

      {(state.conflicts ?? [])
        .filter((c) => c.status !== "resolved")
        .map((c) => {
          const a = messages.find((m) => m.id === c.sideA?.sourceMessageId);
          const b = messages.find((m) => m.id === c.sideB?.sourceMessageId);
          return (
            <section className="card conflict" key={c.id}>
              <div className="row">
                <AlertTriangle size={19} color="#c15438" />
                <h3>Conflict detected · {c.topic}</h3>
              </div>
              <div className="split">
                <div className="quote">
                  "{c.sideA?.statement}"
                  <br />
                  <button
                    className="linkbutton"
                    onClick={() => a && onSource(a)}
                  >
                    {c.sideA?.owner} · View source
                  </button>
                </div>
                <div className="quote">
                  "{c.sideB?.statement}"
                  <br />
                  <button
                    className="linkbutton"
                    onClick={() => b && onSource(b)}
                  >
                    {c.sideB?.owner} · View source
                  </button>
                </div>
              </div>
              <p className="sub" style={{ marginBottom: 0 }}>
                <strong>Recommended:</strong> {c.recommendedAction}
              </p>
            </section>
          );
        })}

      {/* People & Responsibilities Section */}
      {state.actionItems && state.actionItems.filter((x) => x.status !== "resolved").length > 0 && (
        <section className="card wide" style={{ marginBottom: 24 }}>
          <h2>People & Responsibilities</h2>
          {(() => {
            // Group action items by owner
            const byOwner = new Map<string, { role?: string; items: typeof state.actionItems }>();
            state.actionItems
              .filter((x) => x.status !== "resolved")
              .forEach((item) => {
                const owner = item.owner || "Unassigned";
                if (!byOwner.has(owner)) {
                  byOwner.set(owner, { role: item.ownerRole, items: [] });
                }
                byOwner.get(owner)!.items.push(item);
              });

            return Array.from(byOwner.entries()).map(([owner, { role, items }]) => (
              <div key={owner} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                  {role ? `${role} — ${owner}` : owner}
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ink)" }}>
                  {items.map((item) => (
                    <li key={item.id} style={{ marginBottom: 4, fontSize: 14 }}>
                      {item.title}
                      {item.dueDate && (
                        <span style={{ color: "var(--amber)", marginLeft: 8, fontSize: 13 }}>
                          (Due: {item.dueDate})
                        </span>
                      )}
                      {item.status === "waiting" && item.dependencies && item.dependencies.length > 0 && (
                        <span style={{ color: "var(--ink-light)", marginLeft: 8, fontSize: 13 }}>
                          (Waiting for: {item.dependencies[0]})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ));
          })()}
        </section>
      )}

      <div className="grid">
        <StateCard
          title="Current blockers"
          items={(state.blockers ?? []).filter((x) => x.status !== "resolved")}
          messages={messages}
          onSource={onSource}
        />
        <StateCard
          title="Action items"
          items={(state.actionItems ?? []).filter((x) => x.status !== "resolved")}
          messages={messages}
          onSource={onSource}
        />
        <StateCard
          title="Pending decisions"
          items={(state.pendingDecisions ?? []).filter((x) => x.status !== "resolved")}
          messages={messages}
          onSource={onSource}
        />
        <section className="card wide">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Recent changes</h2>
            <Link
              href={`/projects/${projectId}/changes`}
              className="linkbutton"
            >
              View timeline <ArrowRight size={13} />
            </Link>
          </div>
          {(state.updates ?? []).length ? (
            (state.updates ?? [])
              .slice(-3)
              .reverse()
              .map((x) => (
                <div className="item" key={x.id}>
                  <CheckCircle2
                    size={16}
                    color="#077d79"
                    style={{ verticalAlign: "middle", marginRight: 7 }}
                  />
                  <span className="item-title">{x.title}</span>
                  <div className="item-text" style={{ marginLeft: 24 }}>
                    {x.description}
                  </div>
                </div>
              ))
          ) : (
            <p className="sub">Updates will appear after your next import.</p>
          )}
        </section>
        <StateCard
          title="Risks to watch"
          items={(state.risks ?? []).filter((x) => x.status !== "resolved")}
          messages={messages}
          onSource={onSource}
        />
      </div>
    </>
  );
}
