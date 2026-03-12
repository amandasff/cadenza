"use client";
import React, { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { PortfolioItemRow } from "../../../lib/services/PortfolioService";
import AudioPlayer from "../../../components/AudioPlayer";

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

export default function DiscoverPage() {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingColumns, setMissingColumns] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        // Fetch public items (no join — no FK between portfolio_items and profiles)
        const { data: itemData, error: itemError } = await supabase
          .from("portfolio_items")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false });
        if (itemError) throw itemError;

        const rows = (itemData ?? []) as PortfolioItemRow[];

        // Fetch display names for unique student_ids
        const studentIds = [...new Set(rows.map(r => r.student_id))];
        const displayNames: Record<string, string> = {};
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", studentIds);
          (profiles ?? []).forEach((p: { id: string; display_name?: string }) => {
            if (p.display_name) displayNames[p.id] = p.display_name;
          });
        }

        // Try to fetch likes + comments; gracefully skip if tables don't exist
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

  async function toggleLike(item: PublicItem) {
    if (!currentUserId || likingId === item.id) return;
    setLikingId(item.id);
    setItems(prev => prev.map(i => i.id === item.id ? {
      ...i,
      user_liked: !i.user_liked,
      like_count: i.user_liked ? i.like_count - 1 : i.like_count + 1,
    } : i));
    try {
      const supabase = getSupabaseBrowserClient();
      if (item.user_liked) {
        await supabase.from("portfolio_likes").delete()
          .eq("portfolio_item_id", item.id).eq("user_id", currentUserId);
      } else {
        await supabase.from("portfolio_likes").insert({ portfolio_item_id: item.id, user_id: currentUserId });
      }
    } catch {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, user_liked: item.user_liked, like_count: item.like_count } : i));
    } finally {
      setLikingId(null);
    }
  }

  async function loadComments(itemId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("portfolio_comments")
      .select("*")
      .eq("portfolio_item_id", itemId)
      .order("created_at", { ascending: true });
    const comments = (data ?? []) as Comment[];
    // Fetch display names for comment authors
    const authorIds = [...new Set(comments.map(c => c.user_id))];
    const nameMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", authorIds);
      (profiles ?? []).forEach((p: { id: string; display_name?: string }) => { if (p.display_name) nameMap[p.id] = p.display_name; });
    }
    setCommentsMap(prev => ({
      ...prev,
      [itemId]: comments.map(c => ({ ...c, display_name: nameMap[c.user_id] })),
    }));
  }

  function toggleComments(itemId: string) {
    if (expandedComments === itemId) {
      setExpandedComments(null);
    } else {
      setExpandedComments(itemId);
      setCommentText("");
      if (!commentsMap[itemId]) loadComments(itemId);
    }
  }

  async function postComment(itemId: string) {
    if (!commentText.trim() || !currentUserId || commentPosting) return;
    setCommentPosting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("portfolio_comments")
        .insert({ portfolio_item_id: itemId, user_id: currentUserId, content: commentText.trim() })
        .select("*")
        .single();
      if (data) {
        const row = data as Comment;
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", currentUserId).single();
        const comment: Comment = { ...row, display_name: (profile as { display_name?: string } | null)?.display_name };
        setCommentsMap(prev => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), comment] }));
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, comment_count: i.comment_count + 1 } : i));
        setCommentText("");
      }
    } finally {
      setCommentPosting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 280, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)" }}>
      {/* Header */}
      <div style={{ padding: "2rem 1rem 1rem", background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "2rem", color: "var(--charcoal)", letterSpacing: "-0.01em", marginBottom: "0.25rem" }}>
          Discover
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif" }}>
          Performances &amp; covers from musicians everywhere
        </p>
      </div>

      {missingColumns ? (
        <div style={{ padding: "1.5rem" }}>
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
              One more SQL step needed
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.875rem", lineHeight: 1.6 }}>
              Run this in your <strong>Supabase SQL Editor</strong> to enable public sharing:
            </p>
            <pre style={{ background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.875rem", fontSize: "0.7rem", fontFamily: "monospace", color: "var(--charcoal)", overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{ALTER_SQL}</pre>
          </div>
        </div>
      ) : queryError ? (
        <div style={{ padding: "1.5rem" }}>
          <div style={{ background: "#FDF6F3", border: "1px solid #E8C4BA", borderRadius: 10, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "#B85C3A", marginBottom: "0.375rem" }}>
              Could not load covers
            </div>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#B85C3A", margin: 0, wordBreak: "break-all" }}>
              {queryError}
            </p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", fontSize: "1.75rem" }}>
            🎸
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
            Nothing shared yet
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 280, margin: "0 auto" }}>
            Covers appear here when students share them from Journey. Go to <strong>Journey → Add Cover</strong> and make sure &ldquo;Share to Discover&rdquo; is turned on.
          </p>
        </div>
      ) : (
        <div style={{ paddingBottom: "5rem", display: "flex", flexDirection: "column", gap: "0" }}>
          {items.map(item => {
            const isVideo = item.media_type === "video";
            const isPlaying = playingId === item.id;
            const commentsOpen = expandedComments === item.id;
            const itemComments = commentsMap[item.id] ?? [];
            const initials = (item.display_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

            return (
              <div key={item.id} style={{ background: "var(--white)", borderBottom: "8px solid var(--cream)" }}>

                {/* Full-bleed video */}
                {isVideo && item.recording_url && (
                  <div style={{ position: "relative", background: "#0d0d0d", aspectRatio: "16/9", width: "100%" }}>
                    {isPlaying ? (
                      <video src={item.recording_url} autoPlay controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <div onClick={() => setPlayingId(item.id)} style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
                        {/* Dark gradient for readability */}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }} />
                        {/* Play button */}
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }}><path d="M5 3l14 9-14 9V3z" /></svg>
                          </div>
                        </div>
                        {/* Duration / title hint at bottom */}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.75rem 0.875rem" }}>
                          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                            {item.title}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Audio card header (for non-video) */}
                {!isVideo && (
                  <div style={{ background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", padding: "1.25rem 1rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "#fff", lineHeight: 1.3 }}>{item.title}</div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginTop: "0.2rem" }}>{item.display_name ?? "Musician"}</div>
                    </div>
                  </div>
                )}

                {/* Card body */}
                <div style={{ padding: "0.75rem 0.875rem 0" }}>
                  {/* YouTube-style: avatar left, title+meta right */}
                  {isVideo && !isPlaying && (
                    <div style={{ display: "flex", gap: "0.625rem", marginBottom: "0.5rem" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5625rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif", letterSpacing: "0.03em" }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: "0.1rem" }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", lineHeight: 1.35, marginBottom: "0.2rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                          {item.title}
                        </div>
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                          {item.display_name ?? "Musician"} · {formatRelative(item.created_at)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* When video is playing, show compact author below */}
                  {isVideo && isPlaying && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
                        {initials}
                      </div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                        {item.display_name ?? "Musician"} · {formatRelative(item.created_at)}
                      </div>
                    </div>
                  )}

                  {/* Audio player + meta for non-video */}
                  {!isVideo && (
                    <div style={{ marginBottom: "0.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
                          {initials}
                        </div>
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                          {item.display_name ?? "Musician"} · {formatRelative(item.created_at)}
                        </div>
                      </div>
                      {item.recording_url && <AudioPlayer src={item.recording_url} />}
                    </div>
                  )}

                  {/* Description */}
                  {item.description && (
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.55, margin: "0 0 0.5rem", fontStyle: "italic" }}>
                      &ldquo;{item.description}&rdquo;
                    </p>
                  )}

                  {/* Action bar */}
                  <div style={{ display: "flex", alignItems: "center", paddingTop: "0.25rem", paddingBottom: "0.625rem", gap: "0.125rem" }}>
                    <button
                      onClick={() => toggleLike(item)}
                      style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.75rem 0.4rem 0", border: "none", background: "none", cursor: currentUserId ? "pointer" : "default", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: item.user_liked ? "#e85d4a" : "var(--muted)", fontWeight: 500, transition: "color 0.15s" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={item.user_liked ? "#e85d4a" : "none"} stroke={item.user_liked ? "#e85d4a" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      <span>{item.like_count > 0 ? item.like_count : "Like"}</span>
                    </button>

                    <button
                      onClick={() => toggleComments(item.id)}
                      style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.75rem", border: "none", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: commentsOpen ? "var(--charcoal)" : "var(--muted)", fontWeight: commentsOpen ? 600 : 500, transition: "color 0.15s" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{item.comment_count > 0 ? `${item.comment_count} comment${item.comment_count > 1 ? "s" : ""}` : "Comment"}</span>
                    </button>
                  </div>
                </div>

                {/* Comments section */}
                {commentsOpen && (
                  <div style={{ borderTop: "1px solid var(--border)", background: "var(--cream)", padding: "1rem 0.875rem" }}>
                    {itemComments.length === 0 && (
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.875rem", fontStyle: "italic" }}>
                        No comments yet — be the first!
                      </p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: itemComments.length > 0 ? "0.875rem" : 0 }}>
                      {itemComments.map(c => (
                        <div key={c.id} style={{ display: "flex", gap: "0.625rem" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif", marginTop: 1 }}>
                            {(c.display_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "baseline", marginBottom: "0.15rem" }}>
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
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(item.id); } }}
                          style={{ flex: 1, borderRadius: 20, border: "1px solid var(--border)", padding: "0.5rem 1rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)", color: "var(--charcoal)", outline: "none" }}
                        />
                        <button
                          onClick={() => postComment(item.id)}
                          disabled={!commentText.trim() || commentPosting}
                          style={{ padding: "0.5rem 1rem", borderRadius: 20, border: "none", background: commentText.trim() ? "var(--charcoal)" : "var(--border)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", cursor: commentText.trim() ? "pointer" : "default", transition: "background 0.15s", flexShrink: 0 }}
                        >
                          Post
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
