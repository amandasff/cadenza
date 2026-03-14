-- External students: students not yet on the Cadenza app
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS external_students (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id    UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT,
  instrument   TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE external_students ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own external students
CREATE POLICY "Teachers manage their external students"
  ON external_students
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Add external_student_id to lessons and recurrences
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS external_student_id UUID REFERENCES external_students(id) ON DELETE SET NULL;

ALTER TABLE lesson_recurrences
  ADD COLUMN IF NOT EXISTS external_student_id UUID REFERENCES external_students(id) ON DELETE SET NULL;

-- Allow student_id to be null (for external-student lessons)
ALTER TABLE lessons
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE lesson_recurrences
  ALTER COLUMN student_id DROP NOT NULL;
