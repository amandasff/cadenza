-- ─── Studio social: polls + reactions + guestbook ─────────────────────────

-- Buzzfeed-style studio polls
CREATE TABLE IF NOT EXISTS studio_poll_votes (
  studio_owner_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voter_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  poll_id          TEXT NOT NULL,
  option_id        TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_owner_id, voter_id, poll_id)
);

ALTER TABLE studio_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read poll votes"
  ON studio_poll_votes FOR SELECT USING (true);

CREATE POLICY "authenticated users can vote"
  ON studio_poll_votes FOR INSERT
  WITH CHECK (voter_id = auth.uid());

CREATE POLICY "voter can change vote"
  ON studio_poll_votes FOR DELETE
  USING (voter_id = auth.uid());

