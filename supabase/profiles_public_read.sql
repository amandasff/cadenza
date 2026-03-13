-- Allow all authenticated users to read any profile's basic info.
-- Needed for: discover page, seeing other students' avatars,
-- students seeing their teacher's profile, chat headers, etc.
-- Run once in the Supabase SQL editor.

CREATE POLICY IF NOT EXISTS "authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
