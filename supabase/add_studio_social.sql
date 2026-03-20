-- ─── Studio social: reactions + guestbook ─────────────────────────────────

-- Persistent emoji reactions on studios (like Discord/Slack reactions)
CREATE TABLE IF NOT EXISTS studio_reactions (
  studio_owner_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reactor_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type    TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_owner_id, reactor_id, reaction_type)
);

ALTER TABLE studio_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read reactions"
  ON studio_reactions FOR SELECT USING (true);

CREATE POLICY "authenticated users can react"
  ON studio_reactions FOR INSERT
  WITH CHECK (reactor_id = auth.uid());

CREATE POLICY "reactor can unreact"
  ON studio_reactions FOR DELETE
  USING (reactor_id = auth.uid());

-- Guestbook notes left on a studio
CREATE TABLE IF NOT EXISTS studio_shoutouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_owner_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name      TEXT NOT NULL,
  content          TEXT NOT NULL CHECK (char_length(content) <= 120),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE studio_shoutouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read shoutouts"
  ON studio_shoutouts FOR SELECT USING (true);

CREATE POLICY "authenticated users can post shoutouts"
  ON studio_shoutouts FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "author or owner can delete shoutout"
  ON studio_shoutouts FOR DELETE
  USING (author_id = auth.uid() OR studio_owner_id = auth.uid());
