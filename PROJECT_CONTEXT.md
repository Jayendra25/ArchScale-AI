# ArchFlow AI - Complete Project Context

## Project Overview

**ArchFlow AI** is an AI-powered project communication intelligence system designed specifically for architecture and construction projects. It transforms unstructured communication (WhatsApp messages, emails, meeting transcripts) into a live, structured, source-traceable project record.

### Core Value Proposition
- **Problem:** Construction projects involve scattered communication across WhatsApp, email, and meetings, making it hard to track decisions, responsibilities, blockers, and risks.
- **Solution:** AI automatically extracts and structures critical project information (decisions, action items, blockers, conflicts, risks) from raw communication, with full source traceability.
- **Unique Feature:** Every extracted item links back to the exact source message that created it.

---

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript 5**
- **Vanilla CSS** (no Tailwind in runtime, minimal dependencies)
- **lucide-react** (icons)

### Backend
- **Next.js API Routes** (serverless functions)
- **Prisma ORM 5**
- **PostgreSQL** (Neon serverless)

### AI Providers
- **Primary:** Google Gemini 1.5 Flash (via `@google/genai`)
- **Fallback:** Groq (Llama 3.1 via `groq-sdk`)
- **Last Resort:** Rule-based regex extraction

### Architecture Pattern
- Server Components for data fetching (SSR)
- Client Components for interactivity (`"use client"`)
- API routes handle all mutations and AI operations
- PostgreSQL stores all data (no in-memory state)

---

## Project Structure

```
/Users/jayendrasinghnayal/Documents/Jayendra_Project/ArchScale AI/
├── app/                          # Next.js 15 App Router
│   ├── page.tsx                  # Home (project picker) - Server Component
│   ├── home-client.tsx           # Client component for home page
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── api/                      # API routes
│   │   └── projects/
│   │       ├── route.ts          # POST /api/projects (create project)
│   │       └── [id]/
│   │           ├── state/route.ts        # GET project state
│   │           ├── import/route.ts       # POST import communication
│   │           ├── ask/route.ts          # POST ask AI question
│   │           ├── messages/route.ts     # GET messages
│   │           ├── meta/route.ts         # GET project metadata
│   │           └── seed-demo/route.ts    # POST load demo data
│   └── projects/[id]/            # Project workspace routes
│       ├── page.tsx              # Dashboard (default view)
│       ├── inbox/page.tsx        # Message inbox
│       ├── import/page.tsx       # Import communication
│       ├── changes/page.tsx      # Timeline of changes
│       └── ask/page.tsx          # Ask AI interface
│
├── components/                   # React components
│   ├── AppShell.tsx              # Navigation shell wrapper
│   ├── Dashboard.tsx             # Main dashboard with stats, conflicts, cards
│   ├── StateCards.tsx            # Reusable card for blockers/actions/etc
│   ├── ProjectClient.tsx         # Main client component (view router)
│   └── SourceDrawer.tsx          # Drawer showing source messages
│
├── lib/                          # Core business logic
│   ├── types.ts                  # TypeScript type definitions
│   ├── store.ts                  # Database operations (Prisma)
│   ├── prisma.ts                 # Prisma client singleton
│   ├── demoData.ts               # Demo conversation data
│   └── ai/
│       ├── client.ts             # LLM abstraction (Gemini + Groq)
│       ├── extraction.ts         # AI extraction with prompts
│       └── dedup.ts              # Message & event deduplication logic
│
├── prisma/
│   └── schema.prisma             # Database schema
│
├── scripts/
│   └── reset-db.ts               # DB reset utility (DESTRUCTIVE)
│
├── .env                          # Environment variables (gitignored)
├── .env.example                  # Example environment variables
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind config (minimal usage)
└── postcss.config.mjs            # PostCSS config

Documentation:
├── README.md                     # Quick start guide
├── PROJECT_CONTEXT.md            # This file - complete context
├── IMPLEMENTATION_SUMMARY.md     # Recent enhancement details
├── BEFORE_AFTER_COMPARISON.md    # Visual comparison of changes
├── TESTING_GUIDE.md              # Step-by-step testing instructions
└── test-conversation.txt         # Sample conversation for testing
```

