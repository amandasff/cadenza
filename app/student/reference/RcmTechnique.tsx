"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { GRADES, type GradeData, type TechItem } from "./rcm-data";
import { Square, Play } from "lucide-react";
import ScaleNotation from "./ScaleNotation";

// ── Metronome ─────────────────────────────────────────────────────────────────

function useMetronome() {
  const [running, setRunning] = useState(false);
  const [bpm, setBpm] = useState(80);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playClick = useCallback((accent: boolean) => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1100 : 800;
    gain.gain.setValueAtTime(accent ? 0.7 : 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback((targetBpm: number) => {
    stop();
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    setBpm(targetBpm);
    let beat = 0;
    playClick(true);
    intervalRef.current = setInterval(() => {
      beat = (beat + 1) % 4;
      playClick(beat === 0);
    }, Math.round((60 / targetBpm) * 1000));
    setRunning(true);
  }, [stop, playClick]);

  const toggle = useCallback((targetBpm: number) => {
    if (running) { stop(); } else { start(targetBpm); }
  }, [running, stop, start]);

  // cleanup
  useEffect(() => () => { stop(); ctxRef.current?.close(); }, [stop]);

  return { running, bpm, start, stop, toggle };
}

// ── Metronome widget ──────────────────────────────────────────────────────────

function MetronomeWidget({ defaultBpm }: { defaultBpm: number }) {
  const metro = useMetronome();
  const [localBpm, setLocalBpm] = useState(defaultBpm);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      <button
        onClick={() => metro.toggle(localBpm)}
        style={{
          padding: "0.3rem 0.75rem", borderRadius: 4,
          border: "none", cursor: "pointer",
          background: metro.running ? "#C0392B" : "var(--charcoal)",
          color: "#fff", fontFamily: "Inter,sans-serif",
          fontSize: "0.75rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: "0.375rem",
        }}
      >
        {metro.running ? <><Square size={12} strokeWidth={1.5} /> Stop</> : <><Play size={12} strokeWidth={1.5} fill="currentColor" /> Click</>}
      </button>
      <button onClick={() => { const v = Math.max(40, localBpm - 4); setLocalBpm(v); if (metro.running) metro.start(v); }}
        style={nudgeBtn}>−</button>
      <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", fontWeight: 600, color: "var(--charcoal)", minWidth: 52, textAlign: "center" }}>
        {localBpm} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "0.6875rem" }}>BPM</span>
      </span>
      <button onClick={() => { const v = Math.min(240, localBpm + 4); setLocalBpm(v); if (metro.running) metro.start(v); }}
        style={nudgeBtn}>+</button>
    </div>
  );
}

const nudgeBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 4,
  border: "1px solid var(--border-strong)", background: "transparent",
  color: "var(--charcoal)", fontFamily: "Inter,sans-serif",
  fontSize: "1rem", cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center",
};

// ── Tech item card ────────────────────────────────────────────────────────────

function TechCard({ item, color, sectionTitle }: { item: TechItem; color: string; sectionTitle: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: "var(--white)", border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "0.75rem 1rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.75rem",
          userSelect: "none", overflow: "hidden",
          borderRadius: open ? "8px 8px 0 0" : "8px",
        }}
      >
        <div style={{ width: 4, borderRadius: 2, alignSelf: "stretch", background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Inter,sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "var(--charcoal)" }}>
            {item.label}
          </div>
          <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
            <Tag color={color}>{item.hands === "HT" ? "Hands together" : item.hands === "HS" ? "Hands separate" : item.hands}</Tag>
            <Tag color="#555">{item.octaves} oct.</Tag>
            <Tag color="#555">{item.beatUnit} = {item.bpm}</Tag>
          </div>
          {item.note && (
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem", fontStyle: "italic" }}>{item.note}</div>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ padding: "0.75rem 1rem 1rem", borderTop: "1px solid var(--border)", background: "var(--cream)", borderRadius: "0 0 8px 8px" }}>
          <p style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
            Minimum tempo: <strong style={{ color: "var(--charcoal)" }}>{item.beatUnit} = {item.bpm}</strong>
          </p>
          <MetronomeWidget defaultBpm={item.bpm} />
          <ScaleNotation sectionTitle={sectionTitle} item={item} />
        </div>
      )}
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: "0.6875rem", fontFamily: "Inter,sans-serif",
      padding: "0.125rem 0.5rem", borderRadius: 99,
      background: `${color}18`, color, fontWeight: 500,
    }}>
      {children}
    </span>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

