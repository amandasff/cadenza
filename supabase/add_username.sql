-- ─── Public username for profile URLs ────────────────────────────────────────
-- Enables cadenza.social/username style profile links.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Only lowercase letters, numbers, and hyphens, 3-30 chars
ALTER TABLE profiles
  ADD CONSTRAINT username_format
  CHECK (username ~ '^[a-z0-9][a-z0-9\-]{1,28}[a-z0-9]$');

-- Index for fast username lookups
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles (username);
