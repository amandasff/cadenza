-- ============================================================
-- Run this in Supabase SQL Editor
-- Adds: notes, collection_name, is_public to inspirations
--       + inspiration_comments table with RLS
-- ============================================================

-- 1. Add missing columns to inspirations
ALTER TABLE inspirations ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE inspirations ADD COLUMN IF NOT EXISTS collection_name text;
ALTER TABLE inspirations ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 2. Create inspiration_comments table
CREATE TABLE IF NOT EXISTS inspiration_comments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inspiration_id uuid       NOT NULL REFERENCES inspirations(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text        NOT NULL,
  content       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inspiration_comments ENABLE ROW LEVEL SECURITY;

-- 3. RLS: anyone authenticated in the same studio can view comments on public inspirations
--    (and the owner can always see comments on their own)
CREATE POLICY "View inspiration comments"
  ON inspiration_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspirations i
      JOIN profiles owner ON owner.id = i.user_id
      JOIN profiles viewer ON viewer.id = auth.uid()
      WHERE i.id = inspiration_id
        AND (
          i.user_id = auth.uid()
          OR (i.is_public = true AND viewer.studio_id = owner.studio_id)
        )
    )
  );

-- 4. RLS: authenticated users can post comments on public inspirations in their studio,
--    and owners can comment on their own inspirations
CREATE POLICY "Insert inspiration comments"
  ON inspiration_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM inspirations i
      JOIN profiles owner ON owner.id = i.user_id
      JOIN profiles viewer ON viewer.id = auth.uid()
      WHERE i.id = inspiration_id
        AND (
          i.user_id = auth.uid()
          OR (i.is_public = true AND viewer.studio_id = owner.studio_id)
        )
    )
  );
