-- Social/Discover feature tables.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'audio',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT;

CREATE TABLE IF NOT EXISTS public.portfolio_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(portfolio_item_id, user_id)
);
ALTER TABLE public.portfolio_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON public.portfolio_likes FOR SELECT USING (true);
CREATE POLICY "likes_all"    ON public.portfolio_likes FOR ALL   USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.portfolio_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.portfolio_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON public.portfolio_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.portfolio_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.portfolio_comments FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_all"    ON public.follows FOR ALL   USING (auth.uid() = follower_id);
