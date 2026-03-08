"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";

// ── Music theory data ─────────────────────────────────────────────────────────

const TREBLE_NOTES = [
  // Lines (bottom to top): E4, G4, B4, D5, F5
  // Spaces: F4, A4, C5, E5
  // Plus a few ledger lines
  { name: "C4",  octave: 4, position: -2, isLedger: true  }, // middle C (below staff)
  { name: "D4",  octave: 4, position: -1, isLedger: false },
  { name: "E4",  octave: 4, position: 0,  isLedger: false },  // first line
  { name: "F4",  octave: 4, position: 1,  isLedger: false },
  { name: "G4",  octave: 4, position: 2,  isLedger: false },  // second line
  { name: "A4",  octave: 4, position: 3,  isLedger: false },
  { name: "B4",  octave: 4, position: 4,  isLedger: false },  // third line
  { name: "C5",  octave: 5, position: 5,  isLedger: false },
  { name: "D5",  octave: 5, position: 6,  isLedger: false },  // fourth line
  { name: "E5",  octave: 5, position: 7,  isLedger: false },
  { name: "F5",  octave: 5, position: 8,  isLedger: false },  // fifth line
  { name: "G5",  octave: 5, position: 9,  isLedger: false },
  { name: "A5",  octave: 5, position: 10, isLedger: true  }, // above staff
];

const BASS_NOTES = [
  { name: "E2",  octave: 2, position: 0,  isLedger: false },
  { name: "F2",  octave: 2, position: 1,  isLedger: false },
  { name: "G2",  octave: 2, position: 2,  isLedger: false },
  { name: "A2",  octave: 2, position: 3,  isLedger: false },
  { name: "B2",  octave: 2, position: 4,  isLedger: false },
  { name: "C3",  octave: 3, position: 5,  isLedger: false },
  { name: "D3",  octave: 3, position: 6,  isLedger: false },
  { name: "E3",  octave: 3, position: 7,  isLedger: false },
  { name: "F3",  octave: 3, position: 8,  isLedger: false },
  { name: "G3",  octave: 3, position: 9,  isLedger: false },
  { name: "A3",  octave: 3, position: 10, isLedger: true  },
];

type Clef = "treble" | "bass";

const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// ── Intervals ─────────────────────────────────────────────────────────────────
const INTERVALS = [
  { name: "Unison",      semitones: 0  },
  { name: "Minor 2nd",   semitones: 1  },
  { name: "Major 2nd",   semitones: 2  },
  { name: "Minor 3rd",   semitones: 3  },
  { name: "Major 3rd",   semitones: 4  },
  { name: "Perfect 4th", semitones: 5  },
  { name: "Tritone",     semitones: 6  },
  { name: "Perfect 5th", semitones: 7  },
  { name: "Minor 6th",   semitones: 8  },
  { name: "Major 6th",   semitones: 9  },
  { name: "Minor 7th",   semitones: 10 },
  { name: "Major 7th",   semitones: 11 },
  { name: "Octave",      semitones: 12 },
];

// ── Staff SVG component ───────────────────────────────────────────────────────
function Staff({
  clef,
  notePosition,
  noteColor = "#1a1a2e",
  showLedgerAt,
}: {
  clef: Clef;
  notePosition: number;  // 0 = first line, increments by 0.5 per half-step
  noteColor?: string;
  showLedgerAt?: number;
}) {
  const lineSpacing = 12;  // px between staff lines
  const staffTop = 20;     // px from svg top to first (bottom) line
  const noteR = 6;
  const svgH = 100;
  const svgW = 200;

  // 5 staff lines: positions 0, 2, 4, 6, 8 (in half-steps from bottom line)
  const staffLines = [0, 2, 4, 6, 8];

  // Convert note position to Y (position 0 = bottom line, increases upward)
  const posToY = (pos: number) => staffTop + (8 - pos) * (lineSpacing / 2);

  const noteY = posToY(notePosition);

  // Ledger lines needed?
  const ledgerLines: number[] = [];
  if (notePosition <= -1) {
    // below staff: add ledger lines from -2 down to note position
    for (let p = -2; p >= notePosition; p -= 2) ledgerLines.push(p);
  }
  if (notePosition >= 10) {
    // above staff
    for (let p = 10; p <= notePosition; p += 2) ledgerLines.push(p);
  }
  // Middle C ledger for treble
  if (clef === "treble" && notePosition === -2) {
    ledgerLines.push(-2);
  }

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: "visible" }}>
      {/* Staff lines */}
      {staffLines.map(linePos => (
        <line
          key={linePos}
          x1={30} y1={posToY(linePos)} x2={svgW - 10} y2={posToY(linePos)}
          stroke="rgba(255,255,255,0.6)" strokeWidth={1.2}
        />
      ))}

      {/* Clef symbol */}
      {clef === "treble" ? (
        <text
          x={8} y={posToY(0) + 5}
          fontSize={52}
          fill="rgba(255,255,255,0.6)"
          fontFamily="serif"
          style={{ userSelect: "none" }}
        >
          𝄞
        </text>
      ) : (
        <text
          x={8} y={posToY(6) + 2}
          fontSize={32}
          fill="rgba(255,255,255,0.6)"
          fontFamily="serif"
          style={{ userSelect: "none" }}
        >
          𝄢
        </text>
      )}

      {/* Ledger lines */}
      {ledgerLines.map(lp => (
        <line
          key={lp}
          x1={95} y1={posToY(lp)} x2={125} y2={posToY(lp)}
          stroke="rgba(255,255,255,0.6)" strokeWidth={1.2}
        />
      ))}

      {/* Note head */}
      <ellipse
        cx={110} cy={noteY}
        rx={noteR} ry={noteR * 0.72}
        fill={noteColor}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={0.5}
        transform={`rotate(-15, 110, ${noteY})`}
      />

      {/* Stem */}
      <line
        x1={116} y1={noteY}
        x2={116} y2={noteY - 30}
        stroke={noteColor} strokeWidth={1.4}
      />
    </svg>
  );
}

