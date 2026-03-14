-- Chat voice notes storage bucket
-- Run in Supabase SQL editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-voice-notes',
  'chat-voice-notes',
  true,
  52428800,  -- 50 MB
  ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg','video/webm']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Auth users upload voice notes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-voice-notes');

-- Public read
CREATE POLICY "Public read voice notes"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-voice-notes');
