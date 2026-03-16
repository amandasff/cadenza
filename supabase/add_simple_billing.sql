-- Run this in Supabase Dashboard → SQL Editor → New Query

-- Add parent contact info + billing preferences to billing_configs
ALTER TABLE billing_configs
  ADD COLUMN IF NOT EXISTS parent_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_email TEXT,
  ADD COLUMN IF NOT EXISTS parent_phone TEXT,
  ADD COLUMN IF NOT EXISTS lesson_rate_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS makeup_credits INTEGER NOT NULL DEFAULT 0;

-- Add invoice detail columns to tuition_records
ALTER TABLE tuition_records
  ADD COLUMN IF NOT EXISTS lesson_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS makeup_credits_applied INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_charges_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_charges_desc TEXT;