---

## Core Concepts

### 1. Project
- Container for all communication and state
- Has a name and optional description
- Created from the home page

### 2. Message
- Individual communication unit (WhatsApp message, email, meeting snippet)
- Fields: `id`, `sender`, `content`, `timestamp`, `source` (whatsapp/email/meeting)
- Has a `contentHash` (SHA-256 fingerprint) for deduplication
- Each message belongs to an `ImportBatch`

### 3. ImportBatch
- Represents a single import operation
- Has a `label` (optional user-provided name)
- Groups messages that were imported together
- Linked to a ProjectStateSnapshot

### 4. ProjectStateSnapshot
- Captures the project state at a point in time
- Created after each import
- Contains:
  - `state`: ProjectState object (JSON) with decisions, blockers, action items, etc.
  - `changes`: Array of human-readable change descriptions
- Enables timeline view ("What Changed")

### 5. ProjectState Structure
```typescript
{
  summary: string;                    // 1-2 sentence project overview
  decisions: Item[];                  // Finalized decisions (status: resolved)
  actionItems: Item[];                // Tasks, approvals, waiting actions
  pendingDecisions: Item[];           // Decisions awaiting resolution
  blockers: Item[];                   // Things blocking progress
  risks: Item[];                      // Potential risks to watch
  deadlines: Item[];                  // Upcoming deadlines
  updates: Item[];                    // General project updates
  conflicts: Conflict[];              // Contradictions between stakeholders
  people: Person[];                   // People involved with roles
}
```

### 6. Item Structure
```typescript
{
  id: string;
  title: string;                      // Short summary
  description: string;                // Detailed explanation
  status: Status;                     // "open" | "in_progress" | "waiting" | "resolved" | "blocked"
  priority?: "low" | "medium" | "high";
  owner?: string;                     // Person responsible (e.g., "Rohan")
  ownerRole?: string;                 // Their role (e.g., "Architect")
  source: Source;                     // "whatsapp" | "email" | "meeting"
  sourceMessageId: string;            // Primary message that created this
  sourceMessageIds?: string[];        // All messages referencing this
  timestamp: string;
  relatedTopics: string[];
  dependencies?: string[];            // What this is waiting for
  type?: ActionItemType;              // For action items only
  dueDate?: string;                   // For action items/deadlines
  eventKey?: string;                  // Semantic dedup key
}
```

### 7. ActionItemType (7 Categories)
- `assigned_task`: Someone committed to do something
- `approval_required`: Someone needs to approve/review
- `follow_up`: Follow-up action needed
- `waiting_action`: Waiting for something before proceeding
- `coordination`: Coordination between parties needed
- `delivery`: Delivery of materials/documents
- `review`: Review needed

### 8. Conflict Structure
```typescript
{
  id: string;
  topic: string;                      // What the conflict is about
  status?: Status;
  sideA: {
    statement: string;                // What side A said
    owner: string;                    // Who said it
    sourceMessageId: string;          // Where they said it
  };
  sideB: {
    statement: string;
    owner: string;
    sourceMessageId: string;
  };
  recommendedAction: string;          // AI's recommendation
  eventKey?: string;
}
```

---

## Data Flow

