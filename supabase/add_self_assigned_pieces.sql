-- ─── Student self-assigned pieces ────────────────────────────────────────────
-- Allows students to add their own pieces and upload sheet music.

-- Add is_self_assigned flag
ALTER TABLE public.pieces
  ADD COLUMN IF NOT EXISTS is_self_assigned BOOLEAN NOT NULL DEFAULT false;

-- Make teacher_id nullable (self-assigned pieces have no teacher)
ALTER TABLE public.pieces
  ALTER COLUMN teacher_id DROP NOT NULL;

-- Make studio_id nullable too (solo students may not have a studio)
ALTER TABLE public.pieces
  ALTER COLUMN studio_id DROP NOT NULL;

-- Allow students to insert their own self-assigned pieces
CREATE POLICY "Students can self-assign pieces"
  ON public.pieces FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND is_self_assigned = true);

-- Allow students to update sheet_music_url and score_url on their own pieces
CREATE POLICY "Students can upload sheet music for their pieces"
  ON public.pieces FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Allow students to delete their own self-assigned pieces
CREATE POLICY "Students can delete self-assigned pieces"
  ON public.pieces FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND is_self_assigned = true);
