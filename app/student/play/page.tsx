"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff, Play, Square, RotateCcw, Music, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// ── Pitch detection (YIN algorithm) ─────────────────────────────────────────
function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const MIN_FREQ = 60;   // ~B1
  const MAX_FREQ = 1400; // ~F6
  const THRESHOLD = 0.15;

  const minPeriod = Math.floor(sampleRate / MAX_FREQ);
  const maxPeriod = Math.floor(sampleRate / MIN_FREQ);
  const bufLen = Math.min(buf.length, 2048);

  // YIN difference function
  const yinBuf = new Float32Array(maxPeriod);
  for (let tau = 1; tau < maxPeriod; tau++) {
    let sum = 0;
    for (let i = 0; i < bufLen - maxPeriod; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    yinBuf[tau] = sum;
  }

  // Cumulative mean normalized difference
  yinBuf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < maxPeriod; tau++) {
    runningSum += yinBuf[tau];
    yinBuf[tau] = runningSum > 0 ? (yinBuf[tau] * tau) / runningSum : 1;
  }

  // Find first dip below threshold
  let tau = minPeriod;
  while (tau < maxPeriod) {
    if (yinBuf[tau] < THRESHOLD) {
      while (tau + 1 < maxPeriod && yinBuf[tau + 1] < yinBuf[tau]) tau++;
      const freq = sampleRate / tau;
      return freq;
    }
    tau++;
  }
  return null;
}

function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

function midiToNoteName(midi: number): string {
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return NOTES[midi % 12] + Math.floor(midi / 12 - 1);
}

// ── Practice mode types + utilities ─────────────────────────────────────────
interface OMRNote {
  note: string;    // e.g. "C", "C#", "Bb"
  octave: number;  // 4 = middle C
  duration: number;
  beat: number;
}

interface PieceWithGame {
  id: string;
  title: string;
  composer: string | null;
  sheet_music_url: string | null;
  game: {
    notes_json: OMRNote[];
    key_signature: string | null;
    time_signature: string | null;
    bpm_suggestion: number;
    omr_confidence: number;
  } | null;
}

const NOTE_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, "E#": 5, F: 5, Fb: 4, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11, "B#": 0, Cb: 11,
};

function omrNoteToMidi(n: OMRNote): number {
  return (n.octave + 1) * 12 + (NOTE_SEMITONES[n.note] ?? 0);
}

// Convert an OMR piece (note+octave data) to a Song (string+fret data) so it
// can play through the same Yousician-style guitar game UI as built-in songs.
function omrPieceToSong(piece: PieceWithGame): Song {
  const game = piece.game!;
  const tsParts = (game.time_signature ?? "4/4").split("/").map(Number);
  const timeSignature: [number, number] = [tsParts[0] ?? 4, tsParts[1] ?? 4];

  // Map the piece's pitch range evenly across all 6 strings so every lane is
  // used and the game looks visually full, not clustered on 2 strings.
  // Key insight: midiForNote(string, fret) determines expected MIDI for hit
  // detection, so any string/fret combo that produces the same MIDI value is
  // equivalent for gameplay — we just need to spread them visually.
  const midiValues = game.notes_json
    .map(n => (n.octave + 1) * 12 + (NOTE_SEMITONES[n.note] ?? (NOTE_SEMITONES[n.note.charAt(0)] ?? 0)))
    .filter(m => m > 0);
  const minMidi = midiValues.length ? Math.min(...midiValues) : 60;
  const maxMidi = midiValues.length ? Math.max(...midiValues) : 72;
  const midiSpan = Math.max(1, maxMidi - minMidi);

  const notes: TabNote[] = game.notes_json.map(n => {
    const targetMidi = omrNoteToMidi(n);
    // Assign string by mapping pitch position in the piece's range to strings 1-6
    // (highest pitch → string 1, lowest → string 6). Then fret = targetMidi - openMidi.
    const normalized = (targetMidi - minMidi) / midiSpan; // 0.0 (low) … 1.0 (high)
    const stringAssign = Math.min(6, Math.max(1, Math.round(6 - normalized * 5)));
    const openMidi = STRING_OPEN_MIDI[6 - stringAssign];
    const fret = Math.max(0, Math.min(22, targetMidi - openMidi));
    return { beat: n.beat, string: stringAssign, fret, duration: n.duration };
  });

  return {
    id: piece.id,
    title: piece.title,
    artist: piece.composer ?? "Original",
    bpm: game.bpm_suggestion ?? 80,
    timeSignature,
    notes,
    difficulty: "intermediate",
  };
}

function pitchLaneColor(noteName: string): string {
  const colors: Record<string, string> = {
    C: "#e74c3c", D: "#e67e22", E: "#f1c40f",
    F: "#2ecc71", G: "#1abc9c", A: "#3498db", B: "#9b59b6",
  };
  return colors[noteName.charAt(0)] ?? "#888";
}

// ── Built-in songs (Guitar Pro-style note data) ──────────────────────────────
// Each note: { midi, duration (beats), string (1-6, high to low), fret }
// Standard tuning: E2 A2 D3 G3 B3 E4 (strings 6→1)
const STRING_OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // strings 6,5,4,3,2,1

interface TabNote {
  beat: number;       // beat position (0-indexed)
  string: number;     // 1 = high E, 6 = low E
  fret: number;
  duration: number;   // in beats
}

interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  timeSignature: [number, number];
  notes: TabNote[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

function midiForNote(string: number, fret: number): number {
  // STRING_OPEN_MIDI index 0 = string 6 (low E), index 5 = string 1 (high e)
  return STRING_OPEN_MIDI[6 - string] + fret;
}

const SONGS: Song[] = [
  {
    id: "smoke",
    title: "Smoke on the Water",
    artist: "Deep Purple",
    bpm: 112,
    timeSignature: [4, 4],
    difficulty: "beginner",
    notes: [
      // Low E bass drone
      { beat: 0,    string: 6, fret: 3,  duration: 4 },   // G2 bass
      // Main power chord riff on strings 5+4
      { beat: 0,    string: 5, fret: 0,  duration: 1 },   // A2
      { beat: 0,    string: 4, fret: 0,  duration: 1 },   // D3
      { beat: 1,    string: 5, fret: 3,  duration: 1 },   // C3
      { beat: 1,    string: 4, fret: 3,  duration: 1 },   // F3
      { beat: 2,    string: 5, fret: 5,  duration: 1 },   // D3
      { beat: 2,    string: 4, fret: 5,  duration: 1 },   // G3
      { beat: 3,    string: 5, fret: 3,  duration: 0.5 }, // C3
      { beat: 3,    string: 4, fret: 3,  duration: 0.5 }, // F3
      // High response melody on strings 1-3
      { beat: 4,    string: 3, fret: 5,  duration: 0.5 }, // C4
      { beat: 4.5,  string: 3, fret: 3,  duration: 0.5 }, // A#3
      { beat: 5,    string: 1, fret: 3,  duration: 0.5 }, // G4
      { beat: 5.5,  string: 1, fret: 1,  duration: 0.5 }, // F4
      { beat: 6,    string: 2, fret: 1,  duration: 0.5 }, // C4
      { beat: 6.5,  string: 3, fret: 0,  duration: 0.5 }, // G3
      { beat: 7,    string: 2, fret: 0,  duration: 1 },   // B3
      // Repeat riff
      { beat: 8,    string: 6, fret: 3,  duration: 4 },   // G2 bass
      { beat: 8,    string: 5, fret: 0,  duration: 1 },
      { beat: 8,    string: 4, fret: 0,  duration: 1 },
      { beat: 9,    string: 5, fret: 3,  duration: 1 },
      { beat: 9,    string: 4, fret: 3,  duration: 1 },
      { beat: 10,   string: 5, fret: 5,  duration: 1 },
      { beat: 10,   string: 4, fret: 5,  duration: 1 },
      { beat: 11,   string: 5, fret: 3,  duration: 0.5 },
      { beat: 11,   string: 4, fret: 3,  duration: 0.5 },
    ],
  },
  {
    id: "ode",
    title: "Ode to Joy",
    artist: "Beethoven",
    bpm: 90,
    timeSignature: [4, 4],
    difficulty: "beginner",
    notes: [
      // Upper octave — strings 1-2 (E4–D4)
      { beat: 0,    string: 1, fret: 0,  duration: 1 },   // E4
      { beat: 1,    string: 1, fret: 0,  duration: 1 },   // E4
      { beat: 2,    string: 1, fret: 1,  duration: 1 },   // F4
      { beat: 3,    string: 1, fret: 3,  duration: 1 },   // G4
      { beat: 4,    string: 1, fret: 3,  duration: 1 },   // G4
      { beat: 5,    string: 1, fret: 1,  duration: 1 },   // F4
      { beat: 6,    string: 1, fret: 0,  duration: 1 },   // E4
      { beat: 7,    string: 2, fret: 3,  duration: 1 },   // D4
      { beat: 8,    string: 2, fret: 1,  duration: 1 },   // C4
      { beat: 9,    string: 2, fret: 1,  duration: 1 },   // C4
      { beat: 10,   string: 2, fret: 3,  duration: 1 },   // D4
      { beat: 11,   string: 1, fret: 0,  duration: 1.5 }, // E4
      { beat: 12.5, string: 2, fret: 3,  duration: 0.5 }, // D4
      { beat: 13,   string: 2, fret: 3,  duration: 2 },   // D4
      // Middle register — strings 2-4 (B3–D3)
      { beat: 15,   string: 2, fret: 0,  duration: 1 },   // B3
      { beat: 16,   string: 3, fret: 2,  duration: 1 },   // A3
      { beat: 17,   string: 3, fret: 0,  duration: 1 },   // G3
      { beat: 18,   string: 3, fret: 0,  duration: 1 },   // G3
      { beat: 19,   string: 3, fret: 2,  duration: 1 },   // A3
      { beat: 20,   string: 2, fret: 0,  duration: 1 },   // B3
      { beat: 21,   string: 4, fret: 2,  duration: 1 },   // E3
      { beat: 22,   string: 4, fret: 0,  duration: 2 },   // D3
      // Low register — strings 5-6 (B2–E2)
      { beat: 24,   string: 5, fret: 2,  duration: 1 },   // B2
      { beat: 25,   string: 5, fret: 0,  duration: 1 },   // A2
      { beat: 26,   string: 6, fret: 3,  duration: 1 },   // G2
      { beat: 27,   string: 6, fret: 3,  duration: 1 },   // G2
      { beat: 28,   string: 5, fret: 0,  duration: 1 },   // A2
      { beat: 29,   string: 5, fret: 2,  duration: 1 },   // B2
      { beat: 30,   string: 6, fret: 0,  duration: 2 },   // E2
    ],
  },
  {
    id: "seven_nation",
    title: "Seven Nation Army",
    artist: "The White Stripes",
    bpm: 124,
    timeSignature: [4, 4],
    difficulty: "beginner",
    notes: [
      // Famous bass riff on string 6 (low E)
      { beat: 0,    string: 6, fret: 7,  duration: 1 },   // B2
      { beat: 1,    string: 6, fret: 7,  duration: 0.5 }, // B2
      { beat: 1.5,  string: 6, fret: 10, duration: 0.5 }, // D3
      { beat: 2,    string: 6, fret: 7,  duration: 0.75 },// B2
      { beat: 2.75, string: 6, fret: 5,  duration: 0.25 },// A2
      { beat: 3,    string: 6, fret: 3,  duration: 0.5 }, // G2
      { beat: 3.5,  string: 6, fret: 2,  duration: 1.5 }, // F#2
      // String 5 echo
      { beat: 5,    string: 5, fret: 7,  duration: 1 },   // E3
      { beat: 6,    string: 5, fret: 5,  duration: 0.5 }, // D3
      { beat: 6.5,  string: 5, fret: 3,  duration: 0.5 }, // C3
      { beat: 7,    string: 5, fret: 2,  duration: 1 },   // B2
      // Mid strings 4-3
      { beat: 8,    string: 4, fret: 5,  duration: 1 },   // G3
      { beat: 9,    string: 4, fret: 5,  duration: 0.5 }, // G3
      { beat: 9.5,  string: 4, fret: 7,  duration: 0.5 }, // A3
      { beat: 10,   string: 3, fret: 4,  duration: 1 },   // B3
      { beat: 11,   string: 3, fret: 2,  duration: 1 },   // A3
      // High strings 2-1
      { beat: 12,   string: 2, fret: 4,  duration: 1 },   // E4 (via B string)
      { beat: 13,   string: 1, fret: 2,  duration: 0.5 }, // F#4
      { beat: 13.5, string: 1, fret: 0,  duration: 0.5 }, // E4
      { beat: 14,   string: 2, fret: 0,  duration: 0.5 }, // B3
      { beat: 14.5, string: 1, fret: 0,  duration: 1 },   // E4
      // Back to bass riff
      { beat: 16,   string: 6, fret: 7,  duration: 1 },
      { beat: 17,   string: 6, fret: 7,  duration: 0.5 },
      { beat: 17.5, string: 6, fret: 10, duration: 0.5 },
      { beat: 18,   string: 6, fret: 7,  duration: 0.75 },
      { beat: 18.75,string: 6, fret: 5,  duration: 0.25 },
      { beat: 19,   string: 6, fret: 3,  duration: 0.5 },
      { beat: 19.5, string: 6, fret: 2,  duration: 1.5 },
    ],
  },
  {
    id: "stairway",
    title: "Stairway to Heaven (Intro)",
    artist: "Led Zeppelin",
    bpm: 70,
    timeSignature: [3, 4],
    difficulty: "intermediate",
    notes: [
      // Am — arpeggio strings 5→1
      { beat: 0,    string: 5, fret: 0,  duration: 0.5 }, // A2 (bass)
      { beat: 0.5,  string: 4, fret: 2,  duration: 0.5 }, // E3
      { beat: 1,    string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 1.5,  string: 2, fret: 1,  duration: 0.5 }, // C4
      { beat: 2,    string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 2.5,  string: 1, fret: 0,  duration: 0.5 }, // E4 (high)
      // Am/G# — bass on string 6
      { beat: 3,    string: 6, fret: 4,  duration: 0.5 }, // G#2 (low bass!)
      { beat: 3.5,  string: 4, fret: 2,  duration: 0.5 }, // E3
      { beat: 4,    string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 4.5,  string: 2, fret: 1,  duration: 0.5 }, // C4
      { beat: 5,    string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 5.5,  string: 1, fret: 0,  duration: 0.5 }, // E4
      // Am/G — bass G on string 6
      { beat: 6,    string: 6, fret: 3,  duration: 0.5 }, // G2
      { beat: 6.5,  string: 4, fret: 2,  duration: 0.5 }, // E3
      { beat: 7,    string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 7.5,  string: 2, fret: 1,  duration: 0.5 }, // C4
      { beat: 8,    string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 8.5,  string: 1, fret: 0,  duration: 0.5 }, // E4
      // Fmaj7/E — low E bass, then arpeggio up
      { beat: 9,    string: 6, fret: 0,  duration: 0.5 }, // E2 (lowest note!)
      { beat: 9.5,  string: 4, fret: 3,  duration: 0.5 }, // F3
      { beat: 10,   string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 10.5, string: 2, fret: 1,  duration: 0.5 }, // C4
      { beat: 11,   string: 3, fret: 2,  duration: 0.5 }, // A3
      { beat: 11.5, string: 1, fret: 1,  duration: 0.5 }, // F4
      // G chord — all strings descending
      { beat: 12,   string: 6, fret: 3,  duration: 0.5 }, // G2
      { beat: 12.5, string: 5, fret: 2,  duration: 0.5 }, // B2
      { beat: 13,   string: 4, fret: 0,  duration: 0.5 }, // D3
      { beat: 13.5, string: 3, fret: 0,  duration: 0.5 }, // G3
      { beat: 14,   string: 2, fret: 0,  duration: 0.5 }, // B3
      { beat: 14.5, string: 1, fret: 3,  duration: 0.5 }, // G4
    ],
  },
];

// ── Strings → display row (string 1 = top row in UI) ─────────────────────────
const STRING_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6"];
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];
const NUM_STRINGS = 6;

