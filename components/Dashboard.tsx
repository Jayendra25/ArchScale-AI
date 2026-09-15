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
