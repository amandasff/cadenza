-- Add total_days_practiced counter to profiles.
-- Backfills from existing practice_sessions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_days_practiced INTEGER NOT NULL DEFAULT 0;

-- Backfill: count distinct UTC calendar days per student
UPDATE public.profiles p
SET total_days_practiced = sub.day_count
FROM (
  SELECT
    student_id,
    COUNT(DISTINCT DATE(created_at AT TIME ZONE 'UTC')) AS day_count
  FROM public.practice_sessions
  GROUP BY student_id
) sub
WHERE p.id = sub.student_id;