### Import Flow (Most Important)
```
1. User imports raw text (WhatsApp/email/meeting transcript)
   ↓
2. POST /api/projects/[id]/import
   ↓
3. lib/store.ts → ingest() function
   ↓
4. Parse raw text into messages (lib/store.ts → parseMessages)
   ↓
5. Fingerprint each message (SHA-256 hash)
   ↓
6. Check for duplicate messages in DB (lib/ai/dedup.ts)
   ↓
7. AI extraction on FULL raw text (lib/ai/extraction.ts)
   │
   ├─→ Try Gemini first (lib/ai/client.ts)
   ├─→ If fails, try Groq
   └─→ If both fail, use rule-based extraction
   ↓
8. AI returns structured ProjectState (partial)
   ↓
9. Smart merge with existing state (lib/ai/dedup.ts)
   │  - Detect duplicate events via semantic similarity
   │  - Detect status changes (same event, different status)
   │  - Link new messages to existing events
   ↓
10. Save to PostgreSQL
    │  - New messages (deduplicated)
    │  - New snapshot with merged state
    │  - All in a transaction
    ↓
11. Return merged state + changes to frontend
    ↓
12. Frontend redirects to dashboard
    ↓
13. Dashboard displays updated state
```

### Ask AI Flow
```
1. User types question → POST /api/projects/[id]/ask
   ↓
2. lib/store.ts → answer() function
   ↓
3. Fetch project state + messages from DB
   ↓
4. Build context: state summary + action items + recent messages
   ↓
5. Call LLM with question + context
   ↓
6. Find relevant source messages (keyword matching)
   ↓
7. Return answer + source message IDs
   ↓
8. Frontend displays answer with [View source] links
```

---

## Deduplication System (Critical)

ArchFlow AI has a **two-level deduplication system** to prevent duplicate data:

### Level 1: Message Deduplication
- **When:** Before saving messages to DB
- **How:** SHA-256 fingerprint of `projectId + source + sender + normalizedContent`
- **Result:** Same message imported twice = stored once
- **File:** `lib/ai/dedup.ts` → `fingerprintMessage()`

### Level 2: Event Deduplication
- **When:** After AI extraction, before merging into state
- **How:** Semantic similarity via normalized "event keys"
- **Event Key Format:** `"<category>:<topic1>:<topic2>:..."`
  - Example: `"action:marble:option_b:approved"`
  - Normalized: lowercase, synonyms applied, sorted
- **Similarity Threshold:** 0.45 (Jaccard similarity)
- **Actions:**
  - **"create":** New event, insert it
  - **"skip":** Exact duplicate, ignore
  - **"state-change":** Same event, status changed → update existing
  - **"add-source":** Same event, new message → link message
- **File:** `lib/ai/dedup.ts` → `decideDedupAction()`, `smartMergeItems()`

### Synonym Normalization
Common construction terms normalized for better matching:
- "Option B" = "second option" = "opt b" → `"option_b"`
- "approved" = "confirmed" = "go ahead" → `"approved"`
- "blocked" = "hold" = "waiting" → `"blocked"`
- "installation" = "install" = "installing" → `"installation"`

**File:** `lib/ai/dedup.ts` → SYNONYMS table

---

## AI Extraction Process

### AI Provider Chain
```
1st Attempt: Gemini 1.5 Flash (gemini-3.6-flash)
   - Timeout: 20 seconds
   - Response format: JSON
   ↓ If fails
2nd Attempt: Groq (qwen/qwen3.8-27b)
   - Timeout: 25 seconds
   - Response format: JSON
   ↓ If both fail
3rd Attempt: Rule-based extraction
   - Regex patterns for common scenarios
   - Always succeeds (returns partial state)
```

### AI Prompt Strategy
The system prompt in `lib/ai/extraction.ts` instructs the AI to:

1. **Extract ONLY new information** (not info already in prior state)
2. **Extract EVERY meaningful actionable responsibility**
   - Explicit assignments ("I'll send...")
   - Implicit responsibilities ("don't start until approved")
   - Waiting/blocked actions
   - Approval requirements
3. **Identify specific owners** whenever conversation names them
4. **Classify actions by type** (assigned_task, approval_required, etc.)
5. **Extract due dates** even when informal ("tomorrow", "Friday")
6. **Track dependencies** (what each action is waiting for)
7. **Generate event keys** for deduplication
8. **Only extract genuine tasks** (not informational statements)

