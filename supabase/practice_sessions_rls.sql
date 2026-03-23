-- Fix: students can read their own practice sessions
-- Without this, the browser client in AuthService.fetchUser() gets blocked
-- by RLS, causing the streak to be zeroed in-memory on every page load.

CREATE POLICY IF NOT EXISTS "Students can read own sessions"
  ON public.practice_sessions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Teachers can read sessions from their studio's students
CREATE POLICY IF NOT EXISTS "Teachers can read their students' sessions"
  ON public.practice_sessions FOR SELECT
  TO authenticated
  USING (
    studio_id IN (
      SELECT id FROM public.studios WHERE owner_id = auth.uid()
    )
  );
