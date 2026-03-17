-- Add birth_year and gender to profiles for personalised AI notifications.
-- Run this in the Supabase SQL Editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birth_year  smallint  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gender      text      DEFAULT NULL;  -- 'boy' | 'girl' | null

-- Allow students to update their own birth_year and gender.
-- Teachers / admins can also update any profile via the service role key.
-- (No extra RLS policy needed — existing "users can update own profile" policy covers it.)

-- Quick check: show the new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('instrument', 'birth_year', 'gender');
