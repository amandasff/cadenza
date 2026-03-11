-- ============================================================
-- Push notification subscriptions table
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hpeuksywiuijkvvqlfhx/sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  subscription JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions
CREATE POLICY "users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