### JSON Schema
The AI returns a strict JSON schema matching the `ProjectState` type.

**File:** `lib/ai/extraction.ts` → SYSTEM_PROMPT

---

## Database Schema (Prisma)

### Models

**Project**
```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  messages  Message[]
  batches   ImportBatch[]
  snapshots ProjectStateSnapshot[]
}
```

**Message**
```prisma
model Message {
  id          String   @id @default(cuid())
  projectId   String
  source      String   // "whatsapp" | "email" | "meeting"
  sender      String
  content     String
  timestamp   DateTime @default(now())
  tags        String[] @default([])
  label       String?
  batchId     String?
  contentHash String?  // SHA-256 fingerprint for dedup
  
  project Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  batch   ImportBatch? @relation(fields: [batchId], references: [id])
  
  @@unique([projectId, contentHash])  // Ensures no duplicate messages
}
```

**ImportBatch**
```prisma
model ImportBatch {
  id        String   @id @default(cuid())
  projectId String
  label     String?
  source    String
  createdAt DateTime @default(now())
  
  project   Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  messages  Message[]
  snapshots ProjectStateSnapshot[]
}
```

**ProjectStateSnapshot**
```prisma
model ProjectStateSnapshot {
  id        String   @id @default(cuid())
  projectId String
  batchId   String?
  state     Json     // ProjectState object
  changes   String[] // Array of change descriptions
  createdAt DateTime @default(now())
  
  project Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  batch   ImportBatch? @relation(fields: [batchId], references: [id])
}
```

**File:** `prisma/schema.prisma`

---

## User Interface

### Navigation (5 Tabs)
1. **Dashboard** - Main view with stats, conflicts, action items, blockers, etc.
2. **Inbox** - Filterable message list with search
3. **Import** - Import new communication or load demo
4. **What Changed** - Timeline of all imports and their changes
5. **Ask AI** - Question/answer interface with source links

### Dashboard Layout
```
┌─────────────────────────────────────────────┐
│ Stats Bar: [Action items] [Decisions] etc. │
├─────────────────────────────────────────────┤
│ ⚠️ Conflict Cards (if any)                  │
├─────────────────────────────────────────────┤
│ 👥 PEOPLE & RESPONSIBILITIES (NEW)          │
│ Grouped by person with their tasks          │
├─────────────────────────────────────────────┤
│ Grid Layout:                                │
│ ┌─────────────┬─────────────┐              │
│ │ Blockers    │ Action Items│              │
│ ├─────────────┼─────────────┤              │
│ │ Decisions   │ Recent      │              │
│ │             │ Changes     │              │
│ ├─────────────┼─────────────┤              │
│ │ Risks       │             │              │
│ └─────────────┴─────────────┘              │
└─────────────────────────────────────────────┘
```

### Key UI Components

**StateCard** (`components/StateCards.tsx`)
- Displays items (blockers, action items, etc.)
- Shows: Title, Owner (prominent), Description, Status, Type, Priority, Due Date, Dependencies
- [View source] button opens SourceDrawer

**Dashboard** (`components/Dashboard.tsx`)
- Main dashboard view
- Stats bar
- Conflict cards
- **People & Responsibilities** section (groups actions by owner)
- Grid of StateCards

**SourceDrawer** (`components/SourceDrawer.tsx`)
- Sidebar that shows the original message
- Appears when user clicks [View source]

---

## Environment Variables

Required in `.env`:
```bash
# AI Providers (at least one required)
GEMINI_API_KEY=your_gemini_api_key      # Primary
GROQ_API_KEY=your_groq_api_key          # Fallback

# Database
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require&connect_timeout=30
```

**File:** `.env` (gitignored), `.env.example` (template)

---

## Scripts (package.json)

