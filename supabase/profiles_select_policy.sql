-- ============================================================
-- Run this in your Supabase SQL Editor if login shows
-- "profile not found" for existing accounts.
-- https://supabase.com/dashboard/project/hpeuksywiuijkvvqlfhx/sql
-- ============================================================

-- Allow each user to read their own profile row.
-- This policy may be missing if it was never created or was accidentally dropped.
CREATE POLICY IF NOT EXISTS "users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Also allow teachers to read their students' profiles
-- (needed so teacher pages can show student info).
CREATE POLICY IF NOT EXISTS "teachers can read studio member profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    studio_id IN (
      SELECT id FROM public.studios WHERE owner_id = auth.uid()
    )
  );
