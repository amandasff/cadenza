-- ─── Post visibility: private / friends / public ────────────────────────────

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

-- Migrate existing rows
UPDATE public.portfolio_items SET visibility = 'public'  WHERE is_public = true;
UPDATE public.portfolio_items SET visibility = 'private' WHERE is_public = false OR is_public IS NULL;

-- Index for feed queries
CREATE INDEX IF NOT EXISTS portfolio_items_visibility_idx ON public.portfolio_items(visibility);
