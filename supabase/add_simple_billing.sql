-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Creates the billing tables from scratch (safe to run even if they don't exist yet)

-- ── billing_configs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL,
  student_id            UUID REFERENCES profiles(id) ON DELETE CASCADE,
  external_student_id   UUID,
  teacher_id            UUID NOT NULL,
  monthly_rate_cents    INTEGER NOT NULL DEFAULT 0,
  billing_day           INTEGER NOT NULL DEFAULT 1,
  notes                 TEXT,
  -- simple billing fields
  parent_name           TEXT,
  parent_email          TEXT,
  parent_phone          TEXT,
  lesson_rate_cents     INTEGER NOT NULL DEFAULT 0,
  lesson_type           TEXT NOT NULL DEFAULT 'in_person',
  billing_type          TEXT NOT NULL DEFAULT 'private',
  makeup_credits        INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, student_id)
);

-- If the table already existed, add new columns safely
ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS lesson_rate_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'in_person';
ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'private';
ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS makeup_credits INTEGER NOT NULL DEFAULT 0;

-- ── tuition_records ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tuition_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_config_id       UUID REFERENCES billing_configs(id) ON DELETE CASCADE,
  studio_id               UUID NOT NULL,
  student_id              UUID REFERENCES profiles(id) ON DELETE CASCADE,
  external_student_id     UUID,
  teacher_id              UUID NOT NULL,
  period_month            TEXT NOT NULL,  -- 'YYYY-MM-01'
  amount_cents            INTEGER NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'unpaid',
  paid_at                 TIMESTAMPTZ,
  payment_method          TEXT,
  notes                   TEXT,
  lesson_count            INTEGER NOT NULL DEFAULT 0,
  makeup_credits_applied  INTEGER NOT NULL DEFAULT 0,
  extra_charges_cents     INTEGER NOT NULL DEFAULT 0,
  extra_charges_desc      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If the table already existed, add new columns safely
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS lesson_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS makeup_credits_applied INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS extra_charges_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS extra_charges_desc TEXT;

-- ── RLS policies ─────────────────────────────────────────────
ALTER TABLE billing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_records ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own billing configs
DROP POLICY IF EXISTS "teacher_billing_configs" ON billing_configs;
CREATE POLICY "teacher_billing_configs" ON billing_configs
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Teachers can manage their own tuition records
DROP POLICY IF EXISTS "teacher_tuition_records" ON tuition_records;
CREATE POLICY "teacher_tuition_records" ON tuition_records
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
