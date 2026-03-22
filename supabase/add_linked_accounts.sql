-- ── Linked accounts (for account switching) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linked_user_id)
);

-- Only the owner can read/delete their own rows; inserts go through the API (admin client)
ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own links"
  ON public.linked_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own links"
  ON public.linked_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS linked_accounts_user_id_idx ON public.linked_accounts(user_id);
