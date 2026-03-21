-- ─── Practice Journey ────────────────────────────────────────────────────────
-- Adds private session support and clipping to the practice flow.

-- Mark sessions as private (just-me timer) vs normal
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Clips recorded during a private session to send to the teacher
CREATE TABLE IF NOT EXISTS practice_clips (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  student_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_url    TEXT        NOT NULL,
  duration_seconds INTEGER     NOT NULL DEFAULT 0,
  clip_index       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE practice_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student can manage own clips"
  ON practice_clips FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "teacher can view student clips"
  ON practice_clips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions ps
      JOIN studios s ON s.id = ps.studio_id
      WHERE ps.id = practice_clips.session_id
        AND s.owner_id = auth.uid()
    )
  );
