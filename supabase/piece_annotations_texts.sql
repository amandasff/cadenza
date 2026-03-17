-- Add texts column for draggable text annotations on sheet music.
-- Run this in the Supabase SQL Editor.

ALTER TABLE piece_annotations
  ADD COLUMN IF NOT EXISTS texts jsonb DEFAULT '[]'::jsonb;

-- Quick check
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'piece_annotations'
  AND column_name IN ('strokes', 'texts');
