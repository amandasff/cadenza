"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Flame, Music } from "lucide-react";

// ── Note definitions ─────────────────────────────────────────────────────────

const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
type NoteName = typeof ALL_NOTES[number];

// Frequencies for octave 4
const FREQ: Record<NoteName, number> = {
  "C":  261.63, "C#": 277.18, "D":  293.66, "D#": 311.13,
  "E":  329.63, "F":  349.23, "F#": 369.99, "G":  392.00,
  "G#": 415.30, "A":  440.00, "A#": 466.16, "B":  493.88,
};

const DIFFICULTY_NOTES: Record<string, NoteName[]> = {
  easy:   ["C", "D", "E", "G", "A"],
  medium: ["C", "D", "E", "F", "G", "A", "B"],
  hard:   [...ALL_NOTES],
};

const IS_SHARP: Record<NoteName, boolean> = {
  "C": false, "C#": true,  "D": false, "D#": true,
  "E": false, "F": false,  "F#": true, "G": false,
  "G#": true, "A": false,  "A#": true, "B": false,
};

// Which position (0-indexed left to right) on a piano keyboard each note sits
const KEY_ORDER: NoteName[] = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ── Audio synthesis ───────────────────────────────────────────────────────────

// Returns the AudioContext so the caller can close it on unmount/navigation
function playNote(freq: number, duration = 1.8): AudioContext {
  const ctx = new AudioContext();

  const harmonics = [
    { ratio: 1,   gain: 0.6  },
    { ratio: 2,   gain: 0.25 },
    { ratio: 3,   gain: 0.10 },
    { ratio: 4,   gain: 0.05 },
  ];

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.012);
  master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  master.connect(ctx.destination);

  for (const { ratio, gain } of harmonics) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.frequency.value = freq * ratio;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude !== undefined ? arr.filter(x => x !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = "idle" | "listening" | "correct" | "wrong";

import { useI18n } from "../../../lib/context/I18nContext";

export default function PitchTrainerPage() {
  const { t } = useI18n();
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [phase, setPhase]           = useState<Phase>("idle");
  const [currentNote, setCurrentNote] = useState<NoteName | null>(null);
  const [guess, setGuess]           = useState<NoteName | null>(null);
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [round, setRound]           = useState(0);
  const [started, setStarted]       = useState(false);

  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const notes = DIFFICULTY_NOTES[difficulty];

  function clearTimer() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }
  function stopAudio() {
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
  }
  function playNoteTracked(freq: number) {
    stopAudio();
    audioCtxRef.current = playNote(freq);
    // Auto-close after note finishes
    setTimeout(() => { if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; } }, 2200);
  }

  const nextRound = useCallback((prevNote?: NoteName) => {
    const note = pickRandom(DIFFICULTY_NOTES[difficulty], prevNote);
    setCurrentNote(note);
    setGuess(null);
    setPhase("listening");
    setRound(r => r + 1);
    playNoteTracked(FREQ[note]);
  }, [difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  function startGame() {
    setScore(0); setStreak(0); setRound(0); setStarted(true);
    nextRound();
  }

  function replayNote() {
    if (currentNote && phase === "listening") playNoteTracked(FREQ[currentNote]);
  }

  function handleGuess(note: NoteName) {
    if (phase !== "listening" || !currentNote) return;
    clearTimer();
    setGuess(note);

    if (note === currentNote) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBestStreak(b => Math.max(b, newStreak));
      setScore(s => s + (difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1));
      setPhase("correct");
    } else {
      setStreak(0);
      setPhase("wrong");
    }

    // Auto-advance after 1.4s
    timeoutRef.current = setTimeout(() => {
      nextRound(currentNote);
    }, 1400);
  }

  // Cleanup on unmount — stop any in-flight audio
  useEffect(() => () => { clearTimer(); stopAudio(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────────────

  const activeNoteSet = new Set(notes);

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", paddingBottom: "5.5rem" }}>

      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1.25rem 1rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <Link href="/student/theory" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", textDecoration: "none" }}>
            ← {t.nav.games}
          </Link>
        </div>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.625rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
          {t.student.pitchTitle}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", margin: "0.125rem 0 0" }}>
          {t.student.pitchSubtitle}
        </p>
      </div>

      <div style={{ padding: "1rem" }}>

        {/* Stats row */}
        {started && (
          <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem" }}>
            {[
              { label: t.student.scoreLabel,  value: score },
              { label: t.student.streakLabel, value: <>{streak}<Flame size={12} color="#E6A817" fill="#E6A817" strokeWidth={0} /></> },
              { label: t.student.bestLabel,   value: bestStreak },
              { label: t.student.roundLabel,  value: round },
            ].map(({ label, value }) => (
              <div key={label} style={{ flex: 1, background: "var(--white)", borderRadius: 10, padding: "0.5rem 0.25rem", textAlign: "center", border: "1px solid var(--border)" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.125rem", color: "var(--charcoal)", lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Difficulty picker */}
        {!started && (
          <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.75rem" }}>{t.student.pitchChooseDifficulty}</div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["easy", "medium", "hard"] as const).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} style={{
                  flex: 1, padding: "0.625rem 0", borderRadius: 10, fontFamily: "Inter, sans-serif",
                  fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", transition: "all 0.15s",
                  border: difficulty === d ? "none" : "1.5px solid var(--border)",
                  background: difficulty === d ? "var(--charcoal)" : "transparent",
                  color: difficulty === d ? "var(--white)" : "var(--muted)",
                  textTransform: "capitalize",
                }}>
                  {d}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.75rem", lineHeight: 1.5 }}>
              {difficulty === "easy"   && "5 notes: C D E G A — perfect pentatonic start"}
              {difficulty === "medium" && "7 notes: all natural notes (no sharps)"}
              {difficulty === "hard"   && "All 12 chromatic notes — the real challenge"}
            </div>
          </div>
        )}

        {/* Main card */}
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1.5rem 1.25rem", marginBottom: "1rem", textAlign: "center" }}>

          {!started ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}><Music size={48} strokeWidth={1} color="var(--muted)" /></div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.375rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.375rem" }}>
                {t.student.pitchTrainYourEar}
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 1.25rem", maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
                A note will play — tap the key you heard. The more you practice, the faster you&apos;ll recognise pitches instantly.
              </p>
              <button onClick={startGame} style={{
                padding: "0.75rem 2.5rem", borderRadius: 24, border: "none",
                background: "var(--charcoal)", color: "var(--white)",
                fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem",
                cursor: "pointer", letterSpacing: "0.01em",
              }}>
                {t.student.startGame}
              </button>
            </>
          ) : (
            <>
              {/* Feedback display */}
              <div style={{
                height: 72, display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "0.5rem",
              }}>
                {phase === "listening" && (
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--muted)", fontStyle: "italic" }}>
                    {t.student.pitchWhatNote}
                  </div>
                )}
                {phase === "correct" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.125rem" }}>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", color: "#27ae60", fontWeight: 500 }}>
                      {currentNote}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#27ae60", fontWeight: 600 }}>
                      {streak >= 3 ? t.student.inARow.replace("{n}", String(streak)) : t.student.correctFeedback}
                    </div>
                  </div>
                )}
                {phase === "wrong" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.125rem" }}>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", color: "#c0392b", fontWeight: 500 }}>
                      {currentNote}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b" }}>
                      {t.student.pitchWrongFeedback.replace("{note}", currentNote ?? "").replace("{guess}", guess ?? "")}
                    </div>
                  </div>
                )}
              </div>

              {/* Replay button */}
              <button
                onClick={replayNote}
                disabled={phase !== "listening"}
                style={{
                  padding: "0.5rem 1.5rem", borderRadius: 20, border: "1.5px solid var(--border)",
                  background: "transparent", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
                  fontWeight: 500, fontSize: "0.8125rem", cursor: phase === "listening" ? "pointer" : "default",
                  opacity: phase === "listening" ? 1 : 0.4, transition: "opacity 0.15s",
                  marginBottom: "1.25rem",
                }}
              >
                {t.student.playAgain}
              </button>

              {/* Piano keyboard */}
              <PianoKeyboard
                activeNotes={activeNoteSet}
                phase={phase}
                guess={guess}
                answer={currentNote}
                onGuess={handleGuess}
              />

              {/* Restart */}
              <button
                onClick={() => { clearTimer(); setStarted(false); setPhase("idle"); setCurrentNote(null); }}
                style={{ marginTop: "1.25rem", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", textDecoration: "underline" }}
              >
                {t.student.endSession}
              </button>
            </>
          )}
        </div>

        {/* Tips */}
        {!started && (
          <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1rem 1.125rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>Tips</div>
            {[
              "Hum the note back to yourself after hearing it",
              "Anchor notes: A = tuning note, C = piano middle C",
              "Practice daily — even 5 minutes builds your ear fast",
            ].map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: i < 2 ? "0.5rem" : 0 }}>
                <span style={{ color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.55 }}>{tip}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Piano keyboard component ──────────────────────────────────────────────────
// Fixed pixel layout so keys always have correct piano proportions

const WK = 40;   // white key width px
const WH = 112;  // white key height px
const BW = 26;   // black key width px
const BH = 68;   // black key height px
const WG = 3;    // gap between white keys px

// White keys in order, left x position
const WHITE_KEY_ORDER: NoteName[] = ["C", "D", "E", "F", "G", "A", "B"];
const WHITE_KEY_X: Record<NoteName, number> = {} as Record<NoteName, number>;
WHITE_KEY_ORDER.forEach((n, i) => { WHITE_KEY_X[n] = i * (WK + WG); });

// Black keys: left edge = right edge of left neighbor - BW/2
const BLACK_KEY_X: Partial<Record<NoteName, number>> = {
  "C#": WHITE_KEY_X["C"] + WK - BW / 2,
  "D#": WHITE_KEY_X["D"] + WK - BW / 2,
  "F#": WHITE_KEY_X["F"] + WK - BW / 2,
  "G#": WHITE_KEY_X["G"] + WK - BW / 2,
  "A#": WHITE_KEY_X["A"] + WK - BW / 2,
};

const PIANO_WIDTH = 7 * WK + 6 * WG; // 298px

function PianoKeyboard({
  activeNotes, phase, guess, answer, onGuess,
}: {
  activeNotes: Set<NoteName>;
  phase: Phase;
  guess: NoteName | null;
  answer: NoteName | null;
  onGuess: (n: NoteName) => void;
}) {
  const disabled = phase !== "listening";

  function whiteKeyBg(note: NoteName) {
    const isActive = activeNotes.has(note);
    if (phase === "correct" && note === answer) return "#27ae60";
    if (phase === "wrong"   && note === answer) return "#27ae60";
    if (phase === "wrong"   && note === guess)  return "#e74c3c";
    return isActive ? "#FDFCFA" : "#e0ddd8";
  }

  function blackKeyBg(note: NoteName) {
    const isActive = activeNotes.has(note);
    if (phase === "correct" && note === answer) return "#27ae60";
    if (phase === "wrong"   && note === answer) return "#27ae60";
    if (phase === "wrong"   && note === guess)  return "#e74c3c";
    return isActive ? "#2C2824" : "#888";
  }

  function labelColor(note: NoteName, isBlack: boolean) {
    if ((phase === "correct" || phase === "wrong") && (note === answer || note === guess)) return "#fff";
    return isBlack ? "rgba(255,255,255,0.75)" : "#7a6e65";
  }

  return (
    <div style={{ overflowX: "auto", paddingBottom: "0.25rem" }}>
      <div style={{ position: "relative", width: PIANO_WIDTH, height: WH, margin: "0 auto", userSelect: "none", flexShrink: 0 }}>
        {/* White keys */}
        {WHITE_KEY_ORDER.map(note => {
          const isActive = activeNotes.has(note);
          const x = WHITE_KEY_X[note];
          return (
            <button
              key={note}
              onClick={() => isActive && !disabled && onGuess(note)}
              style={{
                position: "absolute",
                left: x, top: 0,
                width: WK, height: WH,
                background: whiteKeyBg(note),
                border: "1px solid #c8c2bb",
                borderRadius: "0 0 6px 6px",
                cursor: isActive && !disabled ? "pointer" : "default",
                zIndex: 1,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 6,
                fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.625rem",
                color: labelColor(note, false),
                transition: "background 0.1s",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              {note}
            </button>
          );
        })}

        {/* Black keys */}
        {(["C#","D#","F#","G#","A#"] as NoteName[]).map(note => {
          const isActive = activeNotes.has(note);
          const x = BLACK_KEY_X[note]!;
          return (
            <button
              key={note}
              onClick={() => isActive && !disabled && onGuess(note)}
              style={{
                position: "absolute",
                left: x, top: 0,
                width: BW, height: BH,
                background: blackKeyBg(note),
                border: "none",
                borderRadius: "0 0 4px 4px",
                cursor: isActive && !disabled ? "pointer" : "default",
                zIndex: 2,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 5,
                fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.5rem",
                color: labelColor(note, true),
                transition: "background 0.1s",
                outline: "none",
                boxShadow: "0 3px 8px rgba(0,0,0,0.45)",
              }}
            >
              {note}
            </button>
          );
        })}
      </div>
    </div>
  );
}
