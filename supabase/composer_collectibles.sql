-- ============================================================
-- Composer Collectibles System
-- Run in Supabase SQL Editor
-- ============================================================

-- Master list of all collectable composer avatars
CREATE TABLE IF NOT EXISTS public.composer_avatars (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  composer_name   TEXT NOT NULL UNIQUE,          -- "Bach", "Beethoven", etc.
  era             TEXT NOT NULL,                  -- 'baroque' | 'classical' | 'romantic' | 'impressionist'
  rarity          TEXT NOT NULL DEFAULT 'common', -- 'common' | 'rare' | 'epic' | 'legendary'
  image_path      TEXT NOT NULL,                  -- e.g. '/composers/bach.jpg'
  fun_fact        TEXT,                           -- kid-friendly fact shown on unlock
  unlock_hint     TEXT,                           -- hint shown on the locked silhouette
  drop_weight     INTEGER NOT NULL DEFAULT 10,    -- higher = more likely in random pool
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,  -- false = coming soon / seasonal
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.composer_avatars ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read the master list
CREATE POLICY "Authenticated users can read composer_avatars"
  ON public.composer_avatars FOR SELECT
  TO authenticated
  USING (true);

-- ── Insert all 9 composers ────────────────────────────────────────────────────

INSERT INTO public.composer_avatars
  (composer_name, era, rarity, image_path, fun_fact, unlock_hint, drop_weight, sort_order)
VALUES
  (
    'Bach',
    'baroque',
    'common',
    '/composers/bach.jpg',
    'Bach had 20 children — several became famous composers. He basically started a music dynasty.',
    'A Baroque master who invented the rules of harmony everyone still uses today.',
    15,
    1
  ),
  (
    'Mozart',
    'classical',
    'common',
    '/composers/mozart.jpg',
    'Mozart wrote his first symphony at age 8. His first piano concerto? Age 4.',
    'The ultimate child prodigy — he was performing for kings before he could write his own name.',
    15,
    2
  ),
  (
    'Haydn',
    'classical',
    'common',
    '/composers/haydn.jpg',
    'Haydn was Mozart''s mentor and close friend. He''s often called the "father of the symphony."',
    'The composer who invented the symphony and string quartet as we know them.',
    12,
    3
  ),
  (
    'Schubert',
    'romantic',
    'common',
    '/composers/schubert.jpg',
    'Schubert wrote over 600 songs — and died at just 31. That''s one song every two weeks of his life.',
    'A Romantic poet of melody — he could write a masterpiece in a single afternoon.',
    12,
    4
  ),
  (
    'Beethoven',
    'romantic',
    'rare',
    '/composers/beethoven.jpg',
    'Beethoven was completely deaf when he wrote his 9th Symphony. He never heard a single note of it performed.',
    'Unlock by reaching a 7-day practice streak.',
    8,
    5
  ),
  (
    'Chopin',
    'romantic',
    'rare',
    '/composers/chopin.jpg',
    'Chopin only performed publicly about 30 times in his entire life — he had terrible stage fright. Yet everyone knew who he was.',
    'The poet of the piano — unlock by practicing 5 hours total.',
    8,
    6
  ),
  (
    'Brahms',
    'romantic',
    'rare',
    '/composers/brahms.jpg',
    'Brahms burned most of his early compositions, convinced they weren''t good enough. He was a perfectionist to the end.',
    'The philosopher of music — unlock by completing 5 goals.',
    8,
    7
  ),
  (
    'Tchaikovsky',
    'romantic',
    'rare',
    '/composers/tchaikovsky.jpg',
    'Tchaikovsky hated The Nutcracker. He thought it was silly — it''s now the most-performed ballet in history.',
    'Master of drama and beauty — unlock by logging 20 practice sessions.',
    8,
    8
  ),
  (
    'Debussy',
    'impressionist',
    'epic',
    '/composers/debussy.jpg',
    'Debussy was nearly expelled from music school for his "unacceptable" chord ideas. Those ideas changed all music that came after.',
    'A rare find — unlocked by completing ear training exercises.',
    4,
    9
  )
ON CONFLICT (composer_name) DO NOTHING;

-- ── Student inventory ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_collectibles (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id           UUID NOT NULL REFERENCES public.composer_avatars(id) ON DELETE CASCADE,
  acquired_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  acquisition_method  TEXT NOT NULL DEFAULT 'practice_drop',
    -- 'practice_drop' | 'streak_bonus' | 'goal_milestone' | 'performance_edition' | 'teacher_gift' | 'welcome_gift'
  is_favorite         BOOLEAN NOT NULL DEFAULT false,
  shard_count         INTEGER NOT NULL DEFAULT 0, -- duplicate shards accumulated
  UNIQUE(student_id, avatar_id)                   -- one entry per composer per student
);

ALTER TABLE public.student_collectibles ENABLE ROW LEVEL SECURITY;

-- Students can read their own collection
CREATE POLICY "Students can read own collectibles"
  ON public.student_collectibles FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Students can update their own favorites
CREATE POLICY "Students can update own collectibles"
  ON public.student_collectibles FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Insert is handled server-side via admin client (award route)
-- No direct insert policy needed for students

-- ── Drop tracking (pity timer) ────────────────────────────────────────────────
-- Tracks how many eligible sessions a student has had since their last drop.
-- This lives on the profile as a simple counter to avoid a heavy query.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS collectible_sessions_since_drop INTEGER NOT NULL DEFAULT 0;

-- ── Era set completion view ───────────────────────────────────────────────────
-- Useful for checking era completion bonuses without complex queries

CREATE OR REPLACE VIEW public.student_era_progress AS
SELECT
  sc.student_id,
  ca.era,
  COUNT(DISTINCT ca.id) AS collected,
  (SELECT COUNT(*) FROM public.composer_avatars ca2
   WHERE ca2.era = ca.era AND ca2.is_active = true) AS total
FROM public.student_collectibles sc
JOIN public.composer_avatars ca ON ca.id = sc.avatar_id
GROUP BY sc.student_id, ca.era;
