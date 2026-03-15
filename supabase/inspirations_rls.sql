-- Run this in Supabase SQL Editor to fix teacher visibility of student picks
-- (Also ensure inspirations_sharing.sql has been run first)

-- Enable RLS on inspirations if not already enabled
ALTER TABLE inspirations ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Own inspirations" ON inspirations;
DROP POLICY IF EXISTS "Public inspirations in studio" ON inspirations;
DROP POLICY IF EXISTS "Manage own inspirations" ON inspirations;

-- Users can always read their own inspirations
CREATE POLICY "Own inspirations"
  ON inspirations FOR SELECT
  USING (user_id = auth.uid());

-- Studio members can read public inspirations from others in the same studio
CREATE POLICY "Public inspirations in studio"
  ON inspirations FOR SELECT
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM profiles viewer
      JOIN profiles owner ON owner.studio_id = viewer.studio_id
      WHERE viewer.id = auth.uid()
        AND owner.id = user_id
        AND viewer.studio_id IS NOT NULL
    )
  );

-- Users can insert, update, delete their own inspirations
CREATE POLICY "Manage own inspirations"
  ON inspirations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