### Development
```bash
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Database
```bash
npm run db:generate      # Generate Prisma client from schema
npm run db:push          # Push schema to database (creates tables)
npm run db:reset         # ⚠️  DESTRUCTIVE: Delete all data and reset schema
npm run db:studio        # Open Prisma Studio (DB GUI)
```

---

## Key Files Deep Dive

### lib/store.ts (Core Business Logic)
**Functions:**
- `getData(projectId)` - Fetch all messages and snapshots
- `parseMessages(rawText)` - Parse raw text into Message objects
- `ingest(projectId, rawText, source, label)` - Main import function
  - Orchestrates entire import flow
  - Handles deduplication
  - Calls AI extraction
  - Saves to DB
- `answer(projectId, question)` - Ask AI questions
- `seedNext(projectId)` - Load next demo step

### lib/ai/extraction.ts (AI Extraction)
**Key Elements:**
- `SYSTEM_PROMPT` - Detailed instructions for AI (1000+ lines)
- `extractFromText(rawText, priorState)` - Main extraction function
- `ruleBasedExtraction()` - Fallback when AI fails
- `ensureEventKeys()` - Ensure all items have event keys

**Critical Prompt Rules:**
- Extract EVERY responsibility
- Identify specific owners
- Classify by action type
- Extract due dates and dependencies
- Don't create false tasks from informational statements

### lib/ai/client.ts (LLM Abstraction)
**Functions:**
- `callLLM(systemPrompt, userPrompt)` - Tries Gemini → Groq → returns empty
- `callGemini()` - Google Gemini API call with timeout
- `callGroq()` - Groq API call with timeout
- `parseLLMJson()` - Parse JSON from LLM (strips markdown fences)

**Features:**
- Hard timeouts (20s Gemini, 25s Groq)
- Automatic provider fallback
- JSON response format enforced
- Console logging of which provider served

### lib/ai/dedup.ts (Deduplication)
**Key Functions:**
- `fingerprintMessage()` - Create SHA-256 hash for message
- `normalizeEventKey()` - Create semantic key for items
- `eventKeySimilarity()` - Jaccard similarity between keys
- `decideDedupAction()` - Decide create/skip/state-change/add-source
- `smartMergeItems()` - Merge new items into existing list
- `smartMergeConflicts()` - Merge conflicts
- `filterNewMessages()` - Filter out duplicate messages

**Synonym Table:**
- Maps construction-specific terms to normalized forms
- Enables "Option B" = "second option" matching

### components/Dashboard.tsx (Main UI)
**Features:**
- Stats bar (counts of action items, blockers, etc.)
- Conflict cards (when detected)
- **People & Responsibilities section** (groups actions by owner) ← NEW
- Grid layout with StateCards
- Recent changes section

**Key Enhancement:**
The "People & Responsibilities" section was added to answer "WHO NEEDS TO DO WHAT?" at a glance.

### components/StateCards.tsx (Item Display)
**Features:**
- Prominent owner display (large, colored text)
- Owner role next to name
- Action type badge
- Priority indicator
- Due date display
- Dependency display
- [View source] button

---

## Recent Major Enhancement

### Action Items / Responsibilities Improvement

**Problem Solved:**
Previously, only 1 action item was extracted per conversation. The system now extracts EVERY meaningful responsibility.

**Example:**
From this conversation:
```
Client: I don't like the marble.
Architect: I'll provide alternatives by tomorrow.
Client: Don't start installation until I approve.
Contractor: Installation was planned for Monday.
Architect: Hold the installation for now.
```

**Before:** 1 action item ("Provide alternatives")
**After:** 3+ action items:
1. Rohan (Architect) - Provide alternatives (assigned_task, in_progress, due: tomorrow)
2. Mrs. Sharma (Client) - Approve marble (approval_required, open)
3. Vikram (Contractor) - Hold installation (waiting_action, waiting)

**Files Changed:**
- `lib/types.ts` - Added ActionItemType, ownerRole, type, dueDate, "waiting" status
- `lib/ai/extraction.ts` - Enhanced AI prompt with exhaustive extraction rules
- `components/StateCards.tsx` - Prominent owner display, new badges
- `components/Dashboard.tsx` - Added "People & Responsibilities" section
- `lib/store.ts` - Enhanced Ask AI context

**Documentation:**
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `BEFORE_AFTER_COMPARISON.md` - Visual comparison
- `TESTING_GUIDE.md` - How to test

---

## Demo Data (Sharma Residence)

The system includes a 3-step demo walkthrough:

**Step 1: Kitchen marble rejection**
- Client rejects original marble
- Architect promises alternatives
- Installation is blocked
- Creates: blockers, pending decision, action items

**Step 2: Supplier options + conflict**
- Supplier provides options
- Architect says installation on hold
- Contractor still plans to start Monday ← CONFLICT
- Creates: conflict, updates

**Step 3: Approval resolves**
- Client approves Option B
- Blockers resolve
- Decisions recorded
- Creates: decision, resolves blockers

**File:** `lib/demoData.ts`

---

## Design Principles

### 1. Source Traceability
Every extracted item (decision, blocker, action, etc.) links back to the exact message(s) that created it. Users can always click [View source] to see the original context.

### 2. Incremental Updates
Importing new communication **updates** the project state, it doesn't replace it. The system maintains a timeline of changes.

### 3. Deduplication First
Two-level deduplication (message + event) prevents duplicate data even when users import the same conversation multiple times.

### 4. AI with Fallback
AI extraction is primary, but the system always works via rule-based fallback if AI providers fail.

### 5. Zero Lock-In
All data stored in PostgreSQL. No proprietary formats. Export-friendly.

### 6. Stateless API
Next.js API routes are stateless serverless functions. All state in DB.

### 7. Minimal Dependencies
Vanilla CSS, no heavy UI frameworks. Fast loading, simple debugging.

---

## Common Workflows

### Create Project and Import First Communication
```
1. Visit / (home page)
2. Click "New project"
3. Enter project name
4. Redirected to /projects/[id]
5. Click "Import communication"
6. Paste WhatsApp/email/transcript
7. Click "Analyze communication"
8. AI extracts structure
9. Redirected to dashboard
10. View results: action items, blockers, etc.
```

### View Responsibilities
```
1. Dashboard → See "People & Responsibilities" section
2. Shows: Who → What they need to do
3. Click on any action item card for details
4. Click [View source] to see original message
```

### Ask Question About Project
```
1. Click "Ask AI" tab
2. Type question (e.g., "Who is responsible for X?")
3. Press Enter or click Send
4. View grounded answer with source links
5. Click source chips to see original messages
```

### Track Changes Over Time
```
1. Click "What Changed" tab
2. View timeline of all imports
3. Each import shows:
   - Timestamp
   - List of changes detected
   - "Latest" badge on most recent
