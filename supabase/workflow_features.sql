-- ============================================================
-- Full Teacher Workflow Features Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. IN-LESSON NOTES — extend lessons table
-- ============================================================

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS covered_notes TEXT,
  ADD COLUMN IF NOT EXISTS focus_notes TEXT,
  ADD COLUMN IF NOT EXISTS next_lesson_notes TEXT,
  ADD COLUMN IF NOT EXISTS attendance TEXT
    CHECK (attendance IN ('attended', 'cancelled', 'no_show'))
    DEFAULT 'attended';

-- ============================================================
-- 2. WEEKLY ASSIGNMENT SHEET — extend assignments table
-- ============================================================

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS week_start DATE,
  ADD COLUMN IF NOT EXISTS times_per_week INT;

-- ============================================================
-- 3. BILLING & PAYMENTS
-- ============================================================

-- Per-student billing configuration
CREATE TABLE IF NOT EXISTS billing_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id),
  external_student_id UUID REFERENCES external_students(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  monthly_rate_cents INT NOT NULL DEFAULT 0,
  billing_day INT NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Monthly tuition records
CREATE TABLE IF NOT EXISTS tuition_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_config_id UUID NOT NULL REFERENCES billing_configs(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id),
  external_student_id UUID REFERENCES external_students(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  period_month DATE NOT NULL,
  amount_cents INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'waived')),
  paid_at TIMESTAMPTZ,
  payment_method TEXT CHECK (payment_method IN ('cash', 'e-transfer', 'cheque', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One-off charges
CREATE TABLE IF NOT EXISTS billing_charges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id),
  external_student_id UUID REFERENCES external_students(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  amount_cents INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_at TIMESTAMPTZ,
  charge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE billing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher manages billing_configs" ON billing_configs
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "teacher manages tuition_records" ON tuition_records
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "teacher manages billing_charges" ON billing_charges
  FOR ALL USING (teacher_id = auth.uid());

-- ============================================================
-- 4. LESSON SCHEDULING — teacher availability
-- ============================================================

CREATE TABLE IF NOT EXISTS availability_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher manages availability" ON availability_blocks
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "studio members view availability" ON availability_blocks
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- 5. PARENT PORTAL
-- ============================================================

-- Add 'parent' role to profiles (safe: existing rows unaffected)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'parent'));

-- Parent ↔ student links
CREATE TABLE IF NOT EXISTS parent_student_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  last_summary_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent sees own links" ON parent_student_links
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "teacher manages links" ON parent_student_links
  FOR ALL USING (
    studio_id IN (
      SELECT studio_id FROM studio_teachers WHERE teacher_id = auth.uid()
    )
  );

-- Parents can read their children's practice sessions
CREATE POLICY "parent sees child sessions" ON practice_sessions
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid()
    )
  );

-- Parents can read their children's lessons
CREATE POLICY "parent sees child lessons" ON lessons
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid()
    )
  );

-- Parents can read their children's billing
CREATE POLICY "parent sees child tuition" ON tuition_records
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "parent sees child charges" ON billing_charges
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid()
    )
  );

-- ============================================================
-- 6. PROGRESS REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS progress_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  term TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'archived')),
  overall_summary TEXT,
  strengths TEXT,
  areas_for_growth TEXT,
  goals_summary TEXT,
  practice_summary TEXT,
  repertoire_summary TEXT,
  teacher_comments TEXT,
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher manages reports" ON progress_reports
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "parent sees child reports" ON progress_reports
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid()
    )
  );

-- ============================================================
-- 7. RCM EXAM PREP TRACKER
-- ============================================================

CREATE TABLE IF NOT EXISTS rcm_exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  grade_level TEXT NOT NULL,
  instrument TEXT NOT NULL DEFAULT 'Piano',
  exam_date DATE,
  status TEXT NOT NULL DEFAULT 'preparing'
    CHECK (status IN ('preparing', 'completed', 'withdrawn')),
  exam_result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rcm_checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES rcm_exams(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'list_a', 'list_b', 'list_c', 'etudes', 'technical', 'theory', 'ear_training', 'sight_reading'
  )),
  title TEXT NOT NULL,
  composer TEXT,
  notes TEXT,
  piece_id UUID REFERENCES pieces(id) ON DELETE SET NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rcm_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE rcm_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher manages rcm exams" ON rcm_exams
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "student sees own rcm exams" ON rcm_exams
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "parent sees child rcm exams" ON rcm_exams
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "teacher manages checklist" ON rcm_checklist_items
  FOR ALL USING (
    exam_id IN (SELECT id FROM rcm_exams WHERE teacher_id = auth.uid())
  );

CREATE POLICY "student sees own checklist" ON rcm_checklist_items
  FOR SELECT USING (
    exam_id IN (SELECT id FROM rcm_exams WHERE student_id = auth.uid())
  );

CREATE POLICY "parent sees child checklist" ON rcm_checklist_items
  FOR SELECT USING (
    exam_id IN (
      SELECT e.id FROM rcm_exams e
      WHERE e.student_id IN (
        SELECT student_id FROM parent_student_links WHERE parent_id = auth.uid()
      )
    )
  );

-- ============================================================
-- Helper function: look up user by email (used by parent linking)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input TEXT)
RETURNS TABLE(id UUID) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE email = email_input LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_user_id_by_email TO authenticated;
