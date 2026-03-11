-- ============================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hpeuksywiuijkvvqlfhx/sql
-- ============================================================

-- 1. Allow authenticated users to insert their own profile row.
--    This was missing, causing "violates row-level security" on login.
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 2. Auto-create a profile row whenever a new auth user is confirmed.
--    This is the root fix — profiles are created in the DB itself,
--    so the app code never needs to worry about missing profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