```

---

## Testing Strategy

### Unit Testing
Currently no automated tests. System designed for manual testing via UI.

### Manual Testing Checklist
See `TESTING_GUIDE.md` for comprehensive testing instructions.

**Key Test Scenarios:**
1. Demo data (3-step Sharma Residence)
2. Custom conversation import
3. Deduplication (import same conversation twice)
4. Status updates (import "task completed" message)
5. Ask AI (responsibility questions)
6. Visual verification (UI display correctness)
7. Edge cases (no owner, multiple dependencies, informal dates)

### Test Files
- `test-conversation.txt` - Sample conversation for testing
- `TESTING_GUIDE.md` - Step-by-step testing instructions

---

## Known Limitations & Future Enhancements

### Current Limitations
1. **No authentication** - Anyone with URL can access any project
2. **No file upload beyond .txt** - PDF/DOCX require server-side parsing
3. **No real-time updates** - Requires manual page refresh after import
4. **No task completion from UI** - Can't mark action items done manually
5. **No export functionality** - Can't export to CSV or other formats
6. **No notification system** - No alerts for overdue tasks or blockers
7. **English-only** - AI prompts and extraction are English-centric

### Potential Future Enhancements
1. **Authentication & Authorization** - User accounts, team permissions
2. **File Upload Support** - PDF, DOCX, images (OCR)
3. **Real-time Updates** - WebSockets or Server-Sent Events
4. **Task Management** - Mark tasks complete, reassign owners
5. **Export/Integration** - Export to Jira, Asana, Excel, etc.
6. **Notifications** - Email/Slack alerts for critical items
7. **Multi-language** - Support for other languages
8. **Dependency Graph** - Visual representation of task dependencies
9. **Automated Reminders** - Based on due dates
10. **Voice Input** - Record meeting audio, auto-transcribe

---

## Troubleshooting Guide

### Issue: Build Fails
**Solution:**
```bash
rm -rf .next node_modules
npm install
npm run db:generate
npm run build
```

### Issue: Database Connection Error
**Check:**
1. `.env` has correct `DATABASE_URL`
2. Neon PostgreSQL instance is running
3. Database exists and schema is pushed

**Fix:**
```bash
npm run db:push
```

### Issue: AI Not Extracting Properly
**Check:**
1. Console logs - Which provider is serving? (Gemini/Groq/rule-based)
2. API keys are valid and have quota
3. Network connectivity

**Debug:**
```bash
# Check API key
echo $GEMINI_API_KEY

