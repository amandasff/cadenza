-- Solo learner mode: students can use the app without joining a teacher studio
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false;
