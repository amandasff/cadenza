-- ============================================================
-- Run this in your Supabase SQL Editor (after setup.sql)
-- Adds structured piece/program hierarchy to the goal system
-- ============================================================

-- programs table: top-level containers (e.g. "RCM Level 6 Preparation")
CREATE TABLE IF NOT EXISTS public.programs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id   UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students and teachers can view own programs"
  ON public.programs FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR teacher_id = auth.uid());

CREATE POLICY "Teachers can manage programs"
  ON public.programs FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- pieces table: a piece/exercise from a book, assigned to a student
CREATE TABLE IF NOT EXISTS public.pieces (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id   UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  program_id  UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  composer    TEXT,
  book        TEXT,
  category    TEXT NOT NULL DEFAULT 'repertoire'
              CHECK (category IN ('technique','etude','repertoire','theory','ear_training','sight_reading','free')),
  status      TEXT NOT NULL DEFAULT 'learning'
              CHECK (status IN ('learning','polishing','performance_ready','completed')),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students and teachers can view own pieces"
  ON public.pieces FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR teacher_id = auth.uid());

CREATE POLICY "Teachers can manage pieces"
  ON public.pieces FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Add piece_id to existing goals table (nullable for backward compatibility)
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS piece_id UUID REFERENCES public.pieces(id) ON DELETE SET NULL;
