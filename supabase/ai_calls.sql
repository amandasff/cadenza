-- AI call log for server-side rate limiting.
-- Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.ai_calls (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index to make per-user hourly count queries fast
CREATE INDEX IF NOT EXISTS ai_calls_user_created ON public.ai_calls(user_id, created_at DESC);

ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own rows
CREATE POLICY "ai_calls_own" ON public.ai_calls
  FOR ALL USING (auth.uid() = user_id);
