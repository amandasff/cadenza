"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { Inspiration, YouTubeResult } from "../../../lib/types";
import YouTubeSearch from "../../../components/YouTubeSearch";
import { usePlayer } from "../../../lib/context/PlayerContext";

export default function InspirationPage() {
  const { user } = useAuth();
  const player = usePlayer();
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
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
      player.play({ id: video.id, title: video.title, thumbnail: video.thumbnail || undefined });
    }
    setSaving(null);
  }

  async function handleRemove(inspiration: Inspiration) {
    await supabase.from("inspirations").delete().eq("id", inspiration.id);
    setInspirations(prev => prev.filter(i => i.id !== inspiration.id));
    if (player.current?.id === inspiration.youtube_id) player.stop();
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%", padding: "1.5rem 1.5rem 5rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)",
            fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            Inspirations
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", margin: 0 }}>
          Collect music you love and want to work towards
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "1.5rem" }}>
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

      {/* Saved grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ aspectRatio: "16/9", borderRadius: 4 }} />)}
        </div>
      ) : inspirations.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">Nothing saved yet</div>
          <p className="empty-state-desc">Search above to find music and save it here as inspiration.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
          {inspirations.map(ins => {
            const isPlaying = player.current?.id === ins.youtube_id;
            return (
            <div
              key={ins.id}
              style={{
                border: isPlaying ? "2px solid var(--charcoal)" : "1px solid var(--border)",
                borderRadius: 4, overflow: "hidden", background: "var(--white)",
                cursor: "pointer", transition: "border-color 0.15s",
              }}
            >
              <div onClick={() => isPlaying ? player.stop() : player.play({ id: ins.youtube_id, title: ins.title, thumbnail: ins.thumbnail_url ?? undefined })} style={{ display: "block" }}>
                {ins.thumbnail_url ? (
                  <img src={ins.thumbnail_url} alt={ins.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                    ▶
                  </div>
                )}
              </div>
              <div style={{ padding: "0.5rem 0.625rem 0.375rem" }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)",
                  lineHeight: 1.4, overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}>
                  {ins.title}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.375rem" }}>
                  <button
                    onClick={() => isPlaying ? player.stop() : player.play({ id: ins.youtube_id, title: ins.title, thumbnail: ins.thumbnail_url ?? undefined })}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 500,
                      color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase",
                    }}
                  >
                    {isPlaying ? "▶ Playing" : "▶ Play"}
                  </button>
                  <button
                    onClick={() => handleRemove(ins)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--muted)", fontSize: "0.75rem", padding: "0 0.125rem",
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
