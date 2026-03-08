"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

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

// ── Instrument definitions ───────────────────────────────────────────────────
interface StringDef {
  label: string;   // e.g. "E2"
  freq: number;
  stringNum: number;
}

interface Instrument {
  name: string;
  strings: StringDef[];
  columns: number;
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
    columns: 6,
  },
  ukulele: {
    name: "Ukulele",
    strings: [
      { label: "G4", freq: 392.0,  stringNum: 4 },
      { label: "C4", freq: 261.63, stringNum: 3 },
      { label: "E4", freq: 329.63, stringNum: 2 },
      { label: "A4", freq: 440.0,  stringNum: 1 },
    ],
    columns: 4,
  },
  violin: {
    name: "Violin",
    strings: [
      { label: "G3", freq: 196.0,  stringNum: 4 },
      { label: "D4", freq: 293.66, stringNum: 3 },
      { label: "A4", freq: 440.0,  stringNum: 2 },
      { label: "E5", freq: 659.25, stringNum: 1 },
    ],
    columns: 4,
  },
  viola: {
    name: "Viola",
    strings: [
      { label: "C3", freq: 130.81, stringNum: 4 },
      { label: "G3", freq: 196.0,  stringNum: 3 },
      { label: "D4", freq: 293.66, stringNum: 2 },
      { label: "A4", freq: 440.0,  stringNum: 1 },
    ],
    columns: 4,
  },
  cello: {
    name: "Cello",
    strings: [
      { label: "C2", freq: 65.41,  stringNum: 4 },
      { label: "G2", freq: 98.0,   stringNum: 3 },
      { label: "D3", freq: 146.83, stringNum: 2 },
      { label: "A3", freq: 220.0,  stringNum: 1 },
    ],
    columns: 4,
  },
  bass: {
    name: "Bass",
    strings: [
      { label: "E1", freq: 41.20,  stringNum: 4 },
      { label: "A1", freq: 55.0,   stringNum: 3 },
      { label: "D2", freq: 73.42,  stringNum: 2 },
      { label: "G2", freq: 98.0,   stringNum: 1 },
    ],
    columns: 4,
  },
  mandolin: {
    name: "Mandolin",
    strings: [
      { label: "G3", freq: 196.0,  stringNum: 4 },
      { label: "D4", freq: 293.66, stringNum: 3 },
      { label: "A4", freq: 440.0,  stringNum: 2 },
      { label: "E5", freq: 659.25, stringNum: 1 },
    ],
    columns: 4,
  },
  banjo: {
    name: "Banjo (5-str)",
    strings: [
      { label: "G4", freq: 392.0,  stringNum: 5 },
      { label: "D3", freq: 146.83, stringNum: 4 },
      { label: "G3", freq: 196.0,  stringNum: 3 },
      { label: "B3", freq: 246.94, stringNum: 2 },
      { label: "D4", freq: 293.66, stringNum: 1 },
    ],
    columns: 5,
  },
};

const INSTRUMENT_ORDER = ["guitar", "ukulele", "violin", "viola", "cello", "bass", "mandolin", "banjo"];

// ── Tuning status ─────────────────────────────────────────────────────────────
function getTuningStatus(cents: number): { label: string; color: string } {
  const abs = Math.abs(cents);
  if (abs <= 5)  return { label: "In tune", color: "#4CAF84" };
  if (abs <= 15) return { label: cents > 0 ? "Slightly sharp" : "Slightly flat", color: "#A8C96E" };
  if (abs <= 35) return { label: cents > 0 ? "Sharp" : "Flat", color: "#E6A817" };
  return { label: cents > 0 ? "Too sharp" : "Too flat", color: "#E05252" };
}

