-- ─── Marketplace: theme songs + The Crate ────────────────────────────────────

-- Theme song on profiles (points to a portfolio item)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_song_item_id UUID REFERENCES portfolio_items(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_song_title TEXT;

-- Marketplace fields on portfolio_items
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS price_points INT DEFAULT 0;        -- 0 = free to collect
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS collection_count INT DEFAULT 0;    -- incremented on collect

-- The Crate: which students have collected which tracks
CREATE TABLE IF NOT EXISTS portfolio_collections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id  UUID NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
  collector_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_paid        INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_item_id, collector_id)
);

ALTER TABLE portfolio_collections ENABLE ROW LEVEL SECURITY;

-- Collector can see their own crate; artist can see who collected (private — not exposed in UI)
CREATE POLICY "collector sees own crate"
  ON portfolio_collections FOR SELECT
  USING (
    collector_id = auth.uid()
    OR portfolio_item_id IN (
      SELECT id FROM portfolio_items WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "collector can add to crate"
  ON portfolio_collections FOR INSERT
  WITH CHECK (collector_id = auth.uid());

CREATE POLICY "collector can remove from crate"
  ON portfolio_collections FOR DELETE
  USING (collector_id = auth.uid());
