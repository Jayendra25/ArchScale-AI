"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  Sparkles,
  MessageCircle,
  Mail,
  Mic,
  Send,
  LoaderCircle,
} from "lucide-react";
import { AppShell } from "./AppShell";
import { SourceDrawer } from "./SourceDrawer";
import { Dashboard } from "./Dashboard";
import LoadingScreen from "./LoadingScreen";
import { ImportCommunicationButton } from "./ImportCommunicationButton";
import type { Message, Snapshot, Source } from "@/lib/types";

export function ProjectClient({
  projectId,
  projectName,
  hasProjectData,
}: {
  projectId: string;
  projectName?: string;
  hasProjectData?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const view = pathname.endsWith("/inbox")
    ? "inbox"
    : pathname.endsWith("/import")
    ? "import"
    : pathname.endsWith("/changes")
    ? "changes"
    : pathname.endsWith("/ask")
    ? "ask"
    : "dashboard";
  const base = `/api/projects/${projectId}`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [drawer, setDrawer] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(projectName ?? "Project workspace");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/state`, { cache: "no-store" });
      const d = await r.json();
      setMessages(d.messages ?? []);
      setSnapshots(d.snapshots ?? []);
    } catch (err) {
      console.error("[ProjectClient] Failed to load state:", err);
    } finally {
      setLoading(false);
    }
  }, [base]);

  // Load project name from DB if not passed as prop
  useEffect(() => {
    if (!projectName) {
      fetch(`/api/projects/${projectId}/meta`)
        .then((r) => r.json())
        .then((d) => { if (d.name) setName(d.name); })
        .catch(() => {});
    }
  }, [projectId, projectName]);

  useEffect(() => {
    if (hasProjectData === false) {
      setLoading(false);
      return;
    }
    load();
  }, [hasProjectData, load]);

  const state = snapshots.at(-1)?.state ?? null;

  return (
    <AppShell projectId={projectId}>
      <ThemeVars />
      <header className="top">
        <div>
          <div className="project-label">Project workspace</div>
          <h1 className="title">{name}</h1>
          <p className="sub">
            {state?.summary ?? "A source-traceable record of project communication."}
          </p>
        </div>
        {view === "dashboard" && (
          <ImportCommunicationButton projectId={projectId} />
        )}
      </header>

      <div className={loading ? "loading" : ""}>
        {view === "dashboard" && (
          <Dashboard
            state={state}
            messages={messages}
            onSource={setDrawer}
            projectId={projectId}
          />
        )}
        {view === "inbox" && (
          <Inbox messages={messages} onSource={setDrawer} />
        )}
        {view === "import" && (
          <Import
            base={base}
            projectId={projectId}
            onComplete={load}
          />
        )}
        {view === "changes" && <Changes snapshots={snapshots} />}
        {view === "ask" && (
          <Ask base={base} messages={messages} onSource={setDrawer} />
        )}
      </div>

      <SourceDrawer message={drawer} onClose={() => setDrawer(null)} />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Theme — overrides the app's existing CSS variables and a few shared
// classNames (.button, .pill, .chip, .field inputs, etc.) with the modern
// violet/coral palette used on the home page. Rendered once here, inside
// AppShell, so it applies no matter which tab (dashboard/inbox/import/
// changes/ask) is active.
// ---------------------------------------------------------------------------
function ThemeVars() {
  return (
    <style jsx global>{`
      :root {
        --ink: #1c1b29;
        --ink-light: #6b7280;
        --amber: #d97706;
        --coral: #e0563a;
        --primary: #6d5dfc;
        --border: #e4e4ec;
        --bg: #f8f8fb;
      }

      .card {
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 14px;
        box-shadow: none;
      }

      .button {
        background: var(--primary);
        color: #fff;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        transition: background 0.15s ease, transform 0.12s ease;
      }
      .button:hover:not(:disabled) {
        background: #5b4ce0;
        transform: translateY(-1px);
      }
      .button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .linkbutton {
        color: var(--primary);
      }
      .linkbutton:hover {
        color: #5b4ce0;
      }

      .pill.open {
        background: rgba(109, 93, 252, 0.12);
        color: var(--primary);
        border-radius: 999px;
      }

      .chip {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: #fff;
        color: var(--ink);
      }
      .chip:hover {
        border-color: var(--primary);
        color: var(--primary);
      }

      .field input,
      .field select,
      .field textarea,
      .filters input,
      .filters select,
      .question input {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff;
      }
      .field input:focus-visible,
      .field select:focus-visible,
      .field textarea:focus-visible,
      .filters input:focus-visible,
      .filters select:focus-visible,
      .question input:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 1px;
      }

      .message,
      .stat,
      .answer.section {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: #fff;
      }

      .source-icon {
        color: var(--primary);
      }

      .loading-spinner {
        color: var(--primary);
      }
    `}</style>
  );
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------
function Inbox({
  messages,
  onSource,
}: {
  messages: Message[];
  onSource: (m: Message) => void;
}) {
  const [source, setSource] = useState("");
  const [person, setPerson] = useState("");
  const [search, setSearch] = useState("");
  const filtered = messages.filter(
    (m) =>
      (!source || m.source === source) &&
      (!person || m.sender.toLowerCase().includes(person.toLowerCase())) &&
      (!search ||
        (m.content + m.tags.join(" "))
          .toLowerCase()
          .includes(search.toLowerCase()))
  );
  const icons = { whatsapp: MessageCircle, email: Mail, meeting: Mic };

  return (
    <>
      <div className="filters">
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
        </select>
        <input
          placeholder="Filter by person"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        />
        <input
          placeholder="Search message or topic"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length ? (
        <div className="inbox">
          {filtered
            .slice()
            .reverse()
            .map((m) => {
              const Icon = icons[m.source];
              return (
                <article className="message" key={m.id}>
                  <span className="source-icon">
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="row">
                      <strong>{m.sender}</strong>
                      <span className="pill open">{m.source}</span>
                    </div>
                    <p className="message-content">{m.content}</p>
                    <span className="sub" style={{ fontSize: 12 }}>
                      {new Date(m.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <button className="linkbutton" onClick={() => onSource(m)}>
                    View source
                  </button>
                </article>
              );
            })}
        </div>
      ) : (
        <div className="empty">
          <h2>No communication yet</h2>
          <p>Imported messages will become a searchable source record here.</p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
function Import({
  base,
  projectId,
  onComplete,
}: {
  base: string;
  projectId: string;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("whatsapp");
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (!/\.txt$/i.test(file.name)) {
      setError("Please choose a .txt file; paste text for other formats.");
      return;
    }
    setError("");
    setText(await file.text());
    setLabel(file.name.replace(/\.txt$/i, ""));
  };

  const analyze = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, rawText: text, label }),
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(d.error || "Analysis failed — try again.");
      }
      // Success: reset form, reload state, navigate to dashboard
      setText("");
      setLabel("");
      await onComplete();
      router.push(`/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {busy && <LoadingScreen message="Analyzing communication..." />}
      <div className="import-grid">
      <section className="card">
        <div className="row">
          <span className="source-icon">
            <Upload size={18} />
          </span>
          <div>
            <h2
              style={{
                margin: 0,
                color: "var(--ink)",
                fontSize: 18,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              Bring in project communication
            </h2>
            <p className="sub" style={{ margin: "4px 0 0" }}>
              Paste WhatsApp, email, or a meeting transcript. It will
              update — not replace — your project state.
            </p>
          </div>
        </div>
        <div className="field">
          <label>Source type</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
          </select>
        </div>
        <div className="field">
          <label>Label (optional)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Site coordination — Sep 15"
          />
        </div>
        <div className="field">
          <label>Upload .txt or paste communication</label>
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => loadFile(e.target.files?.[0])}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste exported messages, an email, or transcript here…"
          />
        </div>
        {error && (
          <p style={{ color: "var(--coral)", fontSize: 13, margin: "0 0 10px" }}>
            {error}
          </p>
        )}
        <button
  className="button w-full sm:w-auto whitespace-nowrap"
  disabled={!text.trim() || busy}
  onClick={() => analyze()}
  id="analyze-btn"
>
  {busy ? (
    <>
      <LoaderCircle
        size={15}
        className="loading-spinner inline-block"
        style={{ marginRight: 7 }}
      />
      Detecting changes…
    </>
  ) : (
    <>
      <Sparkles
        size={15}
        className="inline-block"
        style={{ marginRight: 7 }}
      />
      Analyze communication
    </>
  )}
</button>
      </section>

      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------
function Changes({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 1)
    return (
      <div className="empty">
        <h2>No state comparison yet</h2>
        <p>Import another communication batch to see exactly what changed.</p>
      </div>
    );
  return (
    <div className="timeline">
      {snapshots
        .slice()
        .reverse()
        .map((s, i) => (
          <section className="card" key={s.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>
                Import {snapshots.length - i}{" "}
                <span
                  className="sub"
                  style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}
                >
                  · {new Date(s.createdAt).toLocaleString()}
                </span>
              </h2>
              {i === 0 && <span className="pill open">Latest</span>}
            </div>
            <div style={{ marginTop: 14 }}>
              {s.changes.map((c, j) => (
                <div className="change" key={j}>
                  <span className="check">✓</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ask
// ---------------------------------------------------------------------------
function Ask({
  base,
  messages,
  onSource,
}: {
  base: string;
  messages: Message[];
  onSource: (m: Message) => void;
}) {
  const [question, setQuestion] = useState(
    "Why was the kitchen installation delayed?"
  );
  const [answerText, setAnswerText] = useState<string | null>(null);
  const [sources, setSources] = useState<{ messageId: string; snippet: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ask = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to get answer.");
      setAnswerText(d.answer);
      setSources(d.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {busy && <LoadingScreen message="Thinking..." />}
      <div className="chat">
      <section className="card">
        <div className="row">
          <span className="source-icon">
            <Sparkles size={18} />
          </span>
          <div>
            <h2
              style={{
                margin: 0,
                color: "var(--ink)",
                fontSize: 18,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              Ask project intelligence
            </h2>
            <p className="sub" style={{ margin: "4px 0 0" }}>
              Answers are grounded only in imported project messages and state.
            </p>
          </div>
        </div>
        <div className="question">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask about a decision, risk or owner…"
            id="ask-input"
          />
          <button
            className="button"
            disabled={busy || !question.trim() || !messages.length}
            onClick={ask}
            id="ask-submit"
          >
            {busy ? <LoaderCircle size={17} className="loading-spinner" /> : <Send size={17} />}
          </button>
        </div>
        {!messages.length && (
          <p className="sub" style={{ marginTop: 10 }}>
            No project data yet — import communication first.
          </p>
        )}
        {error && (
          <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{error}</p>
        )}
      </section>
      {answerText && (
        <section className="answer section">
          <strong>Grounded answer</strong>
          <p style={{ marginBottom: 0 }}>{answerText}</p>
          <div className="chips">
            {sources.map((s) => {
              const m = messages.find((x) => x.id === s.messageId);
              return (
                <button
                  className="chip"
                  key={s.messageId}
                  onClick={() => m && onSource(m)}
                >
                  Source: {m?.sender || "message"}
                </button>
              );
            })}
          </div>
        </section>
      )}
      </div>
    </>
  );
}