-- ============================================================
-- Multi-teacher studio support
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add slug and teacher_invite_code to studios
ALTER TABLE studios ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS teacher_invite_code TEXT;

-- Generate slugs and teacher invite codes for existing studios
UPDATE studios
SET
  slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || substring(id::text, 1, 6),
  teacher_invite_code = lower(substring(gen_random_uuid()::text, 1, 8))
WHERE slug IS NULL;

-- Make slug unique
CREATE UNIQUE INDEX IF NOT EXISTS studios_slug_idx ON studios(slug);

-- ============================================================
-- 2. studio_teachers: multiple teachers per studio
-- ============================================================
CREATE TABLE IF NOT EXISTS studio_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('director', 'teacher')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(studio_id, teacher_id)
);

-- Backfill: existing studio owners become directors
INSERT INTO studio_teachers (studio_id, teacher_id, role)
SELECT id, owner_id, 'director'
FROM studios
ON CONFLICT (studio_id, teacher_id) DO NOTHING;

-- ============================================================
-- 3. teacher_student_assignments: track teacher-student pairs
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  student_id UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ  -- NULL = currently active
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS tsa_teacher_idx ON teacher_student_assignments(teacher_id, ended_at);
CREATE INDEX IF NOT EXISTS tsa_student_idx ON teacher_student_assignments(student_id, ended_at);

-- Backfill: assign all existing students to their studio's owner/director
INSERT INTO teacher_student_assignments (studio_id, teacher_id, student_id)
SELECT p.studio_id, s.owner_id, p.id
FROM profiles p
JOIN studios s ON s.id = p.studio_id
WHERE p.role = 'student' AND p.studio_id IS NOT NULL;

-- ============================================================
-- 4. enrollment_applications: public enrollment form
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  parent_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  instrument TEXT,
  age INTEGER,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  preferred_teacher_id UUID REFERENCES auth.users(id),
  preferred_days TEXT[],
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'waitlisted', 'denied')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ea_studio_status_idx ON enrollment_applications(studio_id, status, created_at DESC);

-- ============================================================
-- 5. RLS Policies
-- ============================================================

-- studio_teachers
ALTER TABLE studio_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can view teachers"
  ON studio_teachers FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Directors can manage studio teachers"
  ON studio_teachers FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid() AND role = 'director'
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid() AND role = 'director'
    )
  );

-- teacher_student_assignments
ALTER TABLE teacher_student_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers and students see relevant assignments"
  ON teacher_student_assignments FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR student_id = auth.uid()
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid() AND role = 'director'
    )
  );

CREATE POLICY "Teachers and directors manage assignments"
  ON teacher_student_assignments FOR ALL
  USING (
    teacher_id = auth.uid()
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid() AND role = 'director'
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid() AND role = 'director'
    )
  );

-- enrollment_applications
ALTER TABLE enrollment_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (no auth needed for enrollment form)
CREATE POLICY "Anyone can submit enrollment application"
  ON enrollment_applications FOR INSERT
  WITH CHECK (true);

-- Only directors can view/manage applications
CREATE POLICY "Directors can view enrollment applications"
  ON enrollment_applications FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid() AND role = 'director'
    )
  );

CREATE POLICY "Directors can update enrollment applications"
  ON enrollment_applications FOR UPDATE
  USING (
    studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid() AND role = 'director'
    )
  );