// ── Game modes ────────────────────────────────────────────────────────────────
type GameMode = "menu" | "note-id" | "interval-id";

interface Question {
  type: "note-id";
  clef: Clef;
  noteIndex: number;         // index into TREBLE_NOTES or BASS_NOTES
  correctAnswer: string;     // e.g. "G"
  choices: string[];
}

// ── Utility ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateNoteQuestion(clef: Clef): Question {
  const pool = clef === "treble" ? TREBLE_NOTES : BASS_NOTES;
  const idx = Math.floor(Math.random() * pool.length);
  const note = pool[idx];
  const correct = note.name.replace(/\d/, "");

  // Distractors: pick 3 different letters
  const wrongLetters = shuffle(NOTE_LETTERS.filter(l => l !== correct)).slice(0, 3);
  const choices = shuffle([correct, ...wrongLetters]);

  return {
    type: "note-id",
    clef,
    noteIndex: idx,
    correctAnswer: correct,
    choices,
  };
}

// ── Main theory page ──────────────────────────────────────────────────────────
export default function TheoryPage() {
  const [mode, setMode] = useState<GameMode>("menu");
  const [clef, setClef] = useState<Clef>("treble");

  // Note ID game state
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newQuestion = useCallback((c: Clef) => {
    setSelected(null);
    setShowFeedback(false);
    setQuestion(generateNoteQuestion(c));
  }, []);

  function startNoteId(c: Clef) {
    setClef(c);
    setStreak(0);
    setSessionCorrect(0);
    setSessionTotal(0);
    setMode("note-id");
    newQuestion(c);
  }

  function handleAnswer(choice: string) {
    if (selected || !question) return;
    setSelected(choice);
    setShowFeedback(true);
    setSessionTotal(t => t + 1);

    const correct = choice === question.correctAnswer;
    if (correct) {
      setSessionCorrect(c => c + 1);
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }

    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      newQuestion(clef);
    }, correct ? 800 : 1400);
  }

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  // ── Menu ────────────────────────────────────────────────────────────────────
  if (mode === "menu") {
    return (
      <div style={{
        minHeight: "100%",
        background: "var(--cream)",
        padding: "2.5rem 1.5rem",
        fontFamily: "Inter, sans-serif",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{
              fontFamily: "Cormorant Garamond, Georgia, serif",
              fontSize: "2rem", fontWeight: 500,
              color: "var(--charcoal)", marginBottom: "0.375rem",
              letterSpacing: "-0.01em",
            }}>
              Theory Practice
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              Sharpen your musical ear and eye. Pick an exercise and practice at your own pace.
            </p>
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            {/* Note Identification */}
            <div style={{
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "1.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: "rgba(74,103,185,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.25rem",
                }}>
                  🎵
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                    Note Identification
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem", lineHeight: 1.6 }}>
                    A note appears on the staff. Identify it as fast as you can. Build your streak!
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => startNoteId("treble")}
                      style={{
                        padding: "0.5rem 1.125rem", borderRadius: 4,
                        background: "var(--charcoal)", border: "none",
                        color: "var(--white)", fontSize: "0.8125rem",
                        fontFamily: "Inter, sans-serif", fontWeight: 500,
                        cursor: "pointer", letterSpacing: "0.02em",
                      }}
                    >
                      Treble Clef
                    </button>
                    <button
                      onClick={() => startNoteId("bass")}
                      style={{
                        padding: "0.5rem 1.125rem", borderRadius: 4,
                        background: "none", border: "1px solid var(--border-strong)",
                        color: "var(--muted)", fontSize: "0.8125rem",
                        fontFamily: "Inter, sans-serif", fontWeight: 500,
                        cursor: "pointer", letterSpacing: "0.02em",
                      }}
                    >
                      Bass Clef
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Coming soon cards */}
            {[
              { icon: "👂", title: "Interval Ear Training", desc: "Listen to two notes and identify the interval. Builds from simple to complex, following RCM level requirements." },
              { icon: "📖", title: "Sight Reading", desc: "Short melodic passages graded by level. Sing or play along, then self-rate your accuracy." },
              { icon: "🎼", title: "Chord Quality", desc: "Major, minor, diminished, augmented — hear a chord and identify it instantly." },
              { icon: "🥁", title: "Rhythm Clapping", desc: "See a rhythm pattern and tap it back. Essential for RCM practical exams." },
            ].map(item => (
              <div
                key={item.title}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "1.5rem",
                  opacity: 0.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: "rgba(74,103,185,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: "1.25rem",
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
                        {item.title}
                      </div>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: "var(--muted)",
                        border: "1px solid var(--border-strong)", borderRadius: 3,
                        padding: "0.125rem 0.375rem",
                      }}>
                        Coming soon
                      </span>
                    </div>
                    <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Note ID Game ────────────────────────────────────────────────────────────
  if (mode === "note-id" && question) {
    const pool = clef === "treble" ? TREBLE_NOTES : BASS_NOTES;
    const noteData = pool[question.noteIndex];
    const isCorrect = selected === question.correctAnswer;
    const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : null;

    return (
      <div style={{
        minHeight: "100%",
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
      }}>
        {/* Top bar */}
        <div style={{
          background: "var(--white)",
          borderBottom: "1px solid var(--border)",
          padding: "0.875rem 1.5rem",
          display: "flex", alignItems: "center", gap: "1rem",
        }}>
          <button
            onClick={() => setMode("menu")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--muted)", fontSize: "0.8125rem",
              fontFamily: "Inter, sans-serif", padding: 0,
              display: "flex", alignItems: "center", gap: "0.375rem",
            }}
          >
            ← Back
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <span style={{
              fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)",
              letterSpacing: "0.02em",
            }}>
              Note ID · {clef === "treble" ? "Treble" : "Bass"} Clef
            </span>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            {streak >= 3 && (
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e05252", letterSpacing: "0.02em" }}>
                🔥 {streak}
              </span>
            )}
            {accuracy !== null && (
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {accuracy}% · {sessionTotal} seen
              </span>
            )}
          </div>
        </div>

        {/* Game area */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "2rem 1.5rem",
        }}>
          <div style={{ maxWidth: 440, width: "100%" }}>
            {/* Prompt */}
            <div style={{
              textAlign: "center", marginBottom: "2rem",
              fontSize: "0.8125rem", color: "var(--muted)",
              letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500,
            }}>
              What note is this?
            </div>

            {/* Staff display */}
            <div style={{
              background: "#1a1a2e",
              borderRadius: 12,
              padding: "1.5rem 2rem",
              marginBottom: "2rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              minHeight: 120,
            }}>
              {!showFeedback ? (
                <Staff
                  clef={clef}
                  notePosition={noteData.position}
                  noteColor="#FDFCFA"
                />
              ) : (
                <Staff
                  clef={clef}
                  notePosition={noteData.position}
                  noteColor={isCorrect ? "#4CAF84" : "#E05252"}
                />
              )}
            </div>

            {/* Feedback overlay */}
            {showFeedback && (
              <div style={{
                textAlign: "center",
                marginBottom: "1.25rem",
                fontSize: "1rem",
                fontWeight: 600,
                color: isCorrect ? "#4CAF84" : "#E05252",
                letterSpacing: "0.01em",
                minHeight: 28,
              }}>
                {isCorrect
                  ? streak >= 5 ? `🔥 ${streak} in a row!` : "Correct!"
                  : `That's ${question.correctAnswer}`
                }
              </div>
            )}
            {!showFeedback && <div style={{ minHeight: 28, marginBottom: "1.25rem" }} />}

            {/* Answer buttons */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.625rem",
            }}>
              {question.choices.map(choice => {
                let bg = "var(--white)";
                let border = "1px solid var(--border)";
                let color = "var(--charcoal)";

                if (selected) {
                  if (choice === question.correctAnswer) {
                    bg = "#f0faf5"; border = "1.5px solid #4CAF84"; color = "#2d7a5a";
                  } else if (choice === selected && choice !== question.correctAnswer) {
                    bg = "#fef2f2"; border = "1.5px solid #E05252"; color = "#c0392b";
                  } else {
                    opacity: 0.45;
                  }
                }

                return (
                  <button
                    key={choice}
                    onClick={() => handleAnswer(choice)}
                    disabled={!!selected}
                    style={{
                      padding: "0.875rem",
                      borderRadius: 8,
                      border,
                      background: bg,
                      color,
                      fontSize: "1.25rem",
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 600,
                      cursor: selected ? "default" : "pointer",
                      transition: "all 0.1s",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            {/* Skip */}
            {!selected && (
              <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
                <button
                  onClick={() => newQuestion(clef)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--muted)", fontSize: "0.75rem",
                    fontFamily: "Inter, sans-serif", letterSpacing: "0.03em",
                  }}
                >
                  Skip
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
