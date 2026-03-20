-- ─── Theory games leaderboard ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_leaderboard (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logical_game TEXT NOT NULL,
  score        INT  NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, logical_game)
);

ALTER TABLE game_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read leaderboard"
  ON game_leaderboard FOR SELECT USING (true);

CREATE POLICY "user can insert own score"
  ON game_leaderboard FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user can update own score"
  ON game_leaderboard FOR UPDATE
  USING (user_id = auth.uid());
