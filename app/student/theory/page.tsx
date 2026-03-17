"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useI18n } from "../../../lib/context/I18nContext";

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
  { name: "G2", pos: 0 }, { name: "A2", pos: 1 }, { name: "B2", pos: 2 },
  { name: "C3", pos: 3 }, { name: "D3", pos: 4 }, { name: "E3", pos: 5 },
  { name: "F3", pos: 6 }, { name: "G3", pos: 7 }, { name: "A3", pos: 8 },
  { name: "B3", pos: 9 }, { name: "C4", pos: 10 },
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

// Mnemonic songs for each interval — one ascending, one descending
const INTERVAL_REFS: Record<number, { asc: string; desc: string }> = {
  0:  { asc: "Same note",                           desc: "Same note" },
  1:  { asc: "Jaws theme (da-dum)",                 desc: "Joy to the World (opening)" },
  2:  { asc: "Happy Birthday (first two notes)",    desc: "Mary Had a Little Lamb" },
  3:  { asc: "Hey Jude (Hey… Jude)",                desc: "Brahms' Lullaby (opening)" },
  4:  { asc: "When the Saints Go Marching In",      desc: "Swing Low, Sweet Chariot" },
  5:  { asc: "Here Comes the Bride",                desc: "Eine Kleine Nachtmusik" },
  6:  { asc: "The Simpsons theme",                  desc: "The Simpsons theme (↓)" },
  7:  { asc: "Twinkle Twinkle (first leap)",        desc: "Flintstones theme" },
  8:  { asc: "The Entertainer (Joplin)",            desc: "Turn! Turn! Turn! (Byrds)" },
  9:  { asc: "My Bonnie Lies Over the Ocean",       desc: "Nobody Knows the Trouble I've Seen" },
  10: { asc: "Somewhere (West Side Story)",         desc: "Watermelon Man (Hancock)" },
  11: { asc: "Take On Me (A-ha, opening riff)",     desc: "I Love You (Cole Porter)" },
  12: { asc: "Somewhere Over the Rainbow",          desc: "Willow Weep for Me" },
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

// Shared compressor per AudioContext — prevents clipping when chords stack
function getOutputNode(ctx: AudioContext): AudioNode {
  const key = "__cadenzaOut";
  const stored = (ctx as unknown as Record<string, unknown>)[key];
  if (stored) return stored as AudioNode;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(ctx.destination);
  (ctx as unknown as Record<string, unknown>)[key] = comp;
  return comp;
}

function playTone(hz: number, ctx: AudioContext, when: number, dur = 1.4) {
  const out = getOutputNode(ctx);

  // Low-pass filter rolls off high harmonics for warmth — tracks pitch
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = Math.min(hz * 9, 10000);
  filter.Q.value = 0.5;
  filter.connect(out);

  // Envelope: fast attack → quick initial decay → slow sustain tail
  // This two-stage shape is the defining characteristic of a struck string
  const env = ctx.createGain();
  env.connect(filter);
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(1.0, when + 0.007);      // ~7ms hammer attack
  env.gain.exponentialRampToValueAtTime(0.3, when + 0.08);  // fast initial decay
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);  // long sustain tail

  // Sine harmonics with piano-like amplitude ratios + slight inharmonicity.
  // Piano strings are physically stiff so upper partials are slightly sharp
  // (inharmonicity coefficient B). This is the "piano" quality that synths lack.
  const B = 0.0003;
  ([
    [1, 0.36],
    [2, 0.20],
    [3, 0.10],
    [4, 0.05],
    [5, 0.025],
    [6, 0.012],
  ] as [number, number][]).forEach(([n, amp]) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz * n * Math.sqrt(1 + B * n * n);
    g.gain.value = amp;
    osc.connect(g);
    g.connect(env);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  });
}

function playInterval(semitones: number, audioCtx: AudioContext, direction: "asc" | "desc" = "asc") {
  audioCtx.resume(); // ensure not suspended on mobile
  const root  = midiToHz(60 + Math.floor(Math.random() * 13)); // C4–C5
  const upper = root * Math.pow(2, semitones / 12);
  const t     = audioCtx.currentTime;
  if (direction === "asc") {
    playTone(root,  audioCtx, t,       1.2);
    playTone(upper, audioCtx, t + 0.7, 1.2);
  } else {
    playTone(upper, audioCtx, t,       1.2);
    playTone(root,  audioCtx, t + 0.7, 1.2);
  }
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
  const { t } = useI18n();
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
            <button onClick={onPlayAgain} style={{ flex: 1, padding: "0.875rem", borderRadius: 8, border: "none", background: "#4CAF84", color: "#fff", fontSize: "0.9375rem", fontFamily: "Inter, sans-serif", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 20px #4CAF8440" }}>{t.student.playAgain}</button>
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
  const { t } = useI18n();
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
              {isCorrect ? (game.streak >= 5 ? t.student.inARow.replace("{n}", String(game.streak)) : t.student.correctFeedback) : `That's ${q.correct}`}
            </div>
          )}
          <AnswerGrid choices={q.choices} selected={game.selected} correct={q.correct} onAnswer={answer} />
          {!game.selected && (
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button onClick={() => { setQ(makeNoteQ(clef, q.note.pos)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif" }}>{t.student.skipArrow}</button>
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

function makeIntervalQ(diff: Difficulty, allowDescending = false) {
  const pool      = DIFF_INTERVALS[diff];
  const semi      = pool[Math.floor(Math.random() * pool.length)];
  // Only offer descending for intervals > unison (unison sounds same either way)
  const direction: "asc" | "desc" = allowDescending && semi > 0 && Math.random() < 0.5 ? "desc" : "asc";
  const wrongs    = shuffle(pool.filter(s => s !== semi)).slice(0, 3);
  const choices   = shuffle([semi, ...wrongs]).map(s => INTERVAL_NAMES[s]);
  return { semi, correct: INTERVAL_NAMES[semi], choices, direction };
}

function IntervalRefPanel({ diff, allowDesc, onClose }: { diff: Difficulty; allowDesc: boolean; onClose: () => void }) {
  const pool = DIFF_INTERVALS[diff];
  return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", zIndex: 20, overflowY: "auto", padding: "1rem 1.25rem", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1.25rem" }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: "0.9375rem", color: "#FDFCFA" }}>Interval Reference</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "1.25rem", padding: 0, lineHeight: 1 }}>✕</button>
      </div>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: allowDesc ? "1fr 1fr 1fr" : "1fr 1fr", gap: "0.375rem 0.75rem", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Interval</div>
        <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>↑ Ascending</div>
        {allowDesc && <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>↓ Descending</div>}
      </div>
      {pool.map((semi, i) => (
        <div key={semi} style={{ display: "grid", gridTemplateColumns: allowDesc ? "1fr 1fr 1fr" : "1fr 1fr", gap: "0.375rem 0.75rem", padding: "0.625rem 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", alignItems: "start" }}>
          <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#FDFCFA" }}>{INTERVAL_NAMES[semi]}</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{INTERVAL_REFS[semi].asc}</div>
          {allowDesc && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{INTERVAL_REFS[semi].desc}</div>}
        </div>
      ))}
    </div>
  );
}

