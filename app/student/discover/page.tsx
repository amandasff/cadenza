"use client";
import React, { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PortfolioService, type PortfolioItemRow } from "../../../lib/services/PortfolioService";
import AudioPlayer from "../../../components/AudioPlayer";

type PublicItem = PortfolioItemRow & { display_name?: string };

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
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const data = await PortfolioService.getInstance(supabase).getPublicItems();
        setItems(data);
      } catch (err) {
        const e = err as { message?: string; code?: string };
        // 42703 = undefined_column, 42P01 = undefined_table
        if (e?.code === "42703" || e?.code === "42P01" || e?.message?.includes("is_public") || e?.message?.includes("media_type")) {
          setMissingColumns(true);
        }
        console.error("discover load error:", e?.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />
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
      ) : items.length === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", fontSize: "1.75rem" }}>
            🎸
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
            Nothing shared yet
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 260, margin: "0 auto" }}>
            When musicians share recordings or covers from their Journey, they&apos;ll appear here for everyone to enjoy.
          </p>
        </div>
      ) : (
        <div style={{ padding: "0 1.25rem 3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {items.map(item => {
            const isVideo = item.media_type === "video";
            const isPlaying = playingId === item.id;

            return (
              <div key={item.id} style={{ background: "var(--white)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                {/* Video */}
                {isVideo && item.recording_url && (
                  <div style={{ position: "relative", background: "#111", aspectRatio: "16/9", maxHeight: 240 }}>
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
                <div style={{ padding: "0.875rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5625rem", fontWeight: 600, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
                      {(item.display_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>{item.display_name ?? "Musician"}</div>
                      <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{formatRelative(item.created_at)}</div>
                    </div>
                    {isVideo && (
                      <span style={{ marginLeft: "auto", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.5rem", borderRadius: 4, background: "rgba(91,79,207,0.08)", color: "#5B4FCF", fontFamily: "Inter, sans-serif" }}>
                        Cover
                      </span>
                    )}
                  </div>

                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>{item.title}</div>

                  {item.description && (
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 0.75rem", fontStyle: "italic" }}>
                      &ldquo;{item.description}&rdquo;
                    </p>
                  )}

                  {!isVideo && item.recording_url && (
                    <div style={{ marginTop: "0.625rem" }}>
                      <AudioPlayer src={item.recording_url} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
