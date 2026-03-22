-- ─── Portfolio view count ────────────────────────────────────────────────────

-- Add view_count column if it doesn't exist
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Atomic increment function used by /api/portfolio/view
CREATE OR REPLACE FUNCTION increment_portfolio_view(item_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.portfolio_items
    SET view_count = view_count + 1
    WHERE id = item_id
    RETURNING view_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
