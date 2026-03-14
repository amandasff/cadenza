-- Chat images storage bucket
-- Run in Supabase SQL editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Auth users upload chat images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-images');

-- Public read
CREATE POLICY "Public read chat images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-images');
