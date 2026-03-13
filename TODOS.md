# Cadenza — Deferred Work

Items identified during CEO + engineering review (2026-03-12 and 2026-03-13) that are high-value but not yet built.

---

## P1 — Critical for go-to-market

### 1. Parent accounts + portal (replaces old "parent view" TODO)
**What:** A full `role=parent` account type with dual onboarding: (A) teacher adds parent_email to student profile → parent gets invite → creates account auto-linked to child + studio, OR (B) parent signs up independently → enters a child link code → links to child. Parent dashboard shows: child's streak, practice sessions, goals, teacher notes, lesson schedule. Parents also get their own practice features (timer, games, AI tutor) and a curated support resources page (practice routines, motivation tips, understanding practice data).

**Why:** Parents write the checks for kids' music lessons. They need visibility AND empowerment. A parent who can see their child's practice AND learn alongside them is deeply invested. This is the unlock for the school-age student market. No competitor offers parent-as-learner.

**Pros:** Three value streams from one feature: (1) parent visibility increases teacher credibility, (2) parent practice features add a new revenue stream, (3) support resources reduce churn by helping parents help kids. Teachers get a concrete talking point: "Your parents can see everything AND learn music themselves."

**Cons:** Largest build effort of any TODO. New role type, new RLS policies, dual onboarding flows, child-parent linking, support resources content. Needs careful data scoping — parents see child data but not other students' data.

**Context:** New `role='parent'` value in profiles. New `parent_student_links(id, parent_id, student_id, linked_via, created_at)` table. Teacher sets `parent_email` on student profile → triggers invite. OR parent enters a `child_link_code` (generated per student, shown to teacher). Parent dashboard at `/parent/dashboard`. Own practice at `/parent/practice`. Support resources at `/parent/resources`. RLS: parent can SELECT child's goals, sessions, pieces, lesson schedule. Parent's own practice data is separate (their own profile).

