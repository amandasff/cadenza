"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";

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

function playNote(freq: number, duration = 1.8) {
  const ctx = new AudioContext();

  // Piano-ish: fundamental + harmonics
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
    osc.type = ratio === 1 ? "sine" : "sine";
    osc.frequency.value = freq * ratio;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // Close context after note finishes
  setTimeout(() => ctx.close(), (duration + 0.2) * 1000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude !== undefined ? arr.filter(x => x !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = "idle" | "listening" | "correct" | "wrong";

export default function PitchTrainerPage() {
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [phase, setPhase]           = useState<Phase>("idle");
  const [currentNote, setCurrentNote] = useState<NoteName | null>(null);
  const [guess, setGuess]           = useState<NoteName | null>(null);
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [round, setRound]           = useState(0);
  const [started, setStarted]       = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notes = DIFFICULTY_NOTES[difficulty];

  function clearTimer() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }

  const nextRound = useCallback((prevNote?: NoteName) => {
    const note = pickRandom(DIFFICULTY_NOTES[difficulty], prevNote);
    setCurrentNote(note);
    setGuess(null);
    setPhase("listening");
    setRound(r => r + 1);
    playNote(FREQ[note]);
  }, [difficulty]);

  function startGame() {
    setScore(0); setStreak(0); setRound(0); setStarted(true);
    nextRound();
  }

  function replayNote() {
    if (currentNote && phase === "listening") playNote(FREQ[currentNote]);
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

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const activeNoteSet = new Set(notes);

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", paddingBottom: "5.5rem" }}>

      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1.25rem 1rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <Link href="/student/theory" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", textDecoration: "none" }}>
            ← Games
          </Link>
        </div>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.625rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
          Pitch Trainer
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", margin: "0.125rem 0 0" }}>
          Listen and identify the note — train your ear
        </p>
      </div>

      <div style={{ padding: "1rem" }}>

        {/* Stats row */}
        {started && (
          <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem" }}>
            {[
              { label: "Score",  value: score },
              { label: "Streak", value: `${streak}🔥` },
              { label: "Best",   value: bestStreak },
              { label: "Round",  value: round },
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
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.75rem" }}>Choose difficulty</div>
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
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎵</div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.375rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.375rem" }}>
                Train your ear
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
                Start
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
                    What note was that?
                  </div>
                )}
                {phase === "correct" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.125rem" }}>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", color: "#27ae60", fontWeight: 500 }}>
                      {currentNote}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#27ae60", fontWeight: 600 }}>
                      {streak >= 3 ? `${streak} in a row!` : "Correct!"}
                    </div>
                  </div>
                )}
                {phase === "wrong" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.125rem" }}>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", color: "#c0392b", fontWeight: 500 }}>
                      {currentNote}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b" }}>
                      It was {currentNote} — you guessed {guess}
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
                Play again
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
                End session
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

function PianoKeyboard({
  activeNotes, phase, guess, answer, onGuess,
}: {
  activeNotes: Set<NoteName>;
  phase: Phase;
  guess: NoteName | null;
  answer: NoteName | null;
  onGuess: (n: NoteName) => void;
}) {
  // Lay out keys: white keys form the base, sharps overlap
  const whiteKeys: NoteName[] = KEY_ORDER.filter(n => !IS_SHARP[n]);
  const sharpKeys: NoteName[] = KEY_ORDER.filter(n => IS_SHARP[n]);

  // X position of each white key (0-indexed)
  const whiteWidth = 100 / whiteKeys.length; // percentage

  // For each sharp, compute its approximate % left position
  // Sharps sit between white keys. Map: sharp → fraction of keyboard width
  const sharpPositions: Record<NoteName, number> = {
    "C#": 1,   // between C (0) and D (1)
    "D#": 2,   // between D (1) and E (2)
    "F#": 4,   // between F (3) and G (4)
    "G#": 5,   // between G (4) and A (5)
    "A#": 6,   // between A (5) and B (6)
  } as Record<NoteName, number>;

  function keyColor(note: NoteName) {
    const isActive = activeNotes.has(note);
    if (!isActive) return IS_SHARP[note] ? "#888" : "#ccc";
    if (phase === "correct" && note === answer) return "#27ae60";
    if (phase === "wrong" && note === answer) return "#27ae60"; // show correct in green
    if (phase === "wrong" && note === guess)  return "#e74c3c"; // show wrong guess in red
    return IS_SHARP[note] ? "var(--charcoal)" : "var(--white)";
  }

  function textColor(note: NoteName) {
    const isActive = activeNotes.has(note);
    if (!isActive) return "#999";
    if ((phase === "correct" || phase === "wrong") && note === answer) return "#fff";
    if (phase === "wrong" && note === guess) return "#fff";
    return IS_SHARP[note] ? "#fff" : "var(--charcoal)";
  }

  const disabled = phase !== "listening";

  return (
    <div style={{ position: "relative", height: 120, userSelect: "none" }}>
      {/* White keys */}
      <div style={{ display: "flex", height: "100%", gap: 2 }}>
        {whiteKeys.map((note, i) => {
          const isActive = activeNotes.has(note);
          return (
            <button
              key={note}
              onClick={() => isActive && !disabled && onGuess(note)}
              style={{
                flex: 1,
                borderRadius: "0 0 6px 6px",
                border: "1.5px solid var(--border)",
                background: keyColor(note),
                cursor: isActive && !disabled ? "pointer" : "default",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: "0.375rem",
                fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.625rem",
                color: textColor(note),
                transition: "background 0.12s, transform 0.06s",
                opacity: isActive ? 1 : 0.35,
                transform: "none",
                outline: "none",
                position: "relative",
                zIndex: 1,
              }}
            >
              {note}
            </button>
          );
        })}
      </div>

      {/* Sharp/flat keys — absolute positioned */}
      {sharpKeys.map(note => {
        const whiteIndex = sharpPositions[note];
        const isActive = activeNotes.has(note);
        // Position: center over gap between white keys whiteIndex-1 and whiteIndex
        // Each white key is whiteWidth% wide
        const leftPct = (whiteIndex * whiteWidth) - (whiteWidth * 0.3);
        return (
          <button
            key={note}
            onClick={() => isActive && !disabled && onGuess(note)}
            style={{
              position: "absolute",
              top: 0,
              left: `${leftPct}%`,
              width: `${whiteWidth * 0.6}%`,
              height: "62%",
              borderRadius: "0 0 4px 4px",
              border: "none",
              background: keyColor(note),
              cursor: isActive && !disabled ? "pointer" : "default",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              paddingBottom: "0.25rem",
              fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.5rem",
              color: textColor(note),
              transition: "background 0.12s",
              opacity: isActive ? 1 : 0.35,
              zIndex: 2,
              outline: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
            }}
          >
            {note}
          </button>
        );
      })}
    </div>
  );
}
