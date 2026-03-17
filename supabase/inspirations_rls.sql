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

-- Teachers and studio members can read public inspirations from students in the same studio.
-- Teachers own their studio via studios.owner_id — they don't have studio_id in their profile.
CREATE POLICY "Public inspirations in studio"
  ON inspirations FOR SELECT
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM profiles owner
      JOIN studios ON studios.id = owner.studio_id
      WHERE owner.id = user_id
        AND (
          -- Viewer is the teacher who owns this studio
          studios.owner_id = auth.uid()
          OR
          -- Viewer is another member of the same studio (e.g. sibling student)
          owner.studio_id IN (
            SELECT studio_id FROM profiles
            WHERE id = auth.uid() AND studio_id IS NOT NULL
          )
        )
    )
  );

-- Users can insert, update, delete their own inspirations
CREATE POLICY "Manage own inspirations"
  ON inspirations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
