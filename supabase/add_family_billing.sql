-- Run in Supabase Dashboard → SQL Editor → New Query
-- Adds family billing support (group siblings for a single parent invoice)

ALTER TABLE billing_configs ADD COLUMN IF NOT EXISTS family_id UUID;

-- Index for fast family group lookups
CREATE INDEX IF NOT EXISTS idx_billing_configs_family_id
  ON billing_configs(family_id)
  WHERE family_id IS NOT NULL;
