"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { PortfolioItemRow } from "../../../lib/services/PortfolioService";
import AudioPlayer from "../../../components/AudioPlayer";
import { usePlayer } from "../../../lib/context/PlayerContext";

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string;
};

type PublicItem = PortfolioItemRow & {
  display_name?: string;
  avatar_url?: string | null;
  like_count: number;
  comment_count: number;
  user_liked: boolean;
};

type ProfileInfo = {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  streak_days: number;
};

const SETUP_SQL = `-- Run this once in your Supabase SQL editor

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
CREATE POLICY "follows_all"    ON public.follows FOR ALL   USING (auth.uid() = follower_id);`;

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function VideoThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video ref={ref} src={src} preload="metadata" muted playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      onLoadedMetadata={e => { const v = e.target as HTMLVideoElement; v.currentTime = Math.min(1.5, v.duration * 0.1); }}
    />
  );
}

const initials = (name?: string | null) =>
  (name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

const Avatar = ({ url, name, size }: { url?: string | null; name?: string | null; size: number }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.28, fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif", overflow: "hidden" }}>
    {url ? <img src={url} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(name)}
  </div>
);

export default function DiscoverPage() {
  const { playDiscover, stopDiscover, setSuppressMiniPlayer } = usePlayer();
  const [tab, setTab] = useState<"everyone" | "following">("everyone");

  const [items, setItems]                       = useState<PublicItem[]>([]);
  const [followingItems, setFollowingItems]     = useState<PublicItem[]>([]);
  const [followingLoaded, setFollowingLoaded]   = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [missingColumns, setMissingColumns]     = useState(false);
  const [queryError, setQueryError]             = useState<string | null>(null);

  const [currentUserId, setCurrentUserId]       = useState<string | null>(null);
  const [myFollows, setMyFollows]               = useState<Set<string>>(new Set()); // IDs I follow

  const [expandedItem, setExpandedItem]         = useState<PublicItem | null>(null);
  const [commentsMap, setCommentsMap]           = useState<Record<string, Comment[]>>({});
  const [commentsOpen, setCommentsOpen]         = useState(false);
  const [commentText, setCommentText]           = useState("");
  const [commentPosting, setCommentPosting]     = useState(false);
  const [likingId, setLikingId]                 = useState<string | null>(null);
  const [likeError, setLikeError]               = useState<string | null>(null);

  const [profileInfo, setProfileInfo]           = useState<ProfileInfo | null>(null);
  const [profileItems, setProfileItems]         = useState<PublicItem[]>([]);
  const [followLoading, setFollowLoading]       = useState(false);
  const [editingBio, setEditingBio]             = useState(false);
  const [bioText, setBioText]                   = useState("");
  const [savingBio, setSavingBio]               = useState(false);

  const supabase = getSupabaseBrowserClient();

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function enrichItems(rows: PortfolioItemRow[], userId: string | null): Promise<PublicItem[]> {
    if (rows.length === 0) return [];
    const studentIds = [...new Set(rows.map(r => r.student_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, avatar_url").in("id", studentIds);
    const profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
    (profiles ?? []).forEach((p: { id: string; display_name?: string; avatar_url?: string | null }) => {
      profileMap[p.id] = { display_name: p.display_name ?? "", avatar_url: p.avatar_url ?? null };
    });

    const itemIds = rows.map(r => r.id);
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from("portfolio_likes").select("portfolio_item_id, user_id").in("portfolio_item_id", itemIds),
      supabase.from("portfolio_comments").select("portfolio_item_id").in("portfolio_item_id", itemIds),
    ]);
    const likesData = (likesRes.data ?? []) as { portfolio_item_id: string; user_id: string }[];
    const commentsData = (commentsRes.data ?? []) as { portfolio_item_id: string }[];

    return rows.map(row => ({
      ...row,
      display_name: profileMap[row.student_id]?.display_name,
      avatar_url: profileMap[row.student_id]?.avatar_url ?? null,
      like_count: likesData.filter(l => l.portfolio_item_id === row.id).length,
      comment_count: commentsData.filter(c => c.portfolio_item_id === row.id).length,
      user_liked: likesData.some(l => l.portfolio_item_id === row.id && l.user_id === userId),
    }));
  }

  // ── Initial load ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);

      // Load who we follow
      if (uid) {
        const { data: followData } = await supabase
          .from("follows").select("following_id").eq("follower_id", uid);
        setMyFollows(new Set((followData ?? []).map((f: { following_id: string }) => f.following_id)));
      }

      const { data: itemData, error: itemError } = await supabase
        .from("portfolio_items").select("*").eq("is_public", true)
        .order("created_at", { ascending: false });
      if (itemError) throw itemError;

      const enriched = await enrichItems((itemData ?? []) as PortfolioItemRow[], uid);
      setItems(enriched);
    } catch (err) {
      const e = err as { message?: string; code?: string };
      if (e?.code === "42703" || e?.code === "42P01" || e?.message?.includes("is_public") || e?.message?.includes("media_type")) {
        setMissingColumns(true);
      } else {
        setQueryError(e?.message ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Following feed ──────────────────────────────────────────────────────────

  async function loadFollowingFeed() {
    if (!currentUserId || followingLoaded) return;
    setFollowingLoading(true);
    try {
      const followingIds = [...myFollows];
      if (followingIds.length === 0) { setFollowingItems([]); setFollowingLoaded(true); return; }
      const { data } = await supabase
        .from("portfolio_items").select("*").eq("is_public", true)
        .in("student_id", followingIds).order("created_at", { ascending: false });
      const enriched = await enrichItems((data ?? []) as PortfolioItemRow[], currentUserId);
      setFollowingItems(enriched);
      setFollowingLoaded(true);
    } finally {
      setFollowingLoading(false);
    }
  }

  function switchTab(t: "everyone" | "following") {
    setTab(t);
    if (t === "following" && !followingLoaded) loadFollowingFeed();
  }

  // ── Item open/close ─────────────────────────────────────────────────────────

  function openItem(item: PublicItem) {
    setExpandedItem(item);
    setCommentsOpen(false);
    setCommentText("");
    if (!commentsMap[item.id]) loadComments(item.id);
    if (item.recording_url) {
      playDiscover({ id: item.id, title: item.title, displayName: item.display_name, mediaType: item.media_type === "video" ? "video" : "audio", recordingUrl: item.recording_url });
    }
    setSuppressMiniPlayer(true);
  }

  function closeItem() {
    setExpandedItem(null);
    setCommentsOpen(false);
    setCommentText("");
    setSuppressMiniPlayer(false);
  }

  // ── Reactions ("Inspiring") ─────────────────────────────────────────────────

  async function toggleLike(item: PublicItem) {
    if (!currentUserId) { setLikeError("Sign in to react"); setTimeout(() => setLikeError(null), 3000); return; }
    if (likingId === item.id) return;
    setLikingId(item.id);
    const next = { ...item, user_liked: !item.user_liked, like_count: item.user_liked ? item.like_count - 1 : item.like_count + 1 };
    const patch = (list: PublicItem[]) => list.map(i => i.id === item.id ? next : i);
    setItems(patch); setFollowingItems(patch);
    if (expandedItem?.id === item.id) setExpandedItem(next);
    try {
      if (item.user_liked) {
        const { error } = await supabase.from("portfolio_likes").delete().eq("portfolio_item_id", item.id).eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("portfolio_likes").insert({ portfolio_item_id: item.id, user_id: currentUserId });
        if (error) throw error;
      }
    } catch (err) {
      const revert = (list: PublicItem[]) => list.map(i => i.id === item.id ? item : i);
      setItems(revert); setFollowingItems(revert);
      if (expandedItem?.id === item.id) setExpandedItem(item);
      setLikeError((err as { message?: string })?.message ?? "Could not save reaction");
      setTimeout(() => setLikeError(null), 4000);
    } finally { setLikingId(null); }
  }

  // ── Comments ─────────────────────────────────────────────────────────────────

  async function loadComments(itemId: string) {
    const { data } = await supabase.from("portfolio_comments").select("*").eq("portfolio_item_id", itemId).order("created_at", { ascending: true });
    const comments = (data ?? []) as Comment[];
    const authorIds = [...new Set(comments.map(c => c.user_id))];
    const nameMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", authorIds);
      (profiles ?? []).forEach((p: { id: string; display_name?: string }) => { if (p.display_name) nameMap[p.id] = p.display_name; });
    }
    setCommentsMap(prev => ({ ...prev, [itemId]: comments.map(c => ({ ...c, display_name: nameMap[c.user_id] })) }));
  }

  async function postComment(itemId: string) {
    if (!commentText.trim() || !currentUserId || commentPosting) return;
    setCommentPosting(true);
    try {
      const { data } = await supabase.from("portfolio_comments").insert({ portfolio_item_id: itemId, user_id: currentUserId, content: commentText.trim() }).select("*").single();
      if (data) {
        const row = data as Comment;
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", currentUserId).single();
        const comment: Comment = { ...row, display_name: (profile as { display_name?: string } | null)?.display_name };
        setCommentsMap(prev => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), comment] }));
        const updated = { ...expandedItem!, comment_count: expandedItem!.comment_count + 1 };
        setExpandedItem(updated);
        const patch = (list: PublicItem[]) => list.map(i => i.id === itemId ? { ...i, comment_count: i.comment_count + 1 } : i);
        setItems(patch); setFollowingItems(patch);
        setCommentText("");
      }
    } finally { setCommentPosting(false); }
  }

  // ── Follow / unfollow ────────────────────────────────────────────────────────

  async function toggleFollow(userId: string) {
    if (!currentUserId || followLoading) return;
    setFollowLoading(true);
    const isFollowing = myFollows.has(userId);
    // Optimistic
    setMyFollows(prev => { const n = new Set(prev); isFollowing ? n.delete(userId) : n.add(userId); return n; });
    if (profileInfo?.id === userId) {
      setProfileInfo(prev => prev ? { ...prev, follower_count: prev.follower_count + (isFollowing ? -1 : 1) } : prev);
    }
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", userId);
        // Invalidate following feed
        setFollowingLoaded(false);
        setFollowingItems([]);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: userId });
        setFollowingLoaded(false);
        setFollowingItems([]);
      }
    } catch {
      // Revert
      setMyFollows(prev => { const n = new Set(prev); isFollowing ? n.add(userId) : n.delete(userId); return n; });
      if (profileInfo?.id === userId) {
        setProfileInfo(prev => prev ? { ...prev, follower_count: prev.follower_count + (isFollowing ? 1 : -1) } : prev);
      }
    } finally { setFollowLoading(false); }
  }

  // ── Profile sheet ────────────────────────────────────────────────────────────

  async function openProfile(studentId: string) {
    setProfileInfo(null);
    setProfileItems([]);
    setEditingBio(false);

    const [profileRes, followerRes, followingRes, itemsRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url, bio, streak_days").eq("id", studentId).single(),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", studentId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", studentId),
      supabase.from("portfolio_items").select("*").eq("student_id", studentId).eq("is_public", true).order("created_at", { ascending: false }),
    ]);

    const p = profileRes.data as { id: string; display_name: string; avatar_url: string | null; bio: string | null; streak_days: number } | null;
    if (p) {
      setProfileInfo({
        id: p.id,
        name: p.display_name,
        bio: p.bio,
        avatar_url: p.avatar_url,
        follower_count: followerRes.count ?? 0,
        following_count: followingRes.count ?? 0,
        streak_days: p.streak_days,
      });
      setBioText(p.bio ?? "");
    }

    const rows = (itemsRes.data ?? []) as PortfolioItemRow[];
    const enriched = await enrichItems(rows, currentUserId);
    setProfileItems(enriched);
  }

  async function saveBio() {
    if (!currentUserId || savingBio) return;
    setSavingBio(true);
    try {
      await supabase.from("profiles").update({ bio: bioText.trim() || null }).eq("id", currentUserId);
      setProfileInfo(prev => prev ? { ...prev, bio: bioText.trim() || null } : prev);
      setEditingBio(false);
    } finally { setSavingBio(false); }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const displayItems = tab === "following" ? followingItems : items;

  if (loading) {
    return (
      <div style={{ background: "var(--cream)", minHeight: "100%" }}>
        <div style={{ padding: "1.25rem 1rem 0.75rem", background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
          <div className="skeleton" style={{ height: 28, width: 120, borderRadius: 4 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.75rem" }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i}>
              <div className="skeleton" style={{ aspectRatio: "16/9", width: "100%", borderRadius: 8 }} />
              <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 0.25rem 0" }}>
                <div className="skeleton" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 11, borderRadius: 3, marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 10, width: "60%", borderRadius: 3 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)" }}>

      {/* ── Header + tabs ── */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ padding: "1.25rem 1rem 0" }}>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.625rem", color: "var(--charcoal)", letterSpacing: "-0.01em", margin: 0 }}>
            Discover
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", margin: "0.125rem 0 0.75rem" }}>
            Raw, unedited practice — real musicians, real progress
          </p>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 1rem" }}>
          {(["everyone", "following"] as const).map(t => (
            <button key={t} onClick={() => switchTab(t)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "0.5rem 1rem 0.625rem",
              fontFamily: "Inter, sans-serif", fontWeight: tab === t ? 600 : 400, fontSize: "0.875rem",
              color: tab === t ? "var(--charcoal)" : "var(--muted)",
              borderBottom: `2px solid ${tab === t ? "var(--charcoal)" : "transparent"}`,
              transition: "all 0.15s",
              textTransform: "capitalize",
            }}>
              {t === "everyone" ? "Everyone" : "Following"}
              {t === "following" && myFollows.size > 0 && (
                <span style={{ marginLeft: "0.375rem", background: "var(--charcoal)", color: "var(--white)", borderRadius: 99, fontSize: "0.5625rem", fontWeight: 600, padding: "0.1rem 0.375rem" }}>
                  {myFollows.size}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {missingColumns ? (
        <div style={{ padding: "1.5rem" }}>
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.375rem" }}>
              SQL migration needed
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
              Run this in your Supabase SQL editor to enable social features:
            </p>
            <pre style={{ background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.875rem", fontSize: "0.65rem", fontFamily: "monospace", color: "var(--charcoal)", overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{SETUP_SQL}</pre>
          </div>
        </div>
      ) : queryError ? (
        <div style={{ padding: "1.5rem" }}>
          <div style={{ background: "#FDF6F3", border: "1px solid #E8C4BA", borderRadius: 10, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "#B85C3A", marginBottom: "0.375rem" }}>Could not load feed</div>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#B85C3A", margin: 0 }}>{queryError}</p>
          </div>
        </div>
      ) : tab === "following" && followingLoading ? (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>Loading…</div>
        </div>
      ) : tab === "following" && myFollows.size === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>👥</div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.5rem" }}>Nobody followed yet</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 260, margin: "0 auto" }}>
            Switch to <strong>Everyone</strong> and tap a musician&rsquo;s avatar to follow them.
          </p>
        </div>
      ) : tab === "following" && followingItems.length === 0 && followingLoaded ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.5rem" }}>Nothing posted yet</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 260, margin: "0 auto" }}>
            People you follow haven&rsquo;t shared any clips yet.
          </p>
        </div>
      ) : displayItems.length === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", fontSize: "1.75rem" }}>🎸</div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>Nothing shared yet</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 280, margin: "0 auto" }}>
            Clips appear here when musicians share them from Journey.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.75rem", paddingBottom: "5.5rem" }}>
          {displayItems.map(item => {
            const isVideo = item.media_type === "video";
            return (
              <div key={item.id} onClick={() => openItem(item)} style={{ cursor: "pointer" }}>
                <div style={{ aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "#1a1a1a", position: "relative" }}>
                  {isVideo && item.recording_url ? <VideoThumbnail src={item.recording_url} /> : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.4rem", padding: "0.4rem 0.1rem 0" }}>
                  <div onClick={e => { e.stopPropagation(); openProfile(item.student_id); }}>
                    <Avatar url={item.avatar_url} name={item.display_name} size={26} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem", color: "var(--charcoal)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, marginBottom: "0.15rem" }}>
                      {item.title}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", lineHeight: 1.3 }}>
                      {item.display_name ?? "Musician"}
                      {myFollows.has(item.student_id) && <span style={{ marginLeft: "0.3rem", color: "var(--sage)", fontWeight: 600 }}>· following</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem" }}>
                      <span style={{ fontSize: "0.5625rem" }}>{item.user_liked ? "✦" : "✧"}</span>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", fontWeight: 500 }}>{item.like_count}</span>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", fontWeight: 500 }}>{item.comment_count}</span>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", marginLeft: "auto" }}>{formatRelative(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Like error toast ── */}
      {likeError && (
        <div style={{ position: "fixed", bottom: "5.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 600, background: "#2C2824", color: "#fff", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, padding: "0.625rem 1.25rem", borderRadius: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {likeError}
        </div>
      )}

      {/* ── Profile sheet ── */}
      {profileInfo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex", flexDirection: "column" }}>
          <div onClick={() => { setProfileInfo(null); setProfileItems([]); }} style={{ flex: 1, background: "rgba(0,0,0,0.6)", minHeight: 40 }} />
          <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", maxHeight: "88dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Profile header */}
            <div style={{ padding: "1rem 1rem 0.875rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "0.75rem" }}>
                <Avatar url={profileInfo.avatar_url} name={profileInfo.name} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.2 }}>{profileInfo.name}</div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.375rem" }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                      <strong style={{ color: "var(--charcoal)" }}>{profileInfo.follower_count}</strong> followers
                    </span>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                      <strong style={{ color: "var(--charcoal)" }}>{profileInfo.following_count}</strong> following
                    </span>
                    {profileInfo.streak_days > 0 && (
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                        🔥 <strong style={{ color: "var(--charcoal)" }}>{profileInfo.streak_days}</strong>d streak
                      </span>
                    )}
                  </div>
                </div>
                {/* Follow button or close */}
                {currentUserId && currentUserId !== profileInfo.id ? (
                  <button
                    onClick={() => toggleFollow(profileInfo.id)}
                    disabled={followLoading}
                    style={{
                      padding: "0.5rem 1.125rem", borderRadius: 20, fontFamily: "Inter, sans-serif",
                      fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", transition: "all 0.15s",
                      border: myFollows.has(profileInfo.id) ? "1.5px solid var(--border-strong)" : "none",
                      background: myFollows.has(profileInfo.id) ? "transparent" : "var(--charcoal)",
                      color: myFollows.has(profileInfo.id) ? "var(--charcoal)" : "var(--white)",
                      flexShrink: 0,
                    }}
                  >
                    {myFollows.has(profileInfo.id) ? "Following" : "Follow"}
                  </button>
                ) : (
                  <button onClick={() => { setProfileInfo(null); setProfileItems([]); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.375rem", color: "var(--muted)", lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                )}
              </div>

              {/* Bio */}
              {currentUserId === profileInfo.id ? (
                editingBio ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <textarea
                      value={bioText}
                      onChange={e => setBioText(e.target.value)}
                      placeholder="Tell people about your musical journey…"
                      maxLength={160}
                      rows={2}
                      style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid var(--border-strong)", padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", resize: "none", lineHeight: 1.5 }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={saveBio} disabled={savingBio} style={{ padding: "0.375rem 1rem", borderRadius: 8, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>
                        {savingBio ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => { setEditingBio(false); setBioText(profileInfo.bio ?? ""); }} style={{ padding: "0.375rem 0.875rem", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setEditingBio(true); setBioText(profileInfo.bio ?? ""); }} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: 8, padding: "0.375rem 0.75rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: profileInfo.bio ? "var(--charcoal)" : "var(--muted)", textAlign: "left", width: "100%", lineHeight: 1.5 }}>
                    {profileInfo.bio ?? "Add a bio…"}
                  </button>
                )
              ) : profileInfo.bio ? (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: 0, lineHeight: 1.55 }}>{profileInfo.bio}</p>
              ) : null}
            </div>

            {/* Grid */}
            <div style={{ overflowY: "auto", flex: 1, padding: profileItems.length === 0 ? "2rem 1rem" : 0 }}>
              {profileItems.length === 0 ? (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", textAlign: "center", margin: 0, fontStyle: "italic" }}>No clips shared yet</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, background: "#111" }}>
                  {profileItems.map(pi => (
                    <div key={pi.id} onClick={() => { setProfileInfo(null); setProfileItems([]); openItem(pi); }} style={{ cursor: "pointer", position: "relative", background: "#1a1a1a", overflow: "hidden", aspectRatio: "9/14" }}>
                      {pi.media_type === "video" && pi.recording_url ? <VideoThumbnail src={pi.recording_url} /> : (
                        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                        </div>
                      )}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.375rem" }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.5625rem", color: "#fff", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                          {pi.title}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded item modal ── */}
      {expandedItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column" }}>
          <div onClick={closeItem} style={{ flex: 1, background: "rgba(0,0,0,0.7)", minHeight: 40 }} />
          <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem 0.5rem" }}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: "var(--border)" }} />
              <button onClick={closeItem} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.375rem", color: "var(--muted)", lineHeight: 1, padding: "0 0 0 1rem" }}>×</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {/* Video */}
              {expandedItem.media_type === "video" && expandedItem.recording_url && (
                <div style={{ background: "#0d0d0d", aspectRatio: "16/9", width: "100%" }}>
                  <video src={expandedItem.recording_url} controls autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              )}
              {/* Audio header */}
              {expandedItem.media_type !== "video" && (
                <div style={{ background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", padding: "1.5rem 1rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "#fff", lineHeight: 1.3 }}>{expandedItem.title}</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>{expandedItem.display_name ?? "Musician"}</div>
                  </div>
                </div>
              )}
              {expandedItem.media_type !== "video" && expandedItem.recording_url && (
                <div style={{ padding: "0.875rem 1rem 0" }}><AudioPlayer src={expandedItem.recording_url} /></div>
              )}

              {/* Info */}
              <div style={{ padding: "0.875rem 1rem 0" }}>
                {expandedItem.media_type === "video" && (
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.3, marginBottom: "0.375rem" }}>{expandedItem.title}</div>
                )}
                <div onClick={() => openProfile(expandedItem.student_id)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: expandedItem.description ? "0.625rem" : 0, cursor: "pointer" }}>
                  <Avatar url={expandedItem.avatar_url} name={expandedItem.display_name} size={28} />
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", fontWeight: 500, textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: "2px" }}>
                    {expandedItem.display_name ?? "Musician"}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                    · {formatRelative(expandedItem.created_at)}
                  </div>
                </div>
                {expandedItem.description && (
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 0.5rem", fontStyle: "italic" }}>
                    &ldquo;{expandedItem.description}&rdquo;
                  </p>
                )}

                {/* Action bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "0.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                  <button
                    onClick={() => toggleLike(expandedItem)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.5rem 1rem", borderRadius: 20,
                      border: `1.5px solid ${expandedItem.user_liked ? "var(--charcoal)" : "var(--border)"}`,
                      background: expandedItem.user_liked ? "var(--charcoal)" : "none",
                      cursor: currentUserId ? "pointer" : "default",
                      fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                      color: expandedItem.user_liked ? "var(--white)" : "var(--muted)",
                      fontWeight: 500, transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: "0.875rem" }}>{expandedItem.user_liked ? "✦" : "✧"}</span>
                    {expandedItem.like_count > 0 ? `${expandedItem.like_count} inspiring` : "Inspiring"}
                  </button>

                  <button
                    onClick={() => setCommentsOpen(o => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.5rem 1rem", borderRadius: 20,
                      border: `1.5px solid ${commentsOpen ? "var(--charcoal)" : "var(--border)"}`,
                      background: "none", cursor: "pointer",
                      fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                      color: commentsOpen ? "var(--charcoal)" : "var(--muted)",
                      fontWeight: commentsOpen ? 600 : 400, transition: "all 0.15s",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {expandedItem.comment_count > 0 ? `${expandedItem.comment_count}` : "Feedback"}
                  </button>
                </div>
              </div>

              {/* Comments */}
              {commentsOpen && (
                <div style={{ padding: "0.875rem 1rem 1.5rem" }}>
                  {(commentsMap[expandedItem.id] ?? []).length === 0 && (
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.875rem", fontStyle: "italic" }}>No feedback yet — be the first!</p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                    {(commentsMap[expandedItem.id] ?? []).map(c => (
                      <div key={c.id} style={{ display: "flex", gap: "0.625rem" }}>
                        <Avatar url={null} name={c.display_name} size={30} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "baseline", marginBottom: "0.2rem" }}>
                            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)" }}>{c.display_name ?? "Musician"}</span>
                            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)" }}>{formatRelative(c.created_at)}</span>
                          </div>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {currentUserId && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        placeholder="Leave feedback or encouragement…"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(expandedItem.id); } }}
                        style={{ flex: 1, borderRadius: 20, border: "1px solid var(--border)", padding: "0.5rem 1rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}
                      />
                      <button
                        onClick={() => postComment(expandedItem.id)}
                        disabled={!commentText.trim() || commentPosting}
                        style={{ padding: "0.5rem 1rem", borderRadius: 20, border: "none", background: commentText.trim() ? "var(--charcoal)" : "var(--border)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", cursor: commentText.trim() ? "pointer" : "default", transition: "background 0.15s", flexShrink: 0 }}
                      >
                        Post
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
