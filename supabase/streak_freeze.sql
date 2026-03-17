-- Add streak freeze column to profiles
-- Run once in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hpeuksywiuijkvvqlfhx/sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_count INTEGER NOT NULL DEFAULT 0;
