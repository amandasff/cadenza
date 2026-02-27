-- ============================================================
-- Run this once in your Supabase SQL Editor
-- Project: https://supabase.com/dashboard/project/hpeuksywiuijkvvqlfhx/sql
-- ============================================================

-- Create message_hearts table (for the ♡ feature)
CREATE TABLE IF NOT EXISTS public.message_hearts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_hearts ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read hearts (needed for heart counts)
CREATE POLICY "Authenticated users can read hearts"
  ON public.message_hearts FOR SELECT
  TO authenticated
  USING (true);

-- Enable realtime for heart counts (optional but nice)
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_hearts;