# Test API call manually
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GEMINI_API_KEY
```

### Issue: Duplicate Action Items
**Likely Cause:** Deduplication threshold too low or event keys not matching

**Check:**
1. Console logs - Look for "[Dedup]" messages
2. Verify eventKey generation in `lib/ai/dedup.ts`

### Issue: Owner Not Showing
**Cause:** AI didn't extract owner from conversation

**Fix:**
Use conversations with clear name attributions:
```
✅ Good:
[Name (Role)]: Message content
Name: Message content

❌ Unclear:
Someone said: Message content
```

---

## Performance Considerations

### Load Times
- **Home page:** ~500ms (fetches all projects)
- **Dashboard:** ~800ms (fetches messages + snapshots)
- **AI extraction:** 5-20 seconds (depends on provider, text length)

### Optimization Opportunities
1. **Caching:** Add Redis for frequently accessed project states
2. **Pagination:** Inbox and timeline could paginate for large projects
3. **Lazy Loading:** Dashboard cards could lazy-load
4. **CDN:** Static assets could be CDN-served
5. **Database Indexes:** Add indexes on frequently queried fields

### Scalability
- **Current:** Suitable for 1-50 projects, each with 100-1000 messages
- **Bottleneck:** AI extraction is the slowest part
- **Scale Strategy:** Move AI extraction to background queue (e.g., BullMQ)

---

## Security Considerations

### Current Security Posture
⚠️ **This is a demo/prototype application. NOT production-ready.**

**Missing:**
- No authentication
- No authorization
- No rate limiting
- No input sanitization beyond basic validation
- No CSRF protection
- API keys exposed in server environment (ok for serverless, but must be secret)

### Production Security Checklist
- [ ] Add authentication (NextAuth.js)
- [ ] Add authorization (role-based access)
- [ ] Add rate limiting (e.g., Upstash Rate Limit)
- [ ] Sanitize all user inputs
- [ ] Add CSRF tokens
- [ ] Use environment variable management (Vercel/Railway/etc.)
- [ ] Add audit logging
- [ ] Encrypt sensitive data at rest
- [ ] Use HTTPS everywhere
- [ ] Add API key rotation

---

## Deployment

### Recommended Platforms
1. **Vercel** (easiest) - Native Next.js support
2. **Railway** - Simple deployment with DB
3. **AWS Amplify** - Full AWS integration
4. **Docker** - Self-hosted via container

### Vercel Deployment Steps
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# - GEMINI_API_KEY
# - GROQ_API_KEY
# - DATABASE_URL

# Push database schema
npx prisma db push
```

