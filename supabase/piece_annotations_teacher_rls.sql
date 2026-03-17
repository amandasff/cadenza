-- Allow teachers to read annotations for students in their studio
-- Requires piece_annotations table to exist (created by students when annotating)

-- First ensure RLS is enabled
ALTER TABLE public.piece_annotations ENABLE ROW LEVEL SECURITY;

-- Students can read/write their own annotations (may already exist)
CREATE POLICY IF NOT EXISTS "Students manage own annotations"
  ON public.piece_annotations
  FOR ALL
  USING (student_id = auth.uid());

-- Teachers can read annotations for students in their studio
CREATE POLICY "Teachers can read student annotations"
  ON public.piece_annotations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = piece_annotations.student_id
        AND p.studio_id IN (
          SELECT id FROM public.studios WHERE teacher_id = auth.uid()
        )
    )
  );
