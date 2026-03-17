-- Linked accounts: lets a user associate multiple Cadenza accounts
-- (e.g. a teacher who is also a student at another studio)
-- and switch between them in one click.

CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, linked_user_id),
  CHECK (user_id != linked_user_id)
);

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

-- Users can read and manage only their own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'linked_accounts' AND policyname = 'Users manage own linked accounts'
  ) THEN
    CREATE POLICY "Users manage own linked accounts"
      ON public.linked_accounts
      FOR ALL
      USING (user_id = auth.uid());
  END IF;
END $$;
