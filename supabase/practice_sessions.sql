-- ============================================================
-- Run this in your Supabase SQL Editor
-- Adds piece_id, segments_json, and recording_url to practice_sessions
-- ============================================================

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS piece_id       UUID        REFERENCES public.pieces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segments_json  JSONB,
  ADD COLUMN IF NOT EXISTS recording_url  TEXT,
  ADD COLUMN IF NOT EXISTS ai_feedback    TEXT;
