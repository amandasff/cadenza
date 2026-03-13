# Cadenza — Deferred Work

Items identified during CEO + engineering review (2026-03-12) that are high-value but not yet built.

---

## P1 — Critical for go-to-market

### 1. Parent view (read-only practice summary)
**What:** A `/parent` route or shareable link that shows a child's practice streak, recent sessions, and teacher goals for the week. Read-only, no login required (token-based or public link).

**Why:** Parents write the checks for kids' music lessons. Without visibility into practice habits, they have no reason to trust (or pay for) the platform. This is the unlock for the school-age student market.

**Pros:** Gives teachers a concrete talking point when signing up parents. "Send them this link and they'll see everything." Removes the parent from being a black box.

**Cons:** Requires careful auth design — parent accesses student data without being a studio member. Needs RLS policies that scope access to a signed token or public student ID.

**Context:** The teacher already sees this data at `/teacher/student/[id]`. The parent view is a stripped-down version of that page — streak, last 7 sessions (date + duration), current goals. No chat, no recordings.

**Effort:** M
**Priority:** P1
**Depends on:** Nothing — can be built independently.

---

### 2. Flip Stripe to teacher-side pricing
**What:** Move the Stripe subscription from students to teachers. Teachers pay ~$29/month for Pro (unlimited students, AI features, video lessons). Students are free.

**Why:** Teachers have budget and authority. Students (especially kids) don't have credit cards. The current model — students pay — is backwards for a B2B go-to-market where the teacher is the buyer and distribution channel.

**Pros:** One teacher acquisition = 15+ users. Unit economics flip from $X per student to $X per studio. Aligns payment with the person who feels the pain.

**Cons:** Requires new Stripe product/price IDs, updating the webhook to key on teacher profiles instead of student profiles, and changing the upgrade flow from `/student/upgrade` to a teacher settings page.

**Context:** Stripe webhook is in `app/api/stripe/webhook/route.ts`. Student upgrade page is at `app/student/upgrade`. The `profiles` table already has `subscription_status` and `stripe_customer_id` columns — just need to shift which role they apply to.

**Effort:** M
**Priority:** P1
**Depends on:** Nothing — can be done independently.

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

### 5. Weekly progress email to parents
**What:** An automated email sent every Sunday to a parent/guardian email address showing: child's practice streak, total minutes this week, and teacher's most recent goal note.

**Why:** Parents are the hidden buyers for school-age students. An automated weekly summary keeps them informed without any effort from the teacher — and gives teachers a compelling demo artifact ("show this to parents when you sign up").

**Pros:** Word-of-mouth driver. Parents forwarding this email is free marketing. Teachers can use it as a sign-up incentive.

**Cons:** Requires: (1) parent email field on student profiles, (2) email service integration (Resend recommended — simple API, generous free tier), (3) a cron job or Supabase scheduled function. More moving parts than the other TODOs.

**Context:** Add `parent_email` column to `profiles` table. Teacher can set it on the student detail page (`/teacher/student/[id]`). Sunday send via a Vercel cron route (`app/api/cron/weekly-summary/route.ts`). Use Resend SDK (`npm install resend`). Template: simple HTML with streak number, minutes bar, and last goal title.

**Effort:** L
**Priority:** P2
**Depends on:** Email service setup (Resend account + API key), `parent_email` column migration.
