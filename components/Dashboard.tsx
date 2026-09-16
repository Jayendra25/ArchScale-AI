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
      <section className="empty px-4 py-10 sm:px-6">
        <h2 className="text-xl sm:text-2xl" style={{ color: "var(--ink)" }}>
          Your project intelligence starts here
        </h2>
        <p className="mt-2 max-w-prose text-sm sm:text-base">
          Import a conversation or load the Sharma Residence scenario to build a
          live project record.
        </p>
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

  const openActionItems = (state.actionItems ?? []).filter(
    (x) => x.status !== "resolved"
  );

  return (
    <div className="w-full min-w-0">
      {/* Stats: 2 up on phones, 3 on tablets, all 5 on desktop */}
      <div className="stats grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {stats.map(([l, n, c]) => (
          <div className={`stat ${c} min-w-0`} key={l}>
            <div className="stat-num text-2xl sm:text-3xl">{n}</div>
            <div className="stat-label truncate text-xs sm:text-sm">{l}</div>
          </div>
        ))}
      </div>

      {(state.conflicts ?? [])
        .filter((c) => c.status !== "resolved")
        .map((c) => {
          const a = messages.find((m) => m.id === c.sideA?.sourceMessageId);
          const b = messages.find((m) => m.id === c.sideB?.sourceMessageId);
          return (
            <section className="card conflict mt-4 min-w-0 lg:mt-6" key={c.id}>
              <div className="row flex items-start gap-2">
                <AlertTriangle
                  size={19}
                  color="#E0563A"
                  className="mt-[3px] shrink-0"
                />
                <h3 className="min-w-0 break-words text-base sm:text-lg">
                  Conflict detected · {c.topic}
                </h3>
              </div>

              {/* Stack the two sides on phones, side by side from md up */}
              <div className="split mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                <div className="quote min-w-0 break-words">
                  "{c.sideA?.statement}"
                  <br />
                  <button
                    className="linkbutton mt-1 text-left"
                    onClick={() => a && onSource(a)}
                  >
                    {c.sideA?.owner} · View source
                  </button>
                </div>
                <div className="quote min-w-0 break-words">
                  "{c.sideB?.statement}"
                  <br />
                  <button
                    className="linkbutton mt-1 text-left"
                    onClick={() => b && onSource(b)}
                  >
                    {c.sideB?.owner} · View source
                  </button>
                </div>
              </div>

              <p className="sub mb-0 mt-3 break-words">
                <strong>Recommended:</strong> {c.recommendedAction}
              </p>
            </section>
          );
        })}

      {/* People & Responsibilities */}
      {openActionItems.length > 0 && (
        <section className="card wide mt-4 min-w-0 lg:mt-6">
          <h2 className="text-base sm:text-lg">People &amp; Responsibilities</h2>

          {(() => {
            const byOwner = new Map<
              string,
              { role?: string; items: typeof openActionItems }
            >();

            openActionItems.forEach((item) => {
              const owner = item.owner || "Unassigned";
              if (!byOwner.has(owner)) {
                byOwner.set(owner, { role: item.ownerRole, items: [] });
              }
              byOwner.get(owner)!.items.push(item);
            });

            return (
              <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from(byOwner.entries()).map(
                  ([owner, { role, items }]) => (
                    <div key={owner} className="min-w-0">
                      <div
                        className="mb-1.5 break-words text-sm font-semibold sm:text-[15px]"
                        style={{ color: "var(--ink)" }}
                      >
                        {role ? `${role} — ${owner}` : owner}
                      </div>
                      <ul
                        className="m-0 list-disc pl-5"
                        style={{ color: "var(--ink)" }}
                      >
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="mb-1 break-words text-[13px] leading-relaxed sm:text-sm"
                          >
                            {item.title}
                            {item.dueDate && (
                              <span
                                className="ml-2 whitespace-nowrap text-[13px]"
                                style={{ color: "var(--amber)" }}
                              >
                                (Due: {item.dueDate})
                              </span>
                            )}
                            {item.status === "waiting" &&
                              item.dependencies &&
                              item.dependencies.length > 0 && (
                                <span
                                  className="ml-2 text-[13px]"
                                  style={{ color: "var(--ink-light)" }}
                                >
                                  (Waiting for: {item.dependencies[0]})
                                </span>
                              )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            );
          })()}
        </section>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6">
        <StateCard
          title="Current blockers"
          items={(state.blockers ?? []).filter((x) => x.status !== "resolved")}
          messages={messages}
          onSource={onSource}
        />
        <StateCard
          title="Action items"
          items={openActionItems}
          messages={messages}
          onSource={onSource}
        />
        <StateCard
          title="Pending decisions"
          items={(state.pendingDecisions ?? []).filter(
            (x) => x.status !== "resolved"
          )}
          messages={messages}
          onSource={onSource}
        />

        <section className="card min-w-0 md:col-span-2">
          {/* gap + shrink-0 + nowrap stops "View timeline →" breaking onto its own line */}
          <div className="row flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="min-w-0 text-base sm:text-lg">Recent changes</h2>
            <Link
              href={`/projects/${projectId}/changes`}
              className="linkbutton inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
            >
              View timeline <ArrowRight size={13} className="shrink-0" />
            </Link>
          </div>

          {(state.updates ?? []).length ? (
            <div className="mt-2 max-w-[70ch]">
              {(state.updates ?? [])
                .slice(-3)
                .reverse()
                .map((x) => (
                  <div className="item min-w-0" key={x.id}>
                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        size={16}
                        color="#6D5DFC"
                        className="mt-1 shrink-0"
                      />
                      <span className="item-title min-w-0 break-words">
                        {x.title}
                      </span>
                    </div>
                    <div className="item-text ml-6 break-words">
                      {x.description}
                    </div>
                  </div>
                ))}
            </div>
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

      {/* Responsive overrides for the existing global classes (.stats, .card,
          .row, .split, etc). These win over older fixed-width rules of the
          same name because styled-jsx's scoped hash raises specificity —
          delete the old conflicting rules from globals.css if you still see
          issues, particularly any grid-template-columns or min-width set on
          .stats, .split, or .card there. */}
      <style jsx global>{`
        .page,
        main {
          width: 100%;
          min-width: 0;
          overflow-x: hidden;
          padding-inline: 16px;
        }
        @media (min-width: 768px) {
          .page,
          main {
            padding-inline: 24px;
          }
        }
        @media (min-width: 1280px) {
          .page,
          main {
            padding-inline: 32px;
            max-width: 1440px;
            margin-inline: auto;
          }
        }
        .stats {
          display: grid;
          min-width: 0;
        }
        .stat {
          min-width: 0;
          padding: 14px 16px;
        }
        .split {
          display: grid;
          min-width: 0;
        }
        .card {
          min-width: 0;
          padding: 18px;
          overflow-wrap: anywhere;
        }
        @media (min-width: 768px) {
          .card {
            padding: 24px;
          }
        }
        .row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .linkbutton {
          white-space: nowrap;
        }
        .item-text,
        .sub {
          max-width: 70ch;
          overflow-wrap: anywhere;
        }
        .card table,
        .card pre {
          display: block;
          max-width: 100%;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}