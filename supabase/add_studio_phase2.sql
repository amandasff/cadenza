-- Phase 2: Studio identity columns + gifts table

-- Add studio identity columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS studio_name text,
  ADD COLUMN IF NOT EXISTS studio_tagline text,
  ADD COLUMN IF NOT EXISTS featured_avatar_id uuid REFERENCES composer_avatars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS studio_persona text,
  ADD COLUMN IF NOT EXISTS studio_bio text,
  ADD COLUMN IF NOT EXISTS studio_bio_updated_at timestamptz;

-- Gifts table
CREATE TABLE IF NOT EXISTS studio_gifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id       text NOT NULL REFERENCES shop_items(id),
  message       text,
  seen          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE studio_gifts ENABLE ROW LEVEL SECURITY;

-- Sender can insert
CREATE POLICY "sender can give gifts"
  ON studio_gifts FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Recipient can read their own gifts
CREATE POLICY "recipient can read gifts"
  ON studio_gifts FOR SELECT
  USING (auth.uid() = recipient_id);

-- Public can read gifts (for studio visitor view)
CREATE POLICY "public can view gifts on studio"
  ON studio_gifts FOR SELECT
  USING (true);

-- Recipient can mark seen
CREATE POLICY "recipient can mark seen"
  ON studio_gifts FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
