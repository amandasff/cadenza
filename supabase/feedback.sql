-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text,
  type         text        NOT NULL DEFAULT 'general', -- 'bug' | 'feature' | 'general'
  message      text        NOT NULL,
  page_url     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can submit feedback (we don't need app-side reads)
CREATE POLICY "Authenticated users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());
