# Landing page — design decisions

Decided 2026-07-02 (landing-redesign branch). This doc is the source of truth for the
landing page direction so any future session can pick up without re-deciding.

## Goal

Convert more signups. Read as a premium, trustworthy SaaS ("professional platform"),
not a hobby/art project. Copy should sound natural and describe the real product.

## Direction

**"Show the product"** — the app itself is the hero. The landing page uses the exact
same design language as the product (see `app/globals.css` palette + fonts), so the
promise and the product are visually continuous.

- Layout: product-forward hero (mockup direction A) + split student/teacher CTAs
  (from direction C). Chosen over the editorial "conservatory" direction (B).
- Palette: existing tokens only — `--cream` background, `--charcoal` text,
  `--sage` primary green, `--peach` (terracotta) reserved as the single accent,
  `--muted`, `--border`. No new colors.
- Type: Cormorant Garamond for display headings, Inter for everything else
  (already loaded in `app/layout.tsx`). The old Space Grotesk / Work Sans landing
  fonts are retired.
- Imagery: real product screenshots from `public/slides/` in framed cards.
  No abstract art, no fake browser chrome exaggeration.
- Tone: plain, specific, warm. Name real features (AI tutor on the RCM syllabus,
  practice streaks, lesson chat, repertoire, recordings). No corporate filler
  ("seamless", "unlock", "empower"), no invented numbers.

## Page structure (slice 1 — built now)

1. Nav — wordmark, Features / For teachers anchors, Sign in, Start free
2. Hero — headline "Practice that carries the lesson home", subhead, split CTA
   cards (I'm learning / I teach) that open signup with the role pre-selected,
   product screenshot framed on the right
3. Features — 4 truthful feature blocks with screenshots where they help
4. For teachers — short section (studio view, feedback loop)
5. Final CTA band
6. Footer

Auth form: kept from the old page (same AuthService logic, Google OAuth, role
radio) restyled as a light slide-over. "Security Key" label renamed to "Password".

## Deferred slices (do NOT build until content/dependencies exist)

- **Testimonials** — needs 2–3 real quotes from actual teachers/students.
  Amanda is collecting. Never fabricate.
- **Founder profile** — needs Amanda's blurb + photo.
- **Pricing section** — blocked on TODOS.md #2 (three-tier Free/Pro/Studio
  restructure). Design the section when the tiers are real.
- **"Hear it in action"** — the old page streamed real student recordings via
  `/api/public/recordings`. Genuinely differentiating; consider reintroducing as
  a polished section later. Removed from slice 1 to keep the page focused.

## Old design (for the record)

The previous landing (pre-redesign) was an editorial slideshow: "VOL. n" captions,
live Toronto clock, brutalist all-caps Space Grotesk, black signup sheet. Retired
because it read as an art project and buried the product; see git history of
`app/page.tsx` on master before the landing-redesign branch merged.
