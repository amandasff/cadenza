-- Add youtube_id to composer_avatars
-- After running this, go to YouTube and find a video for each composer.
-- Copy the video ID from the URL: youtube.com/watch?v=VIDEO_ID_HERE
-- Then run UPDATE statements like the ones below.

ALTER TABLE composer_avatars ADD COLUMN IF NOT EXISTS youtube_id TEXT;

-- ─── Seed with YouTube video IDs ────────────────────────────────────────────
-- Replace each VIDEO_ID_HERE with the real YouTube ID.
-- The player starts at second 0 by default; you can adjust later.

-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Bach';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Beethoven';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Mozart';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Chopin';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Debussy';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Brahms';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Tchaikovsky';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Schubert';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Liszt';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Handel';
-- UPDATE composer_avatars SET youtube_id = 'VIDEO_ID_HERE' WHERE composer_name = 'Vivaldi';
