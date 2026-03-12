"use client";
import React, { useState, useRef, useEffect } from "react";
import { usePlayer } from "../lib/context/PlayerContext";

export default function MiniPlayer() {
  const { current, queue, queueIndex, next, prev, stop, playIndex, discoverTrack, stopDiscover, suppressMiniPlayer } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(true);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  // Auto-play when a new discover track is set
  useEffect(() => {
    if (discoverTrack) {
      setPlaying(true);
      setExpanded(false);
    }
  }, [discoverTrack?.id]);

  if (!current && !discoverTrack) return null;
  if (suppressMiniPlayer) return null;

  // ── Discover track mini player ──
  if (discoverTrack && !current) {
    const isVideo = discoverTrack.mediaType === "video";
    return (
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 56px)",
        left: 0, right: 0,
        background: "#1C1916",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        zIndex: 200,
      }}>
        {/* Hidden media element */}
        {isVideo ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={discoverTrack.recordingUrl}
            autoPlay
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        ) : (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={discoverTrack.recordingUrl}
            autoPlay
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", padding: "0.5rem 0.875rem", gap: "0.75rem" }}>
          {/* Icon */}
          <div style={{ width: 32, height: 32, borderRadius: 4, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isVideo ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            )}
          </div>

          {/* Title + author */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "#F0EDE7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {discoverTrack.title}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "rgba(255,255,255,0.45)", marginTop: "0.1rem" }}>
              {discoverTrack.displayName ?? "Musician"}
            </div>
          </div>

          {/* Play/pause + stop */}
          <button
            onClick={() => {
              const el = mediaRef.current;
              if (!el) return;
              if (playing) { el.pause(); setPlaying(false); }
              else { void el.play(); setPlaying(true); }
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#F0EDE7", padding: "0 0.25rem", fontSize: "1rem", lineHeight: 1 }}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button
            onClick={stopDiscover}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: "0 0.25rem", fontSize: "0.875rem", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const hasPrev = queueIndex > 0;
  const hasNext = queueIndex < queue.length - 1;

  const btnStyle: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    color: "#F0EDE7", padding: "0 0.375rem", fontSize: "0.875rem",
    opacity: 0.85, lineHeight: 1,
  };
  const dimBtnStyle: React.CSSProperties = { ...btnStyle, opacity: 0.4, cursor: "default" };

  return (
    <>
      {/* Persistent hidden iframe — stays mounted across navigation */}
      <iframe
        key={current.id}
        src={`https://www.youtube.com/embed/${current.id}?autoplay=1&enablejsapi=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        style={{ position: "fixed", top: -9999, left: -9999, width: 1, height: 1, border: 0, opacity: 0, pointerEvents: "none" }}
        title={current.title}
      />

      {/* Mini player bar */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 56px)", // above mobile bottom nav
        left: 0, right: 0,
        background: "#1C1916",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Expanded: full player */}
        {expanded && (
          <div style={{ position: "relative", paddingBottom: "56.25%", width: "100%" }}>
            <iframe
              key={`exp-${current.id}`}
              src={`https://www.youtube.com/embed/${current.id}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
              title={current.title}
            />
          </div>
        )}

        {/* Mini bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "0.5rem 0.875rem", gap: "0.625rem" }}>
          {/* Thumbnail */}
          {current.thumbnail && (
            <img
              src={current.thumbnail}
              alt=""
              onClick={() => setExpanded(v => !v)}
              style={{ width: 36, height: 27, objectFit: "cover", borderRadius: 2, flexShrink: 0, cursor: "pointer" }}
            />
          )}

          {/* Title */}
          <div
            onClick={() => setExpanded(v => !v)}
            style={{
              flex: 1, minWidth: 0, cursor: "pointer",
              fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
              color: "#F0EDE7", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {current.title}
            {queue.length > 1 && (
              <span style={{ opacity: 0.5, marginLeft: "0.375rem" }}>
                {queueIndex + 1}/{queue.length}
              </span>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
            <button onClick={hasPrev ? prev : undefined} style={hasPrev ? btnStyle : dimBtnStyle} title="Previous">⏮</button>
            <button onClick={() => setExpanded(v => !v)} style={btnStyle} title={expanded ? "Minimise" : "Expand"}>
              {expanded ? "▾" : "▴"}
            </button>
            <button onClick={hasNext ? next : undefined} style={hasNext ? btnStyle : dimBtnStyle} title="Next">⏭</button>
            <button onClick={stop} style={{ ...btnStyle, marginLeft: "0.25rem", opacity: 0.6 }} title="Stop">✕</button>
          </div>
        </div>

        {/* Queue strip (when expanded) */}
        {expanded && queue.length > 1 && (
          <div style={{
            display: "flex", gap: "0.375rem", padding: "0 0.875rem 0.625rem",
            overflowX: "auto",
          }}>
            {queue.map((t, i) => (
              <button
                key={t.id}
                onClick={() => playIndex(i)}
                style={{
                  flexShrink: 0, background: i === queueIndex ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)",
                  border: "none", borderRadius: 2, cursor: "pointer",
                  padding: "0.25rem 0.5rem",
                  fontFamily: "Inter, sans-serif", fontSize: "0.5625rem",
                  color: "#F0EDE7", maxWidth: 120,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {i === queueIndex ? "▶ " : ""}{t.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
