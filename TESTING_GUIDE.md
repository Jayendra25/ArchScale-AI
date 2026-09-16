# Testing Guide - Action Items Enhancement

## Prerequisites

1. Ensure you have the required environment variables in `.env`:
   - `GEMINI_API_KEY` or `GROQ_API_KEY` (at least one)
   - `DATABASE_URL` (Neon Postgres connection)

2. Database should be set up:
   ```bash
   npm run db:push
   ```

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The application will be available at http://localhost:3000 (or 3001 if 3000 is in use).

---

## Test Scenario 1: Demo Data (Recommended)

This is the easiest way to test the enhancements.

### Steps:

1. **Visit** http://localhost:3000
2. **Click** "Load demo: Sharma Residence"
3. **Go to Import tab**
4. **Click** "Load demo step 1" - Kitchen marble rejection

### Expected Results:

✅ Dashboard shows **at least 3 action items**:
- Rohan: Provide alternative marble options
- Mrs. Sharma: Review and approve marble
- Vikram: Hold kitchen installation

✅ **People & Responsibilities** section appears showing:
- Rohan — Architect (with task)
- Mrs. Sharma — Client (with approval task)
- Vikram — Contractor (with hold installation task)

✅ Each action item shows:
- **Owner name prominently** (larger text, primary color)
- Owner role (e.g., "— Architect")
- Action type (e.g., "assigned_task", "approval_required")
- Status (in_progress, open, waiting)
- Priority badge
- Due date (if mentioned)
- Dependencies (if applicable)

### Continue Testing:

4. **Click** "Load demo step 2" - Supplier options + conflict
5. **Verify** action items are updated (no duplicates created)
6. **Click** "Load demo step 3" - Marble approval
7. **Verify** approval action changes to "resolved"
8. **Verify** installation blocker is resolved

---

## Test Scenario 2: Custom Conversation

Test with the exact conversation from the requirements.

### Steps:

1. **Create a new project** or use existing one
2. **Go to Import tab**
3. **Paste this conversation:**

```
[14 Sep, 4:02 PM] Mrs. Sharma (Client):
Hi, we visited the site today and honestly I don't like the marble we selected for the kitchen. It looks too yellow in daylight.

[14 Sep, 4:05 PM] Rohan (Architect):
Understood. I'll pull two alternative marble options for you by tomorrow.

[14 Sep, 4:06 PM] Mrs. Sharma (Client):
Okay, but please don't start any installation until I've approved the new one.

[14 Sep, 4:10 PM] Vikram (Contractor):
Just to flag — my team was planning to start the kitchen installation this coming Monday, materials are already allocated.

[14 Sep, 4:12 PM] Rohan (Architect):
Vikram, please hold the installation for now. We're waiting on the client's approval for the marble.

[14 Sep, 4:13 PM] Vikram (Contractor):
Got it, holding for now. Let me know as soon as it's confirmed.

[14 Sep, 6:45 PM] Rohan (Architect):
Mrs. Sharma, I've reached out to our supplier for alternatives, should have options for you tomorrow morning.
```

4. **Click Import**

### Expected Results:

✅ **Action Items count: 3** (at minimum)

✅ **Action Item 1:**
- Title: "Provide alternative kitchen marble options" (or similar)
- Owner: Rohan
- Role: Architect
- Type: assigned_task
- Status: in_progress
- Due Date: "Tomorrow" or "Tomorrow morning"
- [View source] button works

✅ **Action Item 2:**
- Title: "Review and approve kitchen marble" (or similar)
- Owner: Mrs. Sharma
- Role: Client
- Type: approval_required
- Status: open
- Dependency: "Alternative marble options" or similar
- [View source] button works

✅ **Action Item 3:**
- Title: "Hold kitchen installation" (or similar)
- Owner: Vikram
- Role: Contractor
- Type: waiting_action
- Status: waiting
- Dependency: "Client approval" or similar
- [View source] button works

✅ **People & Responsibilities section** shows all three people with their tasks

---

## Test Scenario 3: Deduplication

Verify that duplicate imports don't create duplicate action items.

### Steps:

1. **Import the conversation** from Test Scenario 2 (if not already done)
2. **Note the Action Items count** (should be 3)
3. **Import the SAME conversation again**