export default function TunerPage() {
  const [listening, setListening] = useState(false);
  const [noteInfo, setNoteInfo] = useState<{ note: string; octave: number; cents: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instrumentKey, setInstrumentKey] = useState("guitar");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number>(0);
  const bufferRef    = useRef<Float32Array<ArrayBuffer> | null>(null);

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
      setError("Microphone access denied. Please allow mic access and try again.");
    }
  }

  function stopListening() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current   = null;
    setListening(false);
    setNoteInfo(null);
  }

  useEffect(() => () => { stopListening(); }, []); // cleanup on unmount

  const instrument = INSTRUMENTS[instrumentKey];
  const status = noteInfo ? getTuningStatus(noteInfo.cents) : null;
  const needlePct = noteInfo ? Math.min(100, Math.max(0, ((noteInfo.cents + 50) / 100) * 100)) : 50;

  // Find closest string to current note
  function getClosestString() {
    if (!noteInfo) return null;
    const { note, octave } = noteInfo;
    return instrument.strings.find(s => {
      const sNote = s.label.replace(/\d+/, "");
      const sOctave = parseInt(s.label.match(/\d+/)![0]);
      return sNote === note && sOctave === octave;
    }) ?? null;
  }
  const closestString = getClosestString();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1C1C1E",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "2rem 1.5rem 3rem",
      fontFamily: "Inter, sans-serif",
    }}>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 380, marginBottom: "1.75rem" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "0.25rem" }}>
          Cadenza
        </div>
        <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 500, color: "#FDFCFA", letterSpacing: "-0.01em" }}>
          Tuner
        </div>
      </div>

      {/* Instrument selector */}
      <div style={{ width: "100%", maxWidth: 380, marginBottom: "1.5rem" }}>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "0.375rem",
        }}>
          {INSTRUMENT_ORDER.map(key => (
            <button
              key={key}
              onClick={() => { setNoteInfo(null); setInstrumentKey(key); }}
              style={{
                padding: "0.375rem 0.75rem",
                borderRadius: 20,
                border: `1px solid ${instrumentKey === key ? "#4CAF84" : "rgba(255,255,255,0.12)"}`,
                background: instrumentKey === key ? "#4CAF8422" : "transparent",
                color: instrumentKey === key ? "#4CAF84" : "rgba(255,255,255,0.45)",
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

      {/* Main display */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "#2C2C2E",
        borderRadius: 16,
        padding: "2.5rem 2rem",
        marginBottom: "1.25rem",
        textAlign: "center",
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      }}>

        {/* Closest string hint */}
        {closestString && (
          <div style={{ marginBottom: "0.75rem", fontSize: "0.6875rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            String {closestString.stringNum} · {closestString.label}
          </div>
        )}

        {/* Note display */}
        <div style={{ marginBottom: "2rem" }}>
          {noteInfo ? (
            <>
              <div style={{
                fontSize: "6rem",
                fontWeight: 700,
                color: status?.color ?? "#FDFCFA",
                lineHeight: 1,
                letterSpacing: "-0.04em",
                transition: "color 0.2s",
              }}>
                {noteInfo.note}
              </div>
              <div style={{ fontSize: "1.5rem", color: "rgba(255,255,255,0.35)", marginTop: "0.25rem", fontWeight: 300 }}>
                {noteInfo.octave}
              </div>
            </>
          ) : (
            <div style={{ fontSize: "4rem", color: "rgba(255,255,255,0.1)", lineHeight: 1, letterSpacing: "-0.02em" }}>
              —
            </div>
          )}
        </div>

        {/* Cents gauge */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>FLAT</span>
            <span style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>SHARP</span>
          </div>

          <div style={{
            position: "relative", height: 6,
            background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "visible",
          }}>
            <div style={{
              position: "absolute", left: "50%", top: -4,
              transform: "translateX(-50%)", width: 2, height: 14,
              background: "rgba(255,255,255,0.15)", borderRadius: 1,
            }} />
            <div style={{
              position: "absolute", top: -5,
              left: `calc(${needlePct}% - 6px)`,
              width: 12, height: 16,
              background: status?.color ?? "rgba(255,255,255,0.2)",
              borderRadius: 2,
              transition: "left 0.1s ease-out, background 0.2s",
              boxShadow: noteInfo ? `0 0 8px ${status?.color}88` : "none",
            }} />
          </div>

          <div style={{ marginTop: "0.875rem", fontSize: "0.8125rem", color: status?.color ?? "rgba(255,255,255,0.2)", fontWeight: 500, transition: "color 0.2s" }}>
            {noteInfo ? (
              <>{noteInfo.cents > 0 ? "+" : ""}{noteInfo.cents} cents &nbsp;·&nbsp; {status?.label}</>
            ) : (
              listening ? "Listening…" : "—"
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ width: "100%", maxWidth: 380, background: "#3A1A1A", border: "1px solid #E05252", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "#E05252" }}>
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
          boxShadow: listening ? "0 0 24px #E0525260" : "0 0 24px #4CAF8460",
          transition: "all 0.2s",
          marginBottom: "2.5rem",
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

      {/* String reference */}
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.875rem", textAlign: "center" }}>
          {instrument.name} · Standard Tuning
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${instrument.columns}, 1fr)`,
          gap: "0.5rem",
        }}>
          {instrument.strings.map(s => {
            const sNote = s.label.replace(/\d+/, "");
            const sOctave = parseInt(s.label.match(/\d+/)![0]);
            const isActive = noteInfo
              ? noteInfo.note === sNote && noteInfo.octave === sOctave
              : false;
            return (
              <div
                key={`${s.label}-${s.stringNum}`}
                style={{
                  background: isActive ? "#4CAF8422" : "#2C2C2E",
                  border: `1px solid ${isActive ? "#4CAF84" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 8,
                  padding: "0.625rem 0.25rem",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: isActive ? "#4CAF84" : "#FDFCFA", marginBottom: "0.125rem" }}>
                  {sNote}
                </div>
                <div style={{ fontSize: "0.5625rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>
                  {sOctave} · str {s.stringNum}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
