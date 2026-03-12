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
      <div style={{ padding: "2rem 1.5rem 1.5rem", background: "linear-gradient(180deg, var(--white) 0%, var(--cream) 100%)" }}>
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
        <div style={{ padding: "0 1.25rem 3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {items.map(item => {
            const isVideo = item.media_type === "video";
            const isPlaying = playingId === item.id;
            const commentsOpen = expandedComments === item.id;
            const itemComments = commentsMap[item.id] ?? [];

            return (
              <div key={item.id} style={{ background: "var(--white)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                {/* Video thumbnail */}
                {isVideo && item.recording_url && (
                  <div style={{ position: "relative", background: "#111", aspectRatio: "16/9" }}>
                    {isPlaying ? (
                      <video src={item.recording_url} autoPlay controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <div onClick={() => setPlayingId(item.id)} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "absolute", inset: 0 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.3)" }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1C1916"><path d="M5 3l14 9-14 9V3z" /></svg>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Card body */}
                <div style={{ padding: "0.875rem 1rem 0" }}>
                  {/* Author row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5625rem", fontWeight: 600, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
                      {(item.display_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>{item.display_name ?? "Musician"}</div>
                      <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{formatRelative(item.created_at)}</div>
                    </div>
                    {isVideo && (
                      <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.5rem", borderRadius: 4, background: "rgba(91,79,207,0.08)", color: "#5B4FCF", fontFamily: "Inter, sans-serif" }}>
                        Cover
                      </span>
                    )}
                  </div>

                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>{item.title}</div>

                  {item.description && (
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 0.75rem", fontStyle: "italic" }}>
                      &ldquo;{item.description}&rdquo;
                    </p>
                  )}

                  {!isVideo && item.recording_url && (
                    <div style={{ marginTop: "0.625rem", marginBottom: "0.125rem" }}>
                      <AudioPlayer src={item.recording_url} />
                    </div>
                  )}

                  {/* Like + comment bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", borderTop: "1px solid var(--border)", marginTop: "0.75rem", padding: "0.375rem 0" }}>
                    <button
                      onClick={() => toggleLike(item)}
                      style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.625rem", borderRadius: 7, border: "none", background: "none", cursor: currentUserId ? "pointer" : "default", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: item.user_liked ? "#e85d4a" : "var(--muted)", fontWeight: item.user_liked ? 600 : 400, transition: "all 0.15s" }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={item.user_liked ? "#e85d4a" : "none"} stroke={item.user_liked ? "#e85d4a" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      <span>{item.like_count > 0 ? item.like_count : ""}</span>
                    </button>

                    <button
                      onClick={() => toggleComments(item.id)}
                      style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.625rem", borderRadius: 7, border: "none", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: commentsOpen ? "var(--charcoal)" : "var(--muted)", fontWeight: commentsOpen ? 600 : 400, transition: "all 0.15s" }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{item.comment_count > 0 ? item.comment_count : ""} {item.comment_count === 1 ? "comment" : item.comment_count > 1 ? "comments" : "comment"}</span>
                    </button>
                  </div>
                </div>

                {/* Comments section */}
                {commentsOpen && (
                  <div style={{ borderTop: "1px solid var(--border)", background: "var(--cream)", padding: "0.875rem 1rem" }}>
                    {itemComments.length === 0 && (
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", margin: "0 0 0.75rem", fontStyle: "italic" }}>
                        No comments yet — be the first!
                      </p>
                    )}

                    {itemComments.map(c => (
                      <div key={c.id} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 600, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                          {(c.display_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "baseline" }}>
                            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--charcoal)" }}>{c.display_name ?? "Musician"}</span>
                            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)" }}>{formatRelative(c.created_at)}</span>
                          </div>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.1rem 0 0", lineHeight: 1.5 }}>{c.content}</p>
                        </div>
                      </div>
                    ))}

                    {currentUserId && (
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                        <input
                          type="text"
                          placeholder="Add a comment…"
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(item.id); } }}
                          style={{ flex: 1, borderRadius: 7, border: "1px solid var(--border)", padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--white)", color: "var(--charcoal)", outline: "none" }}
                        />
                        <button
                          onClick={() => postComment(item.id)}
                          disabled={!commentText.trim() || commentPosting}
                          style={{ padding: "0.5rem 0.875rem", borderRadius: 7, border: "none", background: commentText.trim() ? "var(--charcoal)" : "var(--border)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", cursor: commentText.trim() ? "pointer" : "default", transition: "background 0.15s", flexShrink: 0 }}
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