### Environment Variables (Production)
Set in your hosting platform:
- `GEMINI_API_KEY` - Google AI API key
- `GROQ_API_KEY` - Groq API key
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV=production`

---

## Code Conventions

### TypeScript
- Strict mode enabled
- All functions typed (no `any` unless necessary)
- Types defined in `lib/types.ts`
- Interfaces for React components

### React
- Server Components by default
- Client Components marked with `"use client"`
- Minimal use of `useEffect`
- Controlled components for forms

### CSS
- Vanilla CSS in `app/globals.css`
- CSS variables for colors (e.g., `var(--ink)`, `var(--primary)`)
- No Tailwind utility classes (though config exists)
- BEM-like naming conventions

### Database
- Prisma for all DB operations
- Transactions for multi-step operations
- `onDelete: Cascade` for foreign keys
- Auto-generated IDs (cuid)

### API Routes
- RESTful conventions
- JSON responses
- Error handling with try/catch
- HTTP status codes (200, 400, 500)

---

## Getting Help

### Documentation
- `README.md` - Quick start
- `PROJECT_CONTEXT.md` - This file (complete context)
- `TESTING_GUIDE.md` - Testing instructions
- `IMPLEMENTATION_SUMMARY.md` - Recent changes

### Resources
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Gemini API:** https://ai.google.dev/docs
- **Groq Docs:** https://console.groq.com/docs

### Debug Strategy
1. Check console logs (browser + server)
2. Check database state (Prisma Studio: `npm run db:studio`)
3. Test AI extraction in isolation
4. Check deduplication logs
5. Verify environment variables

---

## Summary for AI Assistants

If you're an AI helping to work on this project, here are the key things to remember:

### Most Important Files
1. **`lib/store.ts`** - Core business logic (ingest, answer, getData)
2. **`lib/ai/extraction.ts`** - AI extraction with prompts
3. **`lib/ai/dedup.ts`** - Deduplication logic (critical for data integrity)
4. **`lib/types.ts`** - Type definitions (source of truth)
5. **`components/Dashboard.tsx`** - Main UI
6. **`prisma/schema.prisma`** - Database schema

### Key Principles
- **Source traceability:** Every item must link to source message
- **Deduplication:** Never create duplicate messages or events
- **Incremental updates:** New imports update state, don't replace
- **AI with fallback:** Always provide rule-based fallback
- **Type safety:** Use TypeScript types, no `any`

### When Making Changes
1. **Read existing code first** - Understand current implementation
2. **Check types in `lib/types.ts`** - Ensure compatibility
3. **Update deduplication logic if needed** - Don't break semantic matching
4. **Test with demo data** - Use "Load demo step 1/2/3"
5. **Verify build succeeds** - Run `npm run build`
6. **Update this document** - Keep PROJECT_CONTEXT.md current

### Common Tasks
- **Add new item type:** Update `ProjectState` in `types.ts`, extraction prompt, dashboard
- **Change AI prompt:** Edit `SYSTEM_PROMPT` in `lib/ai/extraction.ts`
- **Add UI component:** Create in `components/`, import in `ProjectClient.tsx`
- **Add API route:** Create in `app/api/projects/[id]/`, add fetch in client
- **Modify DB schema:** Edit `schema.prisma`, run `npm run db:push`

---

## Version History

- **v0.1.0** (Initial) - Basic project structure, AI extraction, dashboard
- **v0.2.0** (Current) - Enhanced action items extraction (exhaustive), People & Responsibilities section, improved owner display

---

## Contact & Attribution

**Project:** ArchFlow AI
**Purpose:** AI-powered project communication intelligence for architecture & construction
**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, PostgreSQL, Google Gemini, Groq
**License:** [Add license if applicable]

---

**End of PROJECT_CONTEXT.md**

*This document provides complete context for AI assistants and developers working on ArchFlow AI. Keep it updated as the project evolves.*
