-- ============================================================
-- Run this in your Supabase SQL Editor
-- Creates video_rooms table for live video lessons
-- ============================================================

CREATE TABLE IF NOT EXISTS public.video_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  student_id UUID NOT NULL REFERENCES auth.users(id),
  daily_room_name TEXT NOT NULL,
  daily_room_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'live', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher manages rooms" ON public.video_rooms FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "student sees room" ON public.video_rooms FOR SELECT
  USING (student_id = auth.uid());
