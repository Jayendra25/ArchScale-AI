# ArchFlow AI

AI-powered project communication intelligence for architecture and construction projects.

## What it does

Turn WhatsApp messages, emails and meeting transcripts into a live, source-traceable project record. The system extracts decisions, blockers, action items, conflicts, and risks using AI (Gemini with Groq fallback).

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see the project picker. Either create a new project or click **Load demo: Sharma Residence** to launch the built-in walkthrough.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require&connect_timeout=30
```

- **GEMINI_API_KEY**: Primary AI provider (Gemini 1.5 Flash)
- **GROQ_API_KEY**: Fallback AI provider (Llama 3.1 via Groq)
- **DATABASE_URL**: Neon Postgres connection string

---

## Database Setup

The app uses **Neon Postgres** via Prisma ORM.

### First-time setup
```bash
# Generate Prisma client
npm run db:generate

# Push schema to Neon (creates all tables)
npm run db:push
```

### ⚠️ One-time DB reset (DESTRUCTIVE)

> **WARNING: This deletes all data. Run only once to clear leftover test data.**
> **Never run this after loading real demo data.**

```bash
npm run db:reset
```

This was run once during initial setup to wipe stale test tables. **Do not run this again** during a demo or hackathon presentation.

### Prisma Studio (optional)
```bash
npm run db:studio
```

---

## Architecture

### AI Provider Fallback
`lib/ai/client.ts` — Gemini is tried first. If it fails (API error, timeout, bad JSON), Groq is tried automatically. If both fail, the original rule-based regex extraction runs as a last resort. The serving provider is logged to the console.

### Data Flow
1. User creates a project → stored in Postgres
2. User pastes communication text → `POST /api/projects/[id]/import`
3. AI extracts structured state (decisions, blockers, action items, conflicts)
4. State snapshot + messages saved to Postgres
5. Dashboard reads from DB — data persists across server restarts

### Key Files
| File | Purpose |
|---|---|
| `lib/ai/client.ts` | Gemini + Groq provider with fallback |
| `lib/ai/extraction.ts` | AI extraction prompt + rule-based fallback |
| `lib/store.ts` | DB-backed data layer (Prisma) |
| `lib/prisma.ts` | Singleton Prisma client |
| `prisma/schema.prisma` | Database schema |
| `app/page.tsx` | Project picker (server component) |
| `app/home-client.tsx` | Project picker UI client |
| `components/ProjectClient.tsx` | Main project workspace UI |

---

## Demo Script (Sharma Residence)

1. Visit `/` → click **Load demo: Sharma Residence**
2. You land in the project dashboard (empty state)
3. Go to **Import** → click **Load demo step 1** (WhatsApp: marble rejection)
4. You're automatically redirected to the Dashboard — blockers appear
5. Go to **Import** → click **Load demo step 2** (Email+Meeting: supplier options + conflict)
6. Dashboard shows a conflict detected between contractor and architect
7. Go to **Import** → click **Load demo step 3** (WhatsApp: approval)
8. Blockers resolve, decision recorded
9. Click **Ask AI** → ask *"Why was the kitchen installation delayed?"*
10. Grounded answer with source links

---

## Tech Stack

- **Next.js 15** (App Router, server components)
- **Prisma 5** + **Neon Postgres**
- **Google Gemini 1.5 Flash** (primary AI)
- **Groq / Llama 3.1** (fallback AI)
- **TypeScript**
- **Vanilla CSS** (no Tailwind in runtime)