const NOTE_WIDTH = 80;
const HIT_ZONE_X = 200; // pixels from left where note must be played
const SCROLL_SPEED_BASE = 200; // px per second at 100bpm

function noteNameForStringFret(string: number, fret: number): string {
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return NOTES[midiForNote(string, fret) % 12];
}

// ── Result types ─────────────────────────────────────────────────────────────
type NoteResult = "hit" | "miss" | "pending";

interface NoteState extends TabNote {
  id: number;
  result: NoteResult;
  xPos: number; // current x position in px from left edge
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PlayPage() {
  // Fit 6 strings into available screen height (full-screen overlay minus ~52px HUD).
  // Clamp between 48px (dense) and 80px (roomy). Falls back to 72 during SSR.
  const LANE_HEIGHT = typeof window !== "undefined"
    ? Math.max(48, Math.min(80, Math.floor((window.innerHeight - 52) / NUM_STRINGS)))
    : 72;

  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "finished">("idle");
  const [micGranted, setMicGranted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteState[]>([]);
  const [elapsed, setElapsed] = useState(0); // seconds since song start

  // ── Practice mode state ───────────────────────────────────────────────────
  const [tab, setTab] = useState<"guitar" | "practice">("guitar");
  const [studentPieces, setStudentPieces] = useState<PieceWithGame[]>([]);
  const [piecesLoading, setPiecesLoading] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [practiceGameState, setPracticeGameState] = useState<"idle" | "playing" | "finished">("idle");
  const [activePiece, setActivePiece] = useState<PieceWithGame | null>(null);
  const [practiceNotes, setPracticeNotes] = useState<OMRNote[]>([]);
  const [currentNoteIdx, setCurrentNoteIdx] = useState(0);
  const currentNoteIdxRef = useRef(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const wrongAttemptsRef = useRef(0);
  const [practiceResults, setPracticeResults] = useState<NoteResult[]>([]);
  const practiceResultsRef = useRef<NoteResult[]>([]);
  const [practiceFlash, setPracticeFlash] = useState<"hit" | "miss" | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const practiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const practiceNotesRef = useRef<OMRNote[]>([]);
  const practiceCanvasRef = useRef<HTMLCanvasElement>(null);
  const practiceFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // { row: 0-5, type: "hit"|"miss", until: performance.now() ms }
  const hitZoneFlashRef = useRef<{ row: number; type: "hit" | "miss"; until: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const noteStatesRef = useRef<NoteState[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const songRef = useRef<Song | null>(null);

  // ── Mic setup ──────────────────────────────────────────────────────────────
  const micSettingUpRef = useRef(false);
  const setupMic = useCallback(async () => {
    if (micSettingUpRef.current || audioCtxRef.current) return; // guard against double-call
    micSettingUpRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 44100 });
      // Chrome starts AudioContext suspended until a user gesture resumes it
      if (ctx.state === "suspended") await ctx.resume();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;
      setMicGranted(true);
    } catch {
      setMicError("Microphone access denied. Please allow microphone access to play.");
    } finally {
      micSettingUpRef.current = false;
    }
  }, []);

  // ── Load student pieces ────────────────────────────────────────────────────
  const loadPieces = useCallback(async () => {
    setPiecesLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPiecesLoading(false); return; }

    const [{ data: pieces }, { data: games }] = await Promise.all([
      supabase.from("pieces").select("id, title, composer, sheet_music_url")
        .eq("student_id", user.id).not("sheet_music_url", "is", null).order("created_at", { ascending: false }),
      supabase.from("piece_games").select("piece_id, notes_json, key_signature, time_signature, bpm_suggestion, omr_confidence")
        .eq("student_id", user.id),
    ]);

    type RawPiece = { id: string; title: string; composer: string | null; sheet_music_url: string | null };
    type RawGame = { piece_id: string; notes_json: OMRNote[]; key_signature: string | null; time_signature: string | null; bpm_suggestion: number; omr_confidence: number };
    const merged: PieceWithGame[] = (pieces ?? []).map((p: RawPiece) => ({
      ...p,
      game: (games ?? []).find((g: RawGame) => g.piece_id === p.id) ?? null,
    }));
    setStudentPieces(merged);
    setPiecesLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "practice") loadPieces();
  }, [tab, loadPieces]);

  // ── Generate game from sheet music ────────────────────────────────────────
  async function generateGame(piece: PieceWithGame) {
    setGeneratingFor(piece.id);
    setGenerateError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000); // 90s client-side cap
    try {
      const res = await fetch(`/api/pieces/${piece.id}/generate-game`, { method: "POST", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      await loadPieces(); // refresh list with new game data
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? "Generation timed out — please try again." : (e as Error).message;
      setGenerateError(msg);
    } finally {
      clearTimeout(timeout);
      setGeneratingFor(null);
    }
  }

  // ── Start practice game ────────────────────────────────────────────────────
  async function startPractice(piece: PieceWithGame) {
    if (!piece.game) return;
    if (!micGranted) await setupMic();
    const notes = piece.game.notes_json;
    setPracticeNotes(notes);
    practiceNotesRef.current = notes;
    setActivePiece(piece);
    setCurrentNoteIdx(0);
    currentNoteIdxRef.current = 0;
    setWrongAttempts(0);
    wrongAttemptsRef.current = 0;
    setPracticeResults([]);
    practiceResultsRef.current = [];
    setPracticeFlash(null);
    setPracticeFeedback(null);
    setPracticeGameState("playing");

    // Polling loop — check pitch at 10fps
    practiceIntervalRef.current = setInterval(() => {
      const notes = practiceNotesRef.current;
      const idx = currentNoteIdxRef.current;
      if (idx >= notes.length) return;

      const freq = getPitch();
      if (!freq) {
        setDetectedNote(null);
        return;
      }
      const detectedMidi = freqToMidi(freq);
      setDetectedNote(midiToNoteName(detectedMidi));
      const expectedMidi = omrNoteToMidi(notes[idx]);
      // Octave-independent pitch class match: OMR commonly misreads octave by ±1.
      // Compare only the pitch class (0-11) so e.g. B3 matches B4 and B5.
      // Also allow ±1 semitone within the pitch class to handle slight tuning drift.
      const pitchClassDiff = Math.min(
        Math.abs((detectedMidi % 12) - (expectedMidi % 12)),
        12 - Math.abs((detectedMidi % 12) - (expectedMidi % 12))
      );
      const isHit = pitchClassDiff <= 1;

      if (isHit) {
        practiceResultsRef.current = [...practiceResultsRef.current, "hit"];
        setPracticeResults([...practiceResultsRef.current]);
        setPracticeFlash("hit");
        if (practiceFlashTimerRef.current) clearTimeout(practiceFlashTimerRef.current);
        practiceFlashTimerRef.current = setTimeout(() => setPracticeFlash(null), 300);
        wrongAttemptsRef.current = 0;
        setWrongAttempts(0);
        const next = idx + 1;
        currentNoteIdxRef.current = next;
        setCurrentNoteIdx(next);
        if (next >= notes.length) finishPractice(piece);
      } else {
        const attempts = wrongAttemptsRef.current + 1;
        wrongAttemptsRef.current = attempts;
        setWrongAttempts(attempts);
        setPracticeFlash("miss");
        if (practiceFlashTimerRef.current) clearTimeout(practiceFlashTimerRef.current);
        practiceFlashTimerRef.current = setTimeout(() => setPracticeFlash(null), 200);
        if (attempts >= 3) {
          // Auto-advance after 3 misses
          practiceResultsRef.current = [...practiceResultsRef.current, "miss"];
          setPracticeResults([...practiceResultsRef.current]);
          wrongAttemptsRef.current = 0;
          setWrongAttempts(0);
          const next = idx + 1;
          currentNoteIdxRef.current = next;
          setCurrentNoteIdx(next);
          if (next >= notes.length) finishPractice(piece);
        }
      }
    }, 100); // 10fps
  }

  function finishPractice(piece: PieceWithGame) {
    if (practiceIntervalRef.current) clearInterval(practiceIntervalRef.current);
    setPracticeGameState("finished");
    fetchPracticeFeedback(piece);
  }

  function stopPractice() {
    if (practiceIntervalRef.current) clearInterval(practiceIntervalRef.current);
    setDetectedNote(null);
    setPracticeGameState("idle");
    setActivePiece(null);
  }

  async function fetchPracticeFeedback(piece: PieceWithGame) {
    if (!piece.game) return;
    setFeedbackLoading(true);
    const results = practiceResultsRef.current;
    const hits = results.filter(r => r === "hit").length;
    const notes = practiceNotesRef.current;
    // Collect missed note names
    const missedNoteNames = results
      .map((r, i) => r === "miss" ? `${notes[i]?.note}${notes[i]?.octave}` : null)
      .filter(Boolean) as string[];
    // Deduplicate and count
    const missFreq: Record<string, number> = {};
    missedNoteNames.forEach(n => { missFreq[n] = (missFreq[n] ?? 0) + 1; });
    const topMissed = Object.entries(missFreq).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    try {
      const res = await fetch("/api/play/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceTitle: piece.title,
          keySignature: piece.game.key_signature,
          totalNotes: results.length,
          hitCount: hits,
          missedNoteNames: topMissed,
        }),
      });
      const data = await res.json();
      setPracticeFeedback(data.feedback ?? null);
    } catch { /* feedback is optional */ }
    setFeedbackLoading(false);
  }

  // ── Practice canvas draw ───────────────────────────────────────────────────
  useEffect(() => {
    if (practiceGameState !== "playing") return;
    const canvas = practiceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const notes = practiceNotesRef.current;
    const idx = currentNoteIdxRef.current;
    if (notes.length === 0) return;

    // Compute unique pitches sorted high → low; cap at 20 lanes to prevent overflow
    const midiSet = new Set(notes.map(omrNoteToMidi));
    const sortedMidis = [...midiSet].sort((a, b) => b - a).slice(0, 20);
    const numLanes = sortedMidis.length;
    const LANE_H = Math.max(38, Math.min(60, Math.floor(300 / numLanes)));

    // Build midi → preferred note name from actual score (preserves Bb/Db instead of always sharp)
    const midiToPreferredName = new Map<number, string>();
    for (const n of notes) {
      const m = omrNoteToMidi(n);
      if (!midiToPreferredName.has(m)) midiToPreferredName.set(m, n.note);
    }
    const canvasH = numLanes * LANE_H;
    const W = canvas.offsetWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = canvasH * dpr;
    // Must set CSS height explicitly — without it the canvas renders at
    // canvas.height CSS pixels (2× too tall on retina displays).
    canvas.style.height = canvasH + "px";
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, W, canvasH);

    // Lane lines + labels
    const LABEL_W = 52;
    const HIT_X = LABEL_W + 140;
    const NOTE_SPACING_FWD = 100; // px between future notes
    const NOTE_SPACING_BACK = 64;

    for (let li = 0; li < numLanes; li++) {
      const midi = sortedMidis[li];
      const y = li * LANE_H + LANE_H / 2;
      const noteLetter = midiToPreferredName.get(midi) ?? ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][midi % 12];
      const noteOct = Math.floor(midi / 12) - 1;
      const color = pitchLaneColor(noteLetter);

      // Lane bg
      ctx.fillStyle = li % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0)";
      ctx.fillRect(LABEL_W, li * LANE_H, W - LABEL_W, LANE_H);

      // Lane line
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LABEL_W, y);
      ctx.lineTo(W, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${noteLetter}${noteOct}`, LABEL_W / 2, y + 4);
    }

    // Hit zone line
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(HIT_X, 0);
    ctx.lineTo(HIT_X, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw notes (past, current, future)
    for (let ni = Math.max(0, idx - 5); ni < Math.min(notes.length, idx + 8); ni++) {
      const note = notes[ni];
      const midi = omrNoteToMidi(note);
      const laneIdx = sortedMidis.indexOf(midi);
      if (laneIdx === -1) continue;
      const y = laneIdx * LANE_H + LANE_H / 2;
      const color = pitchLaneColor(note.note);

      let x: number;
      let alpha = 1;
      let isCurrentNote = false;
      if (ni === idx) {
        // Current note — stop at hit zone
        x = HIT_X;
        isCurrentNote = true;
        if (practiceFlash === "hit") ctx.shadowColor = "#2ecc71";
        else if (practiceFlash === "miss") ctx.shadowColor = "#e74c3c";
        else ctx.shadowColor = color;
        ctx.shadowBlur = 18;
      } else if (ni < idx) {
        x = HIT_X - (idx - ni) * NOTE_SPACING_BACK;
        alpha = 0.3;
      } else {
        x = HIT_X + (ni - idx) * NOTE_SPACING_FWD;
        alpha = 0.55;
      }

      const pillW = isCurrentNote ? 70 : 52;
      const pillH = isCurrentNote ? LANE_H * 0.72 : LANE_H * 0.52;
      const r = pillH / 2;
      const rx = x - pillW / 2;

      // Result color override
      const result = practiceResultsRef.current[ni];
      const fillColor = result === "hit"
        ? "#2ecc71"
        : result === "miss"
        ? "#c0392b"
        : isCurrentNote && practiceFlash === "hit"
        ? "#2ecc71"
        : isCurrentNote && practiceFlash === "miss"
        ? "#e74c3c"
        : color;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(rx + r, y - pillH / 2);
      ctx.lineTo(rx + pillW - r, y - pillH / 2);
      ctx.arcTo(rx + pillW, y - pillH / 2, rx + pillW, y + pillH / 2, r);
      ctx.lineTo(rx + pillW, y + pillH / 2);
      ctx.arcTo(rx + pillW, y + pillH / 2, rx + pillW - r, y + pillH / 2, r);
      ctx.lineTo(rx + r, y + pillH / 2);
      ctx.arcTo(rx, y + pillH / 2, rx, y - pillH / 2, r);
      ctx.arcTo(rx, y - pillH / 2, rx + r, y - pillH / 2, r);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Note label
      if (result !== "miss" && alpha > 0.4) {
        ctx.fillStyle = result === "hit" ? "#fff" : isCurrentNote ? "#fff" : "rgba(255,255,255,0.85)";
        ctx.font = `${isCurrentNote ? "bold 13px" : "11px"} Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(note.note, x, y + 4);
      }
      if (result === "hit") {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✓", x, y + 4);
      }
    }

    // Attempt dots below hit zone
    if (practiceGameState === "playing" && idx < notes.length) {
      const dotY = (sortedMidis.indexOf(omrNoteToMidi(notes[idx])) + 1) * LANE_H - 5;
      const remaining = 3 - wrongAttempts;
      for (let d = 0; d < 3; d++) {
        ctx.beginPath();
        ctx.arc(HIT_X - 10 + d * 12, Math.min(dotY, canvasH - 8), 4, 0, Math.PI * 2);
        ctx.fillStyle = d < remaining ? "#5B9E79" : "rgba(255,255,255,0.2)";
        ctx.fill();
      }
    }

    // Progress bar
    const prog = notes.length > 0 ? idx / notes.length : 0;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(LABEL_W, canvasH - 3, W - LABEL_W, 3);
    ctx.fillStyle = "#5B9E79";
    ctx.fillRect(LABEL_W, canvasH - 3, (W - LABEL_W) * prog, 3);
  }, [practiceGameState, currentNoteIdx, practiceFlash, wrongAttempts]);

  // ── Pitch polling ──────────────────────────────────────────────────────────
  // Pre-allocate audio buffer once — avoids 16KB allocation every frame.
  const pitchBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  // Throttle YIN to ~20fps (every 3rd frame at 60fps) — it's O(n²), expensive on mobile.
  const pitchFrameCountRef = useRef(0);
  const lastPitchRef = useRef<number | null>(null);

  const getPitch = useCallback((): number | null => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return null;
    // Re-suspend can happen on tab switch or iOS focus loss — kick it back awake
    if (ctx.state !== "running") { ctx.resume(); return lastPitchRef.current; }

    // Only run YIN every 3rd call (~20fps); return cached result on skipped frames
    pitchFrameCountRef.current += 1;
    if (pitchFrameCountRef.current % 3 !== 0) return lastPitchRef.current;

    if (!pitchBufRef.current || pitchBufRef.current.length !== analyser.fftSize) {
      pitchBufRef.current = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(pitchBufRef.current);
    // Check RMS — ignore silence
    const rms = Math.sqrt(pitchBufRef.current.reduce((s, v) => s + v * v, 0) / pitchBufRef.current.length);
    if (rms < 0.01) { lastPitchRef.current = null; return null; }
    const pitch = detectPitch(pitchBufRef.current as Float32Array, ctx.sampleRate);
    lastPitchRef.current = pitch;
    return pitch;
  }, []);

  // ── Initialize notes for selected song ────────────────────────────────────
  function initNotes(song: Song): NoteState[] {
    const beatsPerSec = song.bpm / 60;
    const scrollSpeed = SCROLL_SPEED_BASE * (song.bpm / 100);
    return song.notes.map((n, i) => ({
      ...n,
      id: i,
      result: "pending" as NoteResult,
      // x starts off-screen to the right, scrolls left
      xPos: HIT_ZONE_X + (n.beat / beatsPerSec) * scrollSpeed + window.innerWidth,
    }));
  }

  // ── Start game ─────────────────────────────────────────────────────────────
  async function startGame(song: Song) {
    if (!micGranted) {
      await setupMic();
    }
    songRef.current = song;
    const ns = initNotes(song);
    noteStatesRef.current = ns;
    setNotes([...ns]);
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setDetectedNote(null);
    setGameState("countdown");
    setCountdown(3);

    let c = 3;
    countdownIntervalRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        // startTimeRef is set inside the first RAF frame so it aligns with actual paint
        startTimeRef.current = 0;
        setGameState("playing");
        runGameLoop(song);
      }
    }, 1000);
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  function runGameLoop(song: Song) {
    // Browser may auto-suspend AudioContext after inactivity / tab switch.
    // Resume non-blocking — pitch detection will return null for one frame at most.
    audioCtxRef.current?.resume();

    const scrollSpeed = SCROLL_SPEED_BASE * (song.bpm / 100);
    const beatsPerSec = song.bpm / 60;
    const HIT_WINDOW_PX = 50; // px tolerance for a hit

    let lastFrameTime = 0;

    function frame(now: number) {
      // Set start time on the very first frame so timing aligns with actual paint
      if (startTimeRef.current === 0) startTimeRef.current = now;
      if (lastFrameTime === 0) lastFrameTime = now;
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const elapsedSec = (now - startTimeRef.current) / 1000;
      setElapsed(elapsedSec);

      // Detect pitch
      const freq = getPitch();
      let detectedMidi: number | null = null;
      if (freq) {
        detectedMidi = freqToMidi(freq);
        setDetectedNote(midiToNoteName(detectedMidi));
      } else {
        setDetectedNote(null);
      }

      // Scroll notes left
      const updated = noteStatesRef.current.map(note => ({
        ...note,
        xPos: note.xPos - scrollSpeed * dt,
      }));

      // Check hits and misses
      const PITCH_TOLERANCE = 2; // semitones (exact match)
      for (const note of updated) {
        if (note.result !== "pending") continue;
        const distFromHitZone = Math.abs(note.xPos - HIT_ZONE_X);
        const expectedMidi = midiForNote(note.string, note.fret);

        if (distFromHitZone < HIT_WINDOW_PX && detectedMidi !== null) {
          // Primary: exact semitone match (±2). Fallback: pitch-class match (same
          // note name, any octave) — OMR commonly misreads octave by ±1, and the
          // player is playing the correct note even if Claude got the octave wrong.
          const exactMatch = Math.abs(detectedMidi - expectedMidi) <= PITCH_TOLERANCE;
          const pitchClassDiff = Math.min(
            Math.abs((detectedMidi % 12) - (expectedMidi % 12)),
            12 - Math.abs((detectedMidi % 12) - (expectedMidi % 12))
          );
          const pitchClassMatch = pitchClassDiff <= 1;
          if (exactMatch || pitchClassMatch) {
            note.result = "hit";
            hitZoneFlashRef.current = { row: note.string - 1, type: "hit", until: performance.now() + 160 };
            comboRef.current += 1;
            if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
            const mult = comboRef.current >= 10 ? 4 : comboRef.current >= 5 ? 2 : comboRef.current >= 3 ? 1.5 : 1;
            scoreRef.current += Math.round(100 * mult);
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setMaxCombo(maxComboRef.current);
          }
        } else if (note.xPos < HIT_ZONE_X - HIT_WINDOW_PX) {
          // Passed the hit zone without being hit
          note.result = "miss";
          hitZoneFlashRef.current = { row: note.string - 1, type: "miss", until: performance.now() + 200 };
          comboRef.current = 0;
          setCombo(0);
        }
      }

      noteStatesRef.current = updated;
      setNotes([...updated]);

      // Draw canvas
      drawCanvas(updated, song);

      // Check if song is done (all notes processed + 2s buffer)
      const lastNoteBeat = Math.max(...song.notes.map(n => n.beat + n.duration));
      const lastNoteSec = lastNoteBeat / beatsPerSec;
      if (elapsedSec > lastNoteSec + 2) {
        setGameState("finished");
        return;
      }

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }

  // Need elapsed in draw without re-render dependency
  const elapsedRef = useRef(0);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // ── Canvas draw ────────────────────────────────────────────────────────────
  function drawCanvas(noteList: NoteState[], song: Song) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const LOGICAL_H = NUM_STRINGS * LANE_HEIGHT;

    // ── Self-heal: canvas is conditionally rendered so the resize useEffect
    //    fires before the element exists. Fix dimensions on first draw frame. ──
    const needH = LOGICAL_H * dpr;
    if (canvas.height !== needH) {
      canvas.width = (canvas.offsetWidth || window.innerWidth) * dpr;
      canvas.height = needH;
    }
    // Always reset transform so scale is correct (setting .width resets ctx state)
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = canvas.width / dpr;
    const H = LOGICAL_H;
    const LABEL_W = 48;
    const STRING_LINE_WIDTHS = [0.7, 1.0, 1.3, 1.7, 2.1, 2.6];

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, W, H);

    // ── Subtle vertical beat lines ────────────────────────────────────────────
    const beatsPerSec = song.bpm / 60;
    const scrollSpeed = SCROLL_SPEED_BASE * (song.bpm / 100);
    const pxPerBeat = scrollSpeed / beatsPerSec;
    // Anchor beat lines to the hit zone, scrolling with elapsed time
    const beatOffset = (elapsedRef.current * scrollSpeed) % pxPerBeat;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    // Start far enough left to cover the full canvas
    const beatStart = LABEL_W + ((HIT_ZONE_X - LABEL_W - beatOffset) % pxPerBeat + pxPerBeat) % pxPerBeat;
    for (let x = beatStart; x < W; x += pxPerBeat) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // ── String lanes + labels ─────────────────────────────────────────────────
    for (let s = 0; s < NUM_STRINGS; s++) {
      const y = s * LANE_HEIGHT + LANE_HEIGHT / 2;
      const color = STRING_COLORS[s];

      // Alternating lane tint
      if (s % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.015)";
        ctx.fillRect(LABEL_W, s * LANE_HEIGHT, W - LABEL_W, LANE_HEIGHT);
      }

      // Label column bg
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, s * LANE_HEIGHT, LABEL_W, LANE_HEIGHT);

      // String name
      ctx.fillStyle = color;
      ctx.font = "bold 13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(STRING_LABELS[s], LABEL_W / 2, y + 5);

      // String line — bass strings visually heavier
      ctx.strokeStyle = color + "60";
      ctx.lineWidth = STRING_LINE_WIDTHS[s];
      ctx.beginPath();
      ctx.moveTo(LABEL_W, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Label column separator
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(LABEL_W, 0); ctx.lineTo(LABEL_W, H); ctx.stroke();

    // ── Hit zone: per-string glow circles ─────────────────────────────────────
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(HIT_ZONE_X, 0); ctx.lineTo(HIT_ZONE_X, H); ctx.stroke();
    ctx.setLineDash([]);

    const flash = hitZoneFlashRef.current;
    const flashActive = flash && performance.now() < flash.until;
    for (let s = 0; s < NUM_STRINGS; s++) {
      const y = s * LANE_HEIGHT + LANE_HEIGHT / 2;
      const color = STRING_COLORS[s];
      const r = LANE_HEIGHT * 0.26;
      const isFlashRow = flashActive && flash!.row === s;
      const flashColor = flash?.type === "hit" ? "#2ecc71" : "#e74c3c";
      const glowColor = isFlashRow ? flashColor : color;
      const glowAlpha = isFlashRow ? "40" : "18";
      const ringAlpha = isFlashRow ? "cc" : "45";
      const glowRadius = isFlashRow ? r * 3.5 : r * 2.2;

      const grd = ctx.createRadialGradient(HIT_ZONE_X, y, 0, HIT_ZONE_X, y, glowRadius);
      grd.addColorStop(0, glowColor + glowAlpha); grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(HIT_ZONE_X, y, glowRadius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = glowColor + ringAlpha;
      ctx.lineWidth = isFlashRow ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(HIT_ZONE_X, y, r, 0, Math.PI * 2); ctx.stroke();
    }

    // ── Notes (Yousician-style pills) ─────────────────────────────────────────
    for (const note of noteList) {
      if (note.xPos < LABEL_W - 60 || note.xPos > W + 100) continue;
      const row = note.string - 1;
      const y = row * LANE_HEIGHT + LANE_HEIGHT / 2;
      const color = STRING_COLORS[row];
      const isHit = note.result === "hit";
      const isMiss = note.result === "miss";

      const pillH = LANE_HEIGHT * 0.54;
      const pillW = Math.max(NOTE_WIDTH * note.duration, 48);
      const rx = note.xPos - pillW / 2;
      const ry = y - pillH / 2;
      const cr = pillH / 2; // corner radius

      ctx.globalAlpha = isMiss ? 0.22 : 1;
      ctx.shadowColor = isHit ? "#2ecc71" : isMiss ? "transparent" : color;
      ctx.shadowBlur = isHit ? 20 : 10;

      // Pill fill
      ctx.fillStyle = isHit ? "#2ecc71" : isMiss ? "#2a2a2a" : color;
      ctx.beginPath();
      ctx.moveTo(rx + cr, ry);
      ctx.lineTo(rx + pillW - cr, ry);
      ctx.arcTo(rx + pillW, ry, rx + pillW, ry + pillH, cr);
      ctx.lineTo(rx + pillW, ry + pillH);
      ctx.arcTo(rx + pillW, ry + pillH, rx + pillW - cr, ry + pillH, cr);
      ctx.lineTo(rx + cr, ry + pillH);
      ctx.arcTo(rx, ry + pillH, rx, ry, cr);
      ctx.arcTo(rx, ry, rx + cr, ry, cr);
      ctx.closePath();
      ctx.fill();

      // Subtle highlight border
      if (!isMiss) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (!isMiss) {
        if (isHit) {
          ctx.fillStyle = "#fff";
          ctx.font = "bold 15px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("✓", note.xPos, y + 5);
        } else {
          const noteName = noteNameForStringFret(note.string, note.fret);
          // Note name (small) — baseline at y-8, keeps ~4px gap above fret digits
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.font = "10px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(noteName, note.xPos, y - 8);
          // Fret number (large) — baseline at y+12, cap tops at y-2 → clear of note name
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.round(pillH * 0.46)}px Inter, sans-serif`;
          ctx.fillText(String(note.fret), note.xPos, y + 12);
        }
      }
    }

    // ── Progress bar ──────────────────────────────────────────────────────────
    const lastBeat = Math.max(...song.notes.map(n => n.beat + n.duration));
    const progress = Math.min(1, (elapsedRef.current * beatsPerSec) / lastBeat);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(LABEL_W, H - 3, W - LABEL_W, 3);
    ctx.fillStyle = "#5B9E79";
    ctx.fillRect(LABEL_W, H - 3, (W - LABEL_W) * progress, 3);
  }

  // ── Stop / cleanup ─────────────────────────────────────────────────────────
  function stopGame() {
    cancelAnimationFrame(animFrameRef.current);
    setGameState("idle");
  }

  function resetGame() {
    cancelAnimationFrame(animFrameRef.current);
    setNotes([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setElapsed(0);
    setGameState("idle");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (practiceIntervalRef.current) clearInterval(practiceIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (practiceFlashTimerRef.current) clearTimeout(practiceFlashTimerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Canvas sizing ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      // Use explicit height from constants — never read offsetHeight (unreliable before paint)
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = NUM_STRINGS * LANE_HEIGHT * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Accuracy calculation ───────────────────────────────────────────────────
  const hits = notes.filter(n => n.result === "hit").length;
  const misses = notes.filter(n => n.result === "miss").length;
  const total = notes.filter(n => n.result !== "pending").length;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;

  const canvasHeight = NUM_STRINGS * LANE_HEIGHT;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1.25rem", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link href="/student" style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}>
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.5rem", fontWeight: 600, color: "var(--charcoal)", margin: 0 }}>Play</h1>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>Guitar Hero-style. Play the notes as they reach the line.</p>
        </div>
      </div>

      {/* Mic status */}
      {!micGranted && !micError && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Mic size={18} strokeWidth={1.5} color="var(--sage)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--charcoal)" }}>Microphone needed</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Allow mic access so the game can hear you play</div>
          </div>
          <button
            onClick={setupMic}
            style={{ padding: "0.5rem 1.25rem", background: "var(--sage)", border: "none", color: "white", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
          >
            Allow
          </button>
        </div>
      )}
      {micError && (
        <div style={{ background: "#fff0f0", border: "1px solid #f5c6c6", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#c0392b", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <MicOff size={16} /> {micError}
        </div>
      )}
      {micGranted && gameState === "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--sage)", fontWeight: 500 }}>
          <Mic size={14} /> Microphone ready
        </div>
      )}

      {/* Tab switcher */}
      {gameState === "idle" && practiceGameState === "idle" && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.25rem" }}>
          <button
            onClick={() => setTab("guitar")}
            style={{
              flex: 1, padding: "0.5rem", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              background: tab === "guitar" ? "var(--white)" : "transparent",
              color: tab === "guitar" ? "var(--charcoal)" : "var(--muted)",
              boxShadow: tab === "guitar" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Zap size={14} /> Guitar Game
          </button>
          <button
            onClick={() => setTab("practice")}
            style={{
              flex: 1, padding: "0.5rem", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              background: tab === "practice" ? "var(--white)" : "transparent",
              color: tab === "practice" ? "var(--charcoal)" : "var(--muted)",
              boxShadow: tab === "practice" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Music size={14} /> Practice My Pieces
          </button>
        </div>
      )}

      {/* ── PRACTICE TAB ───────────────────────────────────────────────────── */}
      {tab === "practice" && practiceGameState === "idle" && (
        <div>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Your Sheet Music</h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Upload sheet music on any piece, then generate a note-by-note practice game. Works for any instrument.
          </p>

          {generateError && (
            <div style={{ background: "#fff0f0", border: "1px solid #f5c6c6", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#c0392b" }}>
              {generateError}
            </div>
          )}

          {piecesLoading ? (
            <div style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Loading your pieces...</div>
          ) : studentPieces.length === 0 ? (
            <div className="card-base" style={{ padding: "1.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "0.5rem" }}>No pieces with sheet music yet</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Go to <strong>My Music</strong> and upload a sheet music image for any piece.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {studentPieces.map(piece => (
                <div key={piece.id} className="card-base" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{piece.title}</div>
                    {piece.composer && <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{piece.composer}</div>}
                    {piece.game && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", display: "flex", gap: "0.75rem" }}>
                        <span>{piece.game.notes_json.length} notes</span>
                        {piece.game.key_signature && <span>{piece.game.key_signature}</span>}
                        {piece.game.omr_confidence < 0.65 && (
                          <span style={{ color: "#e67e22" }}>⚠ Low confidence — notes may not be perfect</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {piece.game ? (
                      <>
                        <button
                          onClick={() => startGame(omrPieceToSong(piece))}
                          style={{ padding: "0.5rem 1.25rem", background: "var(--sage)", border: "none", color: "white", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem" }}
                        >
                          <Play size={14} /> Play
                        </button>
                        <button
                          onClick={() => generateGame(piece)}
                          disabled={generatingFor === piece.id}
                          style={{ padding: "0.5rem 0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, cursor: "pointer", fontSize: "0.8125rem" }}
                          title="Regenerate from sheet music"
                        >
                          {generatingFor === piece.id ? "..." : "Regenerate"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => generateGame(piece)}
                        disabled={generatingFor === piece.id}
                        style={{ padding: "0.5rem 1.25rem", background: "var(--charcoal)", border: "none", color: "white", borderRadius: 8, cursor: generatingFor === piece.id ? "default" : "pointer", fontWeight: 600, fontSize: "0.875rem", opacity: generatingFor === piece.id ? 0.7 : 1 }}
                      >
                        {generatingFor === piece.id ? "Reading music..." : "Generate Game"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PRACTICE GAME ─────────────────────────────────────────────────── */}
      {tab === "practice" && practiceGameState === "playing" && activePiece && (
        <div>
          {/* Practice HUD */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{activePiece.title}</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                Note {currentNoteIdx + 1} of {practiceNotes.length}
                {practiceNotes[currentNoteIdx] && (
                  <span style={{ marginLeft: "0.75rem", fontWeight: 600, color: "var(--sage)" }}>
                    Play: {practiceNotes[currentNoteIdx].note}{practiceNotes[currentNoteIdx].octave}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {detectedNote && (
                <div style={{ padding: "0.25rem 0.75rem", background: "#eafaf1", border: "1px solid #a9dfbf", borderRadius: 20, fontSize: "0.8125rem", fontWeight: 600, color: "#1e8449" }}>
                  {detectedNote}
                </div>
              )}
              <button onClick={stopPractice} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Square size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Practice canvas */}
          <canvas
            ref={practiceCanvasRef}
            style={{ width: "100%", borderRadius: 10, display: "block" }}
          />

          <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center" }}>
            Play the highlighted note. It will advance automatically when you hit it.
            {wrongAttempts > 0 && wrongAttempts < 3 && <span style={{ color: "#e67e22", marginLeft: "0.5rem" }}>{3 - wrongAttempts} attempt{3 - wrongAttempts !== 1 ? "s" : ""} left before skip</span>}
          </div>
        </div>
      )}

      {/* ── PRACTICE RESULTS ──────────────────────────────────────────────── */}
      {tab === "practice" && practiceGameState === "finished" && activePiece && (
        <div className="card-base" style={{ padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--charcoal)" }}>
            {activePiece.title}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", margin: "1.25rem 0" }}>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 2 }}>Accuracy</div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: practiceResults.filter(r => r === "hit").length / practiceResults.length >= 0.7 ? "#2ecc71" : "#e74c3c" }}>
                {practiceResults.length > 0 ? Math.round(practiceResults.filter(r => r === "hit").length / practiceResults.length * 100) : 0}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 2 }}>Notes Hit</div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "var(--charcoal)" }}>
                {practiceResults.filter(r => r === "hit").length}/{practiceResults.length}
              </div>
            </div>
          </div>

          {/* AI Feedback */}
          {feedbackLoading && (
            <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem", fontStyle: "italic" }}>Getting feedback...</div>
          )}
          {practiceFeedback && (
            <div style={{ background: "var(--bg)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem", fontSize: "0.9375rem", color: "var(--charcoal)", lineHeight: 1.65, textAlign: "left", borderLeft: "3px solid var(--sage)" }}>
              {practiceFeedback}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={() => activePiece && startPractice(activePiece)}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.5rem", background: "var(--charcoal)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
            >
              <RotateCcw size={15} strokeWidth={2} /> Try Again
            </button>
            <button
              onClick={() => { setPracticeGameState("idle"); setActivePiece(null); }}
              style={{ padding: "0.625rem 1.5rem", background: "transparent", color: "var(--charcoal)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}
            >
              Back to Pieces
            </button>
          </div>
        </div>
      )}

      {/* Song picker */}
      {tab === "guitar" && gameState === "idle" && (
        <div>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Choose a song</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
            {SONGS.map(song => (
              <button
                key={song.id}
                onClick={() => { setSelectedSong(song); startGame(song); }}
                style={{
                  background: "var(--white)",
                  border: `1px solid ${selectedSong?.id === song.id ? "var(--sage)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "1rem 1.25rem",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.375rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{song.title}</div>
                  <span style={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: song.difficulty === "beginner" ? "#e8f5ee" : song.difficulty === "intermediate" ? "#fff3cd" : "#fde8e8",
                    color: song.difficulty === "beginner" ? "#2d8a56" : song.difficulty === "intermediate" ? "#856404" : "#c0392b",
                  }}>
                    {song.difficulty}
                  </span>
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{song.artist}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem" }}>{song.bpm} BPM · {song.notes.length} notes</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Countdown — now inside full-screen overlay below */}

      {/* ── Full-screen game overlay (countdown / playing / finished) ────────── */}
      {(gameState === "countdown" || gameState === "playing" || gameState === "finished") && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "#0a0a14", display: "flex", flexDirection: "column",
          fontFamily: "Inter, sans-serif",
        }}>
          {/* HUD bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.625rem 1.25rem",
            background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Score</div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.5rem", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{score.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Combo</div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.5rem", fontWeight: 700, color: combo >= 5 ? "#f39c12" : "#fff", lineHeight: 1 }}>{combo > 0 ? `${combo}×` : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Accuracy</div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.5rem", fontWeight: 700, color: accuracy >= 80 ? "#2ecc71" : accuracy >= 50 ? "#f39c12" : "#e74c3c", lineHeight: 1 }}>{total > 0 ? `${accuracy}%` : "—"}</div>
              </div>
              {selectedSong && (
                <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "1.5rem" }}>
                  <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Now Playing</div>
                  <div style={{ fontSize: "0.875rem", color: "#fff", fontWeight: 500 }}>{selectedSong.title}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {detectedNote && (
                <div style={{ padding: "0.25rem 0.875rem", background: "rgba(46,204,113,0.15)", border: "1px solid rgba(46,204,113,0.4)", borderRadius: 20, fontSize: "0.8125rem", fontWeight: 700, color: "#2ecc71" }}>
                  🎵 {detectedNote}
                </div>
              )}
              <button onClick={resetGame} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }} title="Restart">
                <RotateCcw size={15} strokeWidth={1.5} />
              </button>
              <button onClick={stopGame} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }} title="Exit">
                <Square size={15} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Countdown */}
          {gameState === "countdown" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.25rem" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "9rem", fontWeight: 700, color: "#fff", lineHeight: 1, textShadow: "0 0 60px rgba(255,255,255,0.25)" }}>
                {countdown > 0 ? countdown : "Go!"}
              </div>
              <div style={{ fontSize: "1rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.05em" }}>{selectedSong?.title} · {selectedSong?.bpm} BPM</div>
            </div>
          )}

          {/* Canvas */}
          {(gameState === "playing" || gameState === "finished") && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: canvasHeight, display: "block" }}
              />
            </div>
          )}

          {/* Finished results overlay */}
          {gameState === "finished" && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(9,9,18,0.88)", zIndex: 10,
            }}>
              <div style={{
                background: "#13131f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16,
                padding: "2rem 2.5rem", textAlign: "center", maxWidth: 420, width: "90%",
              }}>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, color: "#fff", marginBottom: "1.5rem" }}>
                  {accuracy >= 90 ? "🎸 Flawless!" : accuracy >= 70 ? "🎵 Nice playing!" : accuracy >= 50 ? "Keep practicing!" : "Good effort — try again!"}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", marginBottom: "1.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Score</div>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#fff" }}>{score.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Accuracy</div>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: accuracy >= 70 ? "#2ecc71" : "#e74c3c" }}>{accuracy}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Best Combo</div>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#fff" }}>{maxCombo}×</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Notes Hit</div>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#fff" }}>{hits}/{total}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                  <button
                    onClick={() => selectedSong && startGame(selectedSong)}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.5rem", background: "#fff", color: "#0a0a14", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}
                  >
                    <RotateCcw size={15} strokeWidth={2} /> Try Again
                  </button>
                  <button
                    onClick={resetGame}
                    style={{ padding: "0.625rem 1.5rem", background: "transparent", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}
                  >
                    Choose Song
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* How to play — guitar game */}
      {tab === "guitar" && gameState === "idle" && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginTop: "1.5rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>How to play</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.8 }}>
            <li>Pick a song above. Allow mic access when prompted.</li>
            <li>Notes scroll left — each pill shows the <strong>note name</strong> (e.g. G) and <strong>fret number</strong> (e.g. 3). Play that fret on the colored string.</li>
            <li>Play the note on your guitar as it reaches the dashed line.</li>
            <li>Hit notes in a row to build your combo multiplier (up to 4×).</li>
            <li>Works best with acoustic guitar or electric guitar plugged directly into your device.</li>
          </ul>
        </div>
      )}
      {/* How to play — practice mode */}
      {tab === "practice" && practiceGameState === "idle" && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginTop: "1.5rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>How Practice Mode works</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.8 }}>
            <li>Upload a <strong>JPG or PNG photo</strong> of your sheet music on any piece (in My Music).</li>
            <li>Click <strong>Generate Game</strong> — Claude reads the notes from the image.</li>
            <li>Each note waits at the hit zone until you play it. No time pressure.</li>
            <li>After 3 wrong attempts, it skips to the next note.</li>
            <li>Works for <strong>any instrument</strong> — violin, piano, flute, guitar, voice.</li>
          </ul>
        </div>
      )}

    </div>
  );
}