function IntervalGame({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [diff, setDiff]       = useState<Difficulty>("easy");
  const [allowDesc, setAllowDesc] = useState(false);
  const [q, setQ]             = useState(() => makeIntervalQ("easy"));
  const [played, setPlayed]   = useState(false);
  const [showRef, setShowRef] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const game = useGameState(`interval_${diff}`);

  useEffect(() => { game.loadHi(); }, [diff]); // eslint-disable-line

  function freshCtx() {
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      ctxRef.current.close().catch(() => {});
    }
    ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function playQ(semitones: number, direction: "asc" | "desc") {
    playInterval(semitones, freshCtx(), direction);
    setPlayed(true);
  }

  function newQ(d: Difficulty, desc: boolean) {
    const next = makeIntervalQ(d, desc);
    setQ(next);
    setPlayed(false);
    setTimeout(() => {
      playInterval(next.semi, freshCtx(), next.direction);
      setPlayed(true);
    }, 300);
  }

  function start() {
    game.beginCountdown(() => {
      const first = makeIntervalQ(diff, allowDesc);
      setQ(first); setPlayed(false);
      game.beginPlay();
      setTimeout(() => {
        playInterval(first.semi, freshCtx(), first.direction);
        setPlayed(true);
      }, 200);
    });
  }

  function answer(choice: string) {
    if (game.selected || game.gs !== "playing") return;
    game.setSelected(choice);
    const ok = choice === q.correct;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => newQ(diff, allowDesc));
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
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem" }}>
              {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDiff(d)} style={{ padding: "0.5rem 0.875rem", borderRadius: 20, cursor: "pointer", background: diff === d ? "#4CAF84" : "transparent", border: `1.5px solid ${diff === d ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: diff === d ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: diff === d ? 600 : 400, transition: "all 0.15s" }}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}<br />
                  <span style={{ fontSize: "0.5625rem", opacity: 0.7 }}>{DIFF_LABEL[d]}</span>
                </button>
              ))}
            </div>
            {/* Descending toggle */}
            <button
              onClick={() => setAllowDesc(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 auto", padding: "0.5rem 1rem", borderRadius: 20, cursor: "pointer", background: allowDesc ? "rgba(155,89,182,0.2)" : "transparent", border: `1.5px solid ${allowDesc ? "#9b59b6" : "rgba(255,255,255,0.15)"}`, color: allowDesc ? "#c39bd3" : "rgba(255,255,255,0.4)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", fontWeight: 500, transition: "all 0.15s" }}
            >
              <span style={{ fontSize: "1rem" }}>↕</span>
              Include descending intervals
            </button>
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
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", position: "relative" }}>
      {showRef && <IntervalRefPanel diff={diff} allowDesc={allowDesc} onClose={() => setShowRef(false)} />}
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>
        <Popups entries={game.popups} />
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {q.direction === "desc" ? "↓ Descending — what interval?" : "What interval is this?"}
            </div>
            <button
              onClick={() => setShowRef(v => !v)}
              title="Show reference"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif", lineHeight: 1 }}
            >
              📖
            </button>
          </div>

          {/* Big play button */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}>
            <button onClick={() => playQ(q.semi, q.direction)} style={{ width: 80, height: 80, borderRadius: "50%", border: "none", background: played ? "rgba(255,255,255,0.08)" : "#4CAF84", color: "#fff", fontSize: "1.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: played ? "none" : "0 0 28px #4CAF8450", transition: "all 0.2s" }}>
              {played ? "↻" : "▶"}
            </button>
          </div>
          {played && !game.selected && <div style={{ textAlign: "center", marginBottom: "1rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>Tap to replay ↑</div>}

          {game.selected && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem", fontSize: "1rem", fontWeight: 600, color: isCorrect ? "#4CAF84" : "#E05252" }}>
              {isCorrect ? (game.streak >= 5 ? t.student.inARow.replace("{n}", String(game.streak)) : t.student.correctFeedback) : `It was ${q.correct}`}
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
  const { t } = useI18n();
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
              {isCorrect ? (game.streak >= 5 ? t.student.inARow.replace("{n}", String(game.streak)) : t.student.correctFeedback) : `It was ${q.correct} ${CHORD_ICONS[q.correct]}`}
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
// Game 4: Music Terms
// ─────────────────────────────────────────────────────────────────────────────

interface Term { term: string; definition: string; category: string; level: "easy" | "medium" | "hard"; }

const TERMS: Term[] = [
  // Easy
  { term: "Allegro", definition: "Fast and lively", category: "tempo", level: "easy" },
  { term: "Andante", definition: "At a walking pace", category: "tempo", level: "easy" },
  { term: "Forte (f)", definition: "Loud", category: "dynamics", level: "easy" },
  { term: "Piano (p)", definition: "Soft", category: "dynamics", level: "easy" },
  { term: "Staccato", definition: "Short and detached", category: "articulation", level: "easy" },
  { term: "Legato", definition: "Smooth and connected", category: "articulation", level: "easy" },
  { term: "Crescendo", definition: "Gradually getting louder", category: "dynamics", level: "easy" },
  { term: "Decrescendo", definition: "Gradually getting softer", category: "dynamics", level: "easy" },
  { term: "Mezzo Forte (mf)", definition: "Moderately loud", category: "dynamics", level: "easy" },
  { term: "Mezzo Piano (mp)", definition: "Moderately soft", category: "dynamics", level: "easy" },
  { term: "Ritardando (rit.)", definition: "Gradually slowing down", category: "tempo", level: "easy" },
  { term: "Da Capo (D.C.)", definition: "Repeat from the beginning", category: "form", level: "easy" },
  { term: "Fine", definition: "The end", category: "form", level: "easy" },
  { term: "Fermata", definition: "Hold the note longer than its value", category: "form", level: "easy" },
  { term: "Tempo", definition: "The speed of the music", category: "general", level: "easy" },
  // Medium
  { term: "Adagio", definition: "Slow and stately", category: "tempo", level: "medium" },
  { term: "Moderato", definition: "At a moderate pace", category: "tempo", level: "medium" },
  { term: "Vivace", definition: "Lively and fast", category: "tempo", level: "medium" },
  { term: "Presto", definition: "Very fast", category: "tempo", level: "medium" },
  { term: "Pianissimo (pp)", definition: "Very soft", category: "dynamics", level: "medium" },
  { term: "Fortissimo (ff)", definition: "Very loud", category: "dynamics", level: "medium" },
  { term: "Dolce", definition: "Sweetly", category: "expression", level: "medium" },
  { term: "Cantabile", definition: "In a singing style", category: "expression", level: "medium" },
  { term: "Espressivo", definition: "Expressively", category: "expression", level: "medium" },
  { term: "Accelerando (accel.)", definition: "Gradually speeding up", category: "tempo", level: "medium" },
  { term: "A tempo", definition: "Return to the original tempo", category: "tempo", level: "medium" },
  { term: "Dal Segno (D.S.)", definition: "Repeat from the sign", category: "form", level: "medium" },
  { term: "Coda", definition: "A concluding section", category: "form", level: "medium" },
  { term: "Tenuto", definition: "Hold the note for its full value", category: "articulation", level: "medium" },
  { term: "Sforzando (sfz)", definition: "Sudden, strong accent", category: "dynamics", level: "medium" },
  { term: "Grazioso", definition: "Gracefully", category: "expression", level: "medium" },
  { term: "Maestoso", definition: "Majestic and stately", category: "expression", level: "medium" },
  { term: "Semitone", definition: "The smallest interval on the keyboard", category: "theory", level: "medium" },
  { term: "Octave", definition: "The interval of 8 notes (e.g. C to C)", category: "theory", level: "medium" },
  // Hard
  { term: "Largo", definition: "Very slow and broad", category: "tempo", level: "hard" },
  { term: "Grave", definition: "Slow and solemn", category: "tempo", level: "hard" },
  { term: "Prestissimo", definition: "As fast as possible", category: "tempo", level: "hard" },
  { term: "Allegretto", definition: "Moderately fast (slightly slower than allegro)", category: "tempo", level: "hard" },
  { term: "Tranquillo", definition: "Quietly and calmly", category: "expression", level: "hard" },
  { term: "Agitato", definition: "Agitated and restless", category: "expression", level: "hard" },
  { term: "Con brio", definition: "With vigor", category: "expression", level: "hard" },
  { term: "Giocoso", definition: "Playfully and humorously", category: "expression", level: "hard" },
  { term: "Rubato", definition: "With freedom of tempo", category: "tempo", level: "hard" },
  { term: "Marcato", definition: "Strongly accented", category: "articulation", level: "hard" },
  { term: "Enharmonic", definition: "Same pitch, different name (e.g. C♯ = D♭)", category: "theory", level: "hard" },
  { term: "Homophonic", definition: "One melody with harmonic accompaniment", category: "theory", level: "hard" },
  { term: "Polyphonic", definition: "Multiple independent melodic lines", category: "theory", level: "hard" },
  { term: "Monophonic", definition: "A single unaccompanied melody", category: "theory", level: "hard" },
  { term: "Con moto", definition: "With motion", category: "expression", level: "hard" },
  { term: "Subito", definition: "Suddenly (e.g. subito piano = suddenly soft)", category: "dynamics", level: "hard" },
  { term: "Ritenuto (riten.)", definition: "Immediately slower", category: "tempo", level: "hard" },
  { term: "Sostenuto", definition: "Sustained, held back", category: "expression", level: "hard" },
];

interface TermQ { term: Term; choices: string[]; correct: string; }

function makeTermQ(pool: Term[]): TermQ {
  const t = pool[Math.floor(Math.random() * pool.length)];
  const others = pool.filter(x => x.definition !== t.definition);
  const wrongs = shuffle(others).slice(0, 3).map(x => x.definition);
  return { term: t, correct: t.definition, choices: shuffle([t.definition, ...wrongs]) };
}

function MusicTermsGame({ onBack }: { onBack: () => void }) {
  const { t: tr } = useI18n();
  type Diff = "easy" | "medium" | "hard";
  const [diff, setDiff] = useState<Diff>("easy");
  const game = useGameState(`terms_${diff}`);
  const [q, setQ] = useState<TermQ>(() => makeTermQ(TERMS.filter(t => t.level === "easy")));

  function start() {
    game.beginCountdown(() => {
      const p = TERMS.filter(t => t.level === diff || (diff !== "easy" && t.level === "easy") || (diff === "hard" && t.level === "medium"));
      setQ(makeTermQ(p));
      game.beginPlay();
    });
  }

  function answer(def: string) {
    const ok = def === q.correct;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => {
      const p = TERMS.filter(t => t.level === diff || (diff !== "easy" && t.level === "easy") || (diff === "hard" && t.level === "medium"));
      setQ(makeTermQ(p));
    });
  }

  if (game.gs === "idle") {
    return (
      <IdleCard
        title="Music Terms"
        hiScore={game.hiScore}
        description="A term flashes — pick its definition as fast as you can. 30 seconds, streak multipliers."
        extras={
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.625rem", textAlign: "center" }}>Difficulty</div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              {(["easy", "medium", "hard"] as Diff[]).map(d => (
                <button key={d} onClick={() => setDiff(d)} style={{ padding: "0.5rem 0.875rem", borderRadius: 20, cursor: "pointer", background: diff === d ? "#4CAF84" : "transparent", border: `1.5px solid ${diff === d ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: diff === d ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: diff === d ? 600 : 400, transition: "all 0.15s" }}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
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
    return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel={`terms · ${diff}`} onPlayAgain={start} onMenu={onBack} />;
  }

  const isCorrect = game.selected === q.correct;
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>
        <Popups entries={game.popups} />
        <div style={{ maxWidth: 400, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "0.5rem", fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>{q.term.category}</div>
          <div style={{ textAlign: "center", marginBottom: "2rem", fontSize: "1.75rem", fontWeight: 700, color: "#FDFCFA", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{q.term.term}</div>

          {game.selected && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem", fontSize: "1rem", fontWeight: 600, color: isCorrect ? "#4CAF84" : "#E05252" }}>
              {isCorrect ? (game.streak >= 5 ? tr.student.inARow.replace("{n}", String(game.streak)) : tr.student.correctFeedback) : `"${q.correct}"`}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {q.choices.map(c => {
              const isSelected = game.selected === c;
              const isRight = c === q.correct;
              let bg = "rgba(255,255,255,0.06)", border = "1px solid rgba(255,255,255,0.1)", color = "#FDFCFA";
              if (game.selected) {
                if (isRight) { bg = "rgba(76,175,132,0.2)"; border = "1.5px solid #4CAF84"; color = "#4CAF84"; }
                else if (isSelected) { bg = "rgba(224,82,82,0.2)"; border = "1.5px solid #E05252"; color = "#E05252"; }
                else { bg = "rgba(255,255,255,0.03)"; border = "1px solid rgba(255,255,255,0.05)"; color = "rgba(255,255,255,0.25)"; }
              }
              return (
                <button key={c} onClick={() => answer(c)} disabled={!!game.selected}
                  style={{ padding: "0.875rem 1rem", borderRadius: 10, border, background: bg, color, fontFamily: "Inter, sans-serif", fontSize: "0.875rem", cursor: game.selected ? "default" : "pointer", transition: "all 0.1s", textAlign: "left", lineHeight: 1.4 }}>
                  {c}
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
// Game 5: Key Signatures
// ─────────────────────────────────────────────────────────────────────────────

interface KeySig { name: string; sharps: number; flats: number; relativeMajor?: string; }

const KEY_SIGS: KeySig[] = [
  { name: "C major",  sharps: 0, flats: 0 },
  { name: "G major",  sharps: 1, flats: 0 },
  { name: "D major",  sharps: 2, flats: 0 },
  { name: "A major",  sharps: 3, flats: 0 },
  { name: "E major",  sharps: 4, flats: 0 },
  { name: "B major",  sharps: 5, flats: 0 },
  { name: "F♯ major", sharps: 6, flats: 0 },
  { name: "C♯ major", sharps: 7, flats: 0 },
  { name: "F major",  sharps: 0, flats: 1 },
  { name: "B♭ major", sharps: 0, flats: 2 },
  { name: "E♭ major", sharps: 0, flats: 3 },
  { name: "A♭ major", sharps: 0, flats: 4 },
  { name: "D♭ major", sharps: 0, flats: 5 },
  { name: "G♭ major", sharps: 0, flats: 6 },
  { name: "C♭ major", sharps: 0, flats: 7 },
];

// Relative minor names (parallel to KEY_SIGS)
const RELATIVE_MINORS = ["A minor","E minor","B minor","F♯ minor","C♯ minor","G♯ minor","D♯ minor","A♯ minor","D minor","G minor","C minor","F minor","B♭ minor","E♭ minor","A♭ minor"];

interface KeySigQ { key: KeySig; relMinor: string; choices: string[]; correct: string; askRelative: boolean; }

function makeKeySigQ(pool: KeySig[], askRelative: boolean): KeySigQ {
  const key = pool[Math.floor(Math.random() * pool.length)];
  const idx = KEY_SIGS.findIndex(k => k.name === key.name);
  const relMinor = RELATIVE_MINORS[idx];
  const correct = askRelative ? relMinor : key.name;
  const allOptions = askRelative ? RELATIVE_MINORS : KEY_SIGS.map(k => k.name);
  const wrongs = shuffle(allOptions.filter(n => n !== correct)).slice(0, 3);
  return { key, relMinor, choices: shuffle([correct, ...wrongs]), correct, askRelative };
}

function KeySigVisual({ sharps, flats }: { sharps: number; flats: number }) {
  if (sharps === 0 && flats === 0) {
    return (
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <div style={{ fontSize: "1rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>NO SHARPS OR FLATS</div>
        <div style={{ fontSize: "3rem", color: "#FDFCFA", letterSpacing: "0.1em" }}>♩</div>
      </div>
    );
  }
  const symbol = sharps > 0 ? "♯" : "♭";
  const count = sharps > 0 ? sharps : flats;
  return (
    <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
      <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.75rem" }}>
        {count} {sharps > 0 ? "SHARP" : "FLAT"}{count > 1 ? "S" : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.125rem" }}>
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} style={{ fontSize: "3rem", color: "#FDFCFA", fontFamily: "'Times New Roman', Georgia, serif", lineHeight: 1 }}>{symbol}</span>
        ))}
      </div>
    </div>
  );
}

function KeySigGame({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  type Mode = "major" | "relative";
  type KSDiff = "beginner" | "advanced";
  const [mode, setMode] = useState<Mode>("major");
  const [ksDiff, setKsDiff] = useState<KSDiff>("beginner");
  const pool = ksDiff === "beginner" ? KEY_SIGS.filter(k => k.sharps <= 4 && k.flats <= 4) : KEY_SIGS;
  const askRelative = mode === "relative";
  const game = useGameState(`keysig_${mode}_${ksDiff}`);
  const [q, setQ] = useState<KeySigQ>(() => makeKeySigQ(KEY_SIGS.filter(k => k.sharps <= 4 && k.flats <= 4), false));

  function start() {
    game.beginCountdown(() => {
      setQ(makeKeySigQ(pool, askRelative));
      game.beginPlay();
    });
  }

  function answer(choice: string) {
    const ok = choice === q.correct;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => setQ(makeKeySigQ(pool, askRelative)));
  }

  if (game.gs === "idle") {
    return (
      <IdleCard
        title="Key Signatures"
        hiScore={game.hiScore}
        description="See a key signature — identify the major key (or its relative minor). Essential for RCM exams."
        extras={
          <>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.625rem", textAlign: "center" }}>Question type</div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                {(["major", "relative"] as Mode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{ padding: "0.5rem 1rem", borderRadius: 20, cursor: "pointer", background: mode === m ? "#4CAF84" : "transparent", border: `1.5px solid ${mode === m ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: mode === m ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: mode === m ? 600 : 400, transition: "all 0.15s" }}>
                    {m === "major" ? "Major key" : "Relative minor"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.625rem", textAlign: "center" }}>Range</div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                {(["beginner", "advanced"] as KSDiff[]).map(d => (
                  <button key={d} onClick={() => setKsDiff(d)} style={{ padding: "0.5rem 1rem", borderRadius: 20, cursor: "pointer", background: ksDiff === d ? "#4CAF84" : "transparent", border: `1.5px solid ${ksDiff === d ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: ksDiff === d ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: ksDiff === d ? 600 : 400, transition: "all 0.15s" }}>
                    {d === "beginner" ? "Up to 4 ♯/♭" : "All 15 keys"}
                  </button>
                ))}
              </div>
            </div>
          </>
        }
        onStart={start}
      />
    );
  }
  if (game.gs === "countdown") return <CountdownScreen n={game.countdown} />;
  if (game.gs === "results") {
    return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel={`key signatures · ${mode}`} onPlayAgain={start} onMenu={onBack} />;
  }

  const isCorrect = game.selected === q.correct;
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>
        <Popups entries={game.popups} />
        <div style={{ maxWidth: 400, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {q.askRelative ? "What is the relative minor?" : "What major key is this?"}
          </div>
          <KeySigVisual sharps={q.key.sharps} flats={q.key.flats} />

          {game.selected && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem", fontSize: "1rem", fontWeight: 600, color: isCorrect ? "#4CAF84" : "#E05252" }}>
              {isCorrect ? (game.streak >= 5 ? t.student.inARow.replace("{n}", String(game.streak)) : t.student.correctFeedback) : `It's ${q.correct}`}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
            {q.choices.map(c => {
              const isSelected = game.selected === c;
              const isRight = c === q.correct;
              let bg = "rgba(255,255,255,0.06)", border = "1px solid rgba(255,255,255,0.1)", color = "#FDFCFA";
              if (game.selected) {
                if (isRight) { bg = "rgba(76,175,132,0.2)"; border = "1.5px solid #4CAF84"; color = "#4CAF84"; }
                else if (isSelected) { bg = "rgba(224,82,82,0.2)"; border = "1.5px solid #E05252"; color = "#E05252"; }
                else { bg = "rgba(255,255,255,0.03)"; border = "1px solid rgba(255,255,255,0.05)"; color = "rgba(255,255,255,0.25)"; }
              }
              return (
                <button key={c} onClick={() => answer(c)} disabled={!!game.selected}
                  style={{ padding: "1rem 0.5rem", borderRadius: 10, border, background: bg, color, fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", cursor: game.selected ? "default" : "pointer", transition: "all 0.1s", textAlign: "center" }}>
                  {c}
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
// Game 6: Scale Ear Training
// ─────────────────────────────────────────────────────────────────────────────

type ScaleType = "Major" | "Natural Minor" | "Harmonic Minor" | "Melodic Minor";

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  "Major":          [0, 2, 4, 5, 7, 9, 11, 12],
  "Natural Minor":  [0, 2, 3, 5, 7, 8, 10, 12],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11, 12],
  "Melodic Minor":  [0, 2, 3, 5, 7, 9, 11, 12],
};

const SCALE_ICONS: Record<ScaleType, string> = {
  "Major": "☀", "Natural Minor": "🌙", "Harmonic Minor": "✦", "Melodic Minor": "♪",
};

const MIDI_TO_HZ = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function playScale(scaleType: ScaleType, ctx: AudioContext) {
  const root = 60 + Math.floor(Math.random() * 5); // C4–E4
  const intervals = SCALE_INTERVALS[scaleType];
  // ascending
  intervals.forEach((semi, i) => {
    playTone(MIDI_TO_HZ(root + semi), ctx, ctx.currentTime + i * 0.28, 0.5);
  });
  // then descending
  const descStart = intervals.length * 0.28 + 0.15;
  [...intervals].reverse().forEach((semi, i) => {
    playTone(MIDI_TO_HZ(root + semi), ctx, ctx.currentTime + descStart + i * 0.28, 0.5);
  });
}

interface ScaleQ { scaleType: ScaleType; choices: ScaleType[]; }

function makeScaleQ(pool: ScaleType[]): ScaleQ {
  const scaleType = pool[Math.floor(Math.random() * pool.length)];
  const wrongs = shuffle(pool.filter(s => s !== scaleType)).slice(0, 3) as ScaleType[];
  return { scaleType, choices: shuffle([scaleType, ...wrongs]) as ScaleType[] };
}

function ScaleGame({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  type SDiff = "easy" | "medium" | "hard";
  const POOL_BY_DIFF: Record<SDiff, ScaleType[]> = {
    easy:   ["Major", "Natural Minor"],
    medium: ["Major", "Natural Minor", "Harmonic Minor"],
    hard:   ["Major", "Natural Minor", "Harmonic Minor", "Melodic Minor"],
  };
  const [diff, setDiff] = useState<SDiff>("easy");
  const game = useGameState(`scale_${diff}`);
  const [q, setQ] = useState<ScaleQ>(() => makeScaleQ(["Major", "Natural Minor"]));
  const [played, setPlayed] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  function getCtx() {
    if (!audioRef.current || audioRef.current.state === "closed") {
      audioRef.current = new AudioContext();
    }
    return audioRef.current;
  }

  function play(st: ScaleType) {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    playScale(st, ctx);
    setPlayed(true);
  }

  function start() {
    game.beginCountdown(() => {
      const newQ = makeScaleQ(POOL_BY_DIFF[diff]);
      setQ(newQ);
      setPlayed(false);
      game.beginPlay();
      // auto-play after short delay
      setTimeout(() => {
        try { const ctx = getCtx(); if (ctx.state === "suspended") ctx.resume(); playScale(newQ.scaleType, ctx); setPlayed(true); } catch { /* ignore */ }
      }, 400);
    });
  }

  function answer(st: ScaleType) {
    if (!played) return;
    const ok = st === q.scaleType;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => {
      const newQ = makeScaleQ(POOL_BY_DIFF[diff]);
      setQ(newQ);
      setPlayed(false);
      setTimeout(() => {
        try { const ctx = getCtx(); if (ctx.state === "suspended") ctx.resume(); playScale(newQ.scaleType, ctx); setPlayed(true); } catch { /* ignore */ }
      }, 600);
    });
  }

  if (game.gs === "idle") {
    return (
      <IdleCard
        title="Scale Ear Training"
        hiScore={game.hiScore}
        description="A scale plays ascending and descending — identify whether it's major, natural minor, harmonic minor, or melodic minor."
        extras={
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.625rem", textAlign: "center" }}>Difficulty · RCM level</div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              {(["easy", "medium", "hard"] as SDiff[]).map(d => (
                <button key={d} onClick={() => setDiff(d)} style={{ padding: "0.5rem 0.875rem", borderRadius: 20, cursor: "pointer", background: diff === d ? "#4CAF84" : "transparent", border: `1.5px solid ${diff === d ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: diff === d ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: diff === d ? 600 : 400, transition: "all 0.15s" }}>
                  {d === "easy" ? "Major & Minor" : d === "medium" ? "+ Harmonic" : "All 4 Types"}<br/>
                  <span style={{ fontSize: "0.5625rem", opacity: 0.7 }}>{d === "easy" ? "Prep–Gr.3" : d === "medium" ? "Gr.4–6" : "Gr.7–8"}</span>
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
    return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel={`scales · ${diff}`} onPlayAgain={start} onMenu={onBack} />;
  }

  const isCorrect = game.selected === q.scaleType;
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>
        <Popups entries={game.popups} />
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>What type of scale is this?</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}>
            <button onClick={() => play(q.scaleType)} style={{ width: 80, height: 80, borderRadius: "50%", border: "none", background: played ? "rgba(255,255,255,0.08)" : "#2980b9", color: "#fff", fontSize: "1.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: played ? "none" : "0 0 28px #2980b950", transition: "all 0.2s" }}>
              {played ? "↻" : "▶"}
            </button>
          </div>
          {played && !game.selected && <div style={{ textAlign: "center", marginBottom: "1rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>Tap to replay ↑</div>}

          {game.selected && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem", fontSize: "1rem", fontWeight: 600, color: isCorrect ? "#4CAF84" : "#E05252" }}>
              {isCorrect ? (game.streak >= 5 ? t.student.inARow.replace("{n}", String(game.streak)) : t.student.correctFeedback) : `It was ${q.scaleType}`}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
            {q.choices.map(c => {
              const isSelected = game.selected === c;
              const isRight = c === q.scaleType;
              let bg = "rgba(255,255,255,0.06)", border = "1px solid rgba(255,255,255,0.1)", color = "#FDFCFA";
              if (game.selected) {
                if (isRight) { bg = "rgba(76,175,132,0.2)"; border = "1.5px solid #4CAF84"; color = "#4CAF84"; }
                else if (isSelected) { bg = "rgba(224,82,82,0.2)"; border = "1.5px solid #E05252"; color = "#E05252"; }
                else { bg = "rgba(255,255,255,0.03)"; border = "1px solid rgba(255,255,255,0.05)"; color = "rgba(255,255,255,0.25)"; }
              }
              return (
                <button key={c} onClick={() => !played ? undefined : answer(c)} disabled={!!game.selected || !played}
                  style={{ padding: "1rem 0.5rem", borderRadius: 10, border, background: bg, color: !played ? "rgba(255,255,255,0.2)" : color, fontFamily: "Inter, sans-serif", fontWeight: 600, cursor: (game.selected || !played) ? "default" : "pointer", transition: "all 0.1s", textAlign: "center", opacity: !played ? 0.5 : 1 }}>
                  <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>{SCALE_ICONS[c as ScaleType]}</div>
                  <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>{c}</div>
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
// RCM Reference
// ─────────────────────────────────────────────────────────────────────────────

const RCM_LEVELS = [
  {
    level: "Preparatory",
    pieces: "2 pieces (Lists A & B) + 1 study/etude",
    technical: "5-finger warm-ups, C/G/D/F major scales HS, primary triads",
    ear: "Echo clapping, singing back 2–4 note patterns, major vs minor chords",
    theory: "None required",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 1",
    pieces: "3 pieces (Lists A, B, C) + 1 study",
    technical: "C, G, D, F major scales HS (1 octave); A natural minor HS",
    ear: "Intervals of 2nd–5th, major/minor chord ID, echo clapping",
    theory: "None required",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 2",
    pieces: "3 pieces + 1 study",
    technical: "C, G, D, A, E, F, B♭ major HS; A, D, E natural & harmonic minor HS",
    ear: "Intervals 2nd–6th, chord quality, melodic echo (3–4 notes)",
    theory: "None required",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 3",
    pieces: "3 pieces + 1 study",
    technical: "8 major scales HT (1–2 octaves); relative harmonic minor HT; arpeggios begin (HS)",
    ear: "All diatonic intervals, major/minor/diminished chords",
    theory: "Theory Prep A (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 4",
    pieces: "4 pieces (A, B, C + optional D) + 1 study",
    technical: "All 12 major scales HT (2 octaves); natural & harmonic minor HT; melodic minor begins; arpeggios HT",
    ear: "All intervals through octave, chord progressions I–IV–V",
    theory: "Theory Prep B (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 5",
    pieces: "4 pieces + 1 study",
    technical: "All major + all 3 forms of minor (natural, harmonic, melodic) HT; arpeggios 2 oct HT; chord progressions",
    ear: "All intervals, all chord qualities (+ augmented), short melodic dictation",
    theory: "Theory Level 1 (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 6",
    pieces: "4 pieces + 1 study",
    technical: "All scales 2 octaves, legato + staccato + rhythmic variations; broken chord patterns",
    ear: "All intervals, chord quality with inversions, chord progressions, melodic dictation",
    theory: "Theory Level 2 (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 7",
    pieces: "4 pieces + 1 study",
    technical: "4-octave scales begin for select keys; parallel + contrary motion; octave scales; broken chords",
    ear: "All intervals, all chord qualities, diatonic melody dictation (2 hearings)",
    theory: "Theory Level 3 (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 8",
    pieces: "4 pieces + 1 study",
    technical: "Full 4-octave scales; scales in thirds/sixths (select keys); chromatic scales; double notes",
    ear: "All intervals, chord quality (with inversions), harmonic progressions, melodic dictation",
    theory: "Theory Level 4 (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 9",
    pieces: "4 pieces + 1 study",
    technical: "Complete battery at advanced tempos; all scale types at speed",
    ear: "Advanced harmonic dictation, modulation recognition, two-voice elements",
    theory: "Advanced Rudiments (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "Level 10",
    pieces: "4 pieces (all 4 Lists required) + 1 study",
    technical: "Highest technical standard; all scales, arpeggios, technical tests at exam tempo",
    ear: "Two-voice dictation, modulation, non-chord tones, advanced harmonic analysis",
    theory: "Advanced Rudiments + Harmony or Counterpoint or History (co-requisite)",
    marks: "Pieces 64 · Technical 16 · Ear 10 · Sight Reading 10",
  },
  {
    level: "ARCT",
    pieces: "5+ pieces at concert-level standard (chosen from approved repertoire list)",
    technical: "Comprehensive technical exam at the highest level",
    ear: "Advanced: two-voice dictation, modulation, harmonic analysis",
    theory: "History 1 & 2 + Harmony + Counterpoint (all required)",
    marks: "Pieces ~70 · Technical ~15 · Ear ~15",
  },
];

function RCMReference({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState(0);
  const lvl = RCM_LEVELS[selected];

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1rem 1.5rem", flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--muted)", padding: 0, lineHeight: 1 }}>←</button>
          <div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", fontWeight: 500, color: "var(--charcoal)" }}>RCM Exam Requirements</div>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>Royal Conservatory of Music — Piano syllabus overview</p>
          </div>
        </div>
      </div>

      {/* Level selector */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", overflowX: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", padding: "0 1.5rem", gap: 0, minWidth: "max-content" }}>
          {RCM_LEVELS.map((l, i) => (
            <button key={l.level} onClick={() => setSelected(i)} style={{
              padding: "0.75rem 0.875rem", background: "none", border: "none",
              borderBottom: selected === i ? "2px solid var(--charcoal)" : "2px solid transparent",
              color: selected === i ? "var(--charcoal)" : "var(--muted)",
              fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: selected === i ? 600 : 400,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
            }}>
              {l.level}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "2rem 1.5rem", overflowY: "auto" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 500, color: "var(--charcoal)", margin: "0 0 1.5rem", letterSpacing: "-0.01em" }}>
            {lvl.level}
          </h2>

          {[
            { label: "Repertoire", value: lvl.pieces, icon: "🎵" },
            { label: "Technical Requirements", value: lvl.technical, icon: "🎹" },
            { label: "Ear Training", value: lvl.ear, icon: "👂" },
            { label: "Theory Co-requisite", value: lvl.theory, icon: "📚" },
            { label: "Mark Distribution", value: lvl.marks, icon: "📊" },
          ].map(row => (
            <div key={row.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.125rem 1.25rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.125rem", flexShrink: 0, marginTop: "0.125rem" }}>{row.icon}</span>
                <div>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.25rem" }}>{row.label}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--charcoal)", lineHeight: 1.6 }}>{row.value}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Passing marks info */}
          <div style={{ background: "rgba(74,103,185,0.06)", border: "1px solid rgba(74,103,185,0.15)", borderRadius: 8, padding: "1rem 1.25rem", marginTop: "0.5rem" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(74,103,185,0.7)", marginBottom: "0.5rem" }}>Passing Requirements</div>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {[["Pass", "60+"], ["Honours", "80+"], ["First Class Honours", "90+"]].map(([label, mark]) => (
                <div key={label}>
                  <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--charcoal)" }}>{mark}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1.5rem", padding: "0.875rem 1.125rem", background: "var(--cream-deep)", borderRadius: 6, fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.6 }}>
            <strong>Note:</strong> Piece lists and technical requirements are updated annually. Always confirm current requirements at{" "}
            <a href="https://rcmusic.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--charcoal)" }}>rcmusic.com</a>.
            For personalized guidance, ask the AI Tutor.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game: Guitar Fretboard
// ─────────────────────────────────────────────────────────────────────────────
const FRET_OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
const NOTE_NAMES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTE_NAMES_NATURAL = ["C","D","E","F","G","A","B"];

function fretNoteName(str: number, fret: number) {
  return NOTE_NAMES_SHARP[(FRET_OPEN_MIDI[str] + fret) % 12];
}

const STRING_LABELS = ["E","A","D","G","B","e"];

type FretLevel = "beginner" | "intermediate" | "advanced";
const FRET_LEVELS: Record<FretLevel, { frets: number[]; naturalOnly: boolean; label: string; desc: string }> = {
  beginner:     { frets: [0,1,2,3,4,5],    naturalOnly: true,  label: "Beginner",     desc: "Open strings & frets 1–5, natural notes only" },
  intermediate: { frets: [0,1,2,3,4,5,6,7], naturalOnly: false, label: "Intermediate", desc: "Frets 0–7, includes sharps" },
  advanced:     { frets: Array.from({length: 13}, (_,i) => i), naturalOnly: false, label: "Advanced", desc: "Full neck frets 0–12" },
};

function FretboardSVG({ highlightStr, highlightFret, maxFret = 12 }: { highlightStr: number; highlightFret: number; maxFret?: number }) {
  const fretCount = Math.min(maxFret, 12);
  const W = 300, strSpacing = 16, fretSpacing = (W - 60) / fretCount;
  const H = 5 * strSpacing + 40;
  const nutX = 44;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* String labels */}
      {STRING_LABELS.map((l, s) => (
        <text key={s} x={16} y={20 + s * strSpacing + 4} fontSize={9} fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.5)" textAnchor="middle">{l}</text>
      ))}
      {/* Fret numbers */}
      {Array.from({length: fretCount}, (_,f) => f + 1).map(f => (
        <text key={f} x={nutX + (f - 0.5) * fretSpacing} y={H - 4} fontSize={8} fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.3)" textAnchor="middle">{f}</text>
      ))}
      {/* Nut */}
      <line x1={nutX} y1={20} x2={nutX} y2={20 + 5 * strSpacing} stroke="rgba(255,255,255,0.7)" strokeWidth={3} />
      {/* Fret lines */}
      {Array.from({length: fretCount}, (_,f) => f + 1).map(f => (
        <line key={f} x1={nutX + f * fretSpacing} y1={20} x2={nutX + f * fretSpacing} y2={20 + 5 * strSpacing} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
      ))}
      {/* Strings */}
      {[0,1,2,3,4,5].map(s => (
        <line key={s} x1={nutX} y1={20 + s * strSpacing} x2={nutX + fretCount * fretSpacing} y2={20 + s * strSpacing} stroke="rgba(255,255,255,0.5)" strokeWidth={s < 2 ? 2 : s < 4 ? 1.5 : 1} />
      ))}
      {/* Fretboard markers (3, 5, 7, 9, 12) */}
      {[3,5,7,9].filter(f => f <= fretCount).map(f => (
        <circle key={f} cx={nutX + (f - 0.5) * fretSpacing} cy={20 + 2.5 * strSpacing} r={3} fill="rgba(255,255,255,0.12)" />
      ))}
      {/* Highlight */}
      {highlightFret === 0 ? (
        <circle cx={nutX - 14} cy={20 + highlightStr * strSpacing} r={7} fill="#4CAF84" />
      ) : (
        <circle cx={nutX + (highlightFret - 0.5) * fretSpacing} cy={20 + highlightStr * strSpacing} r={7} fill="#4CAF84" />
      )}
    </svg>
  );
}

function makeFretQ(level: FretLevel) {
  const { frets, naturalOnly } = FRET_LEVELS[level];
  let str: number, fret: number, name: string;
  let attempts = 0;
  do {
    str  = Math.floor(Math.random() * 6);
    fret = frets[Math.floor(Math.random() * frets.length)];
    name = fretNoteName(str, fret);
    attempts++;
  } while (naturalOnly && name.includes("#") && attempts < 30);
  const correct = name.replace("#", "♯");
  const allNames = naturalOnly
    ? NOTE_NAMES_NATURAL.map(n => n)
    : NOTE_NAMES_SHARP.map(n => n.replace("#", "♯"));
  const wrongs = shuffle(allNames.filter(n => n !== correct)).slice(0, 3);
  return { str, fret, correct, choices: shuffle([correct, ...wrongs]) };
}

function FretboardGame({ onBack }: { onBack: () => void }) {
  const [level, setLevel] = useState<FretLevel>("beginner");
  const [q, setQ]         = useState(() => makeFretQ("beginner"));
  const gk   = `fret_${level}`;
  const game = useGameState(gk);

  useEffect(() => { game.loadHi(); }, [level]); // eslint-disable-line

  function start() {
    game.loadHi();
    game.beginCountdown(() => { setQ(makeFretQ(level)); game.beginPlay(); });
  }
  function answer(c: string) {
    if (game.selected || game.gs !== "playing") return;
    game.setSelected(c);
    const ok = c === q.correct;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => setQ(makeFretQ(level)));
  }

  if (game.gs === "results") return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel="Fretboard" onPlayAgain={start} onMenu={onBack} />;
  if (game.gs === "countdown") return <CountdownScreen n={game.countdown} />;

  if (game.gs === "idle") return (
    <IdleCard title="Fretboard Challenge" hiScore={game.hiScore}
      description="A position lights up on the neck — name the note. 30s rounds, streak multipliers."
      extras={
        <>
          <div style={{ background: "#252537", borderRadius: 12, padding: "1rem 0.75rem", marginBottom: "1.25rem", overflowX: "auto", display: "flex", justifyContent: "center" }}>
            <FretboardSVG highlightStr={2} highlightFret={3} maxFret={7} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {(Object.keys(FRET_LEVELS) as FretLevel[]).map(lv => (
              <button key={lv} onClick={() => setLevel(lv)} style={{ padding: "0.4rem 0.875rem", borderRadius: 20, cursor: "pointer", background: level === lv ? "#4CAF84" : "transparent", border: `1.5px solid ${level === lv ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: level === lv ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: level === lv ? 600 : 400, transition: "all 0.15s" }}>
                {FRET_LEVELS[lv].label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginBottom: "0", lineHeight: 1.6, textAlign: "center" }}>{FRET_LEVELS[level].desc}</p>
        </>
      }
      onStart={start}
    />
  );

  const maxFret = level === "beginner" ? 5 : level === "intermediate" ? 7 : 12;
  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", position: "relative" }}>
      <TopBar onBack={onBack} label="Fretboard Challenge" />
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <Popups entries={game.popups} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.25rem", gap: "1.25rem" }}>
        <div style={{ background: "#252537", borderRadius: 12, padding: "1rem 0.75rem", overflowX: "auto", display: "flex", justifyContent: "center", width: "100%", maxWidth: 360 }}>
          <FretboardSVG highlightStr={q.str} highlightFret={q.fret} maxFret={maxFret} />
        </div>
        <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.4)", margin: 0, letterSpacing: "0.04em" }}>
          String <strong style={{ color: "rgba(255,255,255,0.7)" }}>{STRING_LABELS[q.str]}</strong> · Fret <strong style={{ color: "rgba(255,255,255,0.7)" }}>{q.fret === 0 ? "Open" : q.fret}</strong>
        </p>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <AnswerGrid choices={q.choices} selected={game.selected} correct={q.correct} onAnswer={answer} columns={q.choices.length <= 4 ? 2 : 3} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game: Guitar Chord Finder
// ─────────────────────────────────────────────────────────────────────────────
// frets: array of 6 (low-E to high-e): -1=muted, 0=open, N=fret N
// barre: optional { fret, fromStr, toStr }
type ChordDiagram = { name: string; frets: number[]; startFret?: number };

const GUITAR_CHORDS_BEGINNER: ChordDiagram[] = [
  { name: "Em",  frets: [0,2,2,0,0,0] },
  { name: "Am",  frets: [-1,0,2,2,1,0] },
  { name: "E",   frets: [0,2,2,1,0,0] },
  { name: "A",   frets: [-1,0,2,2,2,0] },
  { name: "D",   frets: [-1,-1,0,2,3,2] },
  { name: "Dm",  frets: [-1,-1,0,2,3,1] },
  { name: "G",   frets: [3,2,0,0,0,3] },
  { name: "C",   frets: [-1,3,2,0,1,0] },
];
const GUITAR_CHORDS_INTERMEDIATE: ChordDiagram[] = [
  ...GUITAR_CHORDS_BEGINNER,
  { name: "B7",   frets: [-1,2,1,2,0,2] },
  { name: "A7",   frets: [-1,0,2,0,2,0] },
  { name: "E7",   frets: [0,2,0,1,0,0] },
  { name: "D7",   frets: [-1,-1,0,2,1,2] },
  { name: "G7",   frets: [3,2,0,0,0,1] },
  { name: "Cadd9",frets: [-1,3,2,0,3,3] },
  { name: "Dsus2",frets: [-1,-1,0,2,3,0] },
  { name: "Asus2",frets: [-1,0,2,2,0,0] },
];
const GUITAR_CHORDS_ADVANCED: ChordDiagram[] = [
  ...GUITAR_CHORDS_INTERMEDIATE,
  { name: "F",    frets: [1,3,3,2,1,1], startFret: 1 },
  { name: "Bm",   frets: [-1,2,4,4,3,2], startFret: 2 },
  { name: "F#m",  frets: [-1,-1,4,6,7,5], startFret: 4 },
  { name: "Bb",   frets: [-1,1,3,3,3,1], startFret: 1 },
  { name: "Cm",   frets: [-1,3,5,5,4,3], startFret: 3 },
];

type ChordFinderLevel = "beginner" | "intermediate" | "advanced";
const CHORD_FINDER_POOLS: Record<ChordFinderLevel, ChordDiagram[]> = {
  beginner: GUITAR_CHORDS_BEGINNER,
  intermediate: GUITAR_CHORDS_INTERMEDIATE,
  advanced: GUITAR_CHORDS_ADVANCED,
};

function ChordDiagramSVG({ chord, dim = false }: { chord: ChordDiagram; dim?: boolean }) {
  const sf = chord.startFret ?? 1;
  const FRETS = 5, STRINGS = 6;
  const W = 80, H = 90;
  const strGap = (W - 20) / (STRINGS - 1);
  const fretGap = (H - 32) / FRETS;
  const topY = 22, leftX = 10;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", opacity: dim ? 0.4 : 1 }}>
      {/* String labels (X/O) */}
      {chord.frets.map((f, s) => (
        <text key={s} x={leftX + s * strGap} y={13} fontSize={8} fontFamily="Inter, sans-serif"
          fill={f === -1 ? "#E05252" : f === 0 ? "#4CAF84" : "transparent"} textAnchor="middle" fontWeight={700}>
          {f === -1 ? "×" : f === 0 ? "○" : ""}
        </text>
      ))}
      {/* Nut or start fret indicator */}
      {sf === 1 ? (
        <line x1={leftX} y1={topY} x2={leftX + (STRINGS-1)*strGap} y2={topY} stroke="rgba(255,255,255,0.7)" strokeWidth={3} />
      ) : (
        <text x={leftX + (STRINGS - 1) * strGap + 6} y={topY + fretGap * 0.5 + 4} fontSize={8} fill="rgba(255,255,255,0.5)" fontFamily="Inter, sans-serif">{sf}fr</text>
      )}
      {/* Fret lines */}
      {Array.from({length: FRETS}, (_,f) => f).map(f => (
        <line key={f} x1={leftX} y1={topY + f * fretGap} x2={leftX + (STRINGS-1)*strGap} y2={topY + f * fretGap} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      ))}
      {/* String lines */}
      {Array.from({length: STRINGS}, (_,s) => s).map(s => (
        <line key={s} x1={leftX + s * strGap} y1={topY} x2={leftX + s * strGap} y2={topY + FRETS * fretGap} stroke="rgba(255,255,255,0.45)" strokeWidth={s === 0 || s === 5 ? 1.5 : 1} />
      ))}
      {/* Finger dots */}
      {chord.frets.map((f, s) => {
        if (f <= 0) return null;
        const cy = topY + (f - sf + 0.5) * fretGap;
        const cx = leftX + s * strGap;
        return <circle key={s} cx={cx} cy={cy} r={6} fill="rgba(255,255,255,0.9)" />;
      })}
    </svg>
  );
}

function makeChordFinderQ(level: ChordFinderLevel) {
  const pool   = CHORD_FINDER_POOLS[level];
  const target = pool[Math.floor(Math.random() * pool.length)];
  const wrongs = shuffle(pool.filter(c => c.name !== target.name)).slice(0, 3);
  const allChoices = shuffle([target, ...wrongs]);
  return { target, choices: allChoices };
}

function GuitarChordGame({ onBack }: { onBack: () => void }) {
  const [level, setLevel] = useState<ChordFinderLevel>("beginner");
  const [q, setQ]         = useState(() => makeChordFinderQ("beginner"));
  const gk   = `chord_finder_${level}`;
  const game = useGameState(gk);

  useEffect(() => { game.loadHi(); }, [level]); // eslint-disable-line

  function start() {
    game.loadHi();
    game.beginCountdown(() => { setQ(makeChordFinderQ(level)); game.beginPlay(); });
  }
  function answer(name: string) {
    if (game.selected || game.gs !== "playing") return;
    game.setSelected(name);
    const ok = name === q.target.name;
    game.scoreAnswer(ok);
    game.scheduleNext(ok, () => setQ(makeChordFinderQ(level)));
  }

  if (game.gs === "results") return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel="Guitar Chords" onPlayAgain={start} onMenu={onBack} />;
  if (game.gs === "countdown") return <CountdownScreen n={game.countdown} />;

  if (game.gs === "idle") return (
    <IdleCard title="Guitar Chord Finder" hiScore={game.hiScore}
      description="A chord diagram appears — identify it as fast as possible. Includes all common open chords and barre chords."
      extras={
        <>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {(["beginner","intermediate","advanced"] as ChordFinderLevel[]).map(lv => (
              <button key={lv} onClick={() => setLevel(lv)} style={{ padding: "0.4rem 0.875rem", borderRadius: 20, cursor: "pointer", background: level === lv ? "#4CAF84" : "transparent", border: `1.5px solid ${level === lv ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: level === lv ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: level === lv ? 600 : 400, transition: "all 0.15s" }}>
                {lv.charAt(0).toUpperCase() + lv.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "1.5rem" }}>
            {GUITAR_CHORDS_BEGINNER.slice(0, 4).map(c => (
              <div key={c.name} style={{ textAlign: "center" }}>
                <ChordDiagramSVG chord={c} />
                <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{c.name}</div>
              </div>
            ))}
          </div>
        </>
      }
      onStart={start}
    />
  );

  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", position: "relative" }}>
      <TopBar onBack={onBack} label="Guitar Chord Finder" />
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <Popups entries={game.popups} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.25rem 1rem", gap: "1.25rem" }}>
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Name this chord</p>
        <div style={{ background: "#252537", borderRadius: 14, padding: "1.25rem 2rem", display: "flex", justifyContent: "center" }}>
          <ChordDiagramSVG chord={q.target} />
        </div>
        {/* 2×2 name buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem", width: "100%", maxWidth: 320 }}>
          {q.choices.map(c => {
            const isSelected = game.selected === c.name;
            const isRight    = c.name === q.target.name;
            let bg = "rgba(255,255,255,0.06)", border = "1px solid rgba(255,255,255,0.1)", color = "#FDFCFA";
            if (game.selected) {
              if (isRight)    { bg = "rgba(76,175,132,0.2)"; border = "1.5px solid #4CAF84"; color = "#4CAF84"; }
              else if (isSelected) { bg = "rgba(224,82,82,0.2)"; border = "1.5px solid #E05252"; color = "#E05252"; }
              else { bg = "rgba(255,255,255,0.03)"; border = "1px solid rgba(255,255,255,0.05)"; color = "rgba(255,255,255,0.25)"; }
            }
            return (
              <button key={c.name} onClick={() => answer(c.name)} disabled={!!game.selected}
                style={{ padding: "0.875rem 0.5rem", borderRadius: 10, border, background: bg, color, fontSize: "1.125rem", fontFamily: "Inter, sans-serif", fontWeight: 700, cursor: game.selected ? "default" : "pointer", transition: "all 0.1s", textAlign: "center" }}>
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game: Rhythm Echo (hear + tap back)
// ─────────────────────────────────────────────────────────────────────────────
const RHYTHM_BPM  = 80;
const BEAT_MS     = (60 / RHYTHM_BPM) * 1000;   // 750 ms per quarter note
const SIXTEENTH_MS = BEAT_MS / 4;                 // 187.5 ms per 16th note
const COUNT_IN    = 2;                             // quarter-note count-in beats

type RhythmPattern = { label: string; beats: number[] }; // beats: 16th-note onset positions

const RHYTHMS_LEVEL1: RhythmPattern[] = [
  { label: "♩ ♩ ♩ ♩",       beats: [0, 4, 8, 12] },
  { label: "♩♩ ♩ ♩",        beats: [0, 2, 4, 8] },
  { label: "♩ ♩ ♩♩",        beats: [0, 4, 8, 10] },
  { label: "♩♩♩ ♩",         beats: [0, 2, 4, 8] },
];
const RHYTHMS_LEVEL2: RhythmPattern[] = [
  ...RHYTHMS_LEVEL1,
  { label: "♩. ♪ ♩♩",       beats: [0, 6, 8, 12, 14] },
  { label: "♪♪♩ ♩ ♩",       beats: [0, 2, 4, 8, 12] },
  { label: "♩ ♩♪♪ ♩",       beats: [0, 4, 8, 10, 12] },
  { label: "♩♩♩♩♩♩♩♩",      beats: [0,2,4,6,8,10,12,14] },
];
const RHYTHMS_LEVEL3: RhythmPattern[] = [
  ...RHYTHMS_LEVEL2,
  { label: "♩. ♪♩. ♪",      beats: [0, 6, 8, 14] },
  { label: "♪♩♪♩♪♩♪",       beats: [0, 2, 4, 6, 8, 10, 12] },
  { label: "♩♩. ♪♩♪♪",      beats: [0, 4, 6, 8, 12, 14] },
  { label: "♩♪♪♩. ♪♩",      beats: [0, 4, 6, 8, 12, 14] },
];

type RhythmLevel = "level1" | "level2" | "level3";
const RHYTHM_POOLS: Record<RhythmLevel, RhythmPattern[]> = {
  level1: RHYTHMS_LEVEL1, level2: RHYTHMS_LEVEL2, level3: RHYTHMS_LEVEL3,
};
const RHYTHM_LEVEL_LABELS: Record<RhythmLevel, string> = {
  level1: "⭐ Easy", level2: "⭐⭐ Medium", level3: "⭐⭐⭐ Hard",
};

// Metronome tick: ultra-short triangle wave — sounds like a real woodblock tick
function playTick(ctx: AudioContext, time: number, accent: boolean) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type  = "triangle";
  osc.connect(g); g.connect(ctx.destination);
  osc.frequency.value = accent ? 1800 : 1100;
  g.gain.setValueAtTime(accent ? 0.35 : 0.18, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.025); // very short — just a tick
  osc.start(time); osc.stop(time + 0.03);
}

// Pattern beat: warm round "boing" — sine, musical pitch, longer decay
// Completely different character from the metronome tick
function playBoing(ctx: AudioContext, time: number) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type  = "sine";
  osc.connect(g); g.connect(ctx.destination);
  osc.frequency.setValueAtTime(523, time);           // C5
  osc.frequency.exponentialRampToValueAtTime(392, time + 0.18); // slide to G4 — warm boing
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.55, time + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
  osc.start(time); osc.stop(time + 0.3);
}

// Play count-in + pattern + metronome pulse during pattern, return timing info
function playRhythmFull(beats: number[], ctx: AudioContext): { patternStartMs: number; totalDurMs: number } {
  const s16   = SIXTEENTH_MS / 1000;
  const sBeat = BEAT_MS / 1000;
  const now   = ctx.currentTime + 0.05;
  const patternStartSec = now + COUNT_IN * sBeat;

  // Count-in ticks
  for (let i = 0; i < COUNT_IN; i++) {
    playTick(ctx, now + i * sBeat, i === 0);
  }

  // Pattern notes — warm boings, very distinct from ticks
  beats.forEach(b => {
    playBoing(ctx, patternStartSec + b * s16);
  });

  // Metronome ticks under pattern
  const maxBeat16 = Math.max(...beats);
  const numQBeats = Math.ceil((maxBeat16 + 4) / 4) + 1;
  for (let q = 0; q < numQBeats; q++) {
    playTick(ctx, patternStartSec + q * sBeat, q % 4 === 0);
  }

  const patternStartMs = (patternStartSec - ctx.currentTime) * 1000 + Date.now();
  const totalDurMs     = COUNT_IN * BEAT_MS + (maxBeat16 + 4) * SIXTEENTH_MS + 400;
  return { patternStartMs, totalDurMs };
}

// Start a repeating tick metronome for durationMs
function startMetronomeAudio(ctx: AudioContext, durationMs: number) {
  const sBeat = BEAT_MS / 1000;
  const now   = ctx.currentTime + 0.02;
  const beats = Math.ceil(durationMs / BEAT_MS) + 2;
  for (let i = 0; i < beats; i++) {
    playTick(ctx, now + i * sBeat, i % 4 === 0);
  }
}

// Relative rhythm scoring: compare inter-tap intervals to expected intervals
// This rewards rhythmic accuracy regardless of small global tempo drift
function scoreRhythmRelative(expectedBeats: number[], tapMs: number[]): number {
  const n = expectedBeats.length;
  if (tapMs.length === 0) return 0;

  // Count score: penalise wrong number of taps (each wrong tap = -0.4 / n)
  const countDiff = Math.abs(tapMs.length - n);
  const countScore = Math.max(0, 1 - (countDiff / n) * 0.6);

  const usable = Math.min(tapMs.length, n);
  if (usable < 2) return countScore * (usable / n);

  // Interval score: compare consecutive gaps
  const expIntervals = expectedBeats.slice(1, usable).map((b, i) => (b - expectedBeats[i]) * SIXTEENTH_MS);
  const tapIntervals = tapMs.slice(1, usable).map((t, i) => t - tapMs[i]);

  let intScore = 0;
  for (let i = 0; i < expIntervals.length; i++) {
    const window = Math.max(expIntervals[i] * 0.3, 130); // ±30% or ±130ms
    intScore += Math.max(0, 1 - Math.abs(tapIntervals[i] - expIntervals[i]) / window);
  }
  intScore /= expIntervals.length;

  // 65% interval accuracy + 35% count accuracy
  return intScore * 0.65 + countScore * 0.35;
}

type RhythmPhase = "idle" | "listen" | "tapping" | "result";

function RhythmEchoGame({ onBack }: { onBack: () => void }) {
  const [level,     setLevel]  = useState<RhythmLevel>("level1");
  const [pattern,   setPat]    = useState<RhythmPattern | null>(null);
  const [phase,     setPhase]  = useState<RhythmPhase>("idle");
  const [score,     setScore]  = useState(0);
  const [round,     setRound]  = useState(0);
  const [lastAcc,   setLastAcc]= useState<number | null>(null);
  const [hiScore,   setHi]     = useState(0);
  const [newRecord, setNR]     = useState(false);
  const [metBeat,   setMetBeat]= useState(false);
  const [tapCount,  setTapCount]= useState(0);
  const [tapFlash,  setTapFlash]= useState(false);

  // Refs that closures can safely read without going stale
  const phaseRef       = useRef<RhythmPhase>("idle");
  const tapsRef        = useRef<number[]>([]);
  const patRef         = useRef<RhythmPattern | null>(null);
  const scoreRef       = useRef(0);
  const roundRef       = useRef(0);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  function setP(p: RhythmPhase) { phaseRef.current = p; setPhase(p); }

  useEffect(() => {
    setHi(Number(localStorage.getItem(`theory_hi_rhythm_${level}`) ?? 0));
  }, [level]);

  // Metronome visual pulse — starts/stops with phase
  useEffect(() => {
    if (phase === "listen" || phase === "tapping") {
      // Sync pulse to BEAT_MS
      const id = setInterval(() => setMetBeat(v => !v), BEAT_MS);
      metTimerRef.current = id;
      return () => { clearInterval(id); metTimerRef.current = null; };
    }
  }, [phase]);

  function getCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed")
      audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  function startRound() {
    // Clear any previous auto-finish timer
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    const pool = RHYTHM_POOLS[level];
    const p    = pool[Math.floor(Math.random() * pool.length)];
    setPat(p); patRef.current = p;
    tapsRef.current = [];
    setTapCount(0); setLastAcc(null);
    setP("listen");
    const { totalDurMs } = playRhythmFull(p.beats, getCtx());
    // After listening, go straight to tapping — no extra "ready" screen
    finishTimerRef.current = setTimeout(() => {
      setP("tapping");
      tapsRef.current = [];
      setTapCount(0);
      // Audio metronome while tapping — distinct from pattern sound
      const maxBeatMs = Math.max(...p.beats) * SIXTEENTH_MS;
      startMetronomeAudio(getCtx(), maxBeatMs + 3500);
      // Hard deadline: auto-score after window closes
      finishTimerRef.current = setTimeout(doFinish, maxBeatMs + 3000);
    }, totalDurMs);
  }

  function replayPattern() {
    if (!patRef.current) return;
    playRhythmFull(patRef.current.beats, getCtx());
  }

  function recordTap() {
    if (phaseRef.current !== "tapping") return;
    tapsRef.current.push(Date.now());
    const count = tapsRef.current.length;
    setTapCount(count);
    // Flash
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 80);
    // Tap sound: low thud — completely different from metronome clicks
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.7, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.14);
    // Auto-finish once they've tapped enough
    const expected = patRef.current?.beats.length ?? 4;
    if (count >= expected + 1) doFinish();
  }

  function doFinish() {
    if (phaseRef.current !== "tapping") return;
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    setP("result");
    const p   = patRef.current!;
    const raw = tapsRef.current;
    // Convert to relative ms from first tap
    const rel = raw.length > 0 ? raw.map(t => t - raw[0]) : [];
    const acc = scoreRhythmRelative(p.beats, rel);
    setLastAcc(acc);
    const pts = Math.round(acc * 100);
    const ns  = scoreRef.current + pts;
    scoreRef.current = ns;
    setScore(ns);
    const nr = roundRef.current + 1;
    roundRef.current = nr;
    setRound(nr);
  }

  function nextRound() {
    if (roundRef.current >= 5) {
      const stored = Number(localStorage.getItem(`theory_hi_rhythm_${level}`) ?? 0);
      if (scoreRef.current > stored) {
        localStorage.setItem(`theory_hi_rhythm_${level}`, String(scoreRef.current));
        setHi(scoreRef.current); setNR(true);
      }
      setP("idle"); setScore(0); setRound(0); setNR(false);
      scoreRef.current = 0; roundRef.current = 0;
    } else {
      startRound();
    }
  }

  const accPct = lastAcc !== null ? Math.round(lastAcc * 100) : null;

  const MetDot = ({ size = 32 }: { size?: number }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: metBeat ? "rgba(255,210,60,0.95)" : "rgba(255,210,60,0.15)",
      border: `2px solid rgba(255,210,60,${metBeat ? 1 : 0.3})`,
      transition: `background ${BEAT_MS * 0.15}ms, border-color ${BEAT_MS * 0.15}ms`,
    }} />
  );

  const resultEmoji = accPct === null ? "" : accPct >= 90 ? "🌟" : accPct >= 75 ? "🎉" : accPct >= 55 ? "👍" : "💪";
  const resultMsg   = accPct === null ? "" : accPct >= 90 ? "Amazing!!" : accPct >= 75 ? "Great job!" : accPct >= 55 ? "Getting there!" : "Keep trying!";

  return (
    <div style={{ minHeight: "100%", background: "linear-gradient(160deg, #2d1b69 0%, #11145c 60%, #0a1a3a 100%)", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <TopBar onBack={onBack} label="🥁 Rhythm Echo" />

      {/* ── Idle ── */}
      {phase === "idle" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
          <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "0.5rem" }}>🥁</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#FDFCFA", marginBottom: "0.25rem" }}>Rhythm Echo</div>
            <div style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem" }}>Listen 👂 then tap it back! 🖐</div>

            {newRecord && <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#FFD700", marginBottom: "0.75rem" }}>🏆 New Best Score!</div>}

            {hiScore > 0 && (
              <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: "0.75rem 1.25rem", marginBottom: "1.5rem", display: "inline-block" }}>
                <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Best Score</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#FFD700" }}>{hiScore} <span style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)" }}>/ 500</span></div>
              </div>
            )}

            {/* Level picker */}
            <div style={{ marginBottom: "1.75rem" }}>
              <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.75rem" }}>Pick a level:</div>
              <div style={{ display: "flex", gap: "0.625rem", justifyContent: "center" }}>
                {(["level1","level2","level3"] as RhythmLevel[]).map(lv => (
                  <button key={lv} onClick={() => setLevel(lv)} style={{
                    padding: "0.625rem 1rem", borderRadius: 12, cursor: "pointer",
                    background: level === lv ? "#a855f7" : "rgba(255,255,255,0.08)",
                    border: `2px solid ${level === lv ? "#c084fc" : "rgba(255,255,255,0.12)"}`,
                    color: "#fff", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif",
                    fontWeight: level === lv ? 700 : 400, transition: "all 0.15s",
                    boxShadow: level === lv ? "0 0 16px rgba(168,85,247,0.5)" : "none",
                  }}>
                    {RHYTHM_LEVEL_LABELS[lv]}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setScore(0); scoreRef.current = 0; setRound(0); roundRef.current = 0; setNR(false); startRound(); }}
              style={{ width: "100%", padding: "1.1rem", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #a855f7, #6366f1)", color: "#fff", fontSize: "1.2rem", fontFamily: "Inter, sans-serif", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 24px rgba(168,85,247,0.5)", letterSpacing: "0.02em" }}
            >
              Let&apos;s Go! 🚀
            </button>
          </div>
        </div>
      )}

      {/* ── Listen ── */}
      {phase === "listen" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", gap: "1.25rem" }}>
          {/* Round badge */}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < round ? "#a855f7" : i === round ? "#FFD700" : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>

          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>Round {round + 1} of 5</div>

          {/* Big pulsing ear */}
          <div style={{
            fontSize: "6rem", lineHeight: 1,
            filter: metBeat ? "drop-shadow(0 0 20px rgba(255,210,60,0.9))" : "none",
            transition: `filter ${BEAT_MS * 0.2}ms`,
          }}>👂</div>

          {/* Metronome pulse dot */}
          <MetDot size={40} />

          <div style={{ fontSize: "1rem", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Listen carefully…</div>
          <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.25)" }}>Tapping starts right after!</div>
        </div>
      )}

      {/* ── Tapping ── */}
      {phase === "tapping" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", gap: "1.1rem" }}>
          {/* Round dots */}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < round ? "#a855f7" : i === round ? "#FFD700" : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>

          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Your turn! Tap the beat 🎵</div>

          {/* Metronome + replay row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <MetDot size={24} />
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>keep the beat</span>
            <button
              onClick={replayPattern}
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "0.3rem 0.75rem", color: "rgba(255,255,255,0.6)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", cursor: "pointer", touchAction: "manipulation" }}
            >
              🔁 Hear again
            </button>
          </div>

          {/* Tap progress — bigger, colourful stars */}
          <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", justifyContent: "center", minHeight: 32 }}>
            {Array.from({ length: patRef.current?.beats.length ?? 4 }).map((_, i) => (
              <div key={i} style={{ fontSize: i < tapCount ? "1.5rem" : "1.1rem", transition: "font-size 0.1s", opacity: i < tapCount ? 1 : 0.25, lineHeight: 1 }}>
                {i < tapCount ? "⭐" : "○"}
              </div>
            ))}
          </div>

          {/* Big drum tap button */}
          <button
            onPointerDown={recordTap}
            style={{
              width: 180, height: 180, borderRadius: "50%",
              border: `5px solid ${tapFlash ? "#fff" : "#a855f7"}`,
              background: tapFlash
                ? "rgba(255,255,255,0.3)"
                : "linear-gradient(135deg, rgba(168,85,247,0.35), rgba(99,102,241,0.25))",
              color: "#fff",
              fontSize: tapFlash ? "4rem" : "3.5rem",
              cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
              touchAction: "manipulation",
              transition: "border-color 0.05s, background 0.05s, font-size 0.05s",
              boxShadow: tapFlash ? "0 0 40px rgba(255,255,255,0.4)" : "0 0 30px rgba(168,85,247,0.4)",
            }}
          >
            🥁
          </button>

          <button
            onPointerDown={doFinish}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "0.625rem 2rem", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", fontFamily: "Inter, sans-serif", fontWeight: 600, cursor: "pointer", touchAction: "manipulation" }}
          >
            ✅ Done!
          </button>
        </div>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", gap: "0.875rem" }}>
          <div style={{ fontSize: "5rem", lineHeight: 1 }}>{resultEmoji}</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#FDFCFA" }}>{resultMsg}</div>
          <div style={{ fontSize: "4rem", fontWeight: 900, color: accPct! >= 80 ? "#4ade80" : accPct! >= 50 ? "#fbbf24" : "#f87171", lineHeight: 1 }}>{accPct}%</div>

          {/* Round progress bar */}
          <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.25rem" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < round ? "#a855f7" : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>

          <div style={{ fontSize: "1rem", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Score: <strong style={{ color: "#FDFCFA" }}>{score}</strong> / {round * 100}</div>

          <button
            onClick={nextRound}
            style={{ padding: "1rem 3rem", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #a855f7, #6366f1)", color: "#fff", fontSize: "1.1rem", fontFamily: "Inter, sans-serif", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 24px rgba(168,85,247,0.45)", marginTop: "0.5rem", letterSpacing: "0.02em" }}
          >
            {round >= 5 ? "🏁 See My Score!" : "Next Round →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game: Sight Reading (note sequences)
// ─────────────────────────────────────────────────────────────────────────────
type SightLevel = "level1" | "level2" | "level3";
const SIGHT_POOLS: Record<SightLevel, { name: string; pos: number }[]> = {
  level1: TREBLE_NOTES.filter(n => ["C4","D4","E4","F4","G4"].includes(n.name)),
  level2: TREBLE_NOTES,
  level3: [...TREBLE_NOTES, ...BASS_NOTES],
};
const SIGHT_LEVEL_LABELS: Record<SightLevel, string> = { level1: "Level 1 (C–G)", level2: "Level 2 (Full Treble)", level3: "Level 3 (Treble + Bass)" };

const SEQ_LEN = 4;
function makeSeq(level: SightLevel) {
  const pool = SIGHT_POOLS[level];
  const notes: typeof pool = [];
  for (let i = 0; i < SEQ_LEN; i++) {
    const prev = notes[notes.length - 1];
    const candidates = prev ? pool.filter(n => n.pos !== prev.pos) : pool;
    notes.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
  const choices = shuffle(NOTE_LETTERS);
  return { notes, choices };
}

// Multi-note staff: renders SEQ_LEN notes side by side
const SEQ_SPACING = 52;
function SequenceStaff({ notes, current, answered }: { notes: { name: string; pos: number }[]; current: number; answered: boolean[] }) {
  const W = 310, H = CONT_H;
  const startX = 52;

  return (
    <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* Staff lines */}
        {[0,2,4,6,8].map(p => (
          <line key={p} x1={42} y1={posY(p)} x2={W - 8} y2={posY(p)} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
        ))}
        {notes.map((note, i) => {
          const cx = startX + i * SEQ_SPACING;
          const ry = posY(note.pos);
          const isActive = i === current;
          const isDone   = answered[i];
          const color    = isDone ? "rgba(76,175,132,0.9)" : isActive ? "#FDFCFA" : "rgba(255,255,255,0.25)";
          const stemUp   = note.pos <= 4;
          const stemX    = stemUp ? cx + 10 : cx - 10;
          // ledger lines
          const ledgers: number[] = [];
          if (note.pos <= -2) for (let p = -2; p >= note.pos; p -= 2) ledgers.push(p);
          if (note.pos >= 10) for (let p = 10; p <= note.pos; p += 2) ledgers.push(p);
          return (
            <g key={i}>
              {ledgers.map(p => <line key={p} x1={cx - 14} y1={posY(p)} x2={cx + 14} y2={posY(p)} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />)}
              <line x1={stemX} y1={ry} x2={stemX} y2={stemUp ? ry - 30 : ry + 30} stroke={color} strokeWidth={1.5} />
              <ellipse cx={cx} cy={ry} rx={9} ry={7} fill={color} transform={`rotate(-18, ${cx}, ${ry})`} />
              {isActive && !isDone && <ellipse cx={cx} cy={ry} rx={13} ry={11} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} transform={`rotate(-18, ${cx}, ${ry})`} />}
            </g>
          );
        })}
      </svg>
      {/* Treble clef */}
      <span aria-hidden style={{ position: "absolute", left: 5, top: BOT_Y - 97, fontSize: 102, lineHeight: 1, fontFamily: "'Times New Roman', Georgia, serif", color: "rgba(255,255,255,0.7)", userSelect: "none", pointerEvents: "none", display: "block" }}>𝄞</span>
    </div>
  );
}

function SightReadGame({ onBack }: { onBack: () => void }) {
  const [level, setLevel] = useState<SightLevel>("level1");
  const [seq, setSeq]     = useState(() => makeSeq("level1"));
  const [step, setStep]   = useState(0);
  const [answered, setAns] = useState([false, false, false, false]);
  const gk   = `sight_${level}`;
  const game = useGameState(gk);

  useEffect(() => { game.loadHi(); }, [level]); // eslint-disable-line

  function start() {
    game.loadHi();
    game.beginCountdown(() => {
      const s = makeSeq(level);
      setSeq(s); setStep(0); setAns([false,false,false,false]);
      game.beginPlay();
    });
  }

  function answer(letter: string) {
    if (game.selected || game.gs !== "playing") return;
    const correct = seq.notes[step].name.replace(/\d/, "");
    game.setSelected(letter);
    const ok = letter === correct;
    game.scoreAnswer(ok);
    setTimeout(() => {
      game.setSelected(null);
      if (step + 1 >= SEQ_LEN) {
        const ns = makeSeq(level);
        setSeq(ns); setStep(0); setAns([false,false,false,false]);
      } else {
        setAns(prev => { const n = [...prev]; n[step] = ok; return n; });
        setStep(s => s + 1);
      }
    }, ok ? 400 : 900);
  }

  if (game.gs === "results") return <ResultsScreen score={game.score} correct={game.correct} total={game.total} topStreak={game.topStreak} newRecord={game.newRecord} hiScore={game.hiScore} gameLabel="Sight Reading" onPlayAgain={start} onMenu={onBack} />;
  if (game.gs === "countdown") return <CountdownScreen n={game.countdown} />;

  const currentNote = seq.notes[step];
  const clef = level === "level3" && BASS_NOTES.some(n => n.name === currentNote?.name) ? "bass" : "treble";

  if (game.gs === "idle") return (
    <IdleCard title="Sight Reading" hiScore={game.hiScore}
      description={`4 notes appear on the staff — name them left to right as fast as possible. ${SEQ_LEN} notes per sequence, 30s rounds.`}
      extras={
        <>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {(["level1","level2","level3"] as SightLevel[]).map(lv => (
              <button key={lv} onClick={() => setLevel(lv)} style={{ padding: "0.4rem 0.875rem", borderRadius: 20, cursor: "pointer", background: level === lv ? "#4CAF84" : "transparent", border: `1.5px solid ${level === lv ? "#4CAF84" : "rgba(255,255,255,0.2)"}`, color: level === lv ? "#fff" : "rgba(255,255,255,0.5)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: level === lv ? 600 : 400, transition: "all 0.15s" }}>
                {SIGHT_LEVEL_LABELS[lv]}
              </button>
            ))}
          </div>
          <div style={{ background: "#252537", borderRadius: 12, padding: "0.75rem", marginBottom: "1.25rem", display: "flex", justifyContent: "center" }}>
            <SequenceStaff notes={makeSeq("level1").notes} current={1} answered={[true,false,false,false]} />
          </div>
        </>
      }
      onStart={start}
    />
  );

  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", position: "relative" }}>
      <TopBar onBack={onBack} label="Sight Reading" />
      <GameHeader timeLeft={game.timeLeft} score={game.score} streak={game.streak} />
      <Popups entries={game.popups} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.25rem", gap: "1rem" }}>
        <div style={{ background: "#252537", borderRadius: 12, padding: "0.75rem 0.5rem", overflowX: "auto" }}>
          {level === "level3" && clef === "bass"
            ? <Staff clef="bass" notePos={currentNote.pos} />
            : <SequenceStaff notes={seq.notes} current={step} answered={answered} />
          }
        </div>
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", margin: 0 }}>Note {step + 1} of {SEQ_LEN} — name it</p>
        <div style={{ width: "100%", maxWidth: 340 }}>
          <AnswerGrid choices={seq.choices} selected={game.selected} correct={currentNote.name.replace(/\d/, "")} onAnswer={answer} columns={4} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu
// ─────────────────────────────────────────────────────────────────────────────
type View = "menu" | "noteId" | "interval" | "chord" | "terms" | "keySig" | "scale" | "rcm" | "fretboard" | "guitarChord" | "rhythmEcho" | "sightRead";

function Menu({ onSelect }: { onSelect: (v: View) => void }) {
  const { t } = useI18n();
  const scores = {
    noteId_treble: Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("nid_treble")) ?? 0 : 0),
    noteId_bass:   Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("nid_bass"))   ?? 0 : 0),
    interval:      Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("interval_easy")) ?? localStorage.getItem(hiKey("interval_medium")) ?? localStorage.getItem(hiKey("interval_hard")) ?? 0 : 0),
    chord:         Number(typeof window !== "undefined" ? localStorage.getItem(hiKey("chord_easy")) ?? localStorage.getItem(hiKey("chord_medium")) ?? 0 : 0),
  };

  const games = [
    {
      view: "noteId" as View, icon: "🎵", title: "Note Identification", category: "Piano",
      desc: "A note flashes on the staff — name it as fast as you can. 30s rounds, streak multipliers.",
      badge: scores.noteId_treble > 0 ? `🏆 ${Math.max(scores.noteId_treble, scores.noteId_bass).toLocaleString()}` : null,
      active: true,
    },
    {
      view: "interval" as View, icon: "👂", title: "Interval Ear Training", category: "Ear Training",
      desc: "Two notes play in sequence. Identify the interval. RCM-graded difficulty: Prep → Grade 8.",
      badge: null, active: true,
    },
    {
      view: "chord" as View, icon: "🎼", title: "Chord Quality", category: "Ear Training",
      desc: "A chord plays. Major, minor, diminished, or augmented — train your ear to tell them apart.",
      badge: null, active: true,
    },
    {
      view: "terms" as View, icon: "🗣", title: "Music Terms", category: "Theory",
      desc: "A term flashes — pick its definition. Covers all RCM vocabulary: tempo, dynamics, articulation, expression, form.",
      badge: null, active: true,
    },
    {
      view: "keySig" as View, icon: "🔑", title: "Key Signatures", category: "Theory",
      desc: "See a key signature and identify the major key or its relative minor. All 15 major keys.",
      badge: null, active: true,
    },
    {
      view: "scale" as View, icon: "🎶", title: "Scale Ear Training", category: "Ear Training",
      desc: "A scale plays ascending and descending. Is it major, natural minor, harmonic minor, or melodic minor?",
      badge: null, active: true,
    },
    {
      view: "rcm" as View, icon: "📋", title: "RCM Exam Guide", category: "Reference",
      desc: "Level-by-level breakdown of exam requirements: pieces, technical, ear training, theory co-requisites, and passing marks.",
      badge: null, active: true,
    },
    {
      view: "menu" as View, icon: "📖", title: "Sight Reading", category: "Piano",
      desc: "Four notes appear on the staff — name them left to right. Three levels: beginner to full treble + bass.", badge: null, active: false,
    },
    {
      view: "menu" as View, icon: "🥁", title: "Rhythm Echo", category: "Rhythm",
      desc: "Listen to a rhythm, then tap it back. 5 rounds scored on accuracy. Three difficulty levels.", badge: null, active: false,
    },
    {
      view: "fretboard" as View, icon: "🎸", title: "Fretboard Notes", category: "Guitar",
      desc: "A fret position lights up on the guitar neck — name the note. Three levels: open position to full neck.", badge: null, active: true,
    },
    {
      view: "guitarChord" as View, icon: "🤘", title: "Guitar Chord Finder", category: "Guitar",
      desc: "See a chord diagram and identify the chord name. Covers open chords, barre chords, and extended voicings.", badge: null, active: true,
    },
  ];

  const categoryColors: Record<string, { bg: string; text: string }> = {
    "Piano":        { bg: "rgba(99,102,241,0.1)",  text: "#6366f1" },
    "Guitar":       { bg: "rgba(234,88,12,0.1)",   text: "#ea580c" },
    "Ear Training": { bg: "rgba(20,184,166,0.1)",  text: "#0d9488" },
    "Theory":       { bg: "rgba(168,85,247,0.1)",  text: "#9333ea" },
    "Rhythm":       { bg: "rgba(234,179,8,0.1)",   text: "#ca8a04" },
    "Reference":    { bg: "rgba(100,116,139,0.1)", text: "#64748b" },
  };

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", padding: "2.5rem 1.5rem", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>Music Games</div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Fast-paced rounds, streak multipliers, personal bests. The best theory practice happens in small daily doses.</p>
        </div>
        <div style={{ display: "grid", gap: "0.875rem" }}>
          {/* Note Identification + Interval first */}
          {games.slice(0, 2).map(g => (
            <div key={g.title} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem 1.5rem", opacity: g.active ? 1 : 0.48, cursor: g.active ? "pointer" : "default" }} onClick={g.active ? () => onSelect(g.view) : undefined}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: g.active ? "rgba(74,103,185,0.1)" : "rgba(74,103,185,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.2rem" }}>{g.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{g.title}</span>
                    {(() => { const c = categoryColors[g.category]; return c ? <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: c.bg, color: c.text, borderRadius: 4, padding: "0.15rem 0.4rem" }}>{g.category}</span> : null; })()}
                    {g.badge && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{g.badge}</span>}
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{g.desc}</p>
                </div>
                {g.active && <span style={{ fontSize: "1rem", color: "var(--muted)", flexShrink: 0, alignSelf: "center" }}>›</span>}
              </div>
            </div>
          ))}

          {/* Pitch Trainer */}
          <Link href="/student/pitch" style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem 1.5rem", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(20,184,166,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.2rem" }}>🎹</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>Pitch Trainer</span>
                    <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(20,184,166,0.1)", color: "#0d9488", borderRadius: 4, padding: "0.15rem 0.4rem" }}>Ear Training</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>A note plays — identify it by ear. Three difficulty levels from pentatonic to all 12 chromatic notes. Build absolute pitch recognition.</p>
                </div>
                <span style={{ fontSize: "1rem", color: "var(--muted)", flexShrink: 0, alignSelf: "center" }}>›</span>
              </div>
            </div>
          </Link>

          <Link href="/student/progressions" style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem 1.5rem", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(20,184,166,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.2rem" }}>🎼</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>Progressions &amp; Key ID</span>
                    <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(20,184,166,0.1)", color: "#0d9488", borderRadius: 4, padding: "0.15rem 0.4rem" }}>Ear Training</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Identify chord progressions (I–IV–V–I, ii–V–I, pop patterns) and major keys by ear. Essential for playing songs by ear.</p>
                </div>
                <span style={{ fontSize: "1rem", color: "var(--muted)", flexShrink: 0, alignSelf: "center" }}>›</span>
              </div>
            </div>
          </Link>

          <Link href="/student/reference" style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem 1.5rem", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(184,92,58,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.2rem" }}>🎸</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>Chord Reference</span>
                    <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(184,92,58,0.1)", color: "#B85C3A", borderRadius: 4, padding: "0.15rem 0.4rem" }}>Reference</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Interactive chord diagrams for piano, guitar, and ukulele. Tap a chord to see the keys or fingering positions.</p>
                </div>
                <span style={{ fontSize: "1rem", color: "var(--muted)", flexShrink: 0, alignSelf: "center" }}>›</span>
              </div>
            </div>
          </Link>

          {/* Remaining games */}
          {games.slice(2).map(g => (
            <div key={g.title} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem 1.5rem", opacity: g.active ? 1 : 0.48, cursor: g.active ? "pointer" : "default" }} onClick={g.active ? () => onSelect(g.view) : undefined}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: g.active ? "rgba(74,103,185,0.1)" : "rgba(74,103,185,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.2rem" }}>{g.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{g.title}</span>
                    {(() => { const c = categoryColors[g.category]; return c ? <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: c.bg, color: c.text, borderRadius: 4, padding: "0.15rem 0.4rem" }}>{g.category}</span> : null; })()}
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
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const initialView = (searchParams?.get("game") as View | null) ?? "menu";
  const [view, setView] = useState<View>(initialView);
  if (view === "menu")     return <Menu onSelect={setView} />;
  if (view === "noteId")   return <NoteIdGame onBack={() => setView("menu")} />;
  if (view === "interval") return <IntervalGame onBack={() => setView("menu")} />;
  if (view === "chord")    return <ChordGame onBack={() => setView("menu")} />;
  if (view === "terms")    return <MusicTermsGame onBack={() => setView("menu")} />;
  if (view === "keySig")   return <KeySigGame onBack={() => setView("menu")} />;
  if (view === "scale")    return <ScaleGame onBack={() => setView("menu")} />;
  if (view === "rcm")         return <RCMReference onBack={() => setView("menu")} />;
  if (view === "fretboard")   return <FretboardGame onBack={() => setView("menu")} />;
  if (view === "guitarChord") return <GuitarChordGame onBack={() => setView("menu")} />;
  if (view === "rhythmEcho")  return <RhythmEchoGame onBack={() => setView("menu")} />;
  if (view === "sightRead")   return <SightReadGame onBack={() => setView("menu")} />;
  return null;
}
