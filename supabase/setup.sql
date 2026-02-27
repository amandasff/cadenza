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

-- Allow users to heart any message
CREATE POLICY "Users can insert own hearts"
  ON public.message_hearts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to remove their own hearts
CREATE POLICY "Users can delete own hearts"
  ON public.message_hearts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime for heart counts
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_hearts;

-- ============================================================
-- RLS policies for messages table (edit & delete own messages)
-- Run these if edit/delete isn't working without a service role key
-- ============================================================

-- Allow users to update their own messages
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Allow users to delete their own messages
CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());
