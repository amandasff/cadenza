-- ============================================================
-- Sibling Login: family groups + profile PIN
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Family groups table
CREATE TABLE IF NOT EXISTS public.families (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add columns to profiles FIRST (policies below reference these)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS switch_pin TEXT;   -- SHA-256(pin + user_id)

-- 3. RLS on families
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can read family" ON public.families FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM public.profiles
      WHERE id = auth.uid() AND family_id IS NOT NULL
    )
  );

-- 4. Allow students to read profiles of other family members
-- (existing self-read policy is unchanged; RLS policies are OR-combined)
CREATE POLICY "students can read family member profiles" ON public.profiles FOR SELECT
  USING (
    family_id IS NOT NULL AND
    family_id IN (
      SELECT family_id FROM public.profiles
      WHERE id = auth.uid() AND family_id IS NOT NULL
    )
  );
