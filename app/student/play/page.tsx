"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff, Play, Square, RotateCcw } from "lucide-react";

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
  return STRING_OPEN_MIDI[string - 1] + fret;
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
      // Famous riff — power chords on strings 5+4
      { beat: 0,   string: 5, fret: 0,  duration: 1 },
      { beat: 0,   string: 4, fret: 0,  duration: 1 },
      { beat: 1,   string: 5, fret: 3,  duration: 1 },
      { beat: 1,   string: 4, fret: 3,  duration: 1 },
      { beat: 2,   string: 5, fret: 5,  duration: 1 },
      { beat: 2,   string: 4, fret: 5,  duration: 1 },
      { beat: 3.5, string: 5, fret: 3,  duration: 0.5 },
      { beat: 3.5, string: 4, fret: 3,  duration: 0.5 },
      { beat: 4,   string: 5, fret: 0,  duration: 1 },
      { beat: 4,   string: 4, fret: 0,  duration: 1 },
      { beat: 5,   string: 5, fret: 3,  duration: 1 },
      { beat: 5,   string: 4, fret: 3,  duration: 1 },
      { beat: 6,   string: 5, fret: 5,  duration: 0.5 },
      { beat: 6,   string: 4, fret: 5,  duration: 0.5 },
      { beat: 6.5, string: 5, fret: 3,  duration: 1.5 },
      { beat: 6.5, string: 4, fret: 3,  duration: 1.5 },
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
      { beat: 0, string: 2, fret: 0, duration: 1 },
      { beat: 1, string: 2, fret: 0, duration: 1 },
      { beat: 2, string: 2, fret: 1, duration: 1 },
      { beat: 3, string: 2, fret: 3, duration: 1 },
      { beat: 4, string: 2, fret: 3, duration: 1 },
      { beat: 5, string: 2, fret: 1, duration: 1 },
      { beat: 6, string: 2, fret: 0, duration: 1 },
      { beat: 7, string: 3, fret: 2, duration: 1 },
      { beat: 8, string: 3, fret: 2, duration: 1 },
      { beat: 9, string: 2, fret: 0, duration: 1 },
      { beat: 10, string: 2, fret: 0, duration: 1.5 },
      { beat: 11.5, string: 3, fret: 2, duration: 0.5 },
      { beat: 12, string: 3, fret: 2, duration: 2 },
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
      { beat: 0,   string: 5, fret: 7,  duration: 1.5 },
      { beat: 1.5, string: 5, fret: 7,  duration: 0.5 },
      { beat: 2,   string: 5, fret: 10, duration: 0.5 },
      { beat: 2.5, string: 5, fret: 7,  duration: 0.5 },
      { beat: 3,   string: 5, fret: 5,  duration: 1 },
      { beat: 4,   string: 5, fret: 3,  duration: 2 },
      { beat: 6,   string: 5, fret: 2,  duration: 2 },
    ],
  },
  {
    id: "stairway",
    title: "Stairway to Heaven (Intro)",
    artist: "Led Zeppelin",
    bpm: 72,
    timeSignature: [4, 4],
    difficulty: "intermediate",
    notes: [
      { beat: 0,   string: 1, fret: 5,  duration: 1 },
      { beat: 1,   string: 2, fret: 5,  duration: 1 },
      { beat: 2,   string: 1, fret: 5,  duration: 0.5 },
      { beat: 2.5, string: 3, fret: 6,  duration: 0.5 },
      { beat: 3,   string: 1, fret: 4,  duration: 1 },
      { beat: 4,   string: 2, fret: 5,  duration: 1 },
      { beat: 5,   string: 1, fret: 4,  duration: 0.5 },
      { beat: 5.5, string: 1, fret: 3,  duration: 0.5 },
      { beat: 6,   string: 2, fret: 3,  duration: 1 },
      { beat: 7,   string: 3, fret: 5,  duration: 1 },
    ],
  },
];

// ── Strings → display row (string 1 = top row in UI) ─────────────────────────
const STRING_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6"];
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];
const NUM_STRINGS = 6;

const LANE_HEIGHT = 52;
const NOTE_WIDTH = 80;
const HIT_ZONE_X = 160; // pixels from left where note must be played
const SCROLL_SPEED_BASE = 200; // px per second at 100bpm

// ── Result types ─────────────────────────────────────────────────────────────
type NoteResult = "hit" | "miss" | "pending";