function TechSection({ section }: { section: GradeData["sections"][0] }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: "0.875rem" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "0.875rem 1.125rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
          background: "var(--white)", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: section.color, flexShrink: 0 }} />
        <span style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", flex: 1 }}>
          {section.title}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 0.75rem 0.75rem", background: "var(--cream)", display: "flex", flexDirection: "column", gap: "0.5rem", borderRadius: "0 0 10px 10px" }}>
          {section.items.map((item, i) => (
            <TechCard key={i} item={item} color={section.color} sectionTitle={section.title} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RcmTechnique() {
  const [selectedGrade, setSelectedGrade] = useState<string>("1");
  const grade = GRADES.find(g => g.grade === selectedGrade) ?? GRADES[2];
  const [tipsOpen, setTipsOpen] = useState(true);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
          RCM 2022 Piano Syllabus — minimum tempos. Tap any item to open its metronome.
          Always verify exact requirements with your official{" "}
          <strong>RCM Technical Requirements</strong> book.
        </p>
      </div>

      {/* Grade selector */}
      <div style={{ overflowX: "auto", paddingBottom: "0.25rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.375rem", width: "max-content" }}>
          {GRADES.map(g => (
            <button
              key={g.grade}
              onClick={() => setSelectedGrade(g.grade)}
              style={{
                padding: "0.4rem 0.875rem", borderRadius: 99,
                border: "1px solid var(--border-strong)",
                background: selectedGrade === g.grade ? "var(--charcoal)" : "transparent",
                color: selectedGrade === g.grade ? "var(--white)" : "var(--charcoal)",
                fontFamily: "Inter,sans-serif", fontSize: "0.8125rem",
                fontWeight: selectedGrade === g.grade ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grade overview */}
      <div style={{
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem",
      }}>
        <div style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
          {grade.label}
        </div>
        <p style={{ fontFamily: "Inter,sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
          {grade.overview}
        </p>
        {grade.milestone && (
          <div style={{
            marginTop: "0.625rem", padding: "0.5rem 0.75rem",
            background: "#B85C3A18", borderRadius: 6,
            fontFamily: "Inter,sans-serif", fontSize: "0.8125rem",
            color: "#B85C3A", fontWeight: 500,
          }}>
            ★ {grade.milestone}
          </div>
        )}
      </div>

      {/* Technique tips */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: "1.25rem" }}>
        <button
          onClick={() => setTipsOpen(o => !o)}
          style={{
            width: "100%", padding: "0.875rem 1.125rem",
            display: "flex", alignItems: "center", gap: "0.625rem",
            background: "#1E844918", border: "none", cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{ fontSize: "1rem" }}>💡</span>
          <span style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "#1E8449", flex: 1 }}>
            Technique Tips for {grade.label}
          </span>
          <span style={{ color: "#1E8449", fontSize: "0.75rem" }}>{tipsOpen ? "▲" : "▼"}</span>
        </button>
        {tipsOpen && (
          <div style={{ padding: "0.875rem 1.25rem", background: "#1E844908" }}>
            <ul style={{ margin: 0, padding: "0 0 0 1.25rem" }}>
              {grade.tips.map((tip, i) => (
                <li key={i} style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.7, marginBottom: "0.25rem" }}>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Quick tempo reference */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
          Tempos at a glance
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {Array.from(new Set(grade.sections.flatMap(s => s.items.map(i => i.bpm)))).sort((a, b) => a - b).map(bpm => (
            <div key={bpm} style={{
              padding: "0.3rem 0.75rem", borderRadius: 99,
              background: "var(--white)", border: "1px solid var(--border)",
              fontFamily: "Inter,sans-serif", fontSize: "0.75rem",
              color: "var(--charcoal)", fontWeight: 500,
            }}>
              {bpm} BPM
            </div>
          ))}
        </div>
      </div>

      {/* Technical sections */}
      <div>
        {grade.sections.map((section, i) => (
          <TechSection key={i} section={section} />
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        marginTop: "1.5rem", padding: "0.875rem 1rem",
        background: "var(--cream)", borderRadius: 8,
        border: "1px solid var(--border)",
        fontFamily: "Inter,sans-serif", fontSize: "0.75rem",
        color: "var(--muted)", lineHeight: 1.6,
      }}>
        <strong>Source:</strong> RCM 2022 Piano Syllabus and RCM Technical Requirements books.
        Grades 1–5 tempos are sourced from official RCM publications and verified teacher resources (pianotv.net, colorinmypiano.com).
        Grades 6–10 reflect the 2022 syllabus framework — verify specific key groups and tempos with your official RCM Technical Requirements book for your grade, as requirements can vary by exam cycle.
      </div>
    </div>
  );
}
