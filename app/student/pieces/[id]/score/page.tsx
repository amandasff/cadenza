"use client";
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";

declare global {
  interface Window { alphaTab?: any; }
}

const ALPHATAB_CDN = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.3.0/dist/alphaTab.min.js";
const SOUNDFONT_CDN = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.3.0/dist/soundfont/sonivox.sf2";

type PlayerState = "stopped" | "playing" | "paused";

export default function ScorePage() {
  const { id } = useParams<{ id: string }>();

  const [piece, setPiece] = useState<{ title: string; score_url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>("stopped");
  const [speed, setSpeed] = useState(1.0);
  const [atReady, setAtReady] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef     = useRef<any>(null);

  // ── 1. Load piece ─────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("pieces")
      .select("title, score_url")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError("Piece not found."); return; }
        if (!(data as any).score_url) { setError("No score file has been uploaded for this piece yet."); return; }
        setPiece(data as { title: string; score_url: string });
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── 2. Load alphaTab script from CDN ─────────────────────────────────────
  useEffect(() => {
    if (window.alphaTab) { setScriptReady(true); return; }
    const script = document.createElement("script");
    script.src = ALPHATAB_CDN;
    script.onload  = () => setScriptReady(true);
    script.onerror = () => setError("Failed to load music player. Check your internet connection.");
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

  // ── 3. Init alphaTab once script + piece + DOM are ready ──────────────────
  useEffect(() => {
    if (!scriptReady || !piece || !wrapperRef.current) return;
    if (!window.alphaTab) return;

    // Destroy any previous instance
    apiRef.current?.destroy();
    apiRef.current = null;
    setAtReady(false);
    setPlayerState("stopped");

    const api = new window.alphaTab.AlphaTabApi(wrapperRef.current, {
      file: piece.score_url,
      display: { scale: 0.9, layoutMode: 0 /* page */ },
      player: {
        enablePlayer: true,
        soundFont: SOUNDFONT_CDN,
      },
    });

    api.renderFinished.on(() => setAtReady(true));

    api.playerStateChanged.on((args: any) => {
      // 0=stopped, 1=playing, 2=paused
      setPlayerState(args.state === 1 ? "playing" : args.state === 2 ? "paused" : "stopped");
    });

    apiRef.current = api;
    return () => { apiRef.current?.destroy(); apiRef.current = null; };
  }, [scriptReady, piece]);

  function togglePlay() {
    if (!apiRef.current) return;
    if (playerState === "playing") apiRef.current.pause();
    else apiRef.current.play();
  }

  function handleStop() {
    if (!apiRef.current) return;
    apiRef.current.stop();
  }

  function setPlaybackSpeed(s: number) {
    setSpeed(s);
    if (apiRef.current) apiRef.current.playbackSpeed = s;
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#FDFCFA", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{
        background: "#FDFCFA", borderBottom: "1px solid var(--border)",
        padding: "0.875rem 1.25rem",
        display: "flex", alignItems: "center", gap: "1rem",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Link href="/student/pieces" style={{ color: "var(--muted)", textDecoration: "none", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem" }}>
          ← Pieces
        </Link>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.125rem", fontWeight: 600, color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {piece?.title ?? "Score"}
        </div>
      </div>

      {/* Playback controls */}
      {atReady && (
        <div style={{
          background: "var(--white)", borderBottom: "1px solid var(--border)",
          padding: "0.75rem 1.25rem",
          display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
          position: "sticky", top: 49, zIndex: 9,
        }}>
          {/* Play/pause */}
          <button
            onClick={togglePlay}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
              background: playerState === "playing" ? "#E6A817" : "#3D6B55",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem", flexShrink: 0,
            }}
          >
            {playerState === "playing" ? "⏸" : "▶"}
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)",
              cursor: "pointer", background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
            }}
          >
            ⏹
          </button>

          {/* Speed */}
          <div style={{ display: "flex", gap: "0.375rem", marginLeft: "auto" }}>
            {[0.5, 0.75, 1.0].map(s => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                style={{
                  padding: "0.25rem 0.5rem", borderRadius: 3, cursor: "pointer",
                  border: `1px solid ${speed === s ? "var(--charcoal)" : "var(--border)"}`,
                  background: speed === s ? "var(--charcoal)" : "transparent",
                  color: speed === s ? "var(--white)" : "var(--muted)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 500,
                }}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "4rem", fontFamily: "Inter, sans-serif", color: "var(--muted)" }}>
            Loading piece…
          </div>
        )}

        {!loading && error && (
          <div style={{
            maxWidth: 400, margin: "4rem auto", padding: "1.5rem",
            background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8,
            textAlign: "center", fontFamily: "Inter, sans-serif",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎵</div>
            <div style={{ fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.5rem" }}>
              {error}
            </div>
            <Link href="/student/pieces" style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              ← Back to pieces
            </Link>
          </div>
        )}

        {!loading && !error && !scriptReady && (
          <div style={{ textAlign: "center", padding: "4rem", fontFamily: "Inter, sans-serif", color: "var(--muted)" }}>
            Loading music player…
          </div>
        )}

        {/* alphaTab mounts here */}
        {!loading && !error && (
          <div ref={wrapperRef} style={{ minHeight: 300 }} />
        )}

        {!atReady && scriptReady && piece && (
          <div style={{ textAlign: "center", padding: "2rem", fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.8125rem" }}>
            Rendering score…
          </div>
        )}
      </div>
    </div>
  );
}
