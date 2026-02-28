"use client";
import React from "react";
import type { PieceRecording } from "../lib/types";

export default function YouTubePlayer({
  recordings,
  activeIndex,
  onChangeIndex,
  onClose,
}: {
  recordings: PieceRecording[];
  activeIndex: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
}) {
  const video = recordings[activeIndex];
  if (!video) return null;

  return (
    <div style={{
      marginTop: "0.75rem",
      border: "1px solid var(--border)",
      borderRadius: 4,
      overflow: "hidden",
      background: "var(--charcoal)",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.375rem 0.75rem",
        background: "var(--cream)", borderBottom: "1px solid var(--border)",
      }}>
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
          color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flex: 1, marginRight: "0.5rem",
        }}>
          {video.title}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: "1rem", lineHeight: 1, padding: "0 0.25rem", flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Iframe */}
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
        <iframe
          src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
          title={video.title}
        />
      </div>

      {/* Multi-recording switcher */}
      {recordings.length > 1 && (
        <div style={{
          display: "flex", gap: "0.375rem", padding: "0.5rem 0.75rem",
          background: "var(--cream)", borderTop: "1px solid var(--border)",
          overflowX: "auto",
        }}>
          {recordings.map((r, i) => (
            <button
              key={r.id}
              onClick={() => onChangeIndex(i)}
              style={{
                flexShrink: 0, border: "none", borderRadius: 2, cursor: "pointer",
                padding: "0.25rem 0.5rem",
                background: i === activeIndex ? "var(--charcoal)" : "var(--border)",
                color: i === activeIndex ? "var(--white)" : "var(--muted)",
                fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500,
              }}
            >
              {i + 1}
              {r.is_primary && " ★"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
