-- Collaborative annotations: teacher can read AND write annotations for their students

ALTER TABLE public.piece_annotations ENABLE ROW LEVEL SECURITY;

-- Students manage their own annotations (may already exist — use CREATE OR REPLACE equivalent)
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
          WHERE p.id = piece_annotations.student_id
            AND p.studio_id IN (
              SELECT id FROM public.studios WHERE teacher_id = auth.uid()
            )
        )
      );
  END IF;
END $$;

-- Teachers can insert/update annotations for students in their studio (collaborative editing)
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
          WHERE p.id = piece_annotations.student_id
            AND p.studio_id IN (
              SELECT id FROM public.studios WHERE teacher_id = auth.uid()
            )
        )
      );
  END IF;
END $$;

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
          WHERE p.id = piece_annotations.student_id
            AND p.studio_id IN (
              SELECT id FROM public.studios WHERE teacher_id = auth.uid()
            )
        )
      );
  END IF;
END $$;

-- Enable Realtime on piece_annotations so both parties see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.piece_annotations;
