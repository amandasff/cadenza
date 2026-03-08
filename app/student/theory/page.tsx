"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";

// ── Notes: position = half-steps from first (bottom) staff line, 0 = line 1 ──
const TREBLE_NOTES = [
  { name: "C4",  position: -2 },
  { name: "D4",  position: -1 },
  { name: "E4",  position:  0 },
  { name: "F4",  position:  1 },
  { name: "G4",  position:  2 },
  { name: "A4",  position:  3 },
  { name: "B4",  position:  4 },
  { name: "C5",  position:  5 },
  { name: "D5",  position:  6 },
  { name: "E5",  position:  7 },
  { name: "F5",  position:  8 },
  { name: "G5",  position:  9 },
];

const BASS_NOTES = [
  { name: "E2",  position:  0 },
  { name: "F2",  position:  1 },
  { name: "G2",  position:  2 },
  { name: "A2",  position:  3 },
  { name: "B2",  position:  4 },
  { name: "C3",  position:  5 },
  { name: "D3",  position:  6 },
  { name: "E3",  position:  7 },
  { name: "F3",  position:  8 },
  { name: "G3",  position:  9 },
  { name: "A3",  position: 10 },
];

type Clef = "treble" | "bass";
const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// ── Staff dimensions ──────────────────────────────────────────────────────────
const LS = 18;           // line spacing px
const BOTTOM_Y = 94;     // Y of first (bottom) line
const NOTE_X  = 140;     // X of note head center
const SVG_W   = 260;
const SVG_H   = 155;

function posToY(pos: number) { return BOTTOM_Y - pos * (LS / 2); }

function Staff({ clef, notePos, noteColor = "#FDFCFA" }: {
  clef: Clef; notePos: number; noteColor?: string;
}) {
  const staffLines = [0, 2, 4, 6, 8];
  const noteY = posToY(notePos);

  // Ledger lines
  const ledgers: number[] = [];
  if (notePos <= -2) for (let p = -2; p >= notePos; p -= 2) ledgers.push(p);
  if (notePos >= 10) for (let p = 10; p <= notePos; p += 2) ledgers.push(p);

  return (
    <svg
      width={SVG_W} height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Staff lines */}
      {staffLines.map(lp => (
        <line key={lp} x1={36} y1={posToY(lp)} x2={SVG_W - 16} y2={posToY(lp)}
          stroke="rgba(255,255,255,0.55)" strokeWidth={1.4} />
      ))}

      {/* Treble clef — baseline sits at E4 (pos 0), curl wraps G4 (pos 2) */}
      {clef === "treble" && (
        <text
          x={12} y={posToY(0) + 3}
          fontSize={74}
          fontFamily="'Times New Roman', 'Georgia', serif"
          fill="rgba(255,255,255,0.6)"
          style={{ userSelect: "none", lineHeight: 1 }}
          dominantBaseline="auto"
        >
          𝄞
        </text>
      )}

      {/* Bass clef — position its F-dot on the 4th line (pos 6) */}
      {clef === "bass" && (
        <text
          x={12} y={posToY(6) + 3}
          fontSize={40}
          fontFamily="'Times New Roman', 'Georgia', serif"
          fill="rgba(255,255,255,0.6)"
          style={{ userSelect: "none", lineHeight: 1 }}
          dominantBaseline="auto"
        >
          𝄢
        </text>
      )}

      {/* Ledger lines */}
      {ledgers.map(lp => (
        <line key={lp} x1={NOTE_X - 17} y1={posToY(lp)} x2={NOTE_X + 17} y2={posToY(lp)}
          stroke="rgba(255,255,255,0.55)" strokeWidth={1.4} />
      ))}

      {/* Note head */}
      <ellipse
        cx={NOTE_X} cy={noteY}
        rx={11} ry={8}
        fill={noteColor}
        transform={`rotate(-15, ${NOTE_X}, ${noteY})`}
      />

      {/* Stem */}
      <line
        x1={NOTE_X + 10} y1={noteY}
        x2={NOTE_X + 10} y2={noteY - 38}
        stroke={noteColor} strokeWidth={1.8}
      />
    </svg>
  );
}

// ── Game scoring ──────────────────────────────────────────────────────────────
const ROUND_DURATION = 30;

