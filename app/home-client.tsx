"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Sparkles, ArrowRight, FolderOpen, Clock, MessageCircle, LoaderCircle } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  messageCount: number;
  batchCount: number;
  summary: string | null;
};

type Props = {
  initialProjects: Project[];
};

export function HomeClient({ initialProjects }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showForm, setShowForm] = useState(initialProjects.length === 0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [demobusy, setDemoBusy] = useState(false);
  const [error, setError] = useState("");

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const loadDemo = async () => {
    setDemoBusy(true);
    setError("");
    try {
      // Check if a Sharma Residence project already exists
      const existing = projects.find((p) =>
        p.name.toLowerCase().includes("sharma")
      );
      if (existing) {
        router.push(`/projects/${existing.id}`);
        return;
      }

      // Create the demo project
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Sharma Residence",
          description: "Interior design project — kitchen marble coordination demo",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create demo project");
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo.");
      setDemoBusy(false);
    }
  };

  const hasProjects = projects.length > 0;

  return (
    <main className="home-shell">
      {/* Nav */}
      <nav className="home-nav">
        <div className="brand">
          <span className="mark">
            <Building2 size={19} />
          </span>
          ArchFlow{" "}
          <span style={{ color: "#7b9290", fontWeight: 500 }}>AI</span>
        </div>
        <span className="project-label">Live project intelligence</span>
      </nav>

      {/* Hero */}
      <section className="home-hero">
        <div className="hero-badge">
          <Sparkles size={13} />
          AI-powered project intelligence
        </div>
        <h1 className="hero-title">
          {hasProjects ? "Your projects" : "Welcome to ArchFlow AI"}
        </h1>
        <p className="hero-sub">
          {hasProjects
            ? "Select a project to continue or create a new one."
            : "Turn WhatsApp threads, emails and meeting transcripts into a live source-traceable project record."}
        </p>
      </section>

      {/* Project list */}
      {hasProjects && (
        <section className="project-list">
          {projects.map((p) => (
            <button
              key={p.id}
              className="project-card"
              onClick={() => router.push(`/projects/${p.id}`)}
              id={`project-${p.id}`}
            >
              <div className="pc-left">
                <span className="pc-icon">
                  <FolderOpen size={20} />
                </span>
                <div>
                  <div className="pc-name">{p.name}</div>
                  {p.description && (
                    <div className="pc-desc">{p.description}</div>
                  )}
                  {p.summary && <div className="pc-summary">{p.summary}</div>}
                </div>
              </div>
              <div className="pc-right">
                <div className="pc-meta">
                  <span>
                    <MessageCircle size={13} /> {p.messageCount} messages
                  </span>
                  <span>
                    <Clock size={13} /> {p.batchCount} imports
                  </span>
                </div>
                <ArrowRight size={18} className="pc-arrow" />
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Create / actions row */}
      <div className="home-actions">
        {hasProjects && !showForm && (
          <button
            className="button"
            id="new-project-btn"
            onClick={() => setShowForm(true)}
          >
            <Plus size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            New project
          </button>
        )}
        <button
          className="button ghost"
          id="load-demo-btn"
          onClick={loadDemo}
          disabled={demobusy}
        >
          {demobusy ? (
            <>
              <LoaderCircle size={15} className="loading-spinner" style={{ verticalAlign: "middle", marginRight: 6 }} />
              Setting up demo…
            </>
          ) : (
            <>
              <Sparkles size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Load demo: Sharma Residence
            </>
          )}
        </button>
      </div>

      {/* Create project form */}
      {(showForm || !hasProjects) && (
        <section className="create-card">
          <h2 className="create-title">
            {hasProjects ? "New project" : "Create your first project"}
          </h2>
          <p className="sub" style={{ marginBottom: 24 }}>
            Give it a name and start importing communication immediately.
          </p>
          <form onSubmit={createProject} className="create-form" id="create-project-form">
            <div className="field">
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kapoor Residence, Tower Block B"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="project-desc">Description (optional)</label>
              <input
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of the project"
              />
            </div>
            {error && (
              <p style={{ color: "#b1482d", fontSize: 13, margin: "0 0 8px" }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                className="button"
                disabled={busy || !name.trim()}
                id="create-project-submit"
              >
                {busy ? (
                  <>
                    <LoaderCircle size={15} className="loading-spinner" style={{ verticalAlign: "middle", marginRight: 6 }} />
                    Creating…
                  </>
                ) : (
                  "Create project"
                )}
              </button>
              {hasProjects && (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => { setShowForm(false); setName(""); setDescription(""); setError(""); }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