**Effort:** L
**Priority:** P1 (Phase 2 — after AI Planner + Payment Log)
**Depends on:** Nothing, but benefits from Lesson Notes (#7) being built first.

---

### 2. Three-tier pricing model
**What:** Restructure from the current per-student model to three tiers: (1) **Free** — self-learners and students in a studio get core features; (2) **Pro ($4.99/mo)** — self-learners pay for AI tutor, all games, social/community; (3) **Studio ($19-29/mo, teacher pays)** — all students in the studio get Pro included, plus teacher gets AI Lesson Planner, payment tracker, parent portal, studio management.

**Why:** Most music teachers use nothing (not myMusicStaff, not anything). The opportunity is to sell running water to people hauling buckets — a comprehensive platform vs. a teacher's notebook + Venmo. Self-learners (people practicing without a formal teacher) are a huge adjacent market who would pay for the student features alone. The Studio tier gives teachers a compelling ROI: one payment, all their students get Pro.

**Pros:** Three clear value propositions for three user types. Self-learners provide organic growth and B2C revenue. Teachers provide B2B revenue and bring 10-15 students each. Network effect: self-learners and studio students are on the same social platform.

**Cons:** More pricing complexity than "one plan." Requires Stripe product restructuring, new upgrade flows, and changing the landing page significantly.

**Context:** Current model: students pay $4.99/mo Pro. New model: teachers pay $19-29/mo Studio (students in their studio get Pro free), self-learners pay $4.99/mo Pro independently. Stripe webhook at `app/api/stripe/webhook/route.ts`. The `profiles` table has `subscription_status` and `stripe_customer_id`. Need to add a concept of "studio subscription" that grants Pro to all students in a studio. Pricing page lives in `app/page.tsx`.

**Effort:** L
**Priority:** P1
**Depends on:** Nothing — but de-risks other features (parent portal, AI planner) to have a clear pricing context.

---

## P2 — High value, do soon

### 3. Teacher demo / onboarding mode
**What:** When a teacher creates a studio, auto-seed it with a clearly-labeled "Demo Student" with sample goals, a past practice session, and a streak. Let them delete it when ready.

**Why:** Right now a new teacher sees an empty dashboard and must invite a real student before experiencing any product value. A demo student lets them explore the full loop (goals → practice → review → encouragement) in 2 minutes.

**Pros:** Dramatically improves teacher trial-to-activation rate. Classic onboarding technique that works (Notion, Linear, Figma all do this).

**Cons:** Demo data needs to be clearly labeled so teachers don't confuse it with real students. Needs a "Delete demo student" button.

**Context:** Studio creation happens in `app/teacher/onboard`. After studio creation, insert a profile row with `display_name = "Demo Student (sample data)"` and a `is_demo = true` flag (or just a naming convention). Seed 1 goal (status: current) and 1 practice session from yesterday.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing.

---

### 4. CSV data export for teachers
**What:** A button in the teacher Studio settings that exports all student data as a CSV: student names, goals (title, status, points), and practice session history (date, duration in minutes).

**Why:** Teachers need to feel they own their data. "Can I get my data out?" is a standard objection in any SaaS sale. Without export, cautious teachers won't commit.

**Pros:** Removes a real sales objection before it's raised. Takes ~30 minutes to build. One new API route + a download button in `/teacher/studio`.

**Cons:** None meaningful. The data is already accessible via existing services (StudioService, GoalService, PracticeService).

**Context:** New route at `app/api/teacher/export/route.ts`. Query all students in the studio, their goals, and their last 90 days of practice sessions. Format as CSV with headers: `student_name, goal_title, goal_status, goal_points, session_date, session_minutes`.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing.

---

### 6. AI Lesson Planner
**What:** A page at `/teacher/student/[id]/lesson-plan` (or a modal in the schedule page) where the teacher selects a student and the AI generates a structured lesson plan. The AI reads: current goals (title, status), recent practice sessions (last 7 days — duration, segments worked on, mood), active pieces, and any prior lesson notes. Teacher reviews and edits the plan before saving. Student sees it in their chat after the lesson as a "Lesson Plan" system message.

**Why:** No competitor has practice data to inform AI lesson planning. myMusicStaff can't do this. A teacher who plans a lesson in 2 minutes (vs. 15 minutes from memory) will never go back. This is Cadenza's highest-moat feature.

**Pros:** Completely defensible — requires the student's actual practice data which only Cadenza has. Saves teachers 10-15 min per student per week. Creates switching cost (all lesson history locked in). Natural AI upsell for Studio tier.

**Cons:** Quality depends on how much practice data the student has. New students with 0 sessions will get a generic plan. Requires careful prompt engineering to produce pedagogically sound output (not just filler).

**Context:** All needed data already exists in Supabase: `goals` table (goals with status/points), `practice_sessions` table (has segments_json with practice areas, duration, mood, student notes), `pieces` table (pieces the student is learning), `lessons` table (once lesson notes are added — see TODO #7). The AI call follows the same pattern as `app/api/ai-tutor/route.ts`. Output should be structured JSON: `{ warmup: string, pieces: [{title, focus, notes}], technique: string, celebrate: string, homework: string[] }`. New API route: `app/api/ai/lesson-plan/route.ts`.

**Effort:** M
**Priority:** P1
**Depends on:** TODO #7 (Lesson Notes) for best results, but can be built without it using goals + practice data alone.

---

### 7. Lesson Notes (extend Schedule page)
**What:** Add a `notes` text field to each lesson in the schedule page. After a lesson, the teacher writes 1-3 sentences about how it went. Optionally, AI expands the note into a structured recap. Notes appear in the parent portal and are used by the AI Lesson Planner.

**Why:** Teachers currently write lesson notes in a physical notebook or a Notes app. Bringing notes into Cadenza creates: (1) data for the AI planner, (2) content for the parent portal, (3) a searchable lesson history. This is the connective tissue between the schedule and the AI features.

**Pros:** Small effort (add a `notes` column to `lessons` table + textarea in the schedule UI), high leverage (unblocks AI planner and parent portal with real content). Teachers already write notes — this just moves where they write them.

**Cons:** Teachers won't write notes if it's friction-heavy. The UX must be frictionless: after marking a lesson complete, a small notes popover appears. Optional, not required.

**Context:** The `lessons` table needs a `notes TEXT` column (nullable). The schedule page (`app/teacher/schedule/page.tsx`) is already complex — add a "Notes" textarea that appears when a lesson is expanded or after clicking "Mark complete." Save via the existing lesson update API. Display in the per-student view (`app/teacher/student/[id]/page.tsx`).

**Effort:** S
**Priority:** P1
**Depends on:** Nothing. Unblocks AI Lesson Planner.

---

### 8. Payment Log + Invoice PDF
**What:** A "Payments" tab in the per-student view (`/teacher/student/[id]`). Teacher sets a monthly rate or per-lesson rate for each student. The system shows: what's been paid, what's outstanding, and total receivable. Teacher marks payments received. Teacher can generate a clean printable invoice (HTML → PDF or printable page) for any billing period.

**Why:** Most music teachers use nothing to track payments — they remember, text parents, or use a spreadsheet. A clean payment log in Cadenza eliminates that entirely. The invoice PDF is something teachers can send to parents via email. No Stripe Connect needed — parents pay however they want (Venmo, cash, check). The value is in the tracking, not the processing.

**Pros:** Eliminates the spreadsheet. Professional invoices increase perceived value of the teacher's service. Simple to build (new `lesson_payments` table + UI). Becomes a revenue dashboard: "You have $X outstanding this month."

**Cons:** No online payment processing in v1 — parents still pay outside the app. Some teachers may want Stripe in the future (add later as TODO).

**Context:** New Supabase table: `lesson_payments(id, studio_id, student_id, amount_cents, description, paid_at TIMESTAMPTZ nullable, due_date DATE, notes TEXT, created_at)`. The student profile needs a `lesson_rate_cents INT` field. Revenue dashboard: query all payments for the studio, group by student, show paid/unpaid. Invoice generation: simple React page with `@media print` CSS, or use browser `window.print()`. Rate can be set on `/teacher/student/[id]`.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing.

---

### 9. Lesson prep card (on schedule page)
**What:** Before a scheduled lesson, show a summary card on the schedule page: student's practice this week (total minutes, practice areas breakdown, mood trend), current goals status (X of Y completed), and last lesson notes. Teacher sees everything they need for the upcoming lesson in one glance.

**Why:** Teachers currently click through 3 pages (dashboard → student → goals) to prepare for a lesson. A prep card on the schedule page transforms it from a calendar into an intelligent lesson prep tool. This is the kind of detail that makes teachers say "this app *gets* me."

**Pros:** High teacher delight for moderate effort. Uses all existing data (practice sessions, goals, lesson notes). Natural integration point — the schedule page already shows upcoming lessons. Sets the stage for the AI Lesson Planner (prep card shows the data, AI interprets it).

**Cons:** Schedule page is already complex (~800 lines). Need to keep the card compact so it doesn't overwhelm. Performance: fetching practice data for all upcoming students in one query.

**Context:** Expand the lesson card in `app/teacher/schedule/page.tsx`. For each upcoming lesson, fetch: `practice_sessions` from the last 7 days (sum minutes, extract mood, group by practice area), `goals` (count current/completed), `lessons` (last lesson's notes). Display as a collapsible card below the lesson time/student info. Use existing services: PracticeService, GoalService, LessonService.

**Effort:** M
**Priority:** P1
**Depends on:** Nothing. Enhanced by Lesson Notes (#7).

---

### 10. Student needs attention nudge
**What:** On the teacher dashboard, highlight students whose streak broke or who haven't practiced in 3+ days. Show a visual indicator (amber/red dot) on the student card. Include a one-tap "Send encouragement" button that opens a pre-filled chat message like "Hey [name], I noticed you haven't practiced in a few days — even 10 minutes makes a difference! 🎵"

**Why:** Teachers can't monitor every student's practice daily. A nudge system makes the dashboard proactive instead of passive. The teacher feels like Cadenza is their assistant, not just a filing cabinet. Students who get timely encouragement are less likely to quit.

**Pros:** Small build, high impact. Uses existing streak_days + practice_sessions data. Chat send already works. Makes the teacher dashboard feel alive and intelligent.

**Cons:** Risk of notification fatigue if too many students show warnings. Need a threshold that's useful but not noisy (3 days seems right for weekly-lesson students).

**Context:** On `app/teacher/page.tsx`, check each student's last practice session date. If > 3 days ago or streak_days dropped from previous value, show an amber indicator. One-tap "Encourage" button calls ChatService.sendPrivateMessage with a template. Teacher can edit before sending.

**Effort:** S
**Priority:** P2
**Depends on:** Nothing.

---

### 5. Weekly progress email to parents
**What:** An automated email sent every Sunday to a parent/guardian email address showing: child's practice streak, total minutes this week, and teacher's most recent goal note.

**Why:** Parents are the hidden buyers for school-age students. An automated weekly summary keeps them informed without any effort from the teacher — and gives teachers a compelling demo artifact ("show this to parents when you sign up").

**Pros:** Word-of-mouth driver. Parents forwarding this email is free marketing. Teachers can use it as a sign-up incentive.

**Cons:** Requires: (1) parent email field on student profiles, (2) email service integration (Resend recommended — simple API, generous free tier), (3) a cron job or Supabase scheduled function. More moving parts than the other TODOs.

**Context:** Add `parent_email` column to `profiles` table. Teacher can set it on the student detail page (`/teacher/student/[id]`). Sunday send via a Vercel cron route (`app/api/cron/weekly-summary/route.ts`). Use Resend SDK (`npm install resend`). Template: simple HTML with streak number, minutes bar, and last goal title.

**Effort:** L
**Priority:** P2
**Depends on:** Email service setup (Resend account + API key), `parent_email` column migration.
