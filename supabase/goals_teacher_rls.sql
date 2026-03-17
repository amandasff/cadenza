-- Allow teachers to delete and update goals they created
-- (Goals they set for students in their studio)

CREATE POLICY "Teachers can delete their goals"
  ON public.goals
  FOR DELETE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their goals"
  ON public.goals
  FOR UPDATE
  USING (teacher_id = auth.uid());
