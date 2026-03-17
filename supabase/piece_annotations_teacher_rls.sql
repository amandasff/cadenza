-- Collaborative annotations: teacher can read AND write annotations for their students
-- studios uses owner_id (not teacher_id) for the studio owner

ALTER TABLE public.piece_annotations ENABLE ROW LEVEL SECURITY;

-- Helper: is auth.uid() a teacher for the studio that this student belongs to?
-- Uses owner_id on studios table (primary teacher) OR studio_teachers join table (multi-teacher).

-- Students manage their own annotations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'piece_annotations' AND policyname = 'Students manage own annotations'
  ) THEN
    CREATE POLICY "Students manage own annotations"
      ON public.piece_annotations
      FOR ALL
      USING (student_id = auth.uid());
  END IF;
END $$;

-- Teachers can read annotations for students in their studio
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'piece_annotations' AND policyname = 'Teachers can read student annotations'
  ) THEN
    CREATE POLICY "Teachers can read student annotations"
      ON public.piece_annotations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          JOIN public.studios s ON s.id = p.studio_id
          WHERE p.id = piece_annotations.student_id
            AND (
              s.owner_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.studio_teachers st
                WHERE st.studio_id = s.id AND st.teacher_id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;

-- Teachers can insert annotations for students in their studio
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'piece_annotations' AND policyname = 'Teachers can write student annotations'
  ) THEN
    CREATE POLICY "Teachers can write student annotations"
      ON public.piece_annotations
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          JOIN public.studios s ON s.id = p.studio_id
          WHERE p.id = piece_annotations.student_id
            AND (
              s.owner_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.studio_teachers st
                WHERE st.studio_id = s.id AND st.teacher_id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;

-- Teachers can update annotations for students in their studio
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'piece_annotations' AND policyname = 'Teachers can update student annotations'
  ) THEN
    CREATE POLICY "Teachers can update student annotations"
      ON public.piece_annotations
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          JOIN public.studios s ON s.id = p.studio_id
          WHERE p.id = piece_annotations.student_id
            AND (
              s.owner_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.studio_teachers st
                WHERE st.studio_id = s.id AND st.teacher_id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;

-- Enable Realtime on piece_annotations so both parties see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.piece_annotations;
