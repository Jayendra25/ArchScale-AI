"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  messageCount: number;
  batchCount: number;
  summary: string | null;
};

export function HomeClient({
  initialProjects,
  displayFontClass,
  bodyFontClass,
}: {
  initialProjects: Project[];
  displayFontClass: string;
  bodyFontClass: string;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the project a name before creating it.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error("Could not create the project. Try again.");
      const created = await res.json();
      router.push(`/projects/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className={`af-home ${bodyFontClass}`}>
      {/* floating background shapes */}
      <svg className="af-float af-float-1" width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="110" r="100" fill="url(#g1)" />
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6D5DFC" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6D5DFC" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <svg className="af-float af-float-2" width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r="72" fill="url(#g2)" />
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF8B6B" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#FF8B6B" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <svg className="af-float af-float-3" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r="60" fill="none" stroke="#6D5DFC" strokeOpacity="0.15" strokeWidth="1.5" />
        <circle cx="70" cy="70" r="30" fill="none" stroke="#6D5DFC" strokeOpacity="0.12" strokeWidth="1.5" />
      </svg>
      <svg className="af-float af-float-4" width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
        <g stroke="#1C1B29" strokeOpacity="0.06" strokeWidth="1.4">
          <line x1="20" y1="30" x2="90" y2="70" />
          <line x1="90" y1="70" x2="150" y2="40" />
          <line x1="90" y1="70" x2="70" y2="140" />
          <line x1="70" y1="140" x2="150" y2="150" />
        </g>
        <g fill="#6D5DFC" fillOpacity="0.35">
          <circle cx="20" cy="30" r="4" />
          <circle cx="90" cy="70" r="5" />
          <circle cx="150" cy="40" r="4" />
          <circle cx="70" cy="140" r="4" />
          <circle cx="150" cy="150" r="4" />
        </g>
      </svg>

      <header className="af-header">
        <div className="af-brand">
          <div className="af-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="6" cy="6" r="3" fill="currentColor" />
              <circle cx="18" cy="6" r="3" fill="currentColor" opacity="0.55" />
              <circle cx="12" cy="18" r="3" fill="currentColor" opacity="0.8" />
              <path d="M8.4 7.6L15.6 7.6M9 8.5L11.3 15.5M15 8.5L12.7 15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className={displayFontClass}>ArchFlow</h1>
            <p className="af-tagline">Turn scattered communication into one clear project record.</p>
          </div>
        </div>
        <button className={`af-new-btn ${displayFontClass}`} onClick={() => setIsCreating((v) => !v)}>
          {isCreating ? "Cancel" : "New project"}
        </button>
      </header>

      {isCreating && (
        <form className="af-create-row" onSubmit={handleCreate}>
          <div className="af-create-fields">
            <input
              autoFocus
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Short description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="af-error">{error}</p>}
          <button type="submit" className="af-create-btn" disabled={submitting}>
            {submitting ? "Creating…" : "Create project"}
          </button>
        </form>
      )}

      <section className="af-grid-section">
        {projects.length === 0 && !isCreating && (
          <div className="af-empty">
            <p className={displayFontClass}>No projects yet.</p>
            <p>Create one and start importing communication to see it come together.</p>
            <button className={`af-new-btn ${displayFontClass}`} onClick={() => setIsCreating(true)}>
              Create your first project
            </button>
          </div>
        )}

        <div className="af-cards">
          {projects.map((p) => (
            <button key={p.id} className="af-card" onClick={() => router.push(`/projects/${p.id}`)}>
              <span className={`af-card-title ${displayFontClass}`}>{p.name}</span>
              <span className="af-card-summary">
                {p.summary ?? p.description ?? "No communication imported yet."}
              </span>
              <span className="af-card-meta">
                <span>{p.messageCount} messages</span>
                <span>·</span>
                <span>{p.batchCount} imports</span>
                <span>·</span>
                <span>{new Date(p.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <style>{`
        .af-home {
          position: relative;
          min-height: 100vh;
          background: #F8F8FB;
          color: #1C1B29;
          padding: 64px 56px 80px;
          overflow: hidden;
        }
        .af-float {
          position: absolute;
          pointer-events: none;
          filter: blur(1px);
        }
        .af-float-1 { top: -40px; right: 8%; animation: af-drift-a 11s ease-in-out infinite; }
        .af-float-2 { top: 220px; right: 22%; animation: af-drift-b 9s ease-in-out infinite; }
        .af-float-3 { top: 60px; left: 6%; animation: af-drift-a 13s ease-in-out infinite; }
        .af-float-4 { top: 340px; left: 14%; animation: af-drift-b 15s ease-in-out infinite; }
        @keyframes af-drift-a {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(18px) rotate(4deg); }
        }
        @keyframes af-drift-b {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(-3deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .af-float { animation: none !important; }
        }

        .af-header {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          max-width: 980px;
          margin: 0 auto 44px;
        }
        .af-brand { display: flex; gap: 14px; align-items: flex-start; }
        .af-mark {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #1C1B29;
          color: #F8F8FB;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .af-header h1 {
          font-size: 26px;
          font-weight: 800;
          margin: 4px 0 4px;
          letter-spacing: -0.01em;
        }
        .af-tagline {
          margin: 0;
          color: #6B7280;
          font-size: 14.5px;
          max-width: 340px;
        }
        .af-new-btn {
          background: #6D5DFC;
          color: #fff;
          border: none;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border-radius: 10px;
          transition: transform 0.12s ease, background 0.15s ease;
        }
        .af-new-btn:hover { background: #5B4CE0; transform: translateY(-1px); }
        .af-new-btn:focus-visible { outline: 2px solid #6D5DFC; outline-offset: 2px; }

        .af-create-row {
          position: relative;
          max-width: 980px;
          margin: -16px auto 36px;
          padding: 20px 22px;
          background: #fff;
          border: 1px solid #E4E4EC;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .af-create-fields { display: flex; gap: 12px; }
        .af-create-fields input {
          flex: 1;
          padding: 11px 14px;
          border: 1px solid #E4E4EC;
          border-radius: 8px;
          font-size: 14.5px;
          background: #F8F8FB;
        }
        .af-create-fields input:focus-visible { outline: 2px solid #6D5DFC; outline-offset: 1px; }
        .af-create-btn {
          align-self: flex-start;
          background: #1C1B29;
          color: #fff;
          border: none;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
        }
        .af-create-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .af-error { color: #E0563A; font-size: 13px; margin: 0; }

        .af-grid-section { position: relative; max-width: 980px; margin: 0 auto; }
        .af-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .af-card {
          text-align: left;
          background: #fff;
          border: 1px solid #E4E4EC;
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .af-card:hover { transform: translateY(-2px); border-color: #6D5DFC; }
        .af-card-title { font-size: 17px; font-weight: 700; }
        .af-card-summary {
          font-size: 13.5px;
          color: #6B7280;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .af-card-meta {
          margin-top: 4px;
          display: flex;
          gap: 6px;
          font-size: 12px;
          color: #9AA0AC;
        }

        .af-empty {
          padding: 56px 4px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .af-empty p:first-child { font-size: 19px; font-weight: 700; margin: 0; }
        .af-empty p:nth-child(2) { color: #6B7280; font-size: 14.5px; margin: 0 0 8px; max-width: 360px; }

        @media (max-width: 640px) {
          .af-home { padding: 36px 20px 56px; }
          .af-header { flex-direction: column; gap: 16px; }
          .af-cards { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}