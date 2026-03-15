"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useI18n } from "../../../lib/context/I18nContext";

// ── Audio engine ──────────────────────────────────────────────────────────────

function midiToFreq(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

function scheduleChord(
  ctx: AudioContext,
  midiNotes: number[],
  startTime: number,
  duration: number,
  gainVal = 0.13,
) {
  for (const midi of midiNotes) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    // add 2nd harmonic for piano-ish warmth
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = midiToFreq(midi);
    osc2.type = "sine"; osc2.frequency.value = midiToFreq(midi) * 2;
    g2.gain.value = 0.3;
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(gainVal, startTime + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(g);  g.connect(ctx.destination);
    osc2.connect(g2); g2.connect(ctx.destination);
    osc.start(startTime); osc.stop(startTime + duration + 0.05);
    osc2.start(startTime); osc2.stop(startTime + duration + 0.05);
  }
}

// ── Chord / key data ──────────────────────────────────────────────────────────

// Triads in C major (MIDI, root position)
const TRIADS: Record<string, number[]> = {
  "I":    [60, 64, 67],
  "ii":   [62, 65, 69],
  "iii":  [64, 67, 71],
  "IV":   [65, 69, 72],
  "V":    [67, 71, 74],
  "vi":   [69, 72, 76],
  "vii°": [71, 74, 77],
};

type Progression = { numerals: string[]; label: string; style: string };

const PROG_EASY: Progression[] = [
  { numerals: ["I","IV","V","I"],   label: "I – IV – V – I",   style: "Classic" },
  { numerals: ["I","V","IV","I"],   label: "I – V – IV – I",   style: "Rock" },
  { numerals: ["I","IV","I","V"],   label: "I – IV – I – V",   style: "Folk" },
  { numerals: ["I","V","I","I"],    label: "I – V – I – I",    style: "Simple" },
  { numerals: ["I","IV","V","V"],   label: "I – IV – V – V",   style: "Blues" },
];
const PROG_MEDIUM: Progression[] = [
  { numerals: ["I","V","vi","IV"],  label: "I – V – vi – IV",  style: "Pop" },
  { numerals: ["I","vi","IV","V"],  label: "I – vi – IV – V",  style: "50s" },
  { numerals: ["I","iii","IV","V"], label: "I – iii – IV – V", style: "Pop-rock" },
  { numerals: ["vi","IV","I","V"],  label: "vi – IV – I – V",  style: "Minor feel" },
  { numerals: ["I","IV","ii","V"],  label: "I – IV – ii – V",  style: "Jazz-pop" },
  { numerals: ["ii","V","I","I"],   label: "ii – V – I – I",   style: "Jazz" },
];
const PROG_HARD: Progression[] = [
  { numerals: ["ii","V","I","vi"],  label: "ii – V – I – vi",  style: "Jazz turnaround" },
  { numerals: ["I","vi","ii","V"],  label: "I – vi – ii – V",  style: "Rhythm changes" },
  { numerals: ["iii","vi","ii","V"],label:"iii – vi – ii – V", style: "Jazz" },
  { numerals: ["vi","ii","V","I"],  label: "vi – ii – V – I",  style: "Jazz" },
  { numerals: ["I","iii","vi","V"], label: "I – iii – vi – V", style: "Baroque" },
];
const ALL_PROGRESSIONS: Record<string, Progression[]> = {
  easy:   PROG_EASY,
  medium: PROG_MEDIUM,
  hard:   [...PROG_EASY, ...PROG_MEDIUM, ...PROG_HARD],
};

// Keys for the Key ID game
type KeyEntry = { name: string; rootMidi: number };
const KEYS_EASY: KeyEntry[]   = [
  { name: "C major", rootMidi: 60 }, { name: "G major", rootMidi: 67 },
  { name: "F major", rootMidi: 65 }, { name: "D major", rootMidi: 62 },
];
const KEYS_MEDIUM: KeyEntry[] = [
  { name: "C major", rootMidi: 60 }, { name: "G major", rootMidi: 67 },
  { name: "D major", rootMidi: 62 }, { name: "A major", rootMidi: 69 },
  { name: "F major", rootMidi: 65 }, { name: "Bb major", rootMidi: 70 },
];
const KEYS_HARD: KeyEntry[]   = [
  ...KEYS_MEDIUM,
  { name: "E major",  rootMidi: 64 }, { name: "B major",  rootMidi: 71 },
  { name: "Ab major", rootMidi: 68 }, { name: "Eb major", rootMidi: 63 },
];
const ALL_KEYS: Record<string, KeyEntry[]> = {
  easy: KEYS_EASY, medium: KEYS_MEDIUM, hard: KEYS_HARD,
};

// Build major-scale I-IV-V-I cadence from a root MIDI note
function cadenceChords(root: number): number[][] {
  const I  = [root, root+4, root+7];
  const IV = [root+5, root+9,  root+12];
  const V  = [root+7, root+11, root+14];
  return [I, IV, V, I];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude !== undefined ? arr.filter(x => x !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type GameTab   = "progressions" | "key" | "songs";
type Phase     = "idle" | "active" | "answered";
type Difficulty = "easy" | "medium" | "hard";

// ── Real Songs data ───────────────────────────────────────────────────────────

type SongEntry = {
  title: string;
  artist: string;
  label: string;
  numerals: string[];
  style: string;
  youtubeId: string;   // direct YouTube video ID — reliable embed
};

// All IDs are official/VEVO uploads. Update if a video is removed.
const REAL_SONGS: SongEntry[] = [
  { title: "Let It Be",            artist: "The Beatles",    label: "I – V – vi – IV", numerals: ["I","V","vi","IV"], style: "Pop/Rock",   youtubeId: "QDYfEBY9NM4" },
  { title: "With or Without You",  artist: "U2",             label: "I – V – vi – IV", numerals: ["I","V","vi","IV"], style: "Rock",       youtubeId: "XmSdTa9kaiQ" },
  { title: "No Woman No Cry",      artist: "Bob Marley",     label: "I – V – vi – IV", numerals: ["I","V","vi","IV"], style: "Reggae",     youtubeId: "x6S5fBFYkE0" },
  { title: "Don't Stop Believin'", artist: "Journey",        label: "I – V – vi – IV", numerals: ["I","V","vi","IV"], style: "Rock",       youtubeId: "1k8craCGpgs" },
  { title: "Stand By Me",          artist: "Ben E. King",    label: "I – vi – IV – V", numerals: ["I","vi","IV","V"], style: "50s Soul",   youtubeId: "hwZNL7QVJjE" },
  { title: "La Bamba",             artist: "Ritchie Valens", label: "I – IV – V – I",  numerals: ["I","IV","V","I"],  style: "Rock/Folk",  youtubeId: "vIGtLtDuRQs" },
  { title: "Twist and Shout",      artist: "The Beatles",    label: "I – IV – V – I",  numerals: ["I","IV","V","I"],  style: "Rock/R&B",   youtubeId: "b-glYQNtCo0" },
  { title: "Despacito",            artist: "Luis Fonsi",     label: "vi – IV – I – V", numerals: ["vi","IV","I","V"], style: "Latin Pop",  youtubeId: "kTJczUoc26U" },
  { title: "Royals",               artist: "Lorde",          label: "vi – IV – I – V", numerals: ["vi","IV","I","V"], style: "Indie Pop",  youtubeId: "nlcIKh6sBtc" },
  { title: "All of Me",            artist: "John Legend",    label: "I – V – vi – IV", numerals: ["I","V","vi","IV"], style: "Pop/Soul",   youtubeId: "450p7goxZqg" },
  { title: "Africa",               artist: "Toto",           label: "I – V – vi – IV", numerals: ["I","V","vi","IV"], style: "Pop/Rock",   youtubeId: "FTQbiNvZqaY" },
  { title: "Somewhere Only We Know", artist: "Keane",        label: "I – V – vi – IV", numerals: ["I","V","vi","IV"], style: "Indie Rock", youtubeId: "Oalbertpmq9rA" },
  { title: "Autumn Leaves",        artist: "Jazz Standard",  label: "ii – V – I – I",  numerals: ["ii","V","I","I"],  style: "Jazz",       youtubeId: "r-Z8KuwI7Gc" },
  { title: "Fly Me to the Moon",   artist: "Frank Sinatra",  label: "I – vi – ii – V", numerals: ["I","vi","ii","V"], style: "Jazz",       youtubeId: "ZEcqHA7dbwM" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProgressionsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<GameTab>("progressions");
  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", paddingBottom: "5.5rem" }}>
      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1.25rem 1rem 0" }}>
        <div style={{ marginBottom: "0.25rem" }}>
          <Link href="/student/theory" style={{ color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", textDecoration: "none" }}>
            ← {t.nav.games}
          </Link>
        </div>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.625rem", color: "var(--charcoal)", margin: "0 0 0.125rem", letterSpacing: "-0.01em" }}>
          {t.student.earTrainingTitle}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", margin: "0 0 0.875rem" }}>
          {t.student.earTrainingSubtitle}
        </p>
        {/* Tabs */}
        <div style={{ display: "flex" }}>
          {(["progressions", "key", "songs"] as const).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0.4rem 0.875rem 0.625rem", fontFamily: "Inter, sans-serif",
              fontWeight: tab === tabKey ? 600 : 400, fontSize: "0.8125rem",
              color: tab === tabKey ? "var(--charcoal)" : "var(--muted)",
              borderBottom: `2px solid ${tab === tabKey ? "var(--charcoal)" : "transparent"}`,
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              {tabKey === "progressions" ? t.student.progressionsTab : tabKey === "key" ? t.student.keyIdTab : t.student.realSongsTab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "1rem" }}>
        {tab === "progressions" ? <ProgressionGame /> : tab === "key" ? <KeyIdGame /> : <RealSongsGame />}
      </div>
    </div>
  );
}

// ── Progression game ──────────────────────────────────────────────────────────

function ProgressionGame() {
  const { t } = useI18n();
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [phase, setPhase]           = useState<Phase>("idle");
  const [started, setStarted]       = useState(false);
  const [current, setCurrent]       = useState<Progression | null>(null);
  const [choices, setChoices]       = useState<Progression[]>([]);
  const [guess, setGuess]           = useState<Progression | null>(null);
  const [activeChord, setActiveChord] = useState<number>(-1); // which chord is highlighted
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [round, setRound]           = useState(0);
  const [prevProg, setPrevProg]     = useState<Progression | undefined>(undefined);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function clearTimer() { if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } }
  function stopAudio() { if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; } }
  useEffect(() => () => { clearTimer(); stopAudio(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const CHORD_DUR = 1.1;
  const CHORD_GAP = 0.05;

  function playProgression(prog: Progression, onDone: () => void) {
    stopAudio();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    prog.numerals.forEach((numeral, i) => {
      const chords = TRIADS[numeral];
      if (!chords) return;
      scheduleChord(ctx, chords, ctx.currentTime + i * (CHORD_DUR + CHORD_GAP), CHORD_DUR);
      const delay = i * (CHORD_DUR + CHORD_GAP) * 1000;
      setTimeout(() => setActiveChord(i), delay);
    });
    const totalMs = prog.numerals.length * (CHORD_DUR + CHORD_GAP) * 1000;
    timeoutRef.current = setTimeout(() => {
      setActiveChord(-1);
      if (audioCtxRef.current === ctx) { try { ctx.close(); } catch {} audioCtxRef.current = null; }
      onDone();
    }, totalMs);
  }

  function buildChoices(correct: Progression, pool: Progression[]): Progression[] {
    const others = shuffle(pool.filter(p => p.label !== correct.label)).slice(0, 3);
    return shuffle([correct, ...others]);
  }

  function nextRound(prev?: Progression) {
    clearTimer();
    const pool = ALL_PROGRESSIONS[difficulty];
    const prog = pickRandom(pool, prev);
    const ch = buildChoices(prog, pool);
    setCurrent(prog);
    setChoices(ch);
    setGuess(null);
    setActiveChord(-1);
    setPhase("active");
    setRound(r => r + 1);
    setPrevProg(prog);
    playProgression(prog, () => {});
  }

  function startGame() {
    setScore(0); setStreak(0); setRound(0); setStarted(true);
    nextRound();
  }

  function handleGuess(choice: Progression) {
    if (phase !== "active" || !current) return;
    clearTimer();
    setGuess(choice);
    setPhase("answered");
    if (choice.label === current.label) {
      const ns = streak + 1;
      setStreak(ns); setBestStreak(b => Math.max(b, ns));
      setScore(s => s + (difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1));
    } else {
      setStreak(0);
    }
    timeoutRef.current = setTimeout(() => nextRound(prevProg), 2000);
  }

  function replayProg() {
    if (!current || phase !== "active") return;
    clearTimer();
    setActiveChord(-1);
    playProgression(current, () => {});
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {started && (
        <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem" }}>
          {[{ l: t.student.scoreLabel, v: score }, { l: t.student.streakLabel, v: `${streak}🔥` }, { l: t.student.bestLabel, v: bestStreak }, { l: t.student.roundLabel, v: round }].map(({ l, v }) => (
            <div key={l} style={{ flex: 1, background: "var(--white)", borderRadius: 10, padding: "0.5rem 0.25rem", textAlign: "center", border: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--charcoal)", lineHeight: 1.2 }}>{v}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {!started ? (
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1.5rem 1.25rem" }}>
          <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "0.75rem" }}>🎵</div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.375rem", color: "var(--charcoal)", fontWeight: 500, textAlign: "center", marginBottom: "0.375rem" }}>Chord Progressions</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, textAlign: "center", margin: "0 0 1.25rem" }}>
            A 4-chord progression plays in C major. Identify the Roman numeral pattern by ear.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {(["easy", "medium", "hard"] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: "0.625rem 0", borderRadius: 10, fontFamily: "Inter, sans-serif",
                fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", transition: "all 0.15s",
                border: difficulty === d ? "none" : "1.5px solid var(--border)",
                background: difficulty === d ? "var(--charcoal)" : "transparent",
                color: difficulty === d ? "var(--white)" : "var(--muted)",
                textTransform: "capitalize",
              }}>{d}</button>
            ))}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
            {difficulty === "easy"   && "Common I, IV, V progressions — classic and rock"}
            {difficulty === "medium" && "Includes vi and ii — pop, folk, and jazz-pop"}
            {difficulty === "hard"   && "Full set including jazz turnarounds and complex patterns"}
          </div>
          <button onClick={startGame} style={{
            width: "100%", padding: "0.75rem", borderRadius: 24, border: "none",
            background: "var(--charcoal)", color: "var(--white)",
            fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
          }}>{t.student.startGame}</button>
        </div>
      ) : (
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1.25rem" }}>

          {/* Chord progress visualiser */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", textAlign: "center" }}>
              Playing in C major
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 52, height: 52, borderRadius: 10, border: "1.5px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.9375rem",
                  transition: "all 0.12s",
                  background: activeChord === i
                    ? "var(--charcoal)"
                    : phase === "answered" && current
                      ? (i === 0 ? "rgba(74,103,185,0.08)" : "transparent")
                      : "transparent",
                  color: activeChord === i ? "var(--white)" : "var(--charcoal)",
                  boxShadow: activeChord === i ? "0 4px 16px rgba(0,0,0,0.18)" : "none",
                }}>
                  {phase === "answered" && current ? current.numerals[i] : "?"}
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {phase === "answered" && guess && current && (
            <div style={{
              textAlign: "center", marginBottom: "0.875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem",
              color: guess.label === current.label ? "#27ae60" : "#c0392b",
            }}>
              {guess.label === current.label
                ? streak >= 3 ? t.student.inARow.replace("{n}", String(streak)) : t.student.correctFeedback
                : `That was ${current.label}`}
              {guess.label === current.label && (
                <span style={{ marginLeft: "0.375rem", fontSize: "0.75rem", fontWeight: 400, color: "var(--muted)" }}>({current.style})</span>
              )}
            </div>
          )}

          {/* Replay */}
          {phase === "active" && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem" }}>
              <button onClick={replayProg} style={{
                padding: "0.4rem 1.25rem", borderRadius: 20, border: "1.5px solid var(--border)",
                background: "transparent", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
                fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
              }}>{t.student.playAgain}</button>
            </div>
          )}

          {/* Answer choices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {choices.map(ch => {
              const isCorrect = phase === "answered" && ch.label === current?.label;
              const isWrong   = phase === "answered" && guess?.label === ch.label && ch.label !== current?.label;
              return (
                <button
                  key={ch.label}
                  onClick={() => handleGuess(ch)}
                  disabled={phase === "answered"}
                  style={{
                    padding: "0.75rem 0.5rem", borderRadius: 10, cursor: phase === "active" ? "pointer" : "default",
                    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem",
                    transition: "all 0.12s", textAlign: "center",
                    border: isCorrect ? "2px solid #27ae60" : isWrong ? "2px solid #c0392b" : "1.5px solid var(--border)",
                    background: isCorrect ? "rgba(39,174,96,0.1)" : isWrong ? "rgba(192,57,43,0.08)" : "var(--cream)",
                    color: isCorrect ? "#27ae60" : isWrong ? "#c0392b" : "var(--charcoal)",
                  }}
                >
                  <div style={{ marginBottom: "0.125rem" }}>{ch.label}</div>
                  <div style={{ fontWeight: 400, fontSize: "0.625rem", color: isCorrect ? "#27ae60" : isWrong ? "#c0392b" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{ch.style}</div>
                </button>
              );
            })}
          </div>

          <button onClick={() => { clearTimer(); setStarted(false); setPhase("idle"); }} style={{ marginTop: "1rem", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", textDecoration: "underline" }}>
            {t.student.endSession}
          </button>
        </div>
      )}

      {/* Cheat sheet */}
      <div style={{ marginTop: "1rem" }}>
        <RomanNumeralCheatSheet />
      </div>
    </>
  );
}

// ── Key ID game ───────────────────────────────────────────────────────────────

function KeyIdGame() {
  const { t } = useI18n();
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [phase, setPhase]           = useState<Phase>("idle");
  const [started, setStarted]       = useState(false);
  const [current, setCurrent]       = useState<KeyEntry | null>(null);
  const [choices, setChoices]       = useState<KeyEntry[]>([]);
  const [guess, setGuess]           = useState<KeyEntry | null>(null);
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [round, setRound]           = useState(0);
  const [prevKey, setPrevKey]       = useState<KeyEntry | undefined>(undefined);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function clearTimer() { if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } }
  function stopAudio() { if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; } }
  useEffect(() => () => { clearTimer(); stopAudio(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function playKey(key: KeyEntry) {
    stopAudio();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const chords = cadenceChords(key.rootMidi);
    const dur = 0.9;
    const gap = 0.08;
    chords.forEach((chord, i) => {
      scheduleChord(ctx, chord, ctx.currentTime + i * (dur + gap), dur, 0.11);
    });
    setTimeout(() => { if (audioCtxRef.current === ctx) { try { ctx.close(); } catch {} audioCtxRef.current = null; } }, (chords.length * (dur + gap) + 0.5) * 1000);
  }

  function buildKeyChoices(correct: KeyEntry, pool: KeyEntry[]): KeyEntry[] {
    const others = shuffle(pool.filter(k => k.name !== correct.name)).slice(0, 3);
    return shuffle([correct, ...others]);
  }

  function nextRound(prev?: KeyEntry) {
    clearTimer();
    const pool = ALL_KEYS[difficulty];
    const key = pickRandom(pool, prev);
    const ch = buildKeyChoices(key, pool);
    setCurrent(key);
    setChoices(ch);
    setGuess(null);
    setPhase("active");
    setRound(r => r + 1);
    setPrevKey(key);
    playKey(key);
  }

  function startGame() {
    setScore(0); setStreak(0); setRound(0); setStarted(true);
    nextRound();
  }

  function handleGuess(choice: KeyEntry) {
    if (phase !== "active" || !current) return;
    clearTimer();
    setGuess(choice);
    setPhase("answered");
    if (choice.name === current.name) {
      const ns = streak + 1;
      setStreak(ns); setBestStreak(b => Math.max(b, ns));
      setScore(s => s + (difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1));
    } else {
      setStreak(0);
    }
    timeoutRef.current = setTimeout(() => nextRound(prevKey), 2200);
  }

  function replayKey() {
    if (!current || phase !== "active") return;
    playKey(current);
  }

  return (
    <>
      {started && (
        <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem" }}>
          {[{ l: t.student.scoreLabel, v: score }, { l: t.student.streakLabel, v: `${streak}🔥` }, { l: t.student.bestLabel, v: bestStreak }, { l: t.student.roundLabel, v: round }].map(({ l, v }) => (
            <div key={l} style={{ flex: 1, background: "var(--white)", borderRadius: 10, padding: "0.5rem 0.25rem", textAlign: "center", border: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--charcoal)", lineHeight: 1.2 }}>{v}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {!started ? (
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1.5rem 1.25rem" }}>
          <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "0.75rem" }}>🔑</div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.375rem", color: "var(--charcoal)", fontWeight: 500, textAlign: "center", marginBottom: "0.375rem" }}>Key Identification</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, textAlign: "center", margin: "0 0 1.25rem" }}>
            A I–IV–V–I cadence plays. Identify which major key it&apos;s in. Listen for the brightness and feel.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {(["easy", "medium", "hard"] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: "0.625rem 0", borderRadius: 10, fontFamily: "Inter, sans-serif",
                fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", transition: "all 0.15s",
                border: difficulty === d ? "none" : "1.5px solid var(--border)",
                background: difficulty === d ? "var(--charcoal)" : "transparent",
                color: difficulty === d ? "var(--white)" : "var(--muted)",
                textTransform: "capitalize",
              }}>{d}</button>
            ))}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
            {difficulty === "easy"   && "4 keys: C, G, F, D — most common major keys"}
            {difficulty === "medium" && "6 keys: adds A and Bb"}
            {difficulty === "hard"   && "10 keys including sharper and flatter keys"}
          </div>
          <button onClick={startGame} style={{
            width: "100%", padding: "0.75rem", borderRadius: 24, border: "none",
            background: "var(--charcoal)", color: "var(--white)",
            fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
          }}>{t.student.startGame}</button>
        </div>
      ) : (
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1.25rem" }}>

          {/* Big question mark or answer */}
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            {phase === "active" ? (
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", color: "var(--muted)", fontStyle: "italic", lineHeight: 1 }}>
                What key is this?
              </div>
            ) : phase === "answered" && guess && current ? (
              <div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 500, color: guess.name === current.name ? "#27ae60" : "#c0392b", lineHeight: 1.1 }}>
                  {current.name}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: guess.name === current.name ? "#27ae60" : "#c0392b", fontWeight: 600, marginTop: "0.25rem" }}>
                  {guess.name === current.name ? (streak >= 3 ? t.student.inARow.replace("{n}", String(streak)) : t.student.correctFeedback) : `You guessed ${guess.name}`}
                </div>
              </div>
            ) : null}
          </div>

          {phase === "active" && (
            <div style={{ textAlign: "center", marginBottom: "0.875rem" }}>
              <button onClick={replayKey} style={{
                padding: "0.4rem 1.25rem", borderRadius: 20, border: "1.5px solid var(--border)",
                background: "transparent", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
                fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
              }}>{t.student.playAgain}</button>
            </div>
          )}

          {/* Answer grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {choices.map(ch => {
              const isCorrect = phase === "answered" && ch.name === current?.name;
              const isWrong   = phase === "answered" && guess?.name === ch.name && ch.name !== current?.name;
              return (
                <button
                  key={ch.name}
                  onClick={() => handleGuess(ch)}
                  disabled={phase === "answered"}
                  style={{
                    padding: "0.875rem 0.5rem", borderRadius: 10,
                    cursor: phase === "active" ? "pointer" : "default",
                    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem",
                    transition: "all 0.12s", textAlign: "center",
                    border: isCorrect ? "2px solid #27ae60" : isWrong ? "2px solid #c0392b" : "1.5px solid var(--border)",
                    background: isCorrect ? "rgba(39,174,96,0.1)" : isWrong ? "rgba(192,57,43,0.08)" : "var(--cream)",
                    color: isCorrect ? "#27ae60" : isWrong ? "#c0392b" : "var(--charcoal)",
                  }}
                >
                  {ch.name}
                </button>
              );
            })}
          </div>

          <button onClick={() => { clearTimer(); setStarted(false); setPhase("idle"); }} style={{ marginTop: "1rem", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", textDecoration: "underline" }}>
            {t.student.endSession}
          </button>
        </div>
      )}

      {!started && (
        <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", padding: "1rem 1.125rem", marginTop: "1rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>How to hear the key</div>
          {[
            "Listen for where it feels like it wants to resolve — that's the tonic (I)",
            "Brighter/sharper keys feel tenser; flatter keys feel warmer and rounder",
            "Anchor to C major first, then learn to hear how many steps away others feel",
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: i < 2 ? "0.5rem" : 0 }}>
              <span style={{ color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", flexShrink: 0 }}>{i + 1}.</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.55 }}>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Real Songs game ───────────────────────────────────────────────────────────

function RealSongsGame() {
  const { t } = useI18n();
  const [songIndex, setSongIndex] = useState(() => Math.floor(Math.random() * REAL_SONGS.length));
  const [phase, setPhase]         = useState<"active" | "answered">("active");
  const [guess, setGuess]         = useState<string | null>(null);
  const [choices, setChoices]     = useState<string[]>(() => buildSongChoices(REAL_SONGS[Math.floor(Math.random() * REAL_SONGS.length)].label));
  const [score, setScore]         = useState(0);
  const [streak, setStreak]       = useState(0);
  const [round, setRound]         = useState(1);
  const [playerKey, setPlayerKey] = useState(0); // remount iframe on song change
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() { if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } }
  useEffect(() => () => clearTimer(), []);

  const song = REAL_SONGS[songIndex];

  function buildSongChoices(correctLabel: string): string[] {
    const allLabels = [...new Set(REAL_SONGS.map(s => s.label))];
    const others = shuffle(allLabels.filter(l => l !== correctLabel)).slice(0, 3);
    return shuffle([correctLabel, ...others]);
  }

  function nextSong(currentIdx: number) {
    clearTimer();
    const next = (currentIdx + 1) % REAL_SONGS.length;
    setSongIndex(next);
    setGuess(null);
    setPhase("active");
    setRound(r => r + 1);
    setChoices(buildSongChoices(REAL_SONGS[next].label));
    setPlayerKey(k => k + 1);
  }

  function handleGuess(label: string) {
    if (phase === "answered") return;
    setGuess(label);
    setPhase("answered");
    if (label === song.label) {
      setScore(s => s + 1);
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
    timeoutRef.current = setTimeout(() => nextSong(songIndex), 2800);
  }

  const embedSrc = `https://www.youtube.com/embed/${song.youtubeId}?rel=0`;

  return (
    <>
      {/* Stats */}
      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem" }}>
        {[{ l: t.student.scoreLabel, v: score }, { l: t.student.streakLabel, v: `${streak}🔥` }, { l: t.student.roundLabel, v: round }].map(({ l, v }) => (
          <div key={l} style={{ flex: 1, background: "var(--white)", borderRadius: 10, padding: "0.5rem 0.25rem", textAlign: "center", border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--charcoal)", lineHeight: 1.2 }}>{v}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", marginBottom: "1rem" }}>
        {/* Inline YouTube player */}
        <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
          <iframe
            key={playerKey}
            src={embedSrc}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
            title={`${song.title} – ${song.artist}`}
          />
        </div>

        <div style={{ padding: "1rem 1.25rem" }}>
          {/* Song info */}
          <div style={{ marginBottom: "0.875rem" }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", fontWeight: 500, color: "var(--charcoal)", lineHeight: 1.2 }}>
              {song.title}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
              {song.artist} · <span style={{ textTransform: "uppercase", fontSize: "0.625rem", letterSpacing: "0.05em" }}>{song.style}</span>
            </div>
          </div>

          {/* Feedback */}
          {phase === "answered" && (
            <div style={{ textAlign: "center", marginBottom: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: guess === song.label ? "#27ae60" : "#c0392b" }}>
              {guess === song.label ? (streak >= 3 ? t.student.inARow.replace("{n}", String(streak)) : t.student.correctFeedback) : `It was ${song.label}`}
            </div>
          )}
          {phase === "active" && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", margin: "0 0 0.75rem", fontStyle: "italic" }}>
              Listen, then identify the main chord progression:
            </p>
          )}

          {/* Choices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {choices.map(label => {
              const isCorrect = phase === "answered" && label === song.label;
              const isWrong   = phase === "answered" && label === guess && label !== song.label;
              return (
                <button key={label} onClick={() => handleGuess(label)} disabled={phase === "answered"} style={{
                  padding: "0.75rem 0.5rem", borderRadius: 10, textAlign: "center",
                  cursor: phase === "active" ? "pointer" : "default",
                  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem",
                  transition: "all 0.12s",
                  border: isCorrect ? "2px solid #27ae60" : isWrong ? "2px solid #c0392b" : "1.5px solid var(--border)",
                  background: isCorrect ? "rgba(39,174,96,0.1)" : isWrong ? "rgba(192,57,43,0.08)" : "var(--cream)",
                  color: isCorrect ? "#27ae60" : isWrong ? "#c0392b" : "var(--charcoal)",
                }}>
                  {label}
                </button>
              );
            })}
          </div>

          <button onClick={() => nextSong(songIndex)} style={{ marginTop: "0.875rem", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", textDecoration: "underline" }}>
            {t.student.skipArrow}
          </button>
        </div>
      </div>

      {/* Roman numeral cheat sheet */}
      <RomanNumeralCheatSheet />
    </>
  );
}

// ── Shared cheat sheet ────────────────────────────────────────────────────────

function RomanNumeralCheatSheet() {
  const [open, setOpen] = useState(false);
  const DIATONIC = [
    { rn: "I",    quality: "major", example: "C",  degree: "1st" },
    { rn: "ii",   quality: "minor", example: "Dm", degree: "2nd" },
    { rn: "iii",  quality: "minor", example: "Em", degree: "3rd" },
    { rn: "IV",   quality: "major", example: "F",  degree: "4th" },
    { rn: "V",    quality: "major", example: "G",  degree: "5th" },
    { rn: "vi",   quality: "minor", example: "Am", degree: "6th" },
    { rn: "vii°", quality: "dim",   example: "B°", degree: "7th" },
  ];
  return (
    <div style={{ background: "var(--white)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)" }}>Roman numeral guide</span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", background: "var(--cream)", borderRadius: 99, padding: "0.1rem 0.5rem" }}>for beginners</span>
        </div>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", transition: "transform 0.15s", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {open && (
        <div style={{ padding: "0 1.125rem 1rem", borderTop: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0.75rem 0 0.625rem", lineHeight: 1.5 }}>
            Roman numerals describe chords by their position in a scale. The example below uses <strong>C major</strong> — the same pattern works in any key.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr auto", gap: "0.375rem 0.75rem", alignItems: "center" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Numeral</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>In C major</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Quality</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Degree</div>
            {DIATONIC.map(({ rn, quality, example, degree }) => (
              <React.Fragment key={rn}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.875rem", color: "var(--charcoal)" }}>{rn}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: quality === "major" ? "#4267b2" : quality === "minor" ? "#7a5c9e" : "#888" }}>{example}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", textTransform: "capitalize" }}>{quality}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>{degree}</div>
              </React.Fragment>
            ))}
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", margin: "0.75rem 0 0", lineHeight: 1.55 }}>
            Uppercase = major chord. Lowercase = minor chord. The numbers stay the same in any key — I is always the home chord, V always wants to resolve back to I.
          </p>
        </div>
      )}
    </div>
  );
}
