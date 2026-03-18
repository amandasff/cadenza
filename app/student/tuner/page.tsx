"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "../../../lib/context/I18nContext";

// ── Pitch detection ──────────────────────────────────────────────────────────
function autoCorrelate(buffer: Float32Array<ArrayBuffer>, sampleRate: number): number {
  const SIZE = buffer.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.015) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }

  const buf2 = buffer.slice(r1, r2 + 1);
  const len = buf2.length;
  const c = new Float32Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i; j++) c[i] += buf2[j] * buf2[j + i];
  }

  let d = 0;
  while (d < len - 1 && c[d] > c[d + 1]) d++;

  let maxval = -1, maxpos = -1;
  for (let i = d; i < len; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }

  if (maxpos < 1 || maxpos >= len - 1) return -1;

  let T0 = maxpos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

const NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];

function frequencyToNoteInfo(freq: number) {
  if (freq < 20 || freq > 5000) return null;
  const semitones = 12 * Math.log2(freq / 440);
  const rounded = Math.round(semitones);
  const cents = Math.round((semitones - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor((rounded + 9) / 12) + 4;
  return { note: NOTE_NAMES[noteIndex], octave, cents };
}

// ── Karplus-Strong plucked string synthesis ──────────────────────────────────
function pluckString(ctx: AudioContext, freq: number) {
  const sampleRate = ctx.sampleRate;
  // Delay line length = one period at the target frequency
  const delayLen = Math.max(2, Math.round(sampleRate / freq));
  const duration = freq < 120 ? 5 : freq < 250 ? 4 : 3;
  const totalSamples = Math.round(sampleRate * duration);

  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Seed delay line with bandlimited noise (slight low-pass to avoid harshness)
  const delayLine = new Float32Array(delayLen);
  for (let i = 0; i < delayLen; i++) {
    delayLine[i] = Math.random() * 2 - 1;
  }
  // One-pass smoothing of seed noise
  for (let i = 1; i < delayLen; i++) {
    delayLine[i] = delayLine[i] * 0.6 + delayLine[i - 1] * 0.4;
  }

  // Damping coefficient — slightly lower for bass strings (more sustain)
  const damping = freq < 100 ? 0.998 : freq < 200 ? 0.9975 : 0.996;

  let pos = 0;
  for (let i = 0; i < totalSamples; i++) {
    const next = (pos + 1) % delayLen;
    const sample = delayLine[pos];
    data[i] = sample;
    // Average + damping (Karplus-Strong filter step)
    delayLine[pos] = damping * (sample + delayLine[next]) * 0.5;
    pos = next;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Gentle high-shelf roll-off for warmth
  const filter = ctx.createBiquadFilter();
  filter.type = "lowshelf";
  filter.frequency.value = 4000;
  filter.gain.value = -6;

  const gain = ctx.createGain();
  // Pluck attack
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.003);
  // Natural decay envelope
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
  return source;
}

// ── Instrument definitions ───────────────────────────────────────────────────
interface StringDef {
  label: string;   // e.g. "E2"
  freq: number;
  stringNum: number;
}

interface Instrument {
  name: string;
  strings: StringDef[];
  /** For headstock layout: left pegs (low → high) then right pegs */
  leftStrings: number[];   // indices into strings[]
  rightStrings: number[];
}

const INSTRUMENTS: Record<string, Instrument> = {
  guitar: {
    name: "Guitar",
    strings: [
      { label: "E2", freq: 82.41,  stringNum: 6 },
      { label: "A2", freq: 110.0,  stringNum: 5 },
      { label: "D3", freq: 146.83, stringNum: 4 },
      { label: "G3", freq: 196.0,  stringNum: 3 },
      { label: "B3", freq: 246.94, stringNum: 2 },
      { label: "E4", freq: 329.63, stringNum: 1 },
    ],
    leftStrings: [0, 1, 2],
    rightStrings: [5, 4, 3],
  },
  ukulele: {
    name: "Ukulele",
    strings: [
      { label: "G4", freq: 392.0,  stringNum: 4 },
      { label: "C4", freq: 261.63, stringNum: 3 },
      { label: "E4", freq: 329.63, stringNum: 2 },
      { label: "A4", freq: 440.0,  stringNum: 1 },
    ],
    leftStrings: [0, 1],
    rightStrings: [2, 3],
  },
  violin: {
    name: "Violin",
    strings: [
      { label: "G3", freq: 196.0,  stringNum: 4 },
      { label: "D4", freq: 293.66, stringNum: 3 },
      { label: "A4", freq: 440.0,  stringNum: 2 },
      { label: "E5", freq: 659.25, stringNum: 1 },
    ],
    leftStrings: [0, 1],
    rightStrings: [3, 2],
  },
  viola: {
    name: "Viola",
    strings: [
      { label: "C3", freq: 130.81, stringNum: 4 },
      { label: "G3", freq: 196.0,  stringNum: 3 },
      { label: "D4", freq: 293.66, stringNum: 2 },
      { label: "A4", freq: 440.0,  stringNum: 1 },
    ],
    leftStrings: [0, 1],
    rightStrings: [3, 2],
  },
  cello: {
    name: "Cello",
    strings: [
      { label: "C2", freq: 65.41,  stringNum: 4 },
      { label: "G2", freq: 98.0,   stringNum: 3 },
      { label: "D3", freq: 146.83, stringNum: 2 },
      { label: "A3", freq: 220.0,  stringNum: 1 },
    ],
    leftStrings: [0, 1],
    rightStrings: [3, 2],
  },
  bass: {
    name: "Bass",
    strings: [
      { label: "E1", freq: 41.20,  stringNum: 4 },
      { label: "A1", freq: 55.0,   stringNum: 3 },
      { label: "D2", freq: 73.42,  stringNum: 2 },
      { label: "G2", freq: 98.0,   stringNum: 1 },
    ],
    leftStrings: [0, 1],
    rightStrings: [3, 2],
  },
  mandolin: {
    name: "Mandolin",
    strings: [
      { label: "G3", freq: 196.0,  stringNum: 4 },
      { label: "D4", freq: 293.66, stringNum: 3 },
      { label: "A4", freq: 440.0,  stringNum: 2 },
      { label: "E5", freq: 659.25, stringNum: 1 },
    ],
    leftStrings: [0, 1],
    rightStrings: [3, 2],
  },
  banjo: {
    name: "Banjo",
    strings: [
      { label: "G4", freq: 392.0,  stringNum: 5 },
      { label: "D3", freq: 146.83, stringNum: 4 },
      { label: "G3", freq: 196.0,  stringNum: 3 },
      { label: "B3", freq: 246.94, stringNum: 2 },
      { label: "D4", freq: 293.66, stringNum: 1 },
    ],
    leftStrings: [0, 1, 2],
    rightStrings: [4, 3],
  },
};

const INSTRUMENT_ORDER = ["guitar", "ukulele", "violin", "viola", "cello", "bass", "mandolin", "banjo"];

// ── Tuning status ─────────────────────────────────────────────────────────────
function getTuningStatus(cents: number, inTune: string, slightlySharp: string, slightlyFlat: string, sharp: string, flat: string, tooSharp: string, tooFlat: string): { label: string; color: string } {
  const abs = Math.abs(cents);
  if (abs <= 5)  return { label: inTune, color: "#4CAF84" };
  if (abs <= 15) return { label: cents > 0 ? slightlySharp : slightlyFlat, color: "#A8C96E" };
  if (abs <= 35) return { label: cents > 0 ? sharp : flat, color: "#E6A817" };
  return { label: cents > 0 ? tooSharp : tooFlat, color: "#E05252" };
}

// ── PegButton ─────────────────────────────────────────────────────────────────
function PegButton({
  s, isActive, isPlaying, onPlay, side,
}: {
  s: StringDef;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  side: "left" | "right";
}) {
  const noteOnly = s.label.replace(/\d+/, "");
  const octave = s.label.match(/\d+/)?.[0] ?? "";
  const color = isActive ? "#4CAF84" : isPlaying ? "#E6A817" : "rgba(255,255,255,0.55)";
  const bgColor = isActive ? "#4CAF8422" : isPlaying ? "#E6A81722" : "rgba(255,255,255,0.05)";
  const borderColor = isActive ? "#4CAF84" : isPlaying ? "#E6A817" : "rgba(255,255,255,0.12)";
  const glow = isActive ? "0 0 12px #4CAF8466" : isPlaying ? "0 0 12px #E6A81766" : "none";

  return (
    <button
      onClick={onPlay}
      style={{
        display: "flex",
        flexDirection: side === "left" ? "row" : "row-reverse",
        alignItems: "center",
        gap: "0.5rem",
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: "0.5rem 0.625rem",
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: glow,
        minWidth: 68,
      }}
    >
      {/* Peg circle */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: isActive ? "#4CAF84" : isPlaying ? "#E6A817" : "#3A3A3C",
        border: `2px solid ${isActive ? "#6DD4A8" : isPlaying ? "#F2C35A" : "rgba(255,255,255,0.15)"}`,
        flexShrink: 0,
        boxShadow: isActive || isPlaying ? `0 0 8px ${color}66` : "inset 0 1px 0 rgba(255,255,255,0.1)",
        transition: "all 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {/* Peg slot */}
        <div style={{ width: 3, height: 10, background: isActive || isPlaying ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.15)", borderRadius: 2 }} />
      </div>
      {/* Note name */}
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", color, transition: "color 0.15s" }}>
          {noteOnly}
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em", marginTop: 1 }}>
          {octave}
        </div>
      </div>
    </button>
  );
}

// ── Headstock visual ──────────────────────────────────────────────────────────
function Headstock({
  instrument,
  activeLabel,
  playingLabel,
  noteInfo,
  onPlay,
}: {
  instrument: Instrument;
  activeLabel: string | null;
  playingLabel: string | null;
  noteInfo: { note: string; octave: number; cents: number } | null;
  onPlay: (s: StringDef) => void;
}) {
  const { strings, leftStrings, rightStrings } = instrument;
  const leftPegs = leftStrings.map(i => strings[i]);
  const rightPegs = rightStrings.map(i => strings[i]);
  const maxRows = Math.max(leftPegs.length, rightPegs.length);

  // All strings in order (low to high) for the string lines
  // Sort by stringNum descending so string 4 (thickest/top) is leftmost.
  // Frequency sort breaks re-entrant tunings like ukulele (G4 is string 4
  // but higher frequency than C4/string 3).
  const allStrings = [...strings].sort((a, b) => b.stringNum - a.stringNum);
  const numStrings = allStrings.length;

  return (
    <div style={{
      background: "#1A1A1C",
      borderRadius: 18,
      padding: "1.25rem 1rem 1.5rem",
      boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      {/* Label */}
      <div style={{
        textAlign: "center",
        fontFamily: "Inter, sans-serif",
        fontSize: "0.5625rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.25)",
        marginBottom: "1.125rem",
      }}>
        {instrument.name} · Standard Tuning · Tap to hear
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: "0.625rem" }}>
        {/* Left pegs column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", justifyContent: "center" }}>
          {leftPegs.map(s => (
            <PegButton
              key={s.label}
              s={s}
              isActive={activeLabel === s.label}
              isPlaying={playingLabel === s.label}
              onPlay={() => onPlay(s)}
              side="left"
            />
          ))}
          {/* Spacers for right-heavy instruments */}
          {Array.from({ length: maxRows - leftPegs.length }).map((_, i) => (
            <div key={i} style={{ height: 48 }} />
          ))}
        </div>

        {/* Headstock body + strings */}
        <div style={{ flex: 1, position: "relative", minHeight: maxRows * 56 }}>
          {/* Headstock body shape */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, #2A2320 0%, #1E1B18 100%)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.04)",
          }} />

          {/* Nut line at bottom */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 100%)",
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }} />

          {/* String lines */}
          {allStrings.map((s, idx) => {
            const isActive = activeLabel === s.label;
            const isPlaying = playingLabel === s.label;
            // Distribute strings evenly across the headstock width
            const leftPct = 8 + (idx / (numStrings - 1 || 1)) * 84;
            const stringThickness = 1 + (1 - idx / (numStrings - 1 || 1)) * 2.5; // thicker at left (low)
            const color = isActive ? "#4CAF84" : isPlaying ? "#E6A817" : `rgba(255,255,255,${0.12 + (1 - idx / (numStrings - 1 || 1)) * 0.18})`;
            const glow = isActive ? "#4CAF8488" : isPlaying ? "#E6A81788" : "transparent";

            return (
              <div
                key={s.label}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${leftPct}%`,
                  width: stringThickness,
                  transform: "translateX(-50%)",
                  background: color,
                  borderRadius: stringThickness,
                  boxShadow: (isActive || isPlaying) ? `0 0 6px 2px ${glow}` : "none",
                  transition: "background 0.2s, box-shadow 0.2s",
                }}
              />
            );
          })}

          {/* Detected note overlay (when actively detecting a matching string) */}
          {noteInfo && activeLabel && (() => {
            const activeStr = strings.find(s => s.label === activeLabel);
            if (!activeStr) return null;
            const idx = allStrings.findIndex(s => s.label === activeLabel);
            const leftPct = 8 + (idx / (numStrings - 1 || 1)) * 84;
            return (
              <div style={{
                position: "absolute",
                bottom: 8,
                left: `${leftPct}%`,
                transform: "translateX(-50%)",
                background: "rgba(76,175,132,0.15)",
                border: "1px solid rgba(76,175,132,0.4)",
                borderRadius: 4,
                padding: "1px 4px",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.5rem",
                fontWeight: 600,
                color: "#4CAF84",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}>
                {noteInfo.cents > 0 ? "+" : ""}{noteInfo.cents}¢
              </div>
            );
          })()}
        </div>

        {/* Right pegs column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", justifyContent: "center" }}>
          {rightPegs.map(s => (
            <PegButton
              key={s.label}
              s={s}
              isActive={activeLabel === s.label}
              isPlaying={playingLabel === s.label}
              onPlay={() => onPlay(s)}
              side="right"
            />
          ))}
          {Array.from({ length: maxRows - rightPegs.length }).map((_, i) => (
            <div key={i} style={{ height: 48 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TunerPage() {
  const { t } = useI18n();
  const [listening, setListening] = useState(false);
  const [noteInfo, setNoteInfo] = useState<{ note: string; octave: number; cents: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instrumentKey, setInstrumentKey] = useState("guitar");
  const [playingString, setPlayingString] = useState<string | null>(null);

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number>(0);
  const bufferRef    = useRef<Float32Array<ArrayBuffer> | null>(null);
  const toneCtxRef   = useRef<AudioContext | null>(null);
  const pluckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detect = useCallback(() => {
    const analyser = analyserRef.current;
    const buffer   = bufferRef.current;
    if (!analyser || !buffer) return;
    analyser.getFloatTimeDomainData(buffer);
    const ctx = audioCtxRef.current;
    if (ctx) {
      const freq = autoCorrelate(buffer, ctx.sampleRate);
      if (freq > 0) {
        const info = frequencyToNoteInfo(freq);
        if (info) setNoteInfo(info);
      }
    }
    rafRef.current = requestAnimationFrame(detect);
  }, []);

  async function startListening() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize);
      ctx.createMediaStreamSource(stream).connect(analyser);
      setListening(true);
      rafRef.current = requestAnimationFrame(detect);
    } catch {
      setError(t.student.tunerMicDenied);
    }
  }

  function stopListening() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current   = null;
    setListening(false);
    setNoteInfo(null);
  }

  function playTone(s: StringDef) {
    if (pluckTimerRef.current) clearTimeout(pluckTimerRef.current);

    // Close previous tone context
    if (toneCtxRef.current) {
      toneCtxRef.current.close().catch(() => {});
      toneCtxRef.current = null;
    }

    if (playingString === s.label) {
      setPlayingString(null);
      return;
    }

    const ctx = new AudioContext();
    toneCtxRef.current = ctx;
    pluckString(ctx, s.freq);
    setPlayingString(s.label);

    const duration = s.freq < 120 ? 5 : s.freq < 250 ? 4 : 3;
    pluckTimerRef.current = setTimeout(() => {
      setPlayingString(null);
    }, duration * 1000);
  }

  useEffect(() => () => {
    stopListening();
    if (pluckTimerRef.current) clearTimeout(pluckTimerRef.current);
    toneCtxRef.current?.close().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const instrument = INSTRUMENTS[instrumentKey];

  // Find active string (closest pitch match while listening)
  const activeLabel = (() => {
    if (!noteInfo) return null;
    const match = instrument.strings.find(s => {
      const sNote = s.label.replace(/\d+/, "");
      const sOctave = parseInt(s.label.match(/\d+/)![0]);
      return sNote === noteInfo.note && sOctave === noteInfo.octave;
    });
    return match?.label ?? null;
  })();

  const status = noteInfo
    ? getTuningStatus(noteInfo.cents, t.student.tunerInTune, t.student.tunerSlightlySharp, t.student.tunerSlightlyFlat, t.student.tunerSharp, t.student.tunerFlat, t.student.tunerTooSharp, t.student.tunerTooFlat)
    : null;

  const needlePct = noteInfo ? Math.min(100, Math.max(0, ((noteInfo.cents + 50) / 100) * 100)) : 50;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1C1C1E",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "2rem 1.25rem 3rem",
      fontFamily: "Inter, sans-serif",
    }}>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 400, marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.25rem" }}>
          Cadenza
        </div>
        <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 500, color: "#FDFCFA", letterSpacing: "-0.01em" }}>
          {t.student.tunerTitle}
        </div>
      </div>

      {/* Instrument selector */}
      <div style={{ width: "100%", maxWidth: 400, marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {INSTRUMENT_ORDER.map(key => (
            <button
              key={key}
              onClick={() => { setNoteInfo(null); setInstrumentKey(key); setPlayingString(null); }}
              style={{
                padding: "0.375rem 0.75rem",
                borderRadius: 20,
                border: `1px solid ${instrumentKey === key ? "#4CAF84" : "rgba(255,255,255,0.12)"}`,
                background: instrumentKey === key ? "#4CAF8422" : "transparent",
                color: instrumentKey === key ? "#4CAF84" : "rgba(255,255,255,0.4)",
                fontSize: "0.75rem",
                fontFamily: "Inter, sans-serif",
                fontWeight: instrumentKey === key ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {INSTRUMENTS[key].name}
            </button>
          ))}
        </div>
      </div>

      {/* Headstock */}
      <div style={{ width: "100%", maxWidth: 400, marginBottom: "1.25rem" }}>
        <Headstock
          instrument={instrument}
          activeLabel={activeLabel}
          playingLabel={playingString}
          noteInfo={noteInfo}
          onPlay={playTone}
        />
      </div>

      {/* Pitch display + gauge */}
      <div style={{
        width: "100%", maxWidth: 400,
        background: "#2C2C2E",
        borderRadius: 16,
        padding: "1.5rem 1.75rem",
        marginBottom: "1.25rem",
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      }}>
        {/* Note + octave */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "0.375rem", marginBottom: "1.25rem" }}>
          {noteInfo ? (
            <>
              <span style={{
                fontSize: "5rem", fontWeight: 700, lineHeight: 1,
                color: status?.color ?? "#FDFCFA",
                letterSpacing: "-0.04em",
                transition: "color 0.15s",
              }}>
                {noteInfo.note}
              </span>
              <span style={{ fontSize: "1.75rem", color: "rgba(255,255,255,0.3)", fontWeight: 300, alignSelf: "flex-end", paddingBottom: "0.5rem" }}>
                {noteInfo.octave}
              </span>
            </>
          ) : (
            <span style={{ fontSize: "4rem", color: "rgba(255,255,255,0.08)", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {listening ? "…" : "—"}
            </span>
          )}
        </div>

        {/* Gauge */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.5625rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>{t.student.tunerFlatGauge}</span>
            <span style={{ fontSize: "0.5625rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>{t.student.tunerSharpGauge}</span>
          </div>

          <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "visible" }}>
            {/* Center tick */}
            <div style={{
              position: "absolute", left: "50%", top: -5,
              transform: "translateX(-50%)", width: 1.5, height: 16,
              background: "rgba(255,255,255,0.18)", borderRadius: 1,
            }} />
            {/* Needle */}
            <div style={{
              position: "absolute", top: -5,
              left: `calc(${needlePct}% - 7px)`,
              width: 14, height: 16,
              background: status?.color ?? "rgba(255,255,255,0.15)",
              borderRadius: 3,
              transition: "left 0.08s ease-out, background 0.15s",
              boxShadow: noteInfo ? `0 0 10px ${status?.color}88` : "none",
            }} />
          </div>

          <div style={{ marginTop: "0.875rem", fontSize: "0.8125rem", textAlign: "center", color: status?.color ?? "rgba(255,255,255,0.2)", fontWeight: 500, transition: "color 0.15s" }}>
            {noteInfo ? (
              <>{noteInfo.cents > 0 ? "+" : ""}{noteInfo.cents} cents &nbsp;·&nbsp; {status?.label}</>
            ) : (
              listening ? t.student.tunerListening : "—"
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ width: "100%", maxWidth: 400, background: "#3A1A1A", border: "1px solid #E05252", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "#E05252" }}>
          {error}
        </div>
      )}

      {/* Mic button */}
      <button
        onClick={listening ? stopListening : startListening}
        style={{
          width: 72, height: 72, borderRadius: "50%", border: "none", cursor: "pointer",
          background: listening ? "#E05252" : "#4CAF84",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: listening ? "0 0 28px #E0525255" : "0 0 28px #4CAF8455",
          transition: "all 0.2s",
        }}
      >
        {listening ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="12" y1="19" x2="12" y2="23" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="23" x2="16" y2="23" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Practice button */}
      <a
        href="/student/practice"
        style={{
          marginTop: "2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          width: "100%",
          maxWidth: 400,
          padding: "0.875rem",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          color: "rgba(255,255,255,0.75)",
          fontFamily: "Inter, sans-serif",
          fontSize: "0.875rem",
          fontWeight: 500,
          textDecoration: "none",
          letterSpacing: "0.01em",
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
        Start recording practice
      </a>

    </div>
  );
}
