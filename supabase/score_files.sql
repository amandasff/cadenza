-- ============================================================
-- Run this in your Supabase SQL Editor
-- Adds score_url to pieces (for playable MusicXML / Guitar Pro files)
-- Also create the 'score-files' storage bucket (public) in Supabase dashboard
-- ============================================================

ALTER TABLE public.pieces
  ADD COLUMN IF NOT EXISTS score_url TEXT;
