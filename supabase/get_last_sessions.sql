-- ─── RPC: get last practice session per student ──────────────────────────────
-- Used by the leaderboard to compute live streaks without N+1 queries.

CREATE OR REPLACE FUNCTION public.get_last_sessions(student_ids UUID[])
RETURNS TABLE(student_id UUID, last_at TIMESTAMPTZ)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (ps.student_id)
         ps.student_id,
         ps.created_at AS last_at
    FROM practice_sessions ps
   WHERE ps.student_id = ANY(student_ids)
   ORDER BY ps.student_id, ps.created_at DESC;
$$;