interface NoteState extends TabNote {
  id: number;
  result: NoteResult;
  xPos: number; // current x position in px from left edge
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PlayPage() {
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
  const [hitFlash, setHitFlash] = useState<number | null>(null); // note id of last hit

  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const setupMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 44100 });
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
    }
  }, []);

  // ── Pitch polling ──────────────────────────────────────────────────────────
  const getPitch = useCallback((): number | null => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return null;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    // Check RMS — ignore silence
    const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
    if (rms < 0.01) return null;
    return detectPitch(buf, ctx.sampleRate);
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
    const cdInterval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(cdInterval);
        startTimeRef.current = performance.now();
        setGameState("playing");
        runGameLoop(song);
      }
    }, 1000);
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  function runGameLoop(song: Song) {
    const scrollSpeed = SCROLL_SPEED_BASE * (song.bpm / 100);
    const beatsPerSec = song.bpm / 60;
    const HIT_WINDOW_PX = 50; // px tolerance for a hit

    let lastFrameTime = performance.now();

    function frame(now: number) {
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
      const PITCH_TOLERANCE = 2; // semitones
      for (const note of updated) {
        if (note.result !== "pending") continue;
        const distFromHitZone = Math.abs(note.xPos - HIT_ZONE_X);
        const expectedMidi = midiForNote(note.string, note.fret);

        if (distFromHitZone < HIT_WINDOW_PX && detectedMidi !== null) {
          if (Math.abs(detectedMidi - expectedMidi) <= PITCH_TOLERANCE) {
            note.result = "hit";
            comboRef.current += 1;
            if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
            const mult = comboRef.current >= 10 ? 4 : comboRef.current >= 5 ? 2 : comboRef.current >= 3 ? 1.5 : 1;
            scoreRef.current += Math.round(100 * mult);
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setMaxCombo(maxComboRef.current);
            setHitFlash(note.id);
            setTimeout(() => setHitFlash(null), 200);
          }
        } else if (note.xPos < HIT_ZONE_X - HIT_WINDOW_PX) {
          // Passed the hit zone without being hit
          note.result = "miss";
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

  // ── Canvas draw ────────────────────────────────────────────────────────────
  function drawCanvas(noteList: NoteState[], song: Song) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, W, H);

    // String lanes
    for (let s = 0; s < NUM_STRINGS; s++) {
      const y = s * LANE_HEIGHT + LANE_HEIGHT / 2;
      // Lane bg (alternating)
      ctx.fillStyle = s % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0)";
      ctx.fillRect(0, s * LANE_HEIGHT, W, LANE_HEIGHT);
      // String line
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      // String label on left
      ctx.fillStyle = STRING_COLORS[s];
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(STRING_LABELS[s], 24, y + 4);
    }

    // Hit zone line
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(HIT_ZONE_X, 0);
    ctx.lineTo(HIT_ZONE_X, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hit zone glow circle
    for (let s = 0; s < NUM_STRINGS; s++) {
      const y = s * LANE_HEIGHT + LANE_HEIGHT / 2;
      const grad = ctx.createRadialGradient(HIT_ZONE_X, y, 2, HIT_ZONE_X, y, 22);
      grad.addColorStop(0, "rgba(255,255,255,0.25)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(HIT_ZONE_X, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Notes
    for (const note of noteList) {
      if (note.xPos < -NOTE_WIDTH - 20 || note.xPos > W + NOTE_WIDTH) continue;
      const row = note.string - 1; // string 1 = row 0 (top)
      const y = row * LANE_HEIGHT + LANE_HEIGHT / 2;
      const color = STRING_COLORS[row];
      const isHit = note.result === "hit";
      const isMiss = note.result === "miss";

      const noteH = 28;
      const noteW = Math.max(NOTE_WIDTH * note.duration, 44);
      const rx = note.xPos - noteW / 2;

      // Shadow
      ctx.shadowColor = isHit ? "#2ecc71" : isMiss ? "#e74c3c" : color;
      ctx.shadowBlur = isHit ? 20 : 10;

      // Pill background
      ctx.fillStyle = isHit ? "#2ecc71" : isMiss ? "#c0392b" : color;
      ctx.globalAlpha = isMiss ? 0.35 : 1;
      const radius = noteH / 2;
      ctx.beginPath();
      ctx.moveTo(rx + radius, y - noteH / 2);
      ctx.lineTo(rx + noteW - radius, y - noteH / 2);
      ctx.arcTo(rx + noteW, y - noteH / 2, rx + noteW, y + noteH / 2, radius);
      ctx.lineTo(rx + noteW, y + noteH / 2);
      ctx.arcTo(rx + noteW, y + noteH / 2, rx + noteW - radius, y + noteH / 2, radius);
      ctx.lineTo(rx + radius, y + noteH / 2);
      ctx.arcTo(rx, y + noteH / 2, rx, y - noteH / 2, radius);
      ctx.arcTo(rx, y - noteH / 2, rx + radius, y - noteH / 2, radius);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Fret number
      if (!isMiss) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(note.fret), note.xPos, y + 5);
      }

      // Hit checkmark
      if (isHit) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✓", note.xPos, y + 5);
      }
    }

    // Song progress bar at bottom
    const beatsPerSec = song.bpm / 60;
    const lastBeat = Math.max(...song.notes.map(n => n.beat + n.duration));
    const progress = Math.min(1, (elapsedRef.current * beatsPerSec) / lastBeat);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, H - 4, W, 4);
    ctx.fillStyle = "#5B9E79";
    ctx.fillRect(0, H - 4, W * progress, 4);
  }

  // Need elapsed in draw without re-render dependency
  const elapsedRef = useRef(0);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

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
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Canvas sizing ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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

      {/* Song picker */}
      {gameState === "idle" && (
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

      {/* Countdown */}
      {gameState === "countdown" && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: 300, gap: "1rem",
        }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "6rem", fontWeight: 700, color: "var(--charcoal)", lineHeight: 1 }}>
            {countdown > 0 ? countdown : "Go!"}
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>{selectedSong?.title} · {selectedSong?.bpm} BPM</div>
        </div>
      )}

      {/* Game canvas */}
      {(gameState === "playing" || gameState === "finished") && (
        <div>
          {/* HUD */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Score</div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 700, color: "var(--charcoal)" }}>{score.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Combo</div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 700, color: combo >= 5 ? "#e67e22" : "var(--charcoal)" }}>{combo > 0 ? `${combo}×` : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Accuracy</div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 700, color: accuracy >= 80 ? "#2ecc71" : accuracy >= 50 ? "#e67e22" : "#e74c3c" }}>{total > 0 ? `${accuracy}%` : "—"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {detectedNote && (
                <div style={{ padding: "0.25rem 0.75rem", background: "#eafaf1", border: "1px solid #a9dfbf", borderRadius: 20, fontSize: "0.8125rem", fontWeight: 600, color: "#1e8449" }}>
                  🎵 {detectedNote}
                </div>
              )}
              <button
                onClick={resetGame}
                style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Restart"
              >
                <RotateCcw size={16} strokeWidth={1.5} />
              </button>
              <button
                onClick={stopGame}
                style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Stop"
              >
                <Square size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* String labels sidebar */}
          <div style={{ display: "flex", gap: 0 }}>
            <div style={{ width: 48, flexShrink: 0, background: "#111827", borderRadius: "10px 0 0 10px", display: "flex", flexDirection: "column" }}>
              {STRING_LABELS.map((lbl, i) => (
                <div key={i} style={{ height: LANE_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.75rem", color: STRING_COLORS[i] }}>{lbl}</span>
                </div>
              ))}
            </div>
            <canvas
              ref={canvasRef}
              style={{
                flex: 1,
                height: canvasHeight,
                borderRadius: "0 10px 10px 0",
                display: "block",
                background: "#1a1a2e",
              }}
            />
          </div>

          {/* Song finished overlay */}
          {gameState === "finished" && (
            <div style={{
              marginTop: "1.5rem",
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "1.5rem",
              textAlign: "center",
            }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 600, marginBottom: "1rem", color: "var(--charcoal)" }}>
                {accuracy >= 90 ? "🎸 Flawless!" : accuracy >= 70 ? "🎵 Nice playing!" : accuracy >= 50 ? "Keep practicing!" : "Good effort — try again!"}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", marginBottom: "1.25rem" }}>
                <div>
                  <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 2 }}>Final Score</div>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "var(--charcoal)" }}>{score.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 2 }}>Accuracy</div>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: accuracy >= 70 ? "#2ecc71" : "#e74c3c" }}>{accuracy}%</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 2 }}>Best Combo</div>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "var(--charcoal)" }}>{maxCombo}×</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 2 }}>Notes Hit</div>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "var(--charcoal)" }}>{hits}/{total}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button
                  onClick={() => selectedSong && startGame(selectedSong)}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.5rem", background: "var(--charcoal)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
                >
                  <RotateCcw size={15} strokeWidth={2} /> Try Again
                </button>
                <button
                  onClick={resetGame}
                  style={{ padding: "0.625rem 1.5rem", background: "transparent", color: "var(--charcoal)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}
                >
                  Pick Another Song
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* How to play */}
      {gameState === "idle" && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginTop: "1.5rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>How to play</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.8 }}>
            <li>Pick a song above. Allow mic access when prompted.</li>
            <li>Colored pills scroll left — each shows the <strong>string</strong> (by color) and <strong>fret number</strong>.</li>
            <li>Play the note on your guitar as it reaches the dashed line.</li>
            <li>Hit notes in a row to build your combo multiplier (up to 4×).</li>
            <li>Works best with acoustic guitar or electric guitar plugged directly into your device.</li>
          </ul>
        </div>
      )}

      {/* hitFlash invisible — just to suppress unused warning */}
      {hitFlash !== null && <span style={{ display: "none" }} />}
    </div>
  );
}
