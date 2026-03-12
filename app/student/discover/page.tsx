"use client";
import React, { useEffect, useState, useRef } from "react";
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
  like_count: number;
  comment_count: number;
  user_liked: boolean;
};

const ALTER_SQL = `ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'audio',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;`;

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
    <video
      ref={ref}
      src={src}
      preload="metadata"
      muted
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      onLoadedMetadata={e => {
        const v = e.target as HTMLVideoElement;
        v.currentTime = Math.min(1.5, v.duration * 0.1);
      }}
    />
  );
}

export default function DiscoverPage() {
  const { playDiscover, stopDiscover, setSuppressMiniPlayer } = usePlayer();
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingColumns, setMissingColumns] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<PublicItem | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<{ id: string; name: string } | null>(null);
  const [profileItems, setProfileItems] = useState<PublicItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const { data: itemData, error: itemError } = await supabase
          .from("portfolio_items")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false });
        if (itemError) throw itemError;

        const rows = (itemData ?? []) as PortfolioItemRow[];

        const studentIds = [...new Set(rows.map(r => r.student_id))];
        const displayNames: Record<string, string> = {};
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles").select("id, display_name").in("id", studentIds);
          (profiles ?? []).forEach((p: { id: string; display_name?: string }) => {
            if (p.display_name) displayNames[p.id] = p.display_name;
          });
        }

        let likesData: { portfolio_item_id: string; user_id: string }[] = [];
        let commentsData: { portfolio_item_id: string }[] = [];
        if (rows.length > 0) {
          const itemIds = rows.map(r => r.id);
          const [likesRes, commentsRes] = await Promise.all([
            supabase.from("portfolio_likes").select("portfolio_item_id, user_id").in("portfolio_item_id", itemIds),
            supabase.from("portfolio_comments").select("portfolio_item_id").in("portfolio_item_id", itemIds),
          ]);
          if (!likesRes.error) likesData = (likesRes.data ?? []) as typeof likesData;
          if (!commentsRes.error) commentsData = (commentsRes.data ?? []) as typeof commentsData;
        }

        const mapped: PublicItem[] = rows.map(row => ({
          ...row,
          display_name: displayNames[row.student_id],
          like_count: likesData.filter(l => l.portfolio_item_id === row.id).length,
          comment_count: commentsData.filter(c => c.portfolio_item_id === row.id).length,
          user_liked: likesData.some(l => l.portfolio_item_id === row.id && l.user_id === user?.id),
        }));
        setItems(mapped);
      } catch (err) {
        const e = err as { message?: string; code?: string };
        console.error("discover load error:", e?.code, e?.message);
        if (e?.code === "42703" || e?.code === "42P01" || e?.message?.includes("is_public") || e?.message?.includes("media_type")) {
          setMissingColumns(true);
        } else {
          setQueryError(e?.message ?? "Unknown error");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  function openItem(item: PublicItem) {
    setExpandedItem(item);
    setCommentsOpen(false);
    setCommentText("");
    if (!commentsMap[item.id]) loadComments(item.id);
    // Register with global player so it persists when navigating away
    if (item.recording_url) {
      playDiscover({
        id: item.id,
        title: item.title,
        displayName: item.display_name,
        mediaType: item.media_type === "video" ? "video" : "audio",
        recordingUrl: item.recording_url,
      });
    }
    // Hide mini player bar while modal is open (video plays in modal directly)
    setSuppressMiniPlayer(true);
  }

  function closeItem() {
    setExpandedItem(null);
    setCommentsOpen(false);
    setCommentText("");
    // Show mini player now that modal is closed — it continues playing
    setSuppressMiniPlayer(false);
  }

  async function toggleLike(item: PublicItem) {
    if (!currentUserId) { setLikeError("Sign in to like covers"); setTimeout(() => setLikeError(null), 3000); return; }
    if (likingId === item.id) return;
    setLikingId(item.id);
    const next = { ...item, user_liked: !item.user_liked, like_count: item.user_liked ? item.like_count - 1 : item.like_count + 1 };
    setItems(prev => prev.map(i => i.id === item.id ? next : i));
    if (expandedItem?.id === item.id) setExpandedItem(next);
    try {
      const supabase = getSupabaseBrowserClient();
      if (item.user_liked) {
        const { error } = await supabase.from("portfolio_likes").delete().eq("portfolio_item_id", item.id).eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("portfolio_likes").insert({ portfolio_item_id: item.id, user_id: currentUserId });
        if (error) throw error;
      }
    } catch (err) {
      setItems(prev => prev.map(i => i.id === item.id ? item : i));
      if (expandedItem?.id === item.id) setExpandedItem(item);
      const e = err as { message?: string };
      setLikeError(e?.message ?? "Could not save like");
      setTimeout(() => setLikeError(null), 4000);
    } finally {
      setLikingId(null);
    }
  }

  async function openProfile(studentId: string, displayName: string) {
    setProfileUser({ id: studentId, name: displayName });
    setProfileItems([]);
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("portfolio_items")
      .select("*")
      .eq("student_id", studentId)
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as PortfolioItemRow[];
    const mapped: PublicItem[] = rows.map(row => ({
      ...row,
      display_name: displayName,
      like_count: 0,
      comment_count: 0,
      user_liked: false,
    }));
    setProfileItems(mapped);
  }

  async function loadComments(itemId: string) {
    const supabase = getSupabaseBrowserClient();
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
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.from("portfolio_comments").insert({ portfolio_item_id: itemId, user_id: currentUserId, content: commentText.trim() }).select("*").single();
      if (data) {
        const row = data as Comment;
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", currentUserId).single();
        const comment: Comment = { ...row, display_name: (profile as { display_name?: string } | null)?.display_name };
        setCommentsMap(prev => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), comment] }));
        const updated = { ...expandedItem!, comment_count: expandedItem!.comment_count + 1 };
        setExpandedItem(updated);
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, comment_count: i.comment_count + 1 } : i));
        setCommentText("");
      }
    } finally {
      setCommentPosting(false);
    }
  }

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

  const initials = (name?: string) => (name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)" }}>
      {/* Header */}
      <div style={{ padding: "1.25rem 1rem 0.75rem", background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.625rem", color: "var(--charcoal)", letterSpacing: "-0.01em", margin: 0 }}>
          Discover
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", margin: "0.125rem 0 0" }}>
          {items.length > 0 ? `${items.length} cover${items.length > 1 ? "s" : ""} from musicians everywhere` : "Performances & covers from musicians everywhere"}
        </p>
      </div>

      {missingColumns ? (
        <div style={{ padding: "1.5rem", background: "var(--cream)" }}>
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>One more SQL step needed</div>
            <pre style={{ background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.875rem", fontSize: "0.7rem", fontFamily: "monospace", color: "var(--charcoal)", overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{ALTER_SQL}</pre>
          </div>
        </div>
      ) : queryError ? (
        <div style={{ padding: "1.5rem", background: "var(--cream)" }}>
          <div style={{ background: "#FDF6F3", border: "1px solid #E8C4BA", borderRadius: 10, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "#B85C3A", marginBottom: "0.375rem" }}>Could not load covers</div>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#B85C3A", margin: 0, wordBreak: "break-all" }}>{queryError}</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", fontSize: "1.75rem" }}>🎸</div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>Nothing shared yet</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 280, margin: "0 auto" }}>
            Covers appear here when students share them from Journey. Go to <strong>Journey → Add Cover</strong> and turn on &ldquo;Share to Discover&rdquo;.
          </p>
        </div>
      ) : (
        /* ── Grid browse view ── */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.75rem", paddingBottom: "5.5rem" }}>
          {items.map(item => {
            const isVideo = item.media_type === "video";
            return (
              <div key={item.id} onClick={() => openItem(item)} style={{ cursor: "pointer" }}>
                {/* Thumbnail */}
                <div style={{ aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "#1a1a1a", position: "relative" }}>
                  {isVideo && item.recording_url ? (
                    <VideoThumbnail src={item.recording_url} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                    </div>
                  )}
                </div>
                {/* Metadata below thumbnail */}
                <div style={{ display: "flex", gap: "0.4rem", padding: "0.4rem 0.1rem 0" }}>
                  {/* Author avatar */}
                  <div
                    onClick={e => { e.stopPropagation(); openProfile(item.student_id, item.display_name ?? "Musician"); }}
                    style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.45rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                  >
                    {initials(item.display_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title */}
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem", color: "var(--charcoal)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, marginBottom: "0.15rem" }}>
                      {item.title}
                    </div>
                    {/* Author + date */}
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", lineHeight: 1.3 }}>
                      {item.display_name ?? "Musician"}
                    </div>
                    {/* Like + comment row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill={item.like_count > 0 ? "#e85d4a" : "none"} stroke={item.like_count > 0 ? "#e85d4a" : "var(--muted)"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
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
      {profileUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex", flexDirection: "column" }}>
          <div onClick={() => { setProfileUser(null); setProfileItems([]); }} style={{ flex: 1, background: "rgba(0,0,0,0.6)", minHeight: 40 }} />
          <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", maxHeight: "85dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem 0.75rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6875rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
                {initials(profileUser.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.2 }}>{profileUser.name}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>{profileItems.length > 0 ? `${profileItems.length} public cover${profileItems.length > 1 ? "s" : ""}` : "Loading…"}</div>
              </div>
              <button onClick={() => { setProfileUser(null); setProfileItems([]); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.375rem", color: "var(--muted)", lineHeight: 1, padding: 0 }}>×</button>
            </div>
            {/* Grid */}
            <div style={{ overflowY: "auto", flex: 1, padding: profileItems.length === 0 ? "2rem 1rem" : 0 }}>
              {profileItems.length === 0 ? (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", textAlign: "center", margin: 0, fontStyle: "italic" }}>Loading covers…</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, background: "#111" }}>
                  {profileItems.map(pi => (
                    <div key={pi.id} onClick={() => { setProfileUser(null); setProfileItems([]); openItem(pi); }} style={{ cursor: "pointer", position: "relative", background: "#1a1a1a", overflow: "hidden", aspectRatio: "9/14" }}>
                      {pi.media_type === "video" && pi.recording_url ? (
                        <VideoThumbnail src={pi.recording_url} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                        </div>
                      )}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.375rem 0.375rem 0.3rem" }}>
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
          {/* Backdrop */}
          <div onClick={closeItem} style={{ flex: 1, background: "rgba(0,0,0,0.7)", minHeight: 40 }} />

          {/* Sheet */}
          <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Drag handle + close */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem 0.5rem" }}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: "var(--border)" }} />
              <button onClick={closeItem} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.375rem", color: "var(--muted)", lineHeight: 1, padding: "0 0 0 1rem" }}>×</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {/* Video player */}
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
                <div
                  onClick={() => openProfile(expandedItem.student_id, expandedItem.display_name ?? "Musician")}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: expandedItem.description ? "0.625rem" : 0, cursor: "pointer" }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
                    {initials(expandedItem.display_name)}
                  </div>
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
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: 20, border: `1.5px solid ${expandedItem.user_liked ? "#e85d4a" : "var(--border)"}`, background: expandedItem.user_liked ? "rgba(232,93,74,0.07)" : "none", cursor: currentUserId ? "pointer" : "default", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: expandedItem.user_liked ? "#e85d4a" : "var(--muted)", fontWeight: 500, transition: "all 0.15s" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={expandedItem.user_liked ? "#e85d4a" : "none"} stroke={expandedItem.user_liked ? "#e85d4a" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    {expandedItem.like_count > 0 ? expandedItem.like_count : "Like"}
                  </button>

                  <button
                    onClick={() => setCommentsOpen(o => !o)}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: 20, border: `1.5px solid ${commentsOpen ? "var(--charcoal)" : "var(--border)"}`, background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: commentsOpen ? "var(--charcoal)" : "var(--muted)", fontWeight: commentsOpen ? 600 : 400, transition: "all 0.15s" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {expandedItem.comment_count > 0 ? `${expandedItem.comment_count} comment${expandedItem.comment_count > 1 ? "s" : ""}` : "Comment"}
                  </button>
                </div>
              </div>

              {/* Comments */}
              {commentsOpen && (
                <div style={{ padding: "0.875rem 1rem 1.5rem" }}>
                  {(commentsMap[expandedItem.id] ?? []).length === 0 && (
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.875rem", fontStyle: "italic" }}>No comments yet — be the first!</p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                    {(commentsMap[expandedItem.id] ?? []).map(c => (
                      <div key={c.id} style={{ display: "flex", gap: "0.625rem" }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
                          {initials(c.display_name)}
                        </div>
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
                        placeholder="Add a comment…"
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