### Expected Results:

✅ Action Items count **remains 3** (not 6)
✅ No "New action items created" in changes log
✅ Console shows: "X duplicates skipped"

---

## Test Scenario 4: Status Updates

Verify that status changes are properly tracked.

### Steps:

1. **Complete Test Scenario 2** first (import initial conversation)
2. **Import this update:**

```
[15 Sep, 10:00 AM] Rohan (Architect):
Mrs. Sharma, I've sent you the two marble options via email. Please review when you have a moment.
```

### Expected Results:

✅ Rohan's "provide alternatives" action changes to **status: resolved**
✅ No duplicate "provide alternatives" action created
✅ Changes log mentions status update
✅ Action Items count may change (resolved items are hidden by default)

### Continue:

3. **Import this approval:**

```
[15 Sep, 2:00 PM] Mrs. Sharma (Client):
Option B looks perfect! Let's go with that one.

[15 Sep, 2:05 PM] Rohan (Architect):
Great! I'll order Option B today and release the installation once delivery is confirmed.
```

### Expected Results:

✅ Mrs. Sharma's approval action changes to **status: resolved**
✅ Vikram's hold installation action changes to **status: resolved** (blocker removed)
✅ New decision recorded: "Option B marble approved"
✅ Changes log shows multiple status updates

---

## Test Scenario 5: Ask AI

Verify the enhanced Ask AI functionality.

### Steps:

1. **Complete Test Scenario 2** first (import initial conversation)
2. **Go to Ask AI tab**
3. **Ask these questions:**

### Question 1: "What does Rohan need to do?"

**Expected Answer:**
> "Rohan needs to provide two alternative kitchen marble options. He has reached out to the supplier and expects to have options ready tomorrow morning."

✅ Answer mentions Rohan specifically
✅ Answer mentions the task (provide alternatives)
✅ Answer includes context (tomorrow morning)
✅ [View source] links are provided

### Question 2: "Who is responsible for the kitchen installation?"

**Expected Answer:**
> "Vikram's team is responsible for the installation, but the installation is currently on hold pending Mrs. Sharma's approval of the new marble."

✅ Answer mentions Vikram
✅ Answer mentions the hold status
✅ Answer explains why (waiting for approval)

### Question 3: "What is blocking the installation?"

**Expected Answer:**
> "The installation is blocked because Mrs. Sharma has not yet approved the replacement kitchen marble."

✅ Answer identifies the blocker
✅ Answer mentions what's needed (client approval)

### Question 4: "What are all the open action items?"

**Expected Answer:**
Should list all 3 action items with owners.

---

## Test Scenario 6: Visual Verification

Verify the UI improvements.

### Checklist:

Open the Dashboard and verify:

**People & Responsibilities Section:**
- ☐ Section appears above the main grid
- ☐ Shows all people with open action items
- ☐ Each person shows: Name — Role
- ☐ Bullet list of tasks under each person
- ☐ Due dates shown inline (if applicable)
- ☐ Dependencies shown inline (if applicable)
- ☐ Clean, readable formatting

**Action Items Card:**
- ☐ Owner displayed prominently (larger text, primary color)
- ☐ Owner role shown next to owner name
- ☐ Owner is the FIRST thing you see after the title
- ☐ Action type badge present (e.g., "assigned_task")
- ☐ Priority badge present with correct color
- ☐ Due date displayed in amber/yellow color
- ☐ Dependencies displayed (e.g., "Waiting for: ...")
- ☐ Status pill with correct color
- ☐ [View source] button functional
- ☐ Overall visual hierarchy is clear

**Stats Bar:**
- ☐ "Action items" shows correct count (3 for test scenario)
- ☐ "Pending decisions" shows correct count
- ☐ "Blockers" shows correct count

---

## Test Scenario 7: Edge Cases

### Test A: No Owner Identified

Import a conversation where the owner is unclear:

```
[16 Sep] Someone said: The living room paint needs to be redone.
```

**Expected:** Action item created with owner "Unassigned" or best guess

### Test B: Multiple Dependencies

Import a conversation with cascading dependencies:

```
[16 Sep] Rohan: We can't start the electrical work until the plumbing inspection passes.
[16 Sep] Rohan: And the inspection can't happen until the rough plumbing is complete.
```

**Expected:** Dependencies array has multiple items

### Test C: Informal Due Dates

Import various due date formats:

```
[16 Sep] Rohan: I'll have it ready by end of week.
[16 Sep] Vikram: Let's target Monday.
[16 Sep] Mrs. Sharma: I need this ASAP.
```

**Expected:** Due dates extracted even when informal

---

## Verification Checklist

After completing all tests, verify:

**Functionality:**
- ☐ Multiple action items extracted per conversation
- ☐ Specific owners identified
- ☐ Action types correctly classified
- ☐ Due dates extracted when mentioned
- ☐ Dependencies tracked
- ☐ Status changes properly detected
- ☐ No duplicate action items on re-import
- ☐ Ask AI answers responsibility questions

**UI/UX:**
- ☐ Owner prominently displayed
- ☐ People & Responsibilities section present
- ☐ All metadata visible (type, priority, due date, dependencies)
- ☐ Visual hierarchy clear and easy to scan
- ☐ [View source] buttons work
- ☐ Colors and badges appropriate

**Data Integrity:**
- ☐ No duplicate messages in DB
- ☐ No duplicate events in DB
- ☐ State changes logged in changes array
- ☐ Deduplication working correctly
- ☐ Source traceability maintained

**Performance:**
- ☐ AI extraction completes in reasonable time (<30s)
- ☐ Dashboard loads quickly
- ☐ No console errors
- ☐ No memory leaks

---

## Troubleshooting

### Issue: Only 1 action item appears

**Possible Causes:**
1. AI provider (Gemini/Groq) not working → falls back to rule-based extraction
2. Rule-based extraction needs more patterns

**Check:**
- Console logs for AI provider status
- Look for "✓ Gemini responded successfully" or "✓ Groq responded successfully"
- If you see "rule-based fallback", check your API keys

**Solution:**
- Verify API keys in `.env`
- Check API key quotas/limits
- Try the import again (sometimes AI providers have temporary issues)

### Issue: No "People & Responsibilities" section

**Possible Cause:**
- No action items with status !== "resolved"

**Check:**
- Verify action items exist in the Action Items card
- Check if all action items are resolved (they wouldn't show in the People section)

**Solution:**
- Import a fresh conversation with open action items

### Issue: Owners not showing

**Possible Cause:**
- AI didn't extract owner names

**Check:**
- View the raw JSON in the database or console
- Check if messages contain clear person names

**Solution:**
- Use conversations with clear name attributions (e.g., "[Name]:" or "Name (Role):")

### Issue: Build fails

**Error:** Type errors in TypeScript

**Solution:**
```bash
# Regenerate Prisma client
npm run db:generate

# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

---

## Success Criteria

The implementation is successful if:

✅ **Extraction:** 3+ action items extracted from the test conversation (not just 1)
✅ **Owners:** All action items have specific owners (Rohan, Mrs. Sharma, Vikram)
✅ **Types:** Action items classified by type (assigned_task, approval_required, waiting_action)
✅ **UI:** Owner displayed prominently in larger text
✅ **UI:** People & Responsibilities section appears on dashboard
✅ **Dependencies:** Dependencies tracked and displayed
✅ **Due Dates:** Due dates extracted and displayed
✅ **Deduplication:** No duplicate action items on re-import
✅ **Status Updates:** Status changes properly detected and updated
✅ **Ask AI:** Can answer "Who needs to do what?" questions
✅ **Source Links:** [View source] buttons work correctly
✅ **No Breakage:** All existing features still work

---

## Reporting Issues

If you find issues, please report:

1. **What you did:** Steps to reproduce
2. **What you expected:** Desired behavior
3. **What happened:** Actual behavior
4. **Console output:** Any error messages
5. **Screenshot:** If UI-related

Example:
```
Issue: Only 1 action item showing instead of 3

Steps:
1. Imported test conversation from TESTING_GUIDE.md
2. Checked dashboard

Expected: 3 action items (Rohan, Mrs. Sharma, Vikram)
Actual: 1 action item (only Rohan)

Console: "✓ Gemini responded successfully"
Screenshot: [attached]
```
