"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { Inspiration, YouTubeResult } from "../../../lib/types";
import YouTubeSearch from "../../../components/YouTubeSearch";

export default function TeacherInspirationPage() {
  const { user } = useAuth();
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("inspirations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setInspirations((data ?? []) as Inspiration[]);
    setLoading(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleSave(video: YouTubeResult) {
    if (!user?.id) return;
    setSaving(video.id);
    const { data, error } = await supabase
      .from("inspirations")
      .upsert({
        user_id: user.id,
        youtube_id: video.id,
        title: video.title,
        thumbnail_url: video.thumbnail || null,
      }, { onConflict: "user_id,youtube_id" })
      .select()
      .single();
    if (!error && data) {
      setInspirations(prev => {
        if (prev.some(i => i.youtube_id === video.id)) return prev;
        return [data as Inspiration, ...prev];
      });
      setPlayingId(video.id);
    }
    setSaving(null);
  }

  async function handleRemove(inspiration: Inspiration) {
    await supabase.from("inspirations").delete().eq("id", inspiration.id);
    setInspirations(prev => prev.filter(i => i.id !== inspiration.id));
    if (playingId === inspiration.youtube_id) setPlayingId(null);
  }

  const playing = inspirations.find(i => i.youtube_id === playingId);

  return (
    <div className="teacher-main" style={{ padding: "2rem 1.5rem 3rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
          fontSize: "1.5rem", color: "var(--charcoal)", margin: "0 0 0.375rem",
        }}>
          Inspirations
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
          Your personal music mood board — save pieces you love or want to assign
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 640, marginBottom: "1.5rem" }}>
        <YouTubeSearch
          placeholder="Search YouTube for music to inspire you…"
          onSelect={handleSave}
        />
        {saving && (
          <div style={{ marginTop: "0.375rem", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
            Saving…
          </div>
        )}
      </div>

      {/* Now playing */}
      {playing && (
        <div style={{ maxWidth: 640, marginBottom: "1.5rem", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", background: "var(--charcoal)" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.375rem 0.75rem", background: "var(--cream)", borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "0.5rem" }}>
              {playing.title}
            </span>
            <button onClick={() => setPlayingId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", lineHeight: 1, padding: 0 }}>✕</button>
          </div>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            <iframe
              src={`https://www.youtube.com/embed/${playing.youtube_id}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
              title={playing.title}
            />
          </div>
        </div>
      )}

      {/* Saved grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ aspectRatio: "16/9", borderRadius: 4 }} />)}
        </div>
      ) : inspirations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 0" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
            Nothing saved yet
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Search above to find music and build your mood board.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {inspirations.map(ins => (
            <div
              key={ins.id}
              style={{
                border: playingId === ins.youtube_id ? "2px solid var(--charcoal)" : "1px solid var(--border)",
                borderRadius: 4, overflow: "hidden", background: "var(--white)",
                cursor: "pointer", transition: "border-color 0.15s",
              }}
            >
              <div onClick={() => setPlayingId(playingId === ins.youtube_id ? null : ins.youtube_id)}>
                {ins.thumbnail_url ? (
                  <img src={ins.thumbnail_url} alt={ins.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                    ▶
                  </div>
                )}
              </div>
              <div style={{ padding: "0.625rem 0.75rem 0.5rem" }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)",
                  lineHeight: 1.4, overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}>
                  {ins.title}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => setPlayingId(playingId === ins.youtube_id ? null : ins.youtube_id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500,
                      color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase",
                    }}
                  >
                    {playingId === ins.youtube_id ? "▶ Playing" : "▶ Play"}
                  </button>
                  <button
                    onClick={() => handleRemove(ins)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--muted)", fontSize: "0.75rem", padding: "0 0.125rem",
                    }}
                    title="Remove from inspirations"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
