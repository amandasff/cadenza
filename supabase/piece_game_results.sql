-- ─── Piece Game Results ──────────────────────────────────────────────────────
-- Tracks each play-through of a practice game so students and teachers
-- can see accuracy progression over time.

CREATE TABLE IF NOT EXISTS public.piece_game_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id       UUID NOT NULL,
  student_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_notes    INTEGER NOT NULL,
  hits           INTEGER NOT NULL,
  misses         INTEGER NOT NULL,
  accuracy       FLOAT NOT NULL,             -- 0-1
  per_note       JSONB,                      -- [{ note, octave, result: "hit"|"miss" }]
  played_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.piece_game_results ENABLE ROW LEVEL SECURITY;

-- Students can insert their own results and read them
CREATE POLICY "Students can manage own game results"
  ON public.piece_game_results FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Teachers can view their students' results
CREATE POLICY "Teachers can view student game results"
  ON public.piece_game_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = piece_game_results.student_id
      AND s.teacher_id = auth.uid()
    )
  );
