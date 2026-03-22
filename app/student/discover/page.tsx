"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { PortfolioItemRow } from "../../../lib/services/PortfolioService";
import AudioPlayer from "../../../components/AudioPlayer";
import { usePlayer } from "../../../lib/context/PlayerContext";
import { useI18n } from "../../../lib/context/I18nContext";
import Link from "next/link";
import { Flame, X, Guitar, Trophy } from "lucide-react";

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
  streak_days?: number;
  like_count: number;
  comment_count: number;
  user_liked: boolean;
  view_count: number;
  display_as?: string;
  is_anonymous?: boolean;
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


function formatRelative(iso: string, todayLabel: string, yesterdayLabel: string, daysAgoLabel: string, weekAgoLabel: string, monthAgoLabel: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return todayLabel;
  if (days === 1) return yesterdayLabel;
  if (days < 7) return `${days}${daysAgoLabel}`;
  if (days < 30) return `${Math.floor(days / 7)}${weekAgoLabel}`;
  return `${Math.floor(days / 30)}${monthAgoLabel}`;
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

// ── Deterministic label color from title string ──────────────────────────────
const VINYL_LABEL_COLORS = ["#7B2D3E","#2D5A7B","#3D6B4A","#5A3D7B","#7B5A2D","#2D6B6B","#6B2D5A","#3D4A7B"];
function vinylColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return VINYL_LABEL_COLORS[Math.abs(h) % VINYL_LABEL_COLORS.length];
}

// VinylCover uses a fixed 200×200 viewBox so all geometry is in stable units,
// then the SVG scales to whatever `size` pixels the parent requests.
// Text is only rendered when size >= 110 — below that the label is physically
// too small (~36 px diameter) for any legible type.
const VB = 200; // viewBox side length
const VR = 100; // viewBox radius (centre = 100,100)

