-- ─── Comment Reactions ────────────────────────────────────────────────────────
-- Emoji reactions on portfolio comments (discover page feedback).

CREATE TABLE IF NOT EXISTS public.portfolio_comment_reactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id     UUID NOT NULL REFERENCES public.portfolio_comments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji          TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);

ALTER TABLE public.portfolio_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select" ON public.portfolio_comment_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_all"    ON public.portfolio_comment_reactions FOR ALL   USING (auth.uid() = user_id);