function streakMult(streak: number) {
  if (streak >= 10) return 3;
  if (streak >= 5)  return 2;
  if (streak >= 3)  return 1.5;
  return 1;
}

function speedBonus(ms: number) {
  if (ms < 1000) return 75;
  if (ms < 2000) return 50;
  if (ms < 3500) return 25;
  return 0;
}

function grade(accuracy: number) {
  if (accuracy >= 0.95) return { label: "S", color: "#FFD700" };
  if (accuracy >= 0.85) return { label: "A", color: "#4CAF84" };
  if (accuracy >= 0.70) return { label: "B", color: "#A8C96E" };
  if (accuracy >= 0.55) return { label: "C", color: "#E6A817" };
  return                       { label: "D", color: "#E05252" };
}

function hiKey(clef: Clef) { return `theory_hi_nid_${clef}`; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function makeQuestion(clef: Clef, prevPos?: number) {
  const pool = clef === "treble" ? TREBLE_NOTES : BASS_NOTES;
  // avoid repeating same note twice in a row
  const filtered = pool.length > 1 ? pool.filter(n => n.position !== prevPos) : pool;
  const note = filtered[Math.floor(Math.random() * filtered.length)];
  const correct = note.name.replace(/\d/, "");
  const wrongs = shuffle(NOTE_LETTERS.filter(l => l !== correct)).slice(0, 3);
  return { note, correct, choices: shuffle([correct, ...wrongs]) };
}

// ── Game types ────────────────────────────────────────────────────────────────
type GameState = "menu" | "countdown" | "playing" | "results";

interface PopupEntry { id: number; text: string; }

// ── Main component ────────────────────────────────────────────────────────────
export default function TheoryPage() {
  const [view, setView] = useState<"list" | "nid">("list");

  if (view === "list") return <Menu onStart={() => setView("nid")} />;
  return <NoteIdGame onBack={() => setView("list")} />;
}

// ── Menu ──────────────────────────────────────────────────────────────────────
function Menu({ onStart }: { onStart: () => void }) {
  const trebleHi = typeof window !== "undefined" ? Number(localStorage.getItem(hiKey("treble")) ?? 0) : 0;
  const bassHi   = typeof window !== "undefined" ? Number(localStorage.getItem(hiKey("bass"))   ?? 0) : 0;

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", padding: "2.5rem 1.5rem", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>
            Theory Practice
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Sharpen your musical ear and eye. Practice in fast-paced rounds and beat your personal best.
          </p>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {/* Note ID game card */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(74,103,185,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.35rem" }}>
                🎵
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                  Note Identification
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem", lineHeight: 1.6 }}>
                  30 seconds. Notes flash on the staff — name them as fast as you can. Streaks multiply your score.
                </p>
                {(trebleHi > 0 || bassHi > 0) && (
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "0.875rem" }}>
                    {trebleHi > 0 && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>🏆 Treble: <strong style={{ color: "var(--charcoal)" }}>{trebleHi.toLocaleString()}</strong></div>}
                    {bassHi > 0   && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>🏆 Bass: <strong style={{ color: "var(--charcoal)" }}>{bassHi.toLocaleString()}</strong></div>}
                  </div>
                )}
                <button
                  onClick={onStart}
                  style={{
                    padding: "0.5rem 1.25rem", borderRadius: 4, background: "var(--charcoal)", border: "none",
                    color: "var(--white)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif",
                    fontWeight: 500, cursor: "pointer", letterSpacing: "0.02em",
                  }}
                >
                  Play now
                </button>
              </div>
            </div>
          </div>

          {/* Coming soon */}
          {[
            { icon: "👂", title: "Interval Ear Training", desc: "Hear two notes — identify the interval. Builds from P5 and octave up to all 13 intervals." },
            { icon: "📖", title: "Sight Reading", desc: "Short melodic passages graded by RCM level. Sing or play, then self-rate." },
            { icon: "🎼", title: "Chord Quality", desc: "Major, minor, diminished, augmented — hear a chord, name it instantly." },
            { icon: "🥁", title: "Rhythm Clapping", desc: "See a rhythm pattern and tap it back. RCM exam prep." },
          ].map(item => (
            <div key={item.title} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.5rem", opacity: 0.48 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(74,103,185,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.25rem" }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{item.title}</div>
                    <span style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.125rem 0.375rem" }}>Soon</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Note ID Game ──────────────────────────────────────────────────────────────
function NoteIdGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [clef, setClef] = useState<Clef>("treble");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [topStreak, setTopStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal]   = useState(0);
  const [question, setQuestion] = useState(() => makeQuestion("treble"));
  const [selected, setSelected] = useState<string | null>(null);
  const [popups, setPopups] = useState<PopupEntry[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  const [hiScore, setHiScore] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupId = useRef(0);

  // Load hi score when clef changes
  useEffect(() => {
    if (gameState === "menu") {
      const stored = Number(localStorage.getItem(hiKey(clef)) ?? 0);
      setHiScore(stored);
    }
  }, [clef, gameState]);

  const nextQuestion = useCallback((currentClef: Clef, prevPos?: number) => {
    setSelected(null);
    setQuestion(makeQuestion(currentClef, prevPos));
    setQuestionStartTime(Date.now());
  }, []);

  function addPopup(text: string) {
    const id = ++popupId.current;
    setPopups(p => [...p, { id, text }]);
    setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 1200);
  }

  function startGame(selectedClef: Clef) {
    setClef(selectedClef);
    setHiScore(Number(localStorage.getItem(hiKey(selectedClef)) ?? 0));
    setScore(0);
    setStreak(0);
    setTopStreak(0);
    setCorrect(0);
    setTotal(0);
    setSelected(null);
    setNewRecord(false);
    setPopups([]);
    setCountdown(3);
    setGameState("countdown");

    let cd = 3;
    const cdInterval = setInterval(() => {
      cd -= 1;
      setCountdown(cd);
      if (cd <= 0) {
        clearInterval(cdInterval);
        beginPlay(selectedClef);
      }
    }, 1000);
  }

  function beginPlay(selectedClef: Clef) {
    setTimeLeft(ROUND_DURATION);
    setGameState("playing");
    setQuestion(makeQuestion(selectedClef));
    setQuestionStartTime(Date.now());

    let t = ROUND_DURATION;
    timerRef.current = setInterval(() => {
      t -= 1;
      setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        endGame();
      }
    }, 1000);
  }

  function endGame() {
    setGameState("results");
    setScore(prev => {
      const stored = Number(localStorage.getItem(hiKey(clef)) ?? 0);
      if (prev > stored) {
        localStorage.setItem(hiKey(clef), String(prev));
        setHiScore(prev);
        setNewRecord(true);
      }
      return prev;
    });
  }

  function handleAnswer(choice: string) {
    if (selected || gameState !== "playing") return;
    if (advanceRef.current) clearTimeout(advanceRef.current);

    setSelected(choice);
    const isCorrect = choice === question.correct;
    const ms = Date.now() - questionStartTime;

    setTotal(t => t + 1);
    let nextStreak = streak;

    if (isCorrect) {
      setCorrect(c => c + 1);
      nextStreak = streak + 1;
      setStreak(nextStreak);
      setTopStreak(ts => Math.max(ts, nextStreak));

      const mult = streakMult(nextStreak);
      const bonus = speedBonus(ms);
      const pts = Math.round((100 + bonus) * mult);
      setScore(s => s + pts);

      let popupText = `+${pts}`;
      if (mult > 1) popupText += ` ×${mult}`;
      addPopup(popupText);
    } else {
      setStreak(0);
      nextStreak = 0;
    }

    const delay = isCorrect ? 600 : 1200;
    advanceRef.current = setTimeout(() => {
      nextQuestion(clef, question.note.position);
    }, delay);
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advanceRef.current) clearTimeout(advanceRef.current);
  }, []);

  // ── MENU screen ──
  if (gameState === "menu") {
    return (
      <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
        <TopBar onBack={onBack} label="Note Identification" right={null} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
          <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>

            {/* Hi score */}
            <div style={{ marginBottom: "2.5rem" }}>
              <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem" }}>
                Personal Best
              </div>
              <div style={{ fontSize: "3rem", fontWeight: 700, color: "#FDFCFA", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {hiScore > 0 ? hiScore.toLocaleString() : "—"}
              </div>
            </div>

            {/* Staff preview */}
            <div style={{ background: "#2C2C2E", borderRadius: 12, padding: "1rem 1.5rem", marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Staff clef={clef} notePos={clef === "treble" ? 2 : 4} noteColor="rgba(255,255,255,0.3)" />
            </div>

            {/* Clef toggle */}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "2rem" }}>
              {(["treble", "bass"] as Clef[]).map(c => (
                <button
                  key={c}
                  onClick={() => setClef(c)}
                  style={{
                    padding: "0.5rem 1.25rem", borderRadius: 20, cursor: "pointer",
                    background: clef === c ? "#4CAF84" : "transparent",
                    border: `1.5px solid ${clef === c ? "#4CAF84" : "rgba(255,255,255,0.2)"}`,
                    color: clef === c ? "#fff" : "rgba(255,255,255,0.5)",
                    fontSize: "0.8125rem", fontFamily: "Inter, sans-serif",
                    fontWeight: clef === c ? 600 : 400, transition: "all 0.15s",
                  }}
                >
                  {c === "treble" ? "Treble Clef" : "Bass Clef"}
                </button>
              ))}
            </div>

            {/* Instructions */}
            <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.35)", marginBottom: "2rem", lineHeight: 1.7 }}>
              30 seconds · answer fast for bonus points<br/>
              streaks multiply your score up to 3×
            </div>

            <button
              onClick={() => startGame(clef)}
              style={{
                width: "100%", padding: "0.875rem", borderRadius: 8, border: "none",
                background: "#4CAF84", color: "#fff", fontSize: "1rem",
                fontFamily: "Inter, sans-serif", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.02em",
                boxShadow: "0 0 24px #4CAF8444",
              }}
            >
              Start Round
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── COUNTDOWN screen ──
  if (gameState === "countdown") {
    return (
      <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "1rem" }}>
          Get ready…
        </div>
        <div style={{ fontSize: "6rem", fontWeight: 800, color: "#FDFCFA", lineHeight: 1, letterSpacing: "-0.04em", transition: "all 0.2s" }}>
          {countdown}
        </div>
      </div>
    );
  }

  // ── PLAYING screen ──
  if (gameState === "playing") {
    const timePct = timeLeft / ROUND_DURATION;
    const timerColor = timePct > 0.5 ? "#4CAF84" : timePct > 0.25 ? "#E6A817" : "#E05252";
    const mult = streakMult(streak);
    const isCorrect = selected === question.correct;

    return (
      <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>

        {/* Timer bar */}
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${timePct * 100}%`,
            background: timerColor,
            transition: "width 0.9s linear, background 0.5s",
          }} />
        </div>

        {/* Header: timer + score + streak */}
        <div style={{ padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: `2px solid ${timerColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.9375rem", fontWeight: 700, color: timerColor,
            transition: "border-color 0.5s, color 0.5s",
            flexShrink: 0,
          }}>
            {timeLeft}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#FDFCFA", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {score.toLocaleString()}
            </div>
            {mult > 1 && (
              <div style={{ fontSize: "0.6875rem", color: mult >= 3 ? "#FFD700" : mult >= 2 ? "#E6A817" : "#A8C96E", fontWeight: 700, letterSpacing: "0.04em" }}>
                ×{mult} MULTIPLIER
              </div>
            )}
          </div>
          {streak >= 3 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>🔥</div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: mult >= 3 ? "#FFD700" : "#E6A817", letterSpacing: "0.02em" }}>
                {streak}
              </div>
            </div>
          )}
        </div>

        {/* Staff + popup area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem 1rem", position: "relative" }}>

          {/* Score popups */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {popups.map(p => (
              <div key={p.id} style={{
                fontSize: "1.125rem", fontWeight: 800, color: "#4CAF84",
                animation: "floatUp 1.2s ease-out forwards",
                letterSpacing: "-0.01em",
              }}>
                {p.text}
              </div>
            ))}
          </div>

          <div style={{ maxWidth: 380, width: "100%" }}>
            {/* Prompt */}
            <div style={{ textAlign: "center", marginBottom: "1.25rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>
              What note is this?
            </div>

            {/* Staff */}
            <div style={{ background: "#252537", borderRadius: 14, padding: "1rem 0.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 30px rgba(0,0,0,0.3)", minHeight: 130 }}>
              <Staff
                clef={clef}
                notePos={question.note.position}
                noteColor={
                  !selected ? "#FDFCFA"
                  : isCorrect ? "#4CAF84"
                  : "#E05252"
                }
              />
            </div>

            {/* Answer buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              {question.choices.map(choice => {
                const isSelected = selected === choice;
                const isRight = choice === question.correct;
                let bg = "rgba(255,255,255,0.06)";
                let border = "1px solid rgba(255,255,255,0.1)";
                let color = "#FDFCFA";

                if (selected) {
                  if (isRight) { bg = "rgba(76,175,132,0.18)"; border = "1.5px solid #4CAF84"; color = "#4CAF84"; }
                  else if (isSelected) { bg = "rgba(224,82,82,0.18)"; border = "1.5px solid #E05252"; color = "#E05252"; }
                  else { bg = "rgba(255,255,255,0.03)"; border = "1px solid rgba(255,255,255,0.05)"; color = "rgba(255,255,255,0.3)"; }
                }

                return (
                  <button
                    key={choice}
                    onClick={() => handleAnswer(choice)}
                    disabled={!!selected}
                    style={{
                      padding: "1rem", borderRadius: 10, border, background: bg, color,
                      fontSize: "1.5rem", fontFamily: "Inter, sans-serif", fontWeight: 700,
                      cursor: selected ? "default" : "pointer", transition: "all 0.1s",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes floatUp {
            0%   { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-60px); }
          }
        `}</style>
      </div>
    );
  }

  // ── RESULTS screen ──
  if (gameState === "results") {
    const accuracy = total > 0 ? correct / total : 0;
    const g = grade(accuracy);

    return (
      <div style={{ minHeight: "100%", background: "#1a1a2e", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
        <TopBar onBack={onBack} label="Round complete" right={null} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
          <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>

            {/* New record banner */}
            {newRecord && (
              <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FFD700", marginBottom: "0.75rem", animation: "floatUp 0.4s ease-out" }}>
                🏆 New Personal Best!
              </div>
            )}

            {/* Grade */}
            <div style={{ fontSize: "5rem", fontWeight: 800, color: g.color, lineHeight: 1, marginBottom: "0.25rem", letterSpacing: "-0.04em" }}>
              {g.label}
            </div>

            {/* Score */}
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#FDFCFA", letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>
              {score.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2rem" }}>
              pts · {clef} clef
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "2rem" }}>
              {[
                { label: "Correct", value: `${correct}/${total}` },
                { label: "Accuracy", value: total > 0 ? `${Math.round(accuracy * 100)}%` : "—" },
                { label: "Top Streak", value: topStreak > 0 ? `🔥 ${topStreak}` : "0" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "0.875rem 0.5rem" }}>
                  <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FDFCFA", marginBottom: "0.25rem" }}>{stat.value}</div>
                  <div style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Personal best */}
            {hiScore > 0 && !newRecord && (
              <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.3)", marginBottom: "1.5rem" }}>
                Best: {hiScore.toLocaleString()} pts
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button
                onClick={() => startGame(clef)}
                style={{ flex: 1, padding: "0.875rem", borderRadius: 8, border: "none", background: "#4CAF84", color: "#fff", fontSize: "0.9375rem", fontFamily: "Inter, sans-serif", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 20px #4CAF8440" }}
              >
                Play Again
              </button>
              <button
                onClick={() => setGameState("menu")}
                style={{ flex: 1, padding: "0.875rem", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "0.9375rem", fontFamily: "Inter, sans-serif", fontWeight: 500, cursor: "pointer" }}
              >
                Change Clef
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes floatUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}

// ── Shared top bar ────────────────────────────────────────────────────────────
function TopBar({ onBack, label, right }: { onBack: () => void; label: string; right: React.ReactNode }) {
  return (
    <div style={{ padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", padding: 0, display: "flex", alignItems: "center", gap: "0.375rem" }}>
        ← Back
      </button>
      <span style={{ flex: 1, textAlign: "center", fontWeight: 600, fontSize: "0.8125rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>{label}</span>
      <div style={{ minWidth: 40 }}>{right}</div>
    </div>
  );
}
