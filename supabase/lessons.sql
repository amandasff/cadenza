-- ============================================================
-- Lessons, Assignments, and Assignment Completions
-- ============================================================

-- Scheduled lesson instances
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  lesson_notes TEXT,
  recurrence_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recurring lesson templates (set once, generates future lessons)
CREATE TABLE IF NOT EXISTS lesson_recurrences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  time_of_day TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assignments created by teacher (often after completing a lesson)
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  piece_id UUID REFERENCES pieces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  focus TEXT,
  type TEXT NOT NULL DEFAULT 'practice'
    CHECK (type IN ('practice', 'listen', 'theory', 'memorize', 'record')),
  target_minutes_per_day INT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'reviewed')),
  reference_audio_url TEXT,
  youtube_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Student marks assignment done + rates themselves
CREATE TABLE IF NOT EXISTS assignment_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  self_rating TEXT CHECK (self_rating IN ('struggling', 'getting_there', 'nailed_it')),
  student_notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_completions ENABLE ROW LEVEL SECURITY;

-- Lessons
CREATE POLICY "student sees own lessons" ON lessons
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "teacher manages studio lessons" ON lessons
  FOR ALL USING (teacher_id = auth.uid());

-- Lesson recurrences
CREATE POLICY "teacher manages recurrences" ON lesson_recurrences
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "student sees own recurrences" ON lesson_recurrences
  FOR SELECT USING (student_id = auth.uid());

-- Assignments
CREATE POLICY "student sees own assignments" ON assignments
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "teacher manages assignments" ON assignments
  FOR ALL USING (teacher_id = auth.uid());

-- Assignment completions
CREATE POLICY "student manages own completions" ON assignment_completions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "teacher sees completions" ON assignment_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_id AND a.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- Storage bucket for teacher voice notes
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('assignment-voice-notes', 'assignment-voice-notes', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated upload voice notes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'assignment-voice-notes' AND auth.role() = 'authenticated');

CREATE POLICY "public read voice notes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assignment-voice-notes');

CREATE POLICY "teacher delete own voice notes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'assignment-voice-notes' AND auth.uid() = owner);
