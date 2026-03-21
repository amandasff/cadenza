-- ─── Piece Games ─────────────────────────────────────────────────────────────
-- Stores OMR-extracted note sequences so students can practice their pieces
-- in the pitch-lane game. One row per (student, piece) pair.
-- Re-generating overwrites via UPSERT.

CREATE TABLE IF NOT EXISTS public.piece_games (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id       UUID NOT NULL,
  student_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes_json     JSONB NOT NULL,          -- [{ note, octave, duration, beat }]
  key_signature  TEXT,
  time_signature TEXT,
  bpm_suggestion INTEGER DEFAULT 80,
  omr_confidence FLOAT DEFAULT 0,        -- 0-1, warn student if < 0.7
  source_url     TEXT,                   -- sheet_music_url used for generation
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(piece_id, student_id)
);

ALTER TABLE public.piece_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own piece games"
  ON public.piece_games FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
