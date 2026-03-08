-- ============================================================
-- Sibling Login: family groups + profile PIN
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Family groups (minimal — just an anchor for the foreign key)
CREATE TABLE IF NOT EXISTS public.families (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Any family member can see the family row
CREATE POLICY "family members can read family" ON public.families FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM public.profiles
      WHERE id = auth.uid() AND family_id IS NOT NULL
    )
  );

-- Add family_id and switch_pin to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS switch_pin TEXT;   -- SHA-256(pin + user_id)

-- Allow students to read profiles of other family members
-- (existing self-read policy is unchanged; RLS policies are OR-combined)
CREATE POLICY "students can read family member profiles" ON public.profiles FOR SELECT
  USING (
    family_id IS NOT NULL AND
    family_id IN (
      SELECT family_id FROM public.profiles
      WHERE id = auth.uid() AND family_id IS NOT NULL
    )
  );
