# Product brainstorm — July 2026

Working notes from a strategy session (2026-07-03). These are directional ideas;
promote items into TODOS.md (with effort/priority/context) once decided.
Status: Amanda is pre-first-external-customer — she runs her own studio on
Cadenza, which makes her studio the design-partner lab for everything below.

## Strategic frame (agreed)

Teacher-led wedge first, parents as the retention/expansion layer, self-learner
B2C (the Duolingo battlefield) deferred. The moat is practice data feeding AI
lesson prep — no competitor (myMusicStaff etc.) has the data. Core metric:
weekly-practicing students per studio.

Inner loop (studio runs on Cadenza): lesson notes → prep card → AI lesson
planner → practice assignments.
Outer loop (studio visible to the world): recitals → profiles → studio-to-studio
community.

## Sequencing consensus

1. Lesson notes (TODOS #7) — smallest, unblocks planner; add voice-memo
   dictation to kill the friction risk.
2. Online recital v1 — targeted at a real date for Amanda's studio (forcing
   function). Profile upgrades ride along.
3. AI lesson planner (TODOS #6) — better after weeks of real notes exist.
4. Practice assignments (NEW) — lesson plan homework lands on the student's
   practice screen as their checklist. Ties the loops together. Candidate P1.
5. Demo student (#3), CSV export (#4), then pricing (#2), parent portal (#1).

Deliberately deferred: more games/collectibles expansion as a strategy, Stripe
payment processing, TODOS #11 (perf, not needed at current scale).

## Online recitals (NEW — Amanda is enthusiastic)

V1 = a recital page: date, program (student + piece), uploaded recordings
(existing infra), beautiful shareable link styled like a printed concert program
(cream/serif brand). Growth mechanic: families forward the link. Later: joint
cross-studio recitals. Every recital adds a permanent "performances" line to
each performer's profile (Strava race-results pattern).
Open decision: pick a real date for the first one (Amanda's studio).

## Musician profiles v2 (NEW)

Principle: musician identity, not social media — Letterboxd/Strava dignity, not
follower counts. Concert-program bio: instrument, level, current repertoire,
recordings, practice heatmap (ContributionsGraph exists), performance history.
Private by default, share link, first name + initial for minors, no
likes/followers. Only social mechanic considered: teacher comments.
See mockup discussed 2026-07-03 (concert-program aesthetic).

## Personalization economy (NEW — replaces "fake store feels gimmicky")

Test for every item: "would a 24-year-old conservatory student use this
un-ironically?" Mechanic stays (points → purchases), goods become taste:
- Profile editions: typographic/visual themes for profile + public page
  (baroque engraving, art-deco poster, modern minimal). Same store, all ages.
- Composer collectibles elevated by art direction (engraved trading-card
  portraits) — kids collect, adults appreciate.
- "Buying music": public-domain repertoire only (no licensing rabbit hole).
  Points unlock engraved editions of real pieces — a purchase that is also a
  practice goal.
- Default avatars: illustrated instrument portraits / monograms (keeps kids'
  selfies off public pages).

## Local community (NEW — reshaped for safety)

VETOED shape: location-based discovery of strangers for minors. Never.
Agreed-direction shapes:
- Studio-to-studio: teachers link studios for joint recitals and month-long
  practice challenges. Growth kicker: accepting a challenge requires the other
  teacher to join Cadenza. Kids get local community via trusted adults.
- Aggregate city leaderboards ("Toronto practiced 40,000 min this month") —
  local flavor, zero individual exposure.
- Adults-only (18+) opt-in local discovery (duet partners, chamber groups,
  open mics) as a separate, later phase; kid accounts never see it.
