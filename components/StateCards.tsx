"use client";
import type { Item, Message } from "@/lib/types";

export function StateCard({
  title,
  items,
  messages,
  onSource,
}: {
  title: string;
  items: Item[];
  messages: Message[];
  onSource: (m: Message) => void;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {items.length ? (
        items.slice(0, 4).map((x) => {
          const m = messages.find((m) => m.id === x.sourceMessageId);
          return (
            <div className="item" key={x.id}>
              <div className="item-title">{x.title}</div>
              {x.owner && (
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--primary)",
                    marginTop: 4,
                    marginBottom: 6,
                  }}
                >
                  Owner: {x.owner}
                  {x.ownerRole && (
                    <span style={{ color: "var(--ink-light)", fontWeight: 400 }}>
                      {" "}
                      — {x.ownerRole}
                    </span>
                  )}
                </div>
              )}
              <div className="item-text">{x.description}</div>
              <div className="meta">
                <span className={`pill ${x.status === "open" ? "open" : x.status}`}>
                  {x.status.replace("_", " ")}
                </span>
                {x.type && (
                  <span className="sub" style={{ fontSize: 12 }}>
                    {x.type.replace(/_/g, " ")}
                  </span>
                )}
                {x.priority && (
                  <span
                    className={`pill ${x.priority === "high" ? "coral" : ""}`}
                    style={{ fontSize: 11 }}
                  >
                    {x.priority}
                  </span>
                )}
                {x.dueDate && (
                  <span className="sub" style={{ fontSize: 12, color: "var(--amber)" }}>
                    Due: {x.dueDate}
                  </span>
                )}
                {x.dependencies && x.dependencies.length > 0 && (
                  <span className="sub" style={{ fontSize: 12 }}>
                    Waiting for: {x.dependencies[0]}
                  </span>
                )}
                {m && (
                  <button className="linkbutton" onClick={() => onSource(m)}>
                    View source
                  </button>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <p className="sub">Nothing to show yet.</p>
      )}
    </section>
  );
}
