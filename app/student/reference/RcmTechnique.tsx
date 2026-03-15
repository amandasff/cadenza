"use client";
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { GRADES, type GradeData, type TechItem } from "./rcm-data";

// ── Scale audio + notation helpers ────────────────────────────────────────────

const KEY_MIDI: Record<string, number> = {
  C:60, D:62, E:64, F:65, G:67, A:69, B:71,
  "C#":61, "Db":61, "D#":63, "Eb":63, "F#":66, "Gb":66,
  "G#":68, "Ab":68, "A#":70, "Bb":70,
};

const SCALE_PATTERNS: Record<string, number[]> = {
  major:         [0, 2, 4, 5, 7, 9, 11, 12],
  minor:         [0, 2, 3, 5, 7, 8, 10, 12],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11, 12],
  chromatic:     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  arpeggio:      [0, 4, 7, 12],
  arpeggioMinor: [0, 3, 7, 12],
  pentascale:    [0, 2, 4, 5, 7],
  triad:         [0, 4, 7],
};

function parseKey(keys: string): string {
  if (!keys || keys.toLowerCase().includes("all")) return "C";
  const m = keys.match(/[A-G][b#]?/);
  return m ? m[0] : "C";
}

function inferPattern(sectionTitle: string, label: string): number[] {
  const t = sectionTitle.toLowerCase();
  const l = label.toLowerCase();
  if (t.includes("chromatic")) return SCALE_PATTERNS.chromatic;
  if (t.includes("arpeg") || l.includes("arpeg")) {
    return l.includes("minor") || l.includes(" min") ? SCALE_PATTERNS.arpeggioMinor : SCALE_PATTERNS.arpeggio;
  }
  if (t.includes("broken") || t.includes("solid") || t.includes("triad")) {
    return l.includes("minor") ? SCALE_PATTERNS.arpeggioMinor : SCALE_PATTERNS.triad;
  }
  if (t.includes("penta") || t.includes("5-finger")) return SCALE_PATTERNS.pentascale;
  if (l.includes("harmonic")) return SCALE_PATTERNS.harmonicMinor;
  if (l.includes("minor") || l.includes(" min") || t.includes("minor")) return SCALE_PATTERNS.minor;
  return SCALE_PATTERNS.major;
}

function getScaleMidi(sectionTitle: string, item: TechItem): number[] {
  const key = parseKey(item.keys);
  const root = (KEY_MIDI[key] ?? 60);
  // Shift root into a comfortable octave: keep in C4–B4 range
  const rootInRange = root < 60 ? root + 12 : root;
  return inferPattern(sectionTitle, item.label).map(iv => rootInRange + iv);
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Treble clef staff position (pos 0 = bottom line E4)
// Each diatonic step = +1 position
const CHROMATIC_TO_DIATONIC: {letter: string; acc: string}[] = [
  {letter:"C", acc:""},   // 0
  {letter:"C", acc:"#"},  // 1
  {letter:"D", acc:""},   // 2
  {letter:"D", acc:"#"},  // 3
  {letter:"E", acc:""},   // 4
  {letter:"F", acc:""},   // 5
  {letter:"F", acc:"#"},  // 6
  {letter:"G", acc:""},   // 7
  {letter:"G", acc:"#"},  // 8
  {letter:"A", acc:""},   // 9
  {letter:"A", acc:"#"},  // 10
  {letter:"B", acc:""},   // 11
];
const LETTER_TO_IDX: Record<string, number> = {C:0, D:1, E:2, F:3, G:4, A:5, B:6};

function midiToStaff(midi: number): {pos: number; label: string; acc: string} {
  const nc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const {letter, acc} = CHROMATIC_TO_DIATONIC[nc];
  const letterIdx = LETTER_TO_IDX[letter];
  // pos 0 = E4; E has letterIdx=2, octave 4
  const pos = (letterIdx - 2) + (octave - 4) * 7;
  return {pos, label: letter + acc, acc};
}

// ── Mini staff SVG component ───────────────────────────────────────────────────

function MiniStaff({ midiNotes, currentNote }: { midiNotes: number[]; currentNote: number }) {
  const LS = 9;           // px per half-step (line spacing = 2*LS = 18)
  const BOT = 58;         // y of bottom staff line
  const H = 88;
  const NOTE_SPACING = 26;
  const START_X = 32;
  const W = Math.max(200, START_X + (midiNotes.length - 1) * NOTE_SPACING + 24);

  const posY = (pos: number) => BOT - pos * LS;

  const noteInfos = midiNotes.map(midi => midiToStaff(midi));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block", background: "var(--white)", borderRadius: 6, border: "1px solid var(--border)" }}>
        {/* Staff lines */}
        {[0, 2, 4, 6, 8].map(p => (
          <line key={p} x1={6} y1={posY(p)} x2={W - 6} y2={posY(p)} stroke="#CCC" strokeWidth={1} />
        ))}

        {/* Treble clef glyph */}
        <text x={4} y={posY(-2) + 6} fontSize={44} fontFamily="'Times New Roman', Georgia, serif"
          fill="#BBB" dominantBaseline="auto" style={{userSelect:"none"}}>𝄞</text>

        {/* Notes */}
        {noteInfos.map(({pos, label, acc}, i) => {
          const x = START_X + i * NOTE_SPACING;
          const y = posY(pos);
          const isActive = i === currentNote;
          const fill = isActive ? "#B85C3A" : "var(--charcoal)";

          // Ledger lines below
          const ledgersBelow: number[] = [];
          if (pos <= -2) for (let p = -2; p >= pos; p -= 2) ledgersBelow.push(p);
          // Ledger lines above
          const ledgersAbove: number[] = [];
          if (pos >= 10) for (let p = 10; p <= pos; p += 2) ledgersAbove.push(p);

          const stemUp = pos <= 4;

          return (
            <g key={i}>
              {ledgersBelow.map(p => (
                <line key={p} x1={x - 9} y1={posY(p)} x2={x + 9} y2={posY(p)} stroke="#AAA" strokeWidth={1} />
              ))}
              {ledgersAbove.map(p => (
                <line key={p} x1={x - 9} y1={posY(p)} x2={x + 9} y2={posY(p)} stroke="#AAA" strokeWidth={1} />
              ))}
              {acc === "#" && (
                <text x={x - 11} y={y + 4} fontSize={11} fontFamily="serif" fill={fill} textAnchor="middle">♯</text>
              )}
              {acc === "b" && (
                <text x={x - 10} y={y + 3} fontSize={11} fontFamily="serif" fill={fill} textAnchor="middle">♭</text>
              )}
              {/* Note head */}
              <ellipse cx={x} cy={y} rx={6} ry={4.5} fill={fill}
                transform={`rotate(-16, ${x}, ${y})`} />
              {/* Stem */}
              {stemUp
                ? <line x1={x + 6} y1={y} x2={x + 6} y2={y - 22} stroke={fill} strokeWidth={1.4} />
                : <line x1={x - 6} y1={y} x2={x - 6} y2={y + 22} stroke={fill} strokeWidth={1.4} />
              }
              {/* Note name below */}
              <text x={x} y={H - 4} textAnchor="middle" fontSize={8}
                fill={isActive ? "#B85C3A" : "#999"} fontFamily="Inter,sans-serif"
                fontWeight={isActive ? 700 : 400}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Scale player component ─────────────────────────────────────────────────────

function ScalePlayer({ sectionTitle, item }: { sectionTitle: string; item: TechItem }) {
  const [playing, setPlaying] = useState(false);
  const [currentNote, setCurrentNote] = useState(-1);
  const ctxRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ctxRef.current?.close();
      timeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const midiNotes = useMemo(() => getScaleMidi(sectionTitle, item), [sectionTitle, item]);
  const keyName = parseKey(item.keys);
  const showsAllKeys = item.keys.toLowerCase().includes("all");

  const handlePlay = useCallback(() => {
    if (playing) {
      ctxRef.current?.close();
      ctxRef.current = null;
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current = [];
      setPlaying(false);
      setCurrentNote(-1);
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const beatSec = 60 / item.bpm;
    const noteDur = item.beatUnit.includes("♪") ? beatSec * 0.5 : beatSec;

    midiNotes.forEach((midi, i) => {
      const hz = midiToHz(midi);
      const when = ctx.currentTime + i * noteDur;
      [[1, 0.4], [2, 0.15], [3, 0.07]].forEach(([h, a]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = hz * (h as number);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime((a as number) / (h as number), when + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, when + noteDur * 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(when);
        osc.stop(when + noteDur);
      });
      const t = setTimeout(() => {
        if (mountedRef.current) setCurrentNote(i);
      }, (when - ctx.currentTime) * 1000);
      timeoutsRef.current.push(t);
    });

    setPlaying(true);
    setCurrentNote(0);

    const doneMs = midiNotes.length * noteDur * 1000 + 400;
    const doneT = setTimeout(() => {
      if (mountedRef.current) {
        setPlaying(false);
        setCurrentNote(-1);
      }
      try { ctx.close(); } catch {}
    }, doneMs);
    timeoutsRef.current.push(doneT);
  }, [playing, midiNotes, item.bpm, item.beatUnit]);

  return (
    <div style={{ marginTop: "0.875rem" }}>
      <div style={{
        fontFamily: "Inter,sans-serif", fontSize: "0.625rem", color: "var(--muted)",
        fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: "0.5rem",
      }}>
        {showsAllKeys ? `Scale preview — C major (same pattern in all keys)` : `Scale preview — ${keyName}`}
      </div>
      <MiniStaff midiNotes={midiNotes} currentNote={currentNote} />
      <button
        onClick={handlePlay}
        style={{
          marginTop: "0.5rem",
          padding: "0.3rem 0.875rem", borderRadius: 4,
          border: "none", cursor: "pointer",
          background: playing ? "#C0392B" : "#1E8449",
          color: "#fff", fontFamily: "Inter,sans-serif",
          fontSize: "0.6875rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: "0.3rem",
        }}
      >
        {playing ? "⏹ Stop" : "▶ Play"}
      </button>
    </div>
  );
}

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
        {metro.running ? "⏹ Stop" : "▶ Click"}
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
      borderRadius: 8, overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "0.75rem 1rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.75rem",
          userSelect: "none",
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
        <div style={{ padding: "0.75rem 1rem 1rem", borderTop: "1px solid var(--border)", background: "var(--cream)" }}>
          <p style={{ fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
            Minimum tempo: <strong style={{ color: "var(--charcoal)" }}>{item.beatUnit} = {item.bpm}</strong>
          </p>
          <MetronomeWidget defaultBpm={item.bpm} />
          <ScalePlayer sectionTitle={sectionTitle} item={item} />
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
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: "0.875rem" }}>
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
        <div style={{ padding: "0 0.75rem 0.75rem", background: "var(--cream)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
