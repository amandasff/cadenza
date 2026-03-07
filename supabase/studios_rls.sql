-- ============================================================
-- Run this in your Supabase SQL Editor
-- Allows any logged-in user to discover studios (for the join page search)
-- ============================================================

-- Allow any authenticated user to read studios (needed so students can search before joining)
CREATE POLICY "authenticated users can discover studios"
  ON public.studios
  FOR SELECT
  TO authenticated
  USING (true);
