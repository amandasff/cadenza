"use client";
import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePractice } from "../lib/context/PracticeContext";
import { Pause, Play, ChevronDown } from "lucide-react";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function PracticePip() {
  const { isActive, recording, elapsed, pausePractice, resumePractice } = usePractice();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Don't show on the practice page itself, or if no session active
  if (!isActive || pathname === "/student/practice") return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 80,
      left: 16,
      width: collapsed ? 56 : 220,
      borderRadius: 14,
      background: "var(--charcoal)",
      color: "var(--cream)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      zIndex: 200,
      border: "1px solid var(--border)",
      overflow: "hidden",
      transition: "width 0.2s ease",
      fontFamily: "Inter, sans-serif",
    }}>
      {collapsed ? (
        /* ── Collapsed: just a pulsing dot + tap target ── */
        <div
          onClick={() => setCollapsed(false)}
          style={{
            width: 56, height: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", position: "relative",
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            background: recording ? "#E05252" : "#E6A817",
            boxShadow: recording ? "0 0 10px #E05252" : "0 0 8px #E6A817",
            animation: recording ? "pip-pulse 1.5s ease-in-out infinite" : undefined,
          }} />
          <div style={{
            position: "absolute", bottom: 4, left: 0, right: 0,
            textAlign: "center", fontSize: "0.5625rem", color: "var(--cream)",
            opacity: 0.6,
          }}>
            {fmt(elapsed)}
          </div>
        </div>
      ) : (
        /* ── Expanded ── */
        <>
          {/* Header — tap to go to practice page */}
          <div
            onClick={() => router.push("/student/practice")}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.625rem 0.75rem",
              cursor: "pointer",
            }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: recording ? "#E05252" : "#E6A817",
              boxShadow: recording ? "0 0 8px #E05252" : "0 0 6px #E6A817",
              animation: recording ? "pip-pulse 1.5s ease-in-out infinite" : undefined,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, flex: 1 }}>
              Practicing
            </span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
              {fmt(elapsed)}
            </span>
          </div>

          {/* Controls */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 0.75rem 0.625rem",
            gap: "0.5rem",
          }}>
            {/* Pause / Resume */}
            <button
              onClick={recording ? pausePractice : resumePractice}
              style={{
                flex: 1, padding: "0.375rem 0",
                borderRadius: 8, border: "1px solid var(--border)",
                background: "transparent", color: "var(--cream)",
                cursor: "pointer", fontSize: "0.75rem", fontWeight: 500,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {recording ? <><Pause size={12} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Pause</> : <><Play size={12} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Resume</>}
            </button>

            {/* Back to practice */}
            <button
              onClick={() => router.push("/student/practice")}
              style={{
                flex: 1, padding: "0.375rem 0",
                borderRadius: 8, border: "none",
                background: "#4CAF84", color: "#fff",
                cursor: "pointer", fontSize: "0.75rem", fontWeight: 500,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Open
            </button>

            {/* Collapse */}
            <button
              onClick={() => setCollapsed(true)}
              style={{
                width: 28, height: 28,
                borderRadius: 6, border: "1px solid var(--border)",
                background: "transparent", color: "var(--cream)",
                cursor: "pointer", fontSize: "0.625rem",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronDown size={14} strokeWidth={1.5} />
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes pip-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
