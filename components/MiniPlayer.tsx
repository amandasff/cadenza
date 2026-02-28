"use client";
import React, { useState } from "react";
import { usePlayer } from "../lib/context/PlayerContext";

export default function MiniPlayer() {
  const { current, queue, queueIndex, next, prev, stop, playIndex } = usePlayer();
  const [expanded, setExpanded] = useState(false);

  if (!current) return null;

  const hasPrev = queueIndex > 0;
  const hasNext = queueIndex < queue.length - 1;

  const btnStyle: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    color: "var(--white)", padding: "0 0.375rem", fontSize: "0.875rem",
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
        background: "var(--charcoal)",
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
              color: "var(--white)", overflow: "hidden",
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
                  color: "var(--white)", maxWidth: 120,
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
