"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Staff layout constants (all in px)
// ─────────────────────────────────────────────────────────────────────────────
const LS        = 18;   // line spacing
const BOT_Y     = 98;   // Y of bottom staff line inside the container
const TOP_Y     = BOT_Y - 4 * LS;  // = 26  (top staff line)
const NOTE_CX   = 148;  // note head horizontal center
const CONT_W    = 270;
const CONT_H    = 160;

// position 0 = bottom staff line, increments by 1 per half-step
function posY(pos: number) { return BOT_Y - pos * (LS / 2); }

// ─────────────────────────────────────────────────────────────────────────────
// Staff component — SVG lines/note + CSS-rendered clef overlay
// ─────────────────────────────────────────────────────────────────────────────
function Staff({
  clef, notePos, noteColor = "#FDFCFA",
}: { clef: "treble" | "bass"; notePos: number; noteColor?: string }) {
  const ry = posY(notePos);

  // ledger lines (only at even positions)
  const ledgers: number[] = [];
  if (notePos <= -2) for (let p = -2; p >= notePos; p -= 2) ledgers.push(p);
  if (notePos >= 10) for (let p = 10; p <= notePos; p += 2) ledgers.push(p);

  // stem direction: up if note is on or below middle line (pos 4), else down
  const stemUp = notePos <= 4;
  const stemX  = stemUp ? NOTE_CX + 10 : NOTE_CX - 10;
  const stemY1 = ry;
  const stemY2 = stemUp ? ry - 38 : ry + 38;

  return (
    <div style={{ position: "relative", width: CONT_W, height: CONT_H, flexShrink: 0 }}>
      {/* ── SVG: staff lines, note, ledger lines ── */}
      <svg
        width={CONT_W} height={CONT_H}
        viewBox={`0 0 ${CONT_W} ${CONT_H}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {/* 5 staff lines */}
        {[0, 2, 4, 6, 8].map(p => (
          <line key={p} x1={44} y1={posY(p)} x2={CONT_W - 10} y2={posY(p)}
            stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
        ))}

        {/* Ledger lines */}
        {ledgers.map(p => (
          <line key={p} x1={NOTE_CX - 18} y1={posY(p)} x2={NOTE_CX + 18} y2={posY(p)}
            stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
        ))}

        {/* Stem */}
        <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2}
          stroke={noteColor} strokeWidth={1.8} />

        {/* Note head */}
        <ellipse cx={NOTE_CX} cy={ry} rx={11} ry={8} fill={noteColor}
          transform={`rotate(-18, ${NOTE_CX}, ${ry})`} />
      </svg>

      {/* ── CSS clef overlay ── */}
      {clef === "treble" && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            // Empirically: baseline of 𝄞 in Times New Roman sits ~at the E4/bottom line.
            // We nudge the top so the G-curl lines up with the 2nd staff line.
            left: 5,
            top: BOT_Y - 97,   // ≈ 1px above container top
            fontSize: 102,
            lineHeight: 1,
            fontFamily: "'Times New Roman', Georgia, serif",
            color: "rgba(255,255,255,0.7)",
            userSelect: "none",
            pointerEvents: "none",
            display: "block",
          }}
        >
          𝄞
        </span>
      )}
      {clef === "bass" && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            // F-line of bass staff = pos 6 for us → posY(6) = 98 - 54 = 44
            // Bass clef 𝄢 has the two dots at ~20% from top of em square
            left: 6,
            top: posY(6) - 12,  // put top of char slightly above F-line
            fontSize: 50,
            lineHeight: 1,
            fontFamily: "'Times New Roman', Georgia, serif",
            color: "rgba(255,255,255,0.7)",
            userSelect: "none",
            pointerEvents: "none",
            display: "block",
          }}
        >
          𝄢
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Note data
// ─────────────────────────────────────────────────────────────────────────────
const TREBLE_NOTES = [
  { name: "C4", pos: -2 }, { name: "D4", pos: -1 }, { name: "E4", pos: 0  },
  { name: "F4", pos:  1  }, { name: "G4", pos:  2  }, { name: "A4", pos:  3 },
  { name: "B4", pos:  4  }, { name: "C5", pos:  5  }, { name: "D5", pos:  6 },
  { name: "E5", pos:  7  }, { name: "F5", pos:  8  }, { name: "G5", pos:  9 },
];
const BASS_NOTES = [
  { name: "E2", pos: 0 }, { name: "F2", pos: 1 }, { name: "G2", pos: 2 },
  { name: "A2", pos: 3 }, { name: "B2", pos: 4 }, { name: "C3", pos: 5 },
  { name: "D3", pos: 6 }, { name: "E3", pos: 7 }, { name: "F3", pos: 8 },
  { name: "G3", pos: 9 }, { name: "A3", pos: 10 },
];
const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// ─────────────────────────────────────────────────────────────────────────────
// Interval data
// ─────────────────────────────────────────────────────────────────────────────
const INTERVALS_EASY   = [0, 2, 4, 7, 12];
const INTERVALS_MEDIUM = [0, 2, 3, 4, 5, 7, 9, 12];
const INTERVALS_HARD   = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const INTERVAL_NAMES: Record<number, string> = {
  0: "Unison", 1: "Minor 2nd", 2: "Major 2nd", 3: "Minor 3rd", 4: "Major 3rd",
  5: "Perfect 4th", 6: "Tritone", 7: "Perfect 5th", 8: "Minor 6th",
  9: "Major 6th", 10: "Minor 7th", 11: "Major 7th", 12: "Octave",
};

// ─────────────────────────────────────────────────────────────────────────────
// Chord data
// ─────────────────────────────────────────────────────────────────────────────
type ChordQuality = "Major" | "Minor" | "Diminished" | "Augmented";
const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  "Major":      [0, 4, 7],
  "Minor":      [0, 3, 7],
  "Diminished": [0, 3, 6],
  "Augmented":  [0, 4, 8],
};
const CHORD_QUALITIES_EASY:   ChordQuality[] = ["Major", "Minor"];
const CHORD_QUALITIES_MEDIUM: ChordQuality[] = ["Major", "Minor", "Diminished", "Augmented"];

// ─────────────────────────────────────────────────────────────────────────────
// Audio
// ─────────────────────────────────────────────────────────────────────────────
function midiToHz(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

function playTone(hz: number, ctx: AudioContext, when: number, dur = 1.4) {
  // Piano-ish: fundamental + harmonics with exponential decay
  [[1, 0.45], [2, 0.18], [3, 0.09], [4, 0.04]].forEach(([mult, amp]) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = mult === 1 ? "triangle" : "sine";
    osc.frequency.value = hz * mult;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  });
}

function playInterval(semitones: number, audioCtx: AudioContext) {
  const root = midiToHz(60 + Math.floor(Math.random() * 13)); // C4–C5
  const t    = audioCtx.currentTime;
  playTone(root, audioCtx, t, 1.2);
  playTone(root * Math.pow(2, semitones / 12), audioCtx, t + 0.7, 1.2);
}

function playChord(quality: ChordQuality, audioCtx: AudioContext) {
  const rootMidi = 48 + Math.floor(Math.random() * 13); // C3–C4
  const t = audioCtx.currentTime;
  CHORD_INTERVALS[quality].forEach(semi => {
    playTone(midiToHz(rootMidi + semi), audioCtx, t + 0.05, 1.6);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared game scoring
// ─────────────────────────────────────────────────────────────────────────────
const ROUND_SEC = 30;
function streakMult(s: number) { return s >= 10 ? 3 : s >= 5 ? 2 : s >= 3 ? 1.5 : 1; }
function speedPts(ms: number) { return ms < 1000 ? 75 : ms < 2000 ? 50 : ms < 3500 ? 25 : 0; }
function gradeOf(acc: number) {
  if (acc >= 0.95) return { label: "S", color: "#FFD700" };
  if (acc >= 0.85) return { label: "A", color: "#4CAF84" };
  if (acc >= 0.70) return { label: "B", color: "#A8C96E" };
  if (acc >= 0.55) return { label: "C", color: "#E6A817" };
  return                  { label: "D", color: "#E05252" };
}
function hiKey(game: string) { return `theory_hi_${game}`; }

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared game state hook
// ─────────────────────────────────────────────────────────────────────────────
type GS = "idle" | "countdown" | "playing" | "results";

function useGameState(gameKey: string) {
  const [gs, setGs]         = useState<GS>("idle");
  const [countdown, setCd]  = useState(3);
  const [timeLeft, setTL]   = useState(ROUND_SEC);
  const [score, setScore]   = useState(0);
  const [streak, setStreak] = useState(0);
  const [topStreak, setTop] = useState(0);
  const [correct, setC]     = useState(0);
  const [total, setT]       = useState(0);
  const [newRecord, setNR]  = useState(false);
  const [hiScore, setHi]    = useState(0);
  const [popups, setPops]   = useState<{ id: number; text: string }[]>([]);
  const [qStart, setQStart] = useState(0);
  const popId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const advRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadHi() {
    const v = Number(localStorage.getItem(hiKey(gameKey)) ?? 0);
    setHi(v);
    return v;
  }

  function addPopup(text: string) {
    const id = ++popId.current;
    setPops(p => [...p, { id, text }]);
    setTimeout(() => setPops(p => p.filter(x => x.id !== id)), 1100);
  }

  function beginCountdown(onPlay: () => void) {
    setCd(3); setGs("countdown");
    setScore(0); setStreak(0); setTop(0); setC(0); setT(0);
    setNR(false); setPops([]); setSelected(null);
    let cd = 3;
    const iv = setInterval(() => {
      cd -= 1; setCd(cd);
      if (cd <= 0) { clearInterval(iv); onPlay(); }
    }, 1000);
  }

  function beginPlay() {
    setTL(ROUND_SEC); setGs("playing"); setQStart(Date.now());
    let t = ROUND_SEC;
    timerRef.current = setInterval(() => {
      t -= 1; setTL(t);
      if (t <= 0) { clearInterval(timerRef.current!); timerRef.current = null; finishGame(); }
    }, 1000);
  }

  function finishGame() {
    setGs("results");
    setScore(prev => {
      const stored = Number(localStorage.getItem(hiKey(gameKey)) ?? 0);
      if (prev > stored) {
        localStorage.setItem(hiKey(gameKey), String(prev));
        setHi(prev); setNR(true);
      } else { setHi(stored); }
      return prev;
    });
  }

  function scoreAnswer(isCorrect: boolean): { pts: number; mult: number } {
    const ms   = Date.now() - qStart;
    setT(n => n + 1);
    if (isCorrect) {
      setC(n => n + 1);
      const ns = streak + 1;
      setStreak(ns); setTop(t => Math.max(t, ns));
      const mult = streakMult(ns);
      const pts  = Math.round((100 + speedPts(ms)) * mult);
      setScore(s => s + pts);
      addPopup(mult > 1 ? `+${pts} ×${mult}` : `+${pts}`);
      return { pts, mult };
    } else {
      setStreak(0);
      return { pts: 0, mult: 1 };
    }
  }

  function nextQStart() {
    setSelected(null);
    setQStart(Date.now());
  }

  function scheduleNext(isCorrect: boolean, fn: () => void) {
    if (advRef.current) clearTimeout(advRef.current);
    advRef.current = setTimeout(() => { fn(); nextQStart(); }, isCorrect ? 650 : 1300);
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advRef.current) clearTimeout(advRef.current);
  }, []);

  return {
    gs, setGs, countdown, timeLeft, score, streak, topStreak: topStreak,
    correct, total, newRecord, hiScore, popups, selected, setSelected,
    loadHi, beginCountdown, beginPlay, finishGame, scoreAnswer, scheduleNext, nextQStart,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI pieces
// ─────────────────────────────────────────────────────────────────────────────
function TopBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div style={{ padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", padding: 0 }}>
        ← Back
      </button>
      <span style={{ flex: 1, textAlign: "center", fontWeight: 600, fontSize: "0.8125rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>{label}</span>
      <div style={{ width: 40 }} />
    </div>
  );
}

function GameHeader({ timeLeft, score, streak }: { timeLeft: number; score: number; streak: number }) {
  const pct   = timeLeft / ROUND_SEC;
  const color = pct > 0.5 ? "#4CAF84" : pct > 0.25 ? "#E6A817" : "#E05252";
  const mult  = streakMult(streak);
  return (
    <>
      <div style={{ height: 4, background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: color, transition: "width 0.9s linear, background 0.5s" }} />
      </div>
      <div style={{ padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9375rem", fontWeight: 700, color, transition: "border-color 0.5s, color 0.5s", flexShrink: 0 }}>
          {timeLeft}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#FDFCFA", letterSpacing: "-0.03em", lineHeight: 1 }}>{score.toLocaleString()}</div>
          {mult > 1 && <div style={{ fontSize: "0.6875rem", color: mult >= 3 ? "#FFD700" : mult >= 2 ? "#E6A817" : "#A8C96E", fontWeight: 700, letterSpacing: "0.04em" }}>×{mult} MULTIPLIER</div>}
        </div>
        {streak >= 3 && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>🔥</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: mult >= 3 ? "#FFD700" : "#E6A817" }}>{streak}</div>
          </div>
        )}
      </div>
    </>
  );
}

function ResultsScreen({
  score, correct, total, topStreak, newRecord, hiScore, gameLabel,
  onPlayAgain, onMenu,
}: {
  score: number; correct: number; total: number; topStreak: number;
  newRecord: boolean; hiScore: number; gameLabel: string;
  onPlayAgain: () => void; onMenu: () => void;
}) {
  const acc = total > 0 ? correct / total : 0;
  const g   = gradeOf(acc);
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <TopBar onBack={onMenu} label="Round complete" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
          {newRecord && <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FFD700", marginBottom: "0.75rem" }}>🏆 New Personal Best!</div>}
          <div style={{ fontSize: "5rem", fontWeight: 800, color: g.color, lineHeight: 1, marginBottom: "0.25rem", letterSpacing: "-0.04em" }}>{g.label}</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#FDFCFA", letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>{score.toLocaleString()}</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2rem" }}>pts · {gameLabel}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "2rem" }}>
            {[
              { label: "Correct",   value: `${correct}/${total}` },
              { label: "Accuracy",  value: total > 0 ? `${Math.round(acc * 100)}%` : "—" },
              { label: "Top Streak",value: topStreak > 0 ? `🔥 ${topStreak}` : "0" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "0.875rem 0.5rem" }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FDFCFA", marginBottom: "0.25rem" }}>{s.value}</div>
                <div style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {hiScore > 0 && !newRecord && <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.3)", marginBottom: "1.5rem" }}>Best: {hiScore.toLocaleString()} pts</div>}
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button onClick={onPlayAgain} style={{ flex: 1, padding: "0.875rem", borderRadius: 8, border: "none", background: "#4CAF84", color: "#fff", fontSize: "0.9375rem", fontFamily: "Inter, sans-serif", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 20px #4CAF8440" }}>Play Again</button>
            <button onClick={onMenu} style={{ flex: 1, padding: "0.875rem", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "0.9375rem", fontFamily: "Inter, sans-serif", fontWeight: 500, cursor: "pointer" }}>Change Mode</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerGrid({
  choices, selected, correct, onAnswer, columns = 2,
}: { choices: string[]; selected: string | null; correct: string; onAnswer: (c: string) => void; columns?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "0.625rem" }}>
      {choices.map(c => {
        const isSelected = selected === c;
        const isRight    = c === correct;
        let bg = "rgba(255,255,255,0.06)", border = "1px solid rgba(255,255,255,0.1)", color = "#FDFCFA";
        if (selected) {
          if (isRight) { bg = "rgba(76,175,132,0.2)"; border = "1.5px solid #4CAF84"; color = "#4CAF84"; }
          else if (isSelected) { bg = "rgba(224,82,82,0.2)"; border = "1.5px solid #E05252"; color = "#E05252"; }
          else { bg = "rgba(255,255,255,0.03)"; border = "1px solid rgba(255,255,255,0.05)"; color = "rgba(255,255,255,0.25)"; }
        }
        return (
          <button key={c} onClick={() => onAnswer(c)} disabled={!!selected} style={{ padding: "0.875rem 0.5rem", borderRadius: 10, border, background: bg, color, fontSize: choices.length <= 4 ? "1.375rem" : "0.875rem", fontFamily: "Inter, sans-serif", fontWeight: 600, cursor: selected ? "default" : "pointer", transition: "all 0.1s", lineHeight: 1.3, textAlign: "center" }}>
            {c}
          </button>
        );
      })}
    </div>
  );
}

function Popups({ entries }: { entries: { id: number; text: string }[] }) {
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 10 }}>
        {entries.map(p => (
          <div key={p.id} style={{ fontSize: "1.125rem", fontWeight: 800, color: "#4CAF84", animation: "floatUp 1.1s ease-out forwards" }}>{p.text}</div>
        ))}
      </div>
      <style>{`@keyframes floatUp { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-56px)} }`}</style>
    </>
  );
}

function CountdownScreen({ n }: { n: number }) {
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "1rem" }}>Get ready…</div>
      <div style={{ fontSize: "6rem", fontWeight: 800, color: "#FDFCFA", lineHeight: 1, letterSpacing: "-0.04em" }}>{n}</div>
    </div>
  );
}

function IdleCard({
  title, hiScore, description, extras, onStart, startLabel = "Start Round",
}: { title: string; hiScore: number; description: string; extras?: React.ReactNode; onStart: () => void; startLabel?: string }) {
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", overflow: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.375rem" }}>{title}</div>
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.375rem" }}>Personal Best</div>
            <div style={{ fontSize: "3rem", fontWeight: 700, color: "#FDFCFA", letterSpacing: "-0.03em", lineHeight: 1 }}>{hiScore > 0 ? hiScore.toLocaleString() : "—"}</div>
          </div>
          {extras}
          <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)", marginBottom: "2rem", lineHeight: 1.7 }}>{description}</p>
          <button onClick={onStart} style={{ width: "100%", padding: "0.875rem", borderRadius: 8, border: "none", background: "#4CAF84", color: "#fff", fontSize: "1rem", fontFamily: "Inter, sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em", boxShadow: "0 0 24px #4CAF8444" }}>
            {startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game 1: Note Identification
// ─────────────────────────────────────────────────────────────────────────────
function makeNoteQ(clef: "treble" | "bass", prevPos?: number) {
  const pool   = clef === "treble" ? TREBLE_NOTES : BASS_NOTES;
  const opts   = prevPos !== undefined ? pool.filter(n => n.pos !== prevPos) : pool;
  const note   = opts[Math.floor(Math.random() * opts.length)];
  const right  = note.name.replace(/\d/, "");
  const wrongs = shuffle(NOTE_LETTERS.filter(l => l !== right)).slice(0, 3);
  return { note, correct: right, choices: shuffle([right, ...wrongs]) };
}

function NoteIdGame({ onBack }: { onBack: () => void }) {
  const [clef, setClef] = useState<"treble" | "bass">("treble");
  const [q, setQ]       = useState(() => makeNoteQ("treble"));
  const gk = `nid_${clef}`;
  const game = useGameState(gk);

  useEffect(() => { game.loadHi(); }, [clef]); // eslint-disable-line

  function start() {
    const hi = game.loadHi();
    void hi;
    game.beginCountdown(() => {
      setQ(makeNoteQ(clef));
      game.beginPlay();
    });
  }

  function answer(choice: string) {
    if (game.selected || game.gs !== "playing") return;
    game.setSelected(choice);
    const ok = choice === q.correct;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => setQ(makeNoteQ(clef, q.note.pos)));
  }

  if (game.gs === "idle") {
    return (
      <IdleCard
        title="Note Identification"
        hiScore={game.hiScore}
        description={`30 seconds · name each note as fast as you can\nstreaks multiply your score up to 3×`}
        extras={
          <>
            <div style={{ background: "#252537", borderRadius: 14, padding: "0.75rem 0.5rem", marginBottom: "1.5rem", display: "flex", justifyContent: "center" }}>
              <Staff clef={clef} notePos={clef === "treble" ? 2 : 4} noteColor="rgba(255,255,255,0.3)" />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1.25rem" }}>
              {(["treble", "bass"] as const).map(c => (
                <button key={c} onClick={() => setClef(c)} style={{ padding: "0.5rem 1.25rem", borderRadius: 20, cursor: "pointer", background: clef === c ? "#4CAF84" : "transparent", border: `1.5px solid ${clef === c ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: clef === c ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", fontWeight: clef === c ? 600 : 400, transition: "all 0.15s" }}>
                  {c === "treble" ? "Treble Clef" : "Bass Clef"}
                </button>
              ))}
            </div>
          </>
        }
        onStart={start}
      />
    );
  }
  if (game.gs === "countdown") return <CountdownScreen n={game.countdown} />;
  if (game.gs === "results") {
    return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel={`${clef} clef`} onPlayAgain={start} onMenu={onBack} />;
  }

  // playing
  const isCorrect = game.selected === q.correct;
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>
        <Popups entries={game.popups} />
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "1rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>What note is this?</div>
          <div style={{ background: "#252537", borderRadius: 14, padding: "0.75rem 0.5rem", marginBottom: "1.25rem", display: "flex", justifyContent: "center", boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
            <Staff clef={clef} notePos={q.note.pos} noteColor={!game.selected ? "#FDFCFA" : isCorrect ? "#4CAF84" : "#E05252"} />
          </div>
          {game.selected && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem", fontSize: "1rem", fontWeight: 600, color: isCorrect ? "#4CAF84" : "#E05252" }}>
              {isCorrect ? (game.streak >= 5 ? `🔥 ${game.streak} in a row!` : "Correct!") : `That's ${q.correct}`}
            </div>
          )}
          <AnswerGrid choices={q.choices} selected={game.selected} correct={q.correct} onAnswer={answer} />
          {!game.selected && (
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button onClick={() => { setQ(makeNoteQ(clef, q.note.pos)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif" }}>Skip</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// Wrapper so IdleCard renders children prop
NoteIdGame.displayName = "NoteIdGame";

// ─────────────────────────────────────────────────────────────────────────────
// Game 2: Interval Ear Training
// ─────────────────────────────────────────────────────────────────────────────
type Difficulty = "easy" | "medium" | "hard";
const DIFF_INTERVALS: Record<Difficulty, number[]> = {
  easy:   INTERVALS_EASY,
  medium: INTERVALS_MEDIUM,
  hard:   INTERVALS_HARD,
};
const DIFF_LABEL: Record<Difficulty, string> = { easy: "Prep–Grade 2", medium: "Grade 3–5", hard: "Grade 6–8" };

function makeIntervalQ(diff: Difficulty) {
  const pool   = DIFF_INTERVALS[diff];
  const semi   = pool[Math.floor(Math.random() * pool.length)];
  const wrongs = shuffle(pool.filter(s => s !== semi)).slice(0, 3);
  const choices = shuffle([semi, ...wrongs]).map(s => INTERVAL_NAMES[s]);
  return { semi, correct: INTERVAL_NAMES[semi], choices };
}

function IntervalGame({ onBack }: { onBack: () => void }) {
  const [diff, setDiff]   = useState<Difficulty>("easy");
  const [q, setQ]         = useState(() => makeIntervalQ("easy"));
  const [played, setPlayed] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const game = useGameState(`interval_${diff}`);

  useEffect(() => { game.loadHi(); }, [diff]); // eslint-disable-line

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === "closed") ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function playQ(semitones: number) {
    playInterval(semitones, getCtx());
    setPlayed(true);
  }

  function newQ(d: Difficulty) {
    const next = makeIntervalQ(d);
    setQ(next);
    setPlayed(false);
    setTimeout(() => playInterval(next.semi, getCtx()), 300);
  }

  function start() {
    game.beginCountdown(() => {
      const first = makeIntervalQ(diff);
      setQ(first); setPlayed(false);
      game.beginPlay();
      setTimeout(() => playInterval(first.semi, getCtx()), 200);
    });
  }

  function answer(choice: string) {
    if (game.selected || game.gs !== "playing") return;
    game.setSelected(choice);
    const ok = choice === q.correct;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => newQ(diff));
  }

  if (game.gs === "idle") {
    return (
      <IdleCard
        title="Interval Ear Training"
        hiScore={game.hiScore}
        description="Two notes play in sequence — identify the interval. Speed and streaks earn bonus points."
        extras={
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.625rem", textAlign: "center" }}>Difficulty · RCM level</div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDiff(d)} style={{ padding: "0.5rem 0.875rem", borderRadius: 20, cursor: "pointer", background: diff === d ? "#4CAF84" : "transparent", border: `1.5px solid ${diff === d ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: diff === d ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: diff === d ? 600 : 400, transition: "all 0.15s" }}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}<br />
                  <span style={{ fontSize: "0.5625rem", opacity: 0.7 }}>{DIFF_LABEL[d]}</span>
                </button>
              ))}
            </div>
          </div>
        }
        onStart={start}
      />
    );
  }
  if (game.gs === "countdown") return <CountdownScreen n={game.countdown} />;
  if (game.gs === "results") {
    return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel={`intervals · ${diff}`} onPlayAgain={start} onMenu={onBack} />;
  }

  const isCorrect = game.selected === q.correct;
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>
        <Popups entries={game.popups} />
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>What interval is this?</div>

          {/* Big play button */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}>
            <button onClick={() => playQ(q.semi)} style={{ width: 80, height: 80, borderRadius: "50%", border: "none", background: played ? "rgba(255,255,255,0.08)" : "#4CAF84", color: "#fff", fontSize: "1.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: played ? "none" : "0 0 28px #4CAF8450", transition: "all 0.2s" }}>
              {played ? "↻" : "▶"}
            </button>
          </div>
          {played && !game.selected && <div style={{ textAlign: "center", marginBottom: "1rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>Tap to replay ↑</div>}

          {game.selected && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem", fontSize: "1rem", fontWeight: 600, color: isCorrect ? "#4CAF84" : "#E05252" }}>
              {isCorrect ? (game.streak >= 5 ? `🔥 ${game.streak}!` : "Correct!") : `It was ${q.correct}`}
            </div>
          )}

          <AnswerGrid choices={q.choices} selected={game.selected} correct={q.correct} onAnswer={answer} columns={2} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game 3: Chord Quality
// ─────────────────────────────────────────────────────────────────────────────
function makeChordQ(diff: "easy" | "medium") {
  const pool   = diff === "easy" ? CHORD_QUALITIES_EASY : CHORD_QUALITIES_MEDIUM;
  const q      = pool[Math.floor(Math.random() * pool.length)];
  const wrongs = shuffle(pool.filter(p => p !== q)).slice(0, diff === "easy" ? 1 : 3);
  return { quality: q, correct: q, choices: shuffle([q, ...wrongs]) };
}

function ChordGame({ onBack }: { onBack: () => void }) {
  const [diff, setDiff]     = useState<"easy" | "medium">("easy");
  const [q, setQ]           = useState(() => makeChordQ("easy"));
  const [played, setPlayed] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const game = useGameState(`chord_${diff}`);

  useEffect(() => { game.loadHi(); }, [diff]); // eslint-disable-line

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === "closed") ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function play(quality: ChordQuality) { playChord(quality, getCtx()); setPlayed(true); }

  function newQ(d: "easy" | "medium") {
    const next = makeChordQ(d);
    setQ(next); setPlayed(false);
    setTimeout(() => playChord(next.quality, getCtx()), 300);
  }

  function start() {
    game.beginCountdown(() => {
      const first = makeChordQ(diff);
      setQ(first); setPlayed(false);
      game.beginPlay();
      setTimeout(() => playChord(first.quality, getCtx()), 200);
    });
  }

  function answer(choice: string) {
    if (game.selected || game.gs !== "playing") return;
    game.setSelected(choice);
    const ok = choice === q.correct;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => newQ(diff));
  }

  const CHORD_ICONS: Record<ChordQuality, string> = { Major: "△", Minor: "−", Diminished: "°", Augmented: "+" };

  if (game.gs === "idle") {
    return (
      <IdleCard
        title="Chord Quality"
        hiScore={game.hiScore}
        description="A chord plays — identify whether it's major, minor, diminished, or augmented."
        extras={
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.625rem", textAlign: "center" }}>Mode</div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              {(["easy", "medium"] as const).map(d => (
                <button key={d} onClick={() => setDiff(d)} style={{ padding: "0.5rem 1.125rem", borderRadius: 20, cursor: "pointer", background: diff === d ? "#4CAF84" : "transparent", border: `1.5px solid ${diff === d ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: diff === d ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", fontWeight: diff === d ? 600 : 400, transition: "all 0.15s" }}>
                  {d === "easy" ? "Major & Minor" : "All 4 Qualities"}
                </button>
              ))}
            </div>
          </div>
        }
        onStart={start}
      />
    );
  }
  if (game.gs === "countdown") return <CountdownScreen n={game.countdown} />;
  if (game.gs === "results") {
    return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel={`chord quality · ${diff}`} onPlayAgain={start} onMenu={onBack} />;
  }

  const isCorrect = game.selected === q.correct;
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>
        <Popups entries={game.popups} />
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>What chord quality is this?</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}>
            <button onClick={() => play(q.quality)} style={{ width: 80, height: 80, borderRadius: "50%", border: "none", background: played ? "rgba(255,255,255,0.08)" : "#9b59b6", color: "#fff", fontSize: "1.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: played ? "none" : "0 0 28px #9b59b650", transition: "all 0.2s" }}>
              {played ? "↻" : "▶"}
            </button>
          </div>
          {played && !game.selected && <div style={{ textAlign: "center", marginBottom: "1rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>Tap to replay ↑</div>}

          {game.selected && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem", fontSize: "1rem", fontWeight: 600, color: isCorrect ? "#4CAF84" : "#E05252" }}>
              {isCorrect ? (game.streak >= 5 ? `🔥 ${game.streak}!` : "Correct!") : `It was ${q.correct} ${CHORD_ICONS[q.correct]}`}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: diff === "easy" ? "1fr 1fr" : "1fr 1fr", gap: "0.625rem" }}>
            {q.choices.map(c => {
              const cq = c as ChordQuality;
              const isSelected = game.selected === c;
              const isRight    = c === q.correct;
              let bg = "rgba(255,255,255,0.06)", border = "1px solid rgba(255,255,255,0.1)", color = "#FDFCFA";
              if (game.selected) {
                if (isRight) { bg = "rgba(76,175,132,0.2)"; border = "1.5px solid #4CAF84"; color = "#4CAF84"; }
                else if (isSelected) { bg = "rgba(224,82,82,0.2)"; border = "1.5px solid #E05252"; color = "#E05252"; }
                else { bg = "rgba(255,255,255,0.03)"; border = "1px solid rgba(255,255,255,0.05)"; color = "rgba(255,255,255,0.25)"; }
              }
              return (
                <button key={c} onClick={() => answer(c)} disabled={!!game.selected} style={{ padding: "1rem 0.5rem", borderRadius: 10, border, background: bg, color, fontFamily: "Inter, sans-serif", fontWeight: 600, cursor: game.selected ? "default" : "pointer", transition: "all 0.1s", textAlign: "center" }}>
                  <div style={{ fontSize: "1.625rem", lineHeight: 1 }}>{CHORD_ICONS[cq]}</div>
                  <div style={{ fontSize: "0.8125rem", marginTop: "0.25rem", opacity: 0.85 }}>{c}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu
// ─────────────────────────────────────────────────────────────────────────────
type View = "menu" | "noteId" | "interval" | "chord";

function Menu({ onSelect }: { onSelect: (v: View) => void }) {
  const scores = {
    noteId_treble: Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("nid_treble")) ?? 0 : 0),
    noteId_bass:   Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("nid_bass"))   ?? 0 : 0),
    interval:      Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("interval_easy")) ?? localStorage.getItem(hiKey("interval_medium")) ?? localStorage.getItem(hiKey("interval_hard")) ?? 0 : 0),
    chord:         Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("chord_easy")) ?? localStorage.getItem(hiKey("chord_medium")) ?? 0 : 0),
  };

  const games = [
    {
      view: "noteId" as View, icon: "🎵", title: "Note Identification",
      desc: "A note flashes on the staff — name it as fast as you can. 30s rounds, streak multipliers.",
      badge: scores.noteId_treble > 0 ? `🏆 ${Math.max(scores.noteId_treble, scores.noteId_bass).toLocaleString()}` : null,
      active: true,
    },
    {
      view: "interval" as View, icon: "👂", title: "Interval Ear Training",
      desc: "Two notes play in sequence. Identify the interval. RCM-graded difficulty: Prep → Grade 8.",
      badge: null, active: true,
    },
    {
      view: "chord" as View, icon: "🎼", title: "Chord Quality",
      desc: "A chord plays. Major, minor, diminished, or augmented — train your ear to tell them apart.",
      badge: null, active: true,
    },
    {
      view: "menu" as View, icon: "📖", title: "Sight Reading",
      desc: "Short melodic passages graded by RCM level. Sing or play along, then self-rate.", badge: null, active: false,
    },
    {
      view: "menu" as View, icon: "🥁", title: "Rhythm Clapping",
      desc: "See a rhythm pattern and tap it back. RCM exam prep.", badge: null, active: false,
    },
  ];

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", padding: "2.5rem 1.5rem", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>Theory Practice</div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Fast-paced rounds, streak multipliers, personal bests. The best theory practice happens in small daily doses.</p>
        </div>
        <div style={{ display: "grid", gap: "0.875rem" }}>
          {games.map(g => (
            <div key={g.title} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem 1.5rem", opacity: g.active ? 1 : 0.48, cursor: g.active ? "pointer" : "default" }} onClick={g.active ? () => onSelect(g.view) : undefined}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: g.active ? "rgba(74,103,185,0.1)" : "rgba(74,103,185,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.2rem" }}>{g.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{g.title}</span>
                    {!g.active && <span style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.125rem 0.375rem" }}>Soon</span>}
                    {g.badge && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{g.badge}</span>}
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{g.desc}</p>
                </div>
                {g.active && <span style={{ fontSize: "1rem", color: "var(--muted)", flexShrink: 0, alignSelf: "center" }}>›</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────
export default function TheoryPage() {
  const [view, setView] = useState<View>("menu");
  if (view === "menu")    return <Menu onSelect={setView} />;
  if (view === "noteId")  return <NoteIdGame onBack={() => setView("menu")} />;
  if (view === "interval") return <IntervalGame onBack={() => setView("menu")} />;
  if (view === "chord")   return <ChordGame onBack={() => setView("menu")} />;
  return null;
}
