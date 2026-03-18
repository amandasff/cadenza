"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePractice } from "../lib/context/PracticeContext";
import { Pause, Play, ChevronDown } from "lucide-react";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ── Mini metronome hook ───────────────────────────────────────────────────────
function useMiniMetronome() {
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const adjustBpm = useCallback((delta: number) => {
    setBpm(b => Math.max(30, Math.min(240, b + delta)));
  }, []);

  useEffect(() => {
    if (!playing) { setBeat(-1); return; }
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    let beatCount = 0;
    const tick = () => {
      const isAccent = beatCount % 4 === 0;
      setBeat(beatCount % 4);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = isAccent ? 1100 : 800;
      gain.gain.setValueAtTime(isAccent ? 0.6 : 0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
      beatCount++;
    };
    tick();
    const id = setInterval(tick, Math.round((60 / bpm) * 1000));
    return () => clearInterval(id);
  }, [playing, bpm]);

  useEffect(() => () => { audioCtxRef.current?.close().catch(() => {}); }, []);

  return { bpm, adjustBpm, playing, setPlaying, beat };
}

export default function PracticePip() {
  const { isActive, recording, elapsed, pausePractice, resumePractice } = usePractice();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [showMetronome, setShowMetronome] = useState(false);
  const metro = useMiniMetronome();

  // Don't show on the practice page itself, or if no session active
  if (!isActive || pathname === "/student/practice") return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 80,
      left: 16,
      width: collapsed ? 56 : showMetronome ? 260 : 220,
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

            {/* Metronome toggle */}
            <button
              onClick={() => setShowMetronome(m => !m)}
              title="Metronome"
              style={{
                width: 28, height: 28,
                borderRadius: 6,
                border: `1px solid ${showMetronome ? "#4CAF84" : "var(--border)"}`,
                background: showMetronome ? "rgba(76,175,132,0.18)" : "transparent",
                color: showMetronome ? "#4CAF84" : "var(--cream)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.875rem",
              }}
            >
              ♩
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

          {/* ── Mini metronome panel ── */}
          {showMetronome && (
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.1)",
              padding: "0.625rem 0.75rem 0.75rem",
            }}>
              {/* BPM row */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
                <button
                  onClick={() => metro.adjustBpm(-5)}
                  style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "var(--cream)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300 }}
                >−</button>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 300, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                    {metro.bpm}
                  </div>
                  <div style={{ fontSize: "0.4375rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1 }}>
                    BPM
                  </div>
                </div>
                <button
                  onClick={() => metro.adjustBpm(5)}
                  style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "var(--cream)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300 }}
                >+</button>

                {/* Play/stop */}
                <button
                  onClick={() => metro.setPlaying(p => !p)}
                  style={{
                    width: 32, height: 32, borderRadius: "50%", border: "none",
                    background: metro.playing ? "#E05252" : "#4CAF84",
                    color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {metro.playing
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    : <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                  }
                </button>
              </div>

              {/* Beat dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: metro.beat === i
                      ? (i === 0 ? "#4CAF84" : "rgba(255,255,255,0.9)")
                      : "rgba(255,255,255,0.2)",
                    transition: "background 0.05s, transform 0.05s",
                    transform: metro.beat === i ? "scale(1.4)" : "scale(1)",
                  }} />
                ))}
              </div>
            </div>
          )}
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