function VinylCover({ id, title, artist, size, spinning = false }: {
  id: string; title: string; artist?: string | null; size: number; spinning?: boolean;
}) {
  const showText = size >= 110;
  // Label is 40% of disc radius when showing text (needs room), 32% otherwise
  const labelR = VR * (showText ? 0.40 : 0.32);
  const labelColor = vinylColor(title + id);
  const gradId = `vg-${id}`;
  const shineId = `vs-${id}`;

  // At 200-unit viewBox, labelR ≈ 40 when showing text.
  // Max chars that fit at fontSize 10: width ≈ chars * 6, must fit in 2*labelR*0.88
  const maxTitle  = Math.floor((labelR * 1.76) / 6.2);
  const maxArtist = Math.floor((labelR * 1.76) / 5.0);
  const shortTitle  = title.length  > maxTitle  ? title.slice(0, maxTitle - 1)  + "…" : title;
  const shortArtist = (artist ?? "").length > maxArtist ? (artist ?? "").slice(0, maxArtist - 1) + "…" : (artist ?? "");

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      animation: spinning ? "vinyl-spin 3s linear infinite" : undefined,
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <defs>
          <radialGradient id={gradId} cx="38%" cy="30%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
          </radialGradient>
          <radialGradient id={shineId} cx="35%" cy="28%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Disc body */}
        <circle cx={VR} cy={VR} r={VR - 1} fill="#181412" />

        {/* Grooves */}
        {[0.50, 0.57, 0.63, 0.69, 0.74, 0.79, 0.84, 0.89, 0.94].map((pct, i) => (
          <circle key={i} cx={VR} cy={VR} r={VR * pct}
            fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
        ))}

        {/* Disc sheen */}
        <circle cx={VR} cy={VR} r={VR - 1} fill={`url(#${gradId})`} />

        {/* Label disc */}
        <circle cx={VR} cy={VR} r={labelR} fill={labelColor} />
        <circle cx={VR} cy={VR} r={labelR} fill={`url(#${shineId})`} />
        <circle cx={VR} cy={VR} r={labelR} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />

        {showText && (
          <>
            {/* Title — sits just above centre */}
            <text
              x={VR} y={shortArtist ? VR - labelR * 0.16 : VR}
              textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.93)"
              fontSize={11} fontFamily="Inter, sans-serif" fontWeight={700}
            >{shortTitle}</text>

            {/* Artist — sits just below centre */}
            {shortArtist && (
              <text
                x={VR} y={VR + labelR * 0.35}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(255,255,255,0.65)"
                fontSize={8.5} fontFamily="Inter, sans-serif"
              >{shortArtist}</text>
            )}
          </>
        )}

        {/* Spindle hole */}
        <circle cx={VR} cy={VR} r={5} fill="#181412" />

        {/* Disc edge */}
        <circle cx={VR} cy={VR} r={VR - 1} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1.5} />
      </svg>
    </div>
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
  const { t } = useI18n();
  const [tab, setTab] = useState<"everyone" | "following" | "leaderboard">("everyone");

  // When navigating away, release the mini-player suppression so audio keeps playing
  useEffect(() => {
    return () => setSuppressMiniPlayer(false);
  }, [setSuppressMiniPlayer]);

  const [items, setItems]                       = useState<PublicItem[]>([]);
  const [followingItems, setFollowingItems]     = useState<PublicItem[]>([]);
  const [followingLoaded, setFollowingLoaded]   = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [missingColumns, setMissingColumns]     = useState(false);
  const [queryError, setQueryError]             = useState<string | null>(null);

  const [currentUserId, setCurrentUserId]       = useState<string | null>(null);
  const [currentUserName, setCurrentUserName]   = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [myFollows, setMyFollows]               = useState<Set<string>>(new Set()); // IDs I follow

  const [expandedItem, setExpandedItem]         = useState<PublicItem | null>(null);
  const [commentsMap, setCommentsMap]           = useState<Record<string, Comment[]>>({});
  const [commentsOpen, setCommentsOpen]         = useState(false);
  const [commentText, setCommentText]           = useState("");
  const [commentPosting, setCommentPosting]     = useState(false);
  const [likingId, setLikingId]                 = useState<string | null>(null);
  const [likeError, setLikeError]               = useState<string | null>(null);

  const [collectedIds, setCollectedIds]         = useState<Set<string>>(new Set());
  const [themeSongItemId, setThemeSongItemId]   = useState<string | null>(null);
  const [collectingId, setCollectingId]         = useState<string | null>(null);
  const [settingThemeId, setSettingThemeId]     = useState<string | null>(null);
  const [collectToast, setCollectToast]         = useState(false);

  const [leaderboard, setLeaderboard]           = useState<Array<{ id: string; display_name: string; avatar_url: string | null; streak_days: number; total_days_practiced: number; role: string | null }>>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardLoaded, setLeaderboardLoaded]   = useState(false);
  const [followsMe, setFollowsMe]               = useState<Set<string>>(new Set());

  const [profileInfo, setProfileInfo]           = useState<ProfileInfo | null>(null);
  const [profileItems, setProfileItems]         = useState<PublicItem[]>([]);
  const [followLoading, setFollowLoading]       = useState(false);
  const [followError, setFollowError]           = useState<string | null>(null);
  const [editingBio, setEditingBio]             = useState(false);
  const [bioText, setBioText]                   = useState("");
  const [savingBio, setSavingBio]               = useState(false);

  const supabase = getSupabaseBrowserClient();

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function enrichItems(rows: PortfolioItemRow[], userId: string | null): Promise<PublicItem[]> {
    if (rows.length === 0) return [];
    const studentIds = [...new Set(rows.map(r => r.student_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name, artist_name, avatar_url, streak_days").in("id", studentIds);
    const profileMap: Record<string, { display_name: string; artist_name: string | null; avatar_url: string | null; streak_days: number }> = {};
    (profiles ?? []).forEach((p: { id: string; display_name?: string; artist_name?: string | null; avatar_url?: string | null; streak_days?: number }) => {
      profileMap[p.id] = { display_name: p.display_name ?? "", artist_name: p.artist_name ?? null, avatar_url: p.avatar_url ?? null, streak_days: p.streak_days ?? 0 };
    });

    const itemIds = rows.map(r => r.id);
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from("portfolio_likes").select("portfolio_item_id, user_id").in("portfolio_item_id", itemIds),
      supabase.from("portfolio_comments").select("portfolio_item_id").in("portfolio_item_id", itemIds),
    ]);
    const likesData = (likesRes.data ?? []) as { portfolio_item_id: string; user_id: string }[];
    const commentsData = (commentsRes.data ?? []) as { portfolio_item_id: string }[];

    return rows.map(row => {
      const displayAs = (row as PortfolioItemRow & { display_as?: string }).display_as ?? "real";
      const isAnonymous = displayAs === "anonymous";
      const profile = profileMap[row.student_id];
      let displayName: string | undefined;
      if (isAnonymous) displayName = undefined;
      else if (displayAs === "alias" && profile?.artist_name) displayName = profile.artist_name;
      else displayName = profile?.display_name;

      return {
        ...row,
        display_name: displayName,
        avatar_url: isAnonymous ? null : (profile?.avatar_url ?? null),
        streak_days: profile?.streak_days ?? 0,
        display_as: displayAs,
        is_anonymous: isAnonymous,
        like_count: likesData.filter(l => l.portfolio_item_id === row.id).length,
        comment_count: commentsData.filter(c => c.portfolio_item_id === row.id).length,
        user_liked: likesData.some(l => l.portfolio_item_id === row.id && l.user_id === userId),
        view_count: (row as PortfolioItemRow & { view_count?: number }).view_count ?? 0,
      };
    });
  }

  // ── Initial load ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) {
        // Load profile info for current user
        const { data: me } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", uid).single();
        if (me) {
          setCurrentUserName((me as { display_name?: string | null }).display_name ?? null);
          setCurrentUserAvatar((me as { avatar_url?: string | null }).avatar_url ?? null);
        }
        // Load who we follow
        const { data: followData } = await supabase
          .from("follows").select("following_id").eq("follower_id", uid);
        setMyFollows(new Set((followData ?? []).map((f: { following_id: string }) => f.following_id)));

        // Load crate (collected items)
        const { data: crateData } = await supabase
          .from("portfolio_collections").select("portfolio_item_id").eq("collector_id", uid);
        setCollectedIds(new Set((crateData ?? []).map((c: { portfolio_item_id: string }) => c.portfolio_item_id)));

        // Load current theme song
        const { data: themeData } = await supabase
          .from("profiles").select("theme_song_item_id").eq("id", uid).single();
        if (themeData) {
          setThemeSongItemId((themeData as { theme_song_item_id?: string | null }).theme_song_item_id ?? null);
        }
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

  async function loadLeaderboard() {
    if (leaderboardLoaded) return;
    setLeaderboardLoading(true);
    try {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, streak_days, total_days_practiced, role")
        .gt("streak_days", 0)
        .order("streak_days", { ascending: false })
        .limit(100);

      let followsMeSet = new Set<string>();
      if (currentUserId) {
        const { data: fmData } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", currentUserId);
        followsMeSet = new Set((fmData ?? []).map((f: { follower_id: string }) => f.follower_id));
      }

      setLeaderboard(users ?? []);
      setFollowsMe(followsMeSet);
      setLeaderboardLoaded(true);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  function switchTab(t: "everyone" | "following" | "leaderboard") {
    setTab(t);
    if (t === "following" && !followingLoaded) loadFollowingFeed();
    if (t === "leaderboard" && !leaderboardLoaded) loadLeaderboard();
  }

  // ── Item open/close ─────────────────────────────────────────────────────────

  function openItem(item: PublicItem) {
    // Increment view count (fire-and-forget, update local state optimistically)
    const withView = { ...item, view_count: item.view_count + 1 };
    setExpandedItem(withView);
    const patch = (list: PublicItem[]) => list.map(i => i.id === item.id ? withView : i);
    setItems(patch); setFollowingItems(patch);
    fetch("/api/portfolio/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }) }).catch(() => {});
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

  // ── Reactions ("Love") ─────────────────────────────────────────────────

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

  // ── Collect ──────────────────────────────────────────────────────────────────

  async function collectItem(item: PublicItem) {
    if (!currentUserId || collectingId === item.id) return;
    if (item.student_id === currentUserId) return;
    if (collectedIds.has(item.id)) return;
    setCollectingId(item.id);
    try {
      const res = await fetch("/api/portfolio/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectorId: currentUserId, itemId: item.id }),
      });
      if (!res.ok) throw new Error("collect failed");
      setCollectedIds(prev => new Set([...prev, item.id]));
      setCollectToast(true);
      setTimeout(() => setCollectToast(false), 2500);
    } catch {
      // silently ignore
    } finally {
      setCollectingId(null);
    }
  }

  // ── Set as theme ─────────────────────────────────────────────────────────────

  async function setTheme(item: PublicItem) {
    if (!currentUserId || settingThemeId === item.id) return;
    setSettingThemeId(item.id);
    try {
      await supabase.from("profiles").update({ theme_song_item_id: item.id, theme_song_title: item.title }).eq("id", currentUserId);
      setThemeSongItemId(item.id);
    } finally {
      setSettingThemeId(null);
    }
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
        setFollowingLoaded(false);
        setFollowingItems([]);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: userId });
        setFollowingLoaded(false);
        setFollowingItems([]);
      }
    } catch (err) {
      // Revert
      setMyFollows(prev => { const n = new Set(prev); isFollowing ? n.add(userId) : n.delete(userId); return n; });
      if (profileInfo?.id === userId) {
        setProfileInfo(prev => prev ? { ...prev, follower_count: prev.follower_count + (isFollowing ? 1 : -1) } : prev);
      }
      const msg = (err as { message?: string })?.message ?? "Could not follow";
      setFollowError(msg);
      setTimeout(() => setFollowError(null), 4000);
    } finally { setFollowLoading(false); }
  }

  // ── Profile sheet ────────────────────────────────────────────────────────────

  async function openProfile(studentId: string) {
    setProfileInfo(null);
    setProfileItems([]);
    setEditingBio(false);

    // Fetch profile — try with bio first, fall back without (bio column may not exist yet)
    type PData = { id: string; display_name: string; avatar_url: string | null; bio?: string | null; streak_days: number };
    let profileData: PData | null = null;
    const withBio = await supabase.from("profiles").select("id, display_name, avatar_url, bio, streak_days").eq("id", studentId).single();
    if (withBio.data) {
      profileData = withBio.data as PData;
    } else {
      const withoutBio = await supabase.from("profiles").select("id, display_name, avatar_url, streak_days").eq("id", studentId).single();
      if (withoutBio.data) profileData = withoutBio.data as PData;
    }

    // Follower/following counts — may fail if follows table doesn't exist yet
    const [followerRes, followingRes, itemsRes] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", studentId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", studentId),
      supabase.from("portfolio_items").select("*").eq("student_id", studentId).eq("is_public", true).order("created_at", { ascending: false }),
    ]);

    if (profileData) {
      setProfileInfo({
        id: profileData.id,
        name: profileData.display_name,
        bio: profileData.bio ?? null,
        avatar_url: profileData.avatar_url,
        follower_count: followerRes.count ?? 0,
        following_count: followingRes.count ?? 0,
        streak_days: profileData.streak_days,
      });
      setBioText(profileData.bio ?? "");
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
        <div style={{ padding: "1.25rem 1rem 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.625rem", color: "var(--charcoal)", letterSpacing: "-0.01em", margin: 0 }}>
              {t.student.discoverTitle}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", margin: "0.125rem 0 0.75rem" }}>
              {t.student.discoverSubtitle}
            </p>
          </div>
          {currentUserId && (
            <button
              onClick={() => openProfile(currentUserId)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}
            >
              <Avatar url={currentUserAvatar} name={currentUserName} size={32} />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", fontWeight: 500 }}>{t.student.myProfile}</span>
            </button>
          )}
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 1rem" }}>
          {(["everyone", "following", "leaderboard"] as const).map(tabKey => (
            <button key={tabKey} onClick={() => switchTab(tabKey)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "0.5rem 1rem 0.625rem",
              fontFamily: "Inter, sans-serif", fontWeight: tab === tabKey ? 600 : 400, fontSize: "0.875rem",
              color: tab === tabKey ? "var(--charcoal)" : "var(--muted)",
              borderBottom: `2px solid ${tab === tabKey ? "var(--charcoal)" : "transparent"}`,
              transition: "all 0.15s",
            }}>
              {tabKey === "everyone" ? t.student.everyoneTab : tabKey === "following" ? t.student.followingTab : "Leaderboard"}
              {tabKey === "following" && myFollows.size > 0 && (
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
              {t.student.setupRequired}
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
              Run <code>supabase/discover_social.sql</code> in your Supabase SQL editor to enable social features.
            </p>
          </div>
        </div>
      ) : queryError ? (
        <div style={{ padding: "1.5rem" }}>
          <div style={{ background: "var(--peach-bg)", border: "1px solid var(--peach-light)", borderRadius: 4, padding: "1.25rem" }}>
            <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--peach)", marginBottom: "0.375rem" }}>{t.student.couldNotLoadFeed}</div>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--peach)", margin: 0 }}>{queryError}</p>
          </div>
        </div>
      ) : tab === "following" && followingLoading ? (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>{t.common.loading}…</div>
        </div>
      ) : tab === "following" && myFollows.size === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>👥</div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.5rem" }}>{t.student.nobodyFollowedYet}</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 260, margin: "0 auto" }}>
            {t.student.nobodyFollowedDesc}
          </p>
        </div>
      ) : tab === "following" && followingItems.length === 0 && followingLoaded ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.5rem" }}>{t.student.nothingPostedYet}</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 260, margin: "0 auto" }}>
            {t.student.nothingPostedDesc}
          </p>
        </div>
      ) : displayItems.length === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}><Guitar size={32} strokeWidth={1.5} color="var(--muted)" /></div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>{t.student.nothingSharedYet}</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 280, margin: "0 auto" }}>
            {t.student.nothingSharedDesc}
          </p>
        </div>
      ) : tab === "leaderboard" ? (
        <div style={{ padding: "0.75rem", paddingBottom: "5.5rem" }}>
          {leaderboardLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ background: "var(--white)", borderRadius: 10, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div className="skeleton" style={{ width: 28, height: 16, borderRadius: 4, flexShrink: 0 }} />
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 12, width: "50%", borderRadius: 4, marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: "30%", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <Trophy size={36} strokeWidth={1.5} color="var(--muted)" style={{ marginBottom: "0.75rem" }} />
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)", fontWeight: 500 }}>No streaks yet</div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>Start practicing to appear on the leaderboard!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {leaderboard.map((u, idx) => {
                const rank = idx + 1;
                const isMe = u.id === currentUserId;
                const iFollow = myFollows.has(u.id);
                const theyFollowMe = followsMe.has(u.id);
                const medalColor = rank === 1 ? "#E6A817" : rank === 2 ? "#9E9E9E" : rank === 3 ? "#C07B4B" : null;
                return (
                  <div key={u.id} style={{
                    background: isMe ? "var(--cream)" : "var(--white)",
                    border: isMe ? "1.5px solid var(--charcoal)" : "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "0.625rem 0.875rem",
                    display: "flex", alignItems: "center", gap: "0.75rem",
                  }}>
                    {/* Rank */}
                    <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                      {medalColor ? (
                        <Trophy size={18} strokeWidth={1.5} color={medalColor} fill={medalColor} />
                      ) : (
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>#{rank}</span>
                      )}
                    </div>

                    {/* Avatar — clickable → profile */}
                    <Link href={`/student/profile/${u.id}`} style={{ flexShrink: 0 }}>
                      <Avatar url={u.avatar_url} name={u.display_name} size={36} />
                    </Link>

                    {/* Name + badges */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/student/profile/${u.id}`} style={{ textDecoration: "none" }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {u.display_name}
                          {isMe && <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 500, color: "var(--muted)", marginLeft: "0.375rem" }}>you</span>}
                        </div>
                      </Link>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.2rem" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", background: "rgba(230,168,23,0.12)", border: "1px solid rgba(230,168,23,0.25)", borderRadius: 99, padding: "0.1rem 0.4rem", color: "#c47d10", fontWeight: 700, fontSize: "0.625rem" }}>
                          <Flame size={10} color="#E6A817" fill="#E6A817" strokeWidth={0} />{u.streak_days}d streak
                        </span>
                        {(u.total_days_practiced ?? 0) > 0 && (
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 500, color: "var(--muted)" }}>{u.total_days_practiced} days practiced</span>
                        )}
                        {theyFollowMe && !isMe && (
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--sage)", background: "var(--sage-bg, #EFF7EF)", borderRadius: 99, padding: "0.1rem 0.4rem" }}>follows you</span>
                        )}
                      </div>
                    </div>

                    {/* Follow button */}
                    {!isMe && currentUserId && (
                      <button
                        onClick={() => toggleFollow(u.id)}
                        disabled={followLoading}
                        style={{
                          padding: "0.35rem 0.875rem", borderRadius: 20, flexShrink: 0,
                          fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem",
                          cursor: followLoading ? "default" : "pointer", transition: "all 0.15s",
                          border: iFollow ? "1.5px solid var(--border-strong)" : "none",
                          background: iFollow ? "transparent" : "var(--charcoal)",
                          color: iFollow ? "var(--charcoal)" : "var(--white)",
                          opacity: followLoading ? 0.6 : 1,
                        }}
                      >
                        {iFollow ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.75rem", paddingBottom: "5.5rem" }}>
          {displayItems.map(item => {
            const isVideo = item.media_type === "video";
            return (
              <div key={item.id} onClick={() => openItem(item)} style={{ cursor: "pointer" }}>
                <div style={{ aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "#1a1a1a", position: "relative" }}>
                  {isVideo && item.recording_url ? <VideoThumbnail src={item.recording_url} /> : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1210 0%, #2e2520 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <VinylCover id={item.id} title={item.title} artist={item.is_anonymous ? undefined : item.display_name} size={72} />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.4rem", padding: "0.4rem 0.1rem 0" }}>
                  <div onClick={item.is_anonymous ? undefined : e => { e.stopPropagation(); openProfile(item.student_id); }} style={{ cursor: item.is_anonymous ? "default" : "pointer" }}>
                    <Avatar url={item.is_anonymous ? null : item.avatar_url} name={item.is_anonymous ? "?" : item.display_name} size={26} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem", color: "var(--charcoal)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, marginBottom: "0.15rem" }}>
                      {item.title}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", lineHeight: 1.3, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.25rem" }}>
                      <span>{item.is_anonymous ? "👻 Anonymous" : (item.display_name ?? t.student.musicianFallback)}</span>
                      {!item.is_anonymous && myFollows.has(item.student_id) && <span style={{ color: "var(--sage)", fontWeight: 600 }}>· {t.student.followingBadge}</span>}
                      {(item.streak_days ?? 0) > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", background: "rgba(230,168,23,0.12)", border: "1px solid rgba(230,168,23,0.25)", borderRadius: 99, padding: "0.05rem 0.35rem", color: "#c47d10", fontWeight: 700, fontSize: "0.5rem", letterSpacing: "0.01em" }}>
                          <Flame size={10} color="#E6A817" fill="#E6A817" strokeWidth={0} />{item.streak_days}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem" }}>
                      <span style={{ fontSize: "0.5625rem" }}>{item.user_liked ? "✦" : "✧"}</span>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", fontWeight: 500 }}>{item.like_count}</span>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", fontWeight: 500 }}>{item.comment_count}</span>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", marginLeft: "auto" }}>{formatRelative(item.created_at, t.schedule.today, t.schedule.yesterday, t.schedule.daysAgo, t.student.weekAgo, t.student.monthAgo)}</span>
                    </div>
                    {/* Collect + Set theme actions */}
                    <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                      {item.student_id !== currentUserId && (
                        <button
                          onClick={() => collectItem(item)}
                          disabled={collectedIds.has(item.id) || collectingId === item.id}
                          style={{
                            background: "none", border: "1px solid var(--border)", borderRadius: 99,
                            padding: "0.1rem 0.45rem", cursor: collectedIds.has(item.id) ? "default" : "pointer",
                            fontFamily: "Inter, sans-serif", fontSize: "0.5rem", fontWeight: 500,
                            color: collectedIds.has(item.id) ? "var(--muted)" : "var(--charcoal)",
                            opacity: collectingId === item.id ? 0.5 : 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {collectedIds.has(item.id)
                            ? "✓ In Crate"
                            : (item as PublicItem & { price_points?: number }).price_points
                              ? `+ Collect · ${(item as PublicItem & { price_points?: number }).price_points} pts`
                              : "+ Collect"}
                        </button>
                      )}
                      <button
                        onClick={() => setTheme(item)}
                        disabled={settingThemeId === item.id}
                        style={{
                          background: "none", border: "1px solid var(--border)", borderRadius: 99,
                          padding: "0.1rem 0.45rem", cursor: "pointer",
                          fontFamily: "Inter, sans-serif", fontSize: "0.5rem", fontWeight: 500,
                          color: themeSongItemId === item.id ? "#c47d10" : "var(--muted)",
                          borderColor: themeSongItemId === item.id ? "rgba(230,168,23,0.4)" : "var(--border)",
                          opacity: settingThemeId === item.id ? 0.5 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {themeSongItemId === item.id ? "♫ Theme" : "♫ Set theme"}
                      </button>
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
        <div style={{ position: "fixed", bottom: "5.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 600, background: "var(--charcoal)", color: "var(--white)", fontSize: "0.8125rem", fontWeight: 500, padding: "0.625rem 1.25rem", borderRadius: 24, boxShadow: "var(--shadow-md)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {likeError}
        </div>
      )}

      {/* ── Collect toast ── */}
      {collectToast && (
        <div style={{ position: "fixed", bottom: "5.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 600, background: "var(--charcoal)", color: "var(--white)", fontSize: "0.8125rem", fontWeight: 500, padding: "0.625rem 1.25rem", borderRadius: 24, boxShadow: "var(--shadow-md)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          Added to crate!
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.2 }}>{profileInfo.name}</div>
                    <Link href={`/student/studio/${profileInfo.id}`} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: "2px", flexShrink: 0 }}>
                      Visit studio →
                    </Link>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.375rem" }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                      <strong style={{ color: "var(--charcoal)" }}>{profileInfo.follower_count}</strong> {t.student.followersLabel}
                    </span>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                      <strong style={{ color: "var(--charcoal)" }}>{profileInfo.following_count}</strong> {t.student.followingLabel}
                    </span>
                    {profileInfo.streak_days > 0 && (
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                        <Flame size={14} color="#E6A817" fill="#E6A817" strokeWidth={0} style={{ display: "inline", verticalAlign: "middle" }} /> <strong style={{ color: "var(--charcoal)" }}>{profileInfo.streak_days}</strong>{t.student.streakDaysLabel}
                      </span>
                    )}
                  </div>
                </div>
                {/* Follow button or close */}
                {currentUserId && currentUserId !== profileInfo.id ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", flexShrink: 0 }}>
                  <button
                    onClick={() => toggleFollow(profileInfo.id)}
                    disabled={followLoading}
                    style={{
                      padding: "0.5rem 1.125rem", borderRadius: 20, fontFamily: "Inter, sans-serif",
                      fontWeight: 600, fontSize: "0.8125rem", cursor: followLoading ? "default" : "pointer", transition: "all 0.15s",
                      border: myFollows.has(profileInfo.id) ? "1.5px solid var(--border-strong)" : "none",
                      background: myFollows.has(profileInfo.id) ? "transparent" : "var(--charcoal)",
                      color: myFollows.has(profileInfo.id) ? "var(--charcoal)" : "var(--white)",
                      opacity: followLoading ? 0.6 : 1,
                    }}
                  >
                    {followLoading ? "…" : myFollows.has(profileInfo.id) ? t.student.followingAction : t.student.followAction}
                  </button>
                  {followError && <span style={{ fontSize: "0.625rem", color: "var(--error)", maxWidth: 120, textAlign: "right", lineHeight: 1.3 }}>{followError}</span>}
                  </div>
                ) : (
                  <button onClick={() => { setProfileInfo(null); setProfileItems([]); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: 0, flexShrink: 0, display: "flex", alignItems: "center" }}><X size={20} strokeWidth={1.5} /></button>
                )}
              </div>

              {/* Bio */}
              {currentUserId === profileInfo.id ? (
                editingBio ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <textarea
                      value={bioText}
                      onChange={e => setBioText(e.target.value)}
                      placeholder={t.student.bioPlaceholder}
                      maxLength={160}
                      rows={2}
                      style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid var(--border-strong)", padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", resize: "none", lineHeight: 1.5 }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={saveBio} disabled={savingBio} style={{ padding: "0.375rem 1rem", borderRadius: 8, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>
                        {savingBio ? t.common.saving : t.common.save}
                      </button>
                      <button onClick={() => { setEditingBio(false); setBioText(profileInfo.bio ?? ""); }} style={{ padding: "0.375rem 0.875rem", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", cursor: "pointer" }}>
                        {t.common.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setEditingBio(true); setBioText(profileInfo.bio ?? ""); }} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: 8, padding: "0.375rem 0.75rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: profileInfo.bio ? "var(--charcoal)" : "var(--muted)", textAlign: "left", width: "100%", lineHeight: 1.5 }}>
                    {profileInfo.bio ?? t.student.addABio}
                  </button>
                )
              ) : profileInfo.bio ? (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: 0, lineHeight: 1.55 }}>{profileInfo.bio}</p>
              ) : null}
            </div>

            {/* Grid */}
            <div style={{ overflowY: "auto", flex: 1, padding: profileItems.length === 0 ? "2rem 1rem" : 0 }}>
              {profileItems.length === 0 ? (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", textAlign: "center", margin: 0, fontStyle: "italic" }}>{t.student.noClipsSharedYet}</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, background: "#111" }}>
                  {profileItems.map(pi => (
                    <div key={pi.id} onClick={() => { setProfileInfo(null); setProfileItems([]); openItem(pi); }} style={{ cursor: "pointer", position: "relative", background: "#1a1a1a", overflow: "hidden", aspectRatio: "9/14" }}>
                      {pi.media_type === "video" && pi.recording_url ? <VideoThumbnail src={pi.recording_url} /> : (
                        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1210 0%, #2e2520 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <VinylCover id={pi.id} title={pi.title} artist={pi.is_anonymous ? undefined : pi.display_name} size={84} />
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
              <button onClick={closeItem} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: "0 0 0 1rem", display: "flex", alignItems: "center" }}><X size={20} strokeWidth={1.5} /></button>
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
                <div style={{ background: "linear-gradient(160deg, #1a1210 0%, #2e2520 55%, #3a2d26 100%)", padding: "1.75rem 1.25rem", display: "flex", alignItems: "center", gap: "1.125rem" }}>
                  <VinylCover id={expandedItem.id} title={expandedItem.title} artist={expandedItem.is_anonymous ? undefined : expandedItem.display_name} size={140} spinning />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "#fff", lineHeight: 1.3 }}>{expandedItem.title}</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>{expandedItem.is_anonymous ? "👻 Anonymous" : (expandedItem.display_name ?? t.student.musicianFallback)}</div>
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
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: expandedItem.description ? "0.625rem" : 0 }}>
                  <div onClick={expandedItem.is_anonymous ? undefined : () => openProfile(expandedItem.student_id)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: expandedItem.is_anonymous ? "default" : "pointer", flex: 1, minWidth: 0 }}>
                    <Avatar url={expandedItem.is_anonymous ? null : expandedItem.avatar_url} name={expandedItem.is_anonymous ? "?" : expandedItem.display_name} size={28} />
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", fontWeight: 500, textDecoration: expandedItem.is_anonymous ? "none" : "underline", textDecorationColor: "var(--border)", textUnderlineOffset: "2px" }}>
                      {expandedItem.is_anonymous ? "👻 Anonymous" : (expandedItem.display_name ?? t.student.musicianFallback)}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                      · {formatRelative(expandedItem.created_at, t.schedule.today, t.schedule.yesterday, t.schedule.daysAgo, t.student.weekAgo, t.student.monthAgo)}
                    </div>
                  </div>
                  {currentUserId && currentUserId !== expandedItem.student_id && !expandedItem.is_anonymous && (
                    <button
                      onClick={() => toggleFollow(expandedItem.student_id)}
                      disabled={followLoading}
                      style={{
                        padding: "0.3rem 0.875rem", borderRadius: 20, fontFamily: "Inter, sans-serif",
                        fontWeight: 600, fontSize: "0.75rem", cursor: followLoading ? "default" : "pointer",
                        border: myFollows.has(expandedItem.student_id) ? "1.5px solid var(--border-strong)" : "none",
                        background: myFollows.has(expandedItem.student_id) ? "transparent" : "var(--charcoal)",
                        color: myFollows.has(expandedItem.student_id) ? "var(--charcoal)" : "var(--white)",
                        flexShrink: 0, transition: "all 0.15s",
                      }}
                    >
                      {followLoading ? "…" : myFollows.has(expandedItem.student_id) ? t.student.followingAction : t.student.followAction}
                    </button>
                  )}
                </div>
                {expandedItem.description && (
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 0.5rem" }}>
                    {expandedItem.description}
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
                    {expandedItem.like_count > 0 ? `${expandedItem.like_count} ${t.student.loveAction}` : t.student.loveAction}
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
                    {expandedItem.comment_count > 0 ? `${expandedItem.comment_count}` : t.student.feedbackAction}
                  </button>

                  {/* Collect button */}
                  {expandedItem.student_id !== currentUserId && (
                    <button
                      onClick={() => collectItem(expandedItem)}
                      disabled={collectedIds.has(expandedItem.id) || collectingId === expandedItem.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.5rem 1rem", borderRadius: 20,
                        border: `1.5px solid ${collectedIds.has(expandedItem.id) ? "var(--border)" : "var(--border)"}`,
                        background: "none",
                        cursor: collectedIds.has(expandedItem.id) ? "default" : "pointer",
                        fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                        color: collectedIds.has(expandedItem.id) ? "var(--muted)" : "var(--charcoal)",
                        fontWeight: 500, transition: "all 0.15s",
                        opacity: collectingId === expandedItem.id ? 0.5 : 1,
                      }}
                    >
                      {collectedIds.has(expandedItem.id)
                        ? "✓ In Crate"
                        : (expandedItem as PublicItem & { price_points?: number }).price_points
                          ? `+ Collect · ${(expandedItem as PublicItem & { price_points?: number }).price_points} pts`
                          : "+ Collect"}
                    </button>
                  )}

                  {/* Set as theme button */}
                  <button
                    onClick={() => setTheme(expandedItem)}
                    disabled={settingThemeId === expandedItem.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      padding: "0.5rem 1rem", borderRadius: 20,
                      border: `1.5px solid ${themeSongItemId === expandedItem.id ? "rgba(230,168,23,0.5)" : "var(--border)"}`,
                      background: "none",
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                      color: themeSongItemId === expandedItem.id ? "#c47d10" : "var(--muted)",
                      fontWeight: themeSongItemId === expandedItem.id ? 600 : 400,
                      transition: "all 0.15s",
                      opacity: settingThemeId === expandedItem.id ? 0.5 : 1,
                    }}
                  >
                    {themeSongItemId === expandedItem.id ? "♫ Theme" : "♫ Set theme"}
                  </button>

                  {/* View count */}
                  <span style={{
                    marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.3rem",
                    fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {expandedItem.view_count.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Comments */}
              {commentsOpen && (
                <div style={{ padding: "0.875rem 1rem 1.5rem" }}>
                  {(commentsMap[expandedItem.id] ?? []).length === 0 && (
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.875rem", fontStyle: "italic" }}>{t.student.noFeedbackYet}</p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                    {(commentsMap[expandedItem.id] ?? []).map(c => (
                      <div key={c.id} style={{ display: "flex", gap: "0.625rem" }}>
                        <Avatar url={null} name={c.display_name} size={30} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "baseline", marginBottom: "0.2rem" }}>
                            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)" }}>{c.display_name ?? t.student.musicianFallback}</span>
                            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)" }}>{formatRelative(c.created_at, t.schedule.today, t.schedule.yesterday, t.schedule.daysAgo, t.student.weekAgo, t.student.monthAgo)}</span>
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
                        placeholder={t.student.leaveFeedbackPlaceholder}
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
                        {t.student.postComment}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes vinyl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
