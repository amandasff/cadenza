-- ─── Stage name + anonymous posting ─────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS artist_name TEXT;

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS display_as TEXT NOT NULL DEFAULT 'real';
