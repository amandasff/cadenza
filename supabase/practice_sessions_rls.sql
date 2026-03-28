-- Fix: students can read their own practice sessions
-- Without this, the browser client in AuthService.fetchUser() gets blocked
-- by RLS, causing the streak to be zeroed in-memory on every page load.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='practice_sessions' AND policyname='Students can read own sessions'
  ) THEN
    CREATE POLICY "Students can read own sessions"
      ON public.practice_sessions FOR SELECT
      TO authenticated
      USING (student_id = auth.uid());
  END IF;
END $$;

-- Teachers can read sessions from their studio's students
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='practice_sessions' AND policyname='Teachers can read their students'' sessions'
  ) THEN
    CREATE POLICY "Teachers can read their students' sessions"
      ON public.practice_sessions FOR SELECT
      TO authenticated
      USING (
        studio_id IN (
          SELECT id FROM public.studios WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;
