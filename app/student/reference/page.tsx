"use client";
import React, { useState } from "react";
import RcmTechnique from "./RcmTechnique";

// ── Audio ──────────────────────────────────────────────────────────────────────

const GUITAR_OPEN_FREQS = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
const UKE_OPEN_FREQS   = [392.0, 261.63, 329.63, 440.0];
const BASS_OPEN_FREQS  = [41.20, 55.0, 73.42, 98.0];

function chordFreqs(frets: number[], openFreqs: number[]): number[] {
  return frets
    .map((fret, i) => fret < 0 ? 0 : openFreqs[i] * Math.pow(2, fret / 12))
    .filter(f => f > 0);
}

function pianoChordFreqs(root: number, intervals: number[]): number[] {
  return intervals.map(iv => 261.63 * Math.pow(2, (root + iv) / 12));
}

function playSound(frequencies: number[], style: "pluck" | "piano") {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    const dur = style === "piano" ? 3 : 1.8;
    frequencies.forEach((freq, i) => {
      const t0 = ctx.currentTime + (style === "pluck" ? i * 0.05 : 0);
      [[1, 0.7], [2, 0.35], [3, 0.18], [4, 0.08]].forEach(([h, a]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.value = style === "piano" ? 4000 : 2200 / h;
        osc.type = style === "piano" ? "triangle" : "sawtooth";
        osc.frequency.value = freq * h;
        const atk = style === "piano" ? 0.01 : 0.002;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(a / h, t0 + atk);
        if (style === "piano") {
          gain.gain.exponentialRampToValueAtTime(a * 0.4 / h, t0 + 0.4);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        } else {
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur / h);
        }
        osc.connect(filt); filt.connect(gain); gain.connect(master);
        osc.start(t0); osc.stop(t0 + dur + 0.2);
      });
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, (dur + 1.5) * 1000);
  } catch {}
}

// ── Note / chord data ──────────────────────────────────────────────────────────

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC: Record<string, string> = {
  "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb",
};

const PIANO_CHORD_TYPES = [
  { id:"maj",  label:"Major",    intervals:[0,4,7] },
  { id:"min",  label:"Minor",    intervals:[0,3,7] },
  { id:"7",    label:"Dom 7",    intervals:[0,4,7,10] },
  { id:"maj7", label:"Major 7",  intervals:[0,4,7,11] },
  { id:"m7",   label:"Minor 7",  intervals:[0,3,7,10] },
  { id:"dim",  label:"Dim",      intervals:[0,3,6] },
  { id:"aug",  label:"Aug",      intervals:[0,4,8] },
  { id:"sus2", label:"Sus 2",    intervals:[0,2,7] },
  { id:"sus4", label:"Sus 4",    intervals:[0,5,7] },
  { id:"9",    label:"Dom 9",    intervals:[0,4,7,10,14] },
  { id:"m9",   label:"Minor 9",  intervals:[0,3,7,10,14] },
  { id:"add9", label:"Add 9",    intervals:[0,4,7,14] },
];

// ── Guitar chord database ──────────────────────────────────────────────────────
// frets[]: 6 values (low E → high e), -1=muted, 0=open, N=fret number
// baseFret: diagram starting fret (default 1)

interface GChord { name: string; frets: number[]; baseFret?: number; }

const GUITAR_CHORDS: Record<string, GChord[]> = {
  major: [
    { name:"C",   frets:[-1,3,2,0,1,0] },
    { name:"C#",  frets:[-1,4,6,6,6,4], baseFret:4 },
    { name:"D",   frets:[-1,-1,0,2,3,2] },
    { name:"D#",  frets:[-1,6,8,8,8,6], baseFret:6 },
    { name:"E",   frets:[0,2,2,1,0,0] },
    { name:"F",   frets:[1,3,3,2,1,1] },
    { name:"F#",  frets:[2,4,4,3,2,2], baseFret:2 },
    { name:"G",   frets:[3,2,0,0,0,3] },
    { name:"G#",  frets:[4,6,6,5,4,4], baseFret:4 },
    { name:"A",   frets:[-1,0,2,2,2,0] },
    { name:"A#",  frets:[-1,1,3,3,3,1] },
    { name:"B",   frets:[-1,2,4,4,4,2], baseFret:2 },
  ],
  minor: [
    { name:"Cm",  frets:[-1,3,5,5,4,3], baseFret:3 },
    { name:"C#m", frets:[-1,4,6,6,5,4], baseFret:4 },
    { name:"Dm",  frets:[-1,-1,0,2,3,1] },
    { name:"D#m", frets:[-1,6,8,8,7,6], baseFret:6 },
    { name:"Em",  frets:[0,2,2,0,0,0] },
    { name:"Fm",  frets:[1,3,3,1,1,1] },
    { name:"F#m", frets:[2,4,4,2,2,2], baseFret:2 },
    { name:"Gm",  frets:[3,5,5,3,3,3], baseFret:3 },
    { name:"G#m", frets:[4,6,6,4,4,4], baseFret:4 },
    { name:"Am",  frets:[-1,0,2,2,1,0] },
    { name:"A#m", frets:[-1,1,3,3,2,1] },
    { name:"Bm",  frets:[-1,2,4,4,3,2], baseFret:2 },
  ],
  dom7: [
    { name:"C7",   frets:[-1,3,2,3,1,0] },
    { name:"C#7",  frets:[-1,4,6,4,6,4], baseFret:4 },
    { name:"D7",   frets:[-1,-1,0,2,1,2] },
    { name:"D#7",  frets:[-1,6,8,6,8,6], baseFret:6 },
    { name:"E7",   frets:[0,2,0,1,0,0] },
    { name:"F7",   frets:[1,3,1,2,1,1] },
    { name:"F#7",  frets:[2,4,2,3,2,2], baseFret:2 },
    { name:"G7",   frets:[3,2,0,0,0,1] },
    { name:"G#7",  frets:[4,6,4,5,4,4], baseFret:4 },
    { name:"A7",   frets:[-1,0,2,0,2,0] },
    { name:"A#7",  frets:[-1,1,3,1,3,1] },
    { name:"B7",   frets:[-1,2,1,2,0,2] },
  ],
  maj7: [
    { name:"Cmaj7",  frets:[-1,3,2,0,0,0] },
    { name:"C#maj7", frets:[-1,4,6,5,6,4], baseFret:4 },
    { name:"Dmaj7",  frets:[-1,-1,0,2,2,2] },
    { name:"D#maj7", frets:[-1,6,8,7,8,6], baseFret:6 },
    { name:"Emaj7",  frets:[0,2,1,1,0,0] },
    { name:"Fmaj7",  frets:[1,3,2,2,1,1] },
    { name:"F#maj7", frets:[2,4,3,3,2,2], baseFret:2 },
    { name:"Gmaj7",  frets:[3,2,0,0,0,2] },
    { name:"G#maj7", frets:[4,6,5,5,4,4], baseFret:4 },
    { name:"Amaj7",  frets:[-1,0,2,1,2,0] },
    { name:"A#maj7", frets:[-1,1,3,2,3,1] },
    { name:"Bmaj7",  frets:[-1,2,4,3,4,2], baseFret:2 },
  ],
  m7: [
    { name:"Cm7",  frets:[-1,3,5,3,4,3], baseFret:3 },
    { name:"C#m7", frets:[-1,4,6,4,5,4], baseFret:4 },
    { name:"Dm7",  frets:[-1,-1,0,2,1,1] },
    { name:"D#m7", frets:[-1,6,8,6,7,6], baseFret:6 },
    { name:"Em7",  frets:[0,2,0,0,0,0] },
    { name:"Fm7",  frets:[1,3,1,1,1,1] },
    { name:"F#m7", frets:[2,4,2,2,2,2], baseFret:2 },
    { name:"Gm7",  frets:[3,5,3,3,3,3], baseFret:3 },
    { name:"G#m7", frets:[4,6,4,4,4,4], baseFret:4 },
    { name:"Am7",  frets:[-1,0,2,0,1,0] },
    { name:"A#m7", frets:[-1,1,3,1,2,1] },
    { name:"Bm7",  frets:[-1,2,4,2,3,2], baseFret:2 },
  ],
  dim: [
    { name:"Cdim",  frets:[-1,3,4,5,4,3], baseFret:3 },
    { name:"C#dim", frets:[-1,4,5,6,5,4], baseFret:4 },
    { name:"Ddim",  frets:[-1,-1,0,1,0,1] },
    { name:"D#dim", frets:[-1,-1,1,2,1,2] },
    { name:"Edim",  frets:[0,1,2,3,2,0] },
    { name:"Fdim",  frets:[-1,-1,3,4,3,4] },
    { name:"F#dim", frets:[2,3,4,5,4,2], baseFret:2 },
    { name:"Gdim",  frets:[3,4,5,6,5,3], baseFret:3 },
    { name:"G#dim", frets:[4,5,6,7,6,4], baseFret:4 },
    { name:"Adim",  frets:[-1,0,1,2,1,2] },
    { name:"A#dim", frets:[-1,1,2,3,2,3] },
    { name:"Bdim",  frets:[-1,2,3,4,3,2], baseFret:2 },
  ],
  sus4: [
    { name:"Csus4",  frets:[-1,3,3,0,1,1] },
    { name:"C#sus4", frets:[-1,4,6,6,7,4], baseFret:4 },
    { name:"Dsus4",  frets:[-1,-1,0,2,3,3] },
    { name:"D#sus4", frets:[-1,6,8,8,9,6], baseFret:6 },
    { name:"Esus4",  frets:[0,2,2,2,0,0] },
    { name:"Fsus4",  frets:[1,3,3,3,1,1] },
    { name:"F#sus4", frets:[2,4,4,4,2,2], baseFret:2 },
    { name:"Gsus4",  frets:[3,5,5,5,3,3], baseFret:3 },
    { name:"G#sus4", frets:[4,6,6,6,4,4], baseFret:4 },
    { name:"Asus4",  frets:[-1,0,2,2,3,0] },
    { name:"A#sus4", frets:[-1,1,3,3,4,1] },
    { name:"Bsus4",  frets:[-1,2,4,4,5,2], baseFret:2 },
  ],
  sus2: [
    { name:"Csus2",  frets:[-1,3,0,0,3,3] },
    { name:"C#sus2", frets:[-1,4,6,6,4,4], baseFret:4 },
    { name:"Dsus2",  frets:[-1,-1,0,2,3,0] },
    { name:"D#sus2", frets:[-1,6,8,8,6,6], baseFret:6 },
    { name:"Esus2",  frets:[0,2,4,4,0,0] },
    { name:"Fsus2",  frets:[1,3,5,5,1,1] },
    { name:"F#sus2", frets:[2,4,6,6,2,2], baseFret:2 },
    { name:"Gsus2",  frets:[3,5,7,7,3,3], baseFret:3 },
    { name:"G#sus2", frets:[4,6,6,6,4,4], baseFret:4 },
    { name:"Asus2",  frets:[-1,0,2,2,0,0] },
    { name:"A#sus2", frets:[-1,1,3,3,1,1] },
    { name:"Bsus2",  frets:[-1,2,4,4,2,2], baseFret:2 },
  ],
};

const GUITAR_QUALITY_LABELS: Record<string, string> = {
  major:"Major", minor:"Minor", dom7:"Dom 7", maj7:"Major 7",
  m7:"Minor 7", dim:"Diminished", sus4:"Sus 4", sus2:"Sus 2",
};

// ── Ukulele chord database (G C E A) ──────────────────────────────────────────

const UKULELE_CHORDS: Record<string, GChord[]> = {
  major: [
    { name:"C",   frets:[0,0,0,3] },
    { name:"C#",  frets:[1,1,1,4] },
    { name:"D",   frets:[2,2,2,0] },
    { name:"D#",  frets:[3,3,3,1] },
    { name:"E",   frets:[4,4,4,2] },
    { name:"F",   frets:[2,0,1,0] },
    { name:"F#",  frets:[3,1,2,1] },
    { name:"G",   frets:[0,2,3,2] },
    { name:"G#",  frets:[1,3,4,3] },
    { name:"A",   frets:[2,1,0,0] },
    { name:"A#",  frets:[3,2,1,1] },
    { name:"B",   frets:[4,3,2,2] },
  ],
  minor: [
    { name:"Cm",  frets:[0,3,3,3] },
    { name:"C#m", frets:[1,4,4,4] },
    { name:"Dm",  frets:[2,2,1,0] },
    { name:"D#m", frets:[3,3,2,1] },
    { name:"Em",  frets:[0,4,3,2] },
    { name:"Fm",  frets:[1,0,1,3] },
    { name:"F#m", frets:[2,1,2,0] },
    { name:"Gm",  frets:[0,2,3,1] },
    { name:"G#m", frets:[1,3,4,2] },
    { name:"Am",  frets:[2,0,0,0] },
    { name:"A#m", frets:[3,1,0,1] },
    { name:"Bm",  frets:[4,2,2,2] },
  ],
  dom7: [
    { name:"C7",   frets:[0,0,0,1] },
    { name:"C#7",  frets:[1,1,1,2] },
    { name:"D7",   frets:[2,2,2,3] },
    { name:"D#7",  frets:[3,3,3,4] },
    { name:"E7",   frets:[1,2,0,2] },
    { name:"F7",   frets:[2,0,1,3] },
    { name:"F#7",  frets:[3,1,2,0] },
    { name:"G7",   frets:[0,2,1,2] },
    { name:"G#7",  frets:[1,3,2,3] },
    { name:"A7",   frets:[0,1,0,0] },
    { name:"A#7",  frets:[1,2,1,1] },
    { name:"B7",   frets:[2,3,2,2] },
  ],
  maj7: [
    { name:"Cmaj7",  frets:[0,0,0,2] },
    { name:"C#maj7", frets:[1,1,1,3] },
    { name:"Dmaj7",  frets:[2,2,2,4] },
    { name:"D#maj7", frets:[3,3,3,5] },
    { name:"Emaj7",  frets:[1,3,0,2] },
    { name:"Fmaj7",  frets:[2,4,1,0] },
    { name:"F#maj7", frets:[3,1,2,2] },
    { name:"Gmaj7",  frets:[0,2,2,2] },
    { name:"G#maj7", frets:[1,3,3,3] },
    { name:"Amaj7",  frets:[1,1,0,0] },
    { name:"A#maj7", frets:[2,2,1,1] },
    { name:"Bmaj7",  frets:[3,3,2,2] },
  ],
  m7: [
    { name:"Cm7",  frets:[0,3,3,3] }, // same as Cm, often voiced same
    { name:"C#m7", frets:[1,1,0,2] },
    { name:"Dm7",  frets:[2,2,1,3] },
    { name:"D#m7", frets:[3,3,2,4] },
    { name:"Em7",  frets:[0,2,0,2] },
    { name:"Fm7",  frets:[1,3,1,3] },
    { name:"F#m7", frets:[2,0,2,0] },
    { name:"Gm7",  frets:[0,2,1,1] },
    { name:"G#m7", frets:[1,3,2,2] },
    { name:"Am7",  frets:[0,0,0,0] },
    { name:"A#m7", frets:[1,1,0,1] },
    { name:"Bm7",  frets:[2,2,2,2] },
  ],
  dim: [
    { name:"Cdim",  frets:[2,3,2,3] },
    { name:"C#dim", frets:[0,1,0,1] },
    { name:"Ddim",  frets:[1,2,1,2] },
    { name:"D#dim", frets:[2,3,2,3] },
    { name:"Edim",  frets:[0,1,0,1] },
    { name:"Fdim",  frets:[1,2,1,2] },
    { name:"F#dim", frets:[2,3,2,3] },
    { name:"Gdim",  frets:[0,1,0,1] },
    { name:"G#dim", frets:[1,2,1,2] },
    { name:"Adim",  frets:[2,3,2,3] },
    { name:"A#dim", frets:[0,1,0,1] },
    { name:"Bdim",  frets:[1,2,1,2] },
  ],
};

const UKE_QUALITY_LABELS: Record<string, string> = {
  major:"Major", minor:"Minor", dom7:"Dom 7", maj7:"Major 7", m7:"Minor 7", dim:"Diminished",
};

// ── Bass power chords (root + 5th) ──────────────────────────────────────────

const BASS_CHORDS: GChord[] = [
  { name:"C5",   frets:[-1,3,5,5] },
  { name:"C#5",  frets:[-1,4,6,6] },
  { name:"D5",   frets:[-1,5,7,7] },
  { name:"D#5",  frets:[1,3,3,-1] },
  { name:"E5",   frets:[0,2,2,-1] },
  { name:"F5",   frets:[1,3,3,-1] },
  { name:"F#5",  frets:[2,4,4,-1] },
  { name:"G5",   frets:[3,5,5,-1] },
  { name:"G#5",  frets:[4,6,6,-1] },
  { name:"A5",   frets:[-1,0,2,2] },
  { name:"A#5",  frets:[-1,1,3,3] },
  { name:"B5",   frets:[-1,2,4,4] },
];

// ── Piano keyboard component ──────────────────────────────────────────────────

const WHITE_ORDER  = [0,2,4,5,7,9,11];
const BLACK_OFFSET = [0.75,1.75,3.75,4.75,5.75];
const BLACK_NOTE   = [1,3,6,8,10];

function PianoKeyboard({ highlightedNotes }: { highlightedNotes: number[] }) {
  const hl = new Set(highlightedNotes.map(n => n % 12));
  const W = 34, H = 120, BW = 22, BH = 72;
  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <svg width={14 * W + 1} height={H + 2} style={{ display: "block" }}>
        {Array.from({ length: 14 }, (_, i) => {
          const semitone = WHITE_ORDER[i % 7];
          const isHl = hl.has(semitone);
          return (
            <g key={i}>
              <rect x={i*W+1} y={1} width={W-1} height={H} fill={isHl ? "#B85C3A" : "#FDFCFA"} stroke="#CCC" strokeWidth={1} rx={2} />
              {isHl && <text x={i*W+W/2} y={H-10} textAnchor="middle" fontSize={10} fill="#FFF" fontFamily="Inter,sans-serif" fontWeight={600}>{NOTE_NAMES[semitone]}</text>}
            </g>
          );
        })}
        {Array.from({ length: 2 }, (_, oct) =>
          BLACK_OFFSET.map((offset, bi) => {
            const semitone = BLACK_NOTE[bi];
            const isHl = hl.has(semitone);
            const x = (oct * 7 + offset) * W;
            return (
              <g key={oct*5+bi}>
                <rect x={x} y={1} width={BW} height={BH} fill={isHl ? "#B85C3A" : "#1A1714"} stroke="#111" strokeWidth={1} rx={2} />
                {isHl && <text x={x+BW/2} y={BH-8} textAnchor="middle" fontSize={9} fill="#FFF" fontFamily="Inter,sans-serif" fontWeight={600}>{NOTE_NAMES[semitone]}</text>}
              </g>
            );
          })
        ).flat()}
      </svg>
    </div>
  );
}

// ── Chord diagram component ────────────────────────────────────────────────────

function ChordDiagram({ chord, strings = 6, openFreqs, onPlay }: {
  chord: GChord; strings?: number; openFreqs: number[]; onPlay: () => void;
}) {
  const FRETS = 5;
  const SW = strings === 4 ? 22 : 18;
  const FH = 16; const PAD = 10;
  const W = (strings - 1) * SW + PAD * 2;
  const H = FRETS * FH + PAD * 2 + 12;
  const baseFret = chord.baseFret ?? 1;
  const maxFret = Math.max(...chord.frets.filter(f => f > 0), 0);
  const displayBase = maxFret > FRETS ? baseFret : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal)", fontFamily: "Inter,sans-serif" }}>{chord.name}</div>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {displayBase === 1 && <rect x={PAD} y={PAD} width={(strings-1)*SW} height={3} fill="var(--charcoal)" rx={1} />}
        {Array.from({ length: FRETS }, (_, f) => (
          <line key={f} x1={PAD} y1={PAD+f*FH} x2={PAD+(strings-1)*SW} y2={PAD+f*FH}
            stroke="#CCC" strokeWidth={f===0 && displayBase===1 ? 0 : 1} />
        ))}
        {Array.from({ length: strings }, (_, s) => (
          <line key={s} x1={PAD+s*SW} y1={PAD} x2={PAD+s*SW} y2={PAD+FRETS*FH} stroke="#CCC" strokeWidth={1} />
        ))}
        {chord.frets.map((fret, s) => (
          <text key={s} x={PAD+s*SW} y={PAD-4} textAnchor="middle" fontSize={9} fill={fret===-1?"#BBB":"#777"} fontFamily="Inter,sans-serif">
            {fret===-1 ? "×" : fret===0 ? "○" : ""}
          </text>
        ))}
        {chord.frets.map((fret, s) => {
          if (fret <= 0) return null;
          const df = fret - displayBase + 1;
          if (df < 1 || df > FRETS) return null;
          return <circle key={s} cx={PAD+s*SW} cy={PAD+(df-0.5)*FH} r={6} fill="var(--charcoal)" />;
        })}
        {displayBase > 1 && (
          <text x={W+2} y={PAD+FH*0.65} fontSize={8} fill="var(--muted)" fontFamily="Inter,sans-serif">{displayBase}fr</text>
        )}
      </svg>
      <button onClick={onPlay} style={{
        padding:"0.2rem 0.5rem", borderRadius:4, border:"1px solid var(--border-strong)",
        background:"transparent", color:"var(--muted)", fontSize:"0.625rem",
        cursor:"pointer", fontFamily:"Inter,sans-serif",
      }}>▶ Play</button>
    </div>
  );
}

// ── Practice guides ──────────────────────────────────────────────────────────

const PRACTICE_GUIDES = [
  {
    title: "The 4-bar loop",
    icon: "🔁",
    color: "#4A67B9",
    body: "Identify the hardest 4 bars and drill only those. Don't always start from the beginning — isolate the problem, fix it, then reconnect it to the surrounding music.",
  },
  {
    title: "Slow practice",
    icon: "🐢",
    color: "#4CAF84",
    body: "Practice at 50–60% of tempo until every note is correct. Speed is a by-product of accuracy. Use a metronome and increase tempo by 5 BPM increments only when the current tempo is perfect.",
  },
  {
    title: "Hands separately (piano)",
    icon: "🤲",
    color: "#9B59B6",
    body: "Learn each hand until it's automatic before combining. When hands-together feels impossible, go back to hands-separately at a slower tempo. The hands teach each other.",
  },
  {
    title: "Chunking",
    icon: "🧩",
    color: "#E6A817",
    body: "Divide the piece into logical chunks (phrases, sections). Master each chunk before connecting them. Chunks should be 4–8 bars — small enough to memorize quickly.",
  },
  {
    title: "Record yourself",
    icon: "🎙️",
    color: "#E05252",
    body: "Record every practice session. You hear differently on playback — tone, timing, and dynamics that felt right often aren't. Listening critically to recordings is one of the fastest paths to improvement.",
  },
  {
    title: "The 20-minute rule",
    icon: "⏱️",
    color: "#B85C3A",
    body: "20 focused minutes beats 2 unfocused hours. Start each session with a clear goal (e.g., 'perfect bars 12–16 at 80 BPM'). Stop when focus fades. Frequent short sessions build skill faster than long exhausting ones.",
  },
  {
    title: "Warm up intentionally",
    icon: "🔥",
    color: "#E67E22",
    body: "Don't warm up by playing through the piece. Use scales, arpeggios, or technical exercises. For guitarists: chromatic exercises, string skipping. Piano: Hanon, five-finger patterns, triads in all keys.",
  },
  {
    title: "Mental practice",
    icon: "🧠",
    color: "#1ABC9C",
    body: "Away from your instrument, visualize playing the piece perfectly — hear the notes, feel the movements. Elite performers use mental practice as much as physical practice. It reinforces neural pathways.",
  },
  {
    title: "Performance practice",
    icon: "🎭",
    color: "#8E44AD",
    body: "Once you know the piece, do full run-throughs without stopping. Getting comfortable with mistakes (recovering gracefully) is a separate skill from playing correctly. Record these run-throughs.",
  },
];

// ── Theory quick reference ────────────────────────────────────────────────────

const INTERVALS = [
  ["0","Unison","P1","Same note"],
  ["1","Minor 2nd","m2","Half step"],
  ["2","Major 2nd","M2","Whole step"],
  ["3","Minor 3rd","m3","1½ steps"],
  ["4","Major 3rd","M3","2 whole steps"],
  ["5","Perfect 4th","P4","2½ steps"],
  ["6","Tritone","A4/d5","3 whole steps"],
  ["7","Perfect 5th","P5","3½ steps"],
  ["8","Minor 6th","m6","4 whole steps"],
  ["9","Major 6th","M6","4½ steps"],
  ["10","Minor 7th","m7","5 whole steps"],
  ["11","Major 7th","M7","5½ steps"],
  ["12","Octave","P8","6 whole steps"],
];

const KEY_SIGS = [
  ["C","0 sharps / 0 flats"],
  ["G","1♯ (F#)"],
  ["D","2♯ (F# C#)"],
  ["A","3♯ (F# C# G#)"],
  ["E","4♯ (F# C# G# D#)"],
  ["B","5♯ (F# C# G# D# A#)"],
  ["F#","6♯"],
  ["F","1♭ (Bb)"],
  ["Bb","2♭ (Bb Eb)"],
  ["Eb","3♭ (Bb Eb Ab)"],
  ["Ab","4♭ (Bb Eb Ab Db)"],
  ["Db","5♭ (Bb Eb Ab Db Gb)"],
  ["Gb","6♭"],
];

const TEMPO_MARKS = [
  ["Larghissimo","< 24 BPM","Extremely slow"],
  ["Largo","40–60 BPM","Very slow, broad"],
  ["Adagio","66–76 BPM","Slow, stately"],
  ["Andante","76–108 BPM","Walking pace"],
  ["Moderato","108–120 BPM","Moderate"],
  ["Allegro","120–168 BPM","Fast, lively"],
  ["Vivace","168–176 BPM","Very lively"],
  ["Presto","168–200 BPM","Very fast"],
  ["Prestissimo","> 200 BPM","Extremely fast"],
];

const DYNAMICS = [
  ["ppp","Pianississimo","Extremely soft"],
  ["pp","Pianissimo","Very soft"],
  ["p","Piano","Soft"],
  ["mp","Mezzo-piano","Medium soft"],
  ["mf","Mezzo-forte","Medium loud"],
  ["f","Forte","Loud"],
  ["ff","Fortissimo","Very loud"],
  ["fff","Fortississimo","Extremely loud"],
  ["sf / sfz","Sforzando","Sudden strong accent"],
  ["cresc.","Crescendo","Gradually louder"],
  ["decresc.","Decrescendo","Gradually softer"],
];

// ── Main page ─────────────────────────────────────────────────────────────────

type MainTab = "chords" | "practice" | "theory" | "rcm";
type InstrumentTab = "piano" | "guitar" | "ukulele" | "bass";

export default function ReferencePage() {
  const [mainTab, setMainTab] = useState<MainTab>("chords");
  const [instrument, setInstrument] = useState<InstrumentTab>("guitar");

  // Piano state
  const [root, setRoot] = useState(0);
  const [chordType, setChordType] = useState("maj");

  // Guitar/Uke state
  const [gQuality, setGQuality] = useState("major");
  const [uQuality, setUQuality] = useState("major");
  const [search, setSearch] = useState("");

  const pianoChord = PIANO_CHORD_TYPES.find(c => c.id === chordType) ?? PIANO_CHORD_TYPES[0];
  const highlightedNotes = pianoChord.intervals.map(i => (root + i) % 12);

  const tabBtn = (id: MainTab, label: string) => (
    <button key={id} onClick={() => setMainTab(id)} style={{
      padding:"0.5rem 1.125rem", borderRadius:6, border:"none",
      background: mainTab === id ? "var(--charcoal)" : "transparent",
      color: mainTab === id ? "var(--white)" : "var(--muted)",
      fontFamily:"Inter,sans-serif", fontSize:"0.875rem", fontWeight: mainTab === id ? 600 : 400,
      cursor:"pointer",
    }}>{label}</button>
  );

  const instBtn = (id: InstrumentTab, label: string) => (
    <button key={id} onClick={() => { setInstrument(id); setSearch(""); }} style={{
      padding:"0.375rem 0.875rem", borderRadius:4, border:"1px solid var(--border-strong)",
      background: instrument === id ? "var(--charcoal)" : "transparent",
      color: instrument === id ? "var(--white)" : "var(--muted)",
      fontFamily:"Inter,sans-serif", fontSize:"0.8125rem", fontWeight: instrument === id ? 500 : 400,
      cursor:"pointer",
    }}>{label}</button>
  );

  const qualityBtns = (qualities: string[], labels: Record<string,string>, active: string, setActive: (q:string)=>void) => (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.375rem", marginBottom:"1.25rem" }}>
      {qualities.map(q => (
        <button key={q} onClick={() => setActive(q)} style={{
          padding:"0.375rem 0.75rem", borderRadius:4, border:"1px solid var(--border-strong)",
          background: active === q ? "#B85C3A" : "transparent",
          color: active === q ? "#fff" : "var(--charcoal)",
          fontFamily:"Inter,sans-serif", fontSize:"0.8125rem", cursor:"pointer",
        }}>{labels[q]}</button>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth:860, margin:"0 auto", padding:"2rem 1.25rem 4rem", fontFamily:"Inter,sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom:"1.75rem" }}>
        <h1 style={{ fontFamily:"Cormorant Garamond,serif", fontWeight:600, fontSize:"1.75rem", color:"var(--charcoal)", margin:0 }}>Reference</h1>
        <p style={{ fontSize:"0.8125rem", color:"var(--muted)", margin:"0.25rem 0 0" }}>Chords · Practice guides · Music theory · RCM Technique</p>
      </div>

      {/* Main tabs */}
      <div style={{ display:"flex", gap:"0.25rem", background:"var(--cream)", borderRadius:8, padding:"0.25rem", marginBottom:"1.75rem", overflowX:"auto", width:"fit-content", maxWidth:"100%" }}>
        {tabBtn("chords","Chords")}
        {tabBtn("practice","Practice")}
        {tabBtn("theory","Theory")}
        {tabBtn("rcm","RCM Technique")}
      </div>

      {/* ── CHORDS TAB ── */}
      {mainTab === "chords" && (
        <div>
          {/* Instrument picker */}
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"1.5rem" }}>
            {instBtn("guitar","🎸 Guitar")}
            {instBtn("ukulele","🪕 Ukulele")}
            {instBtn("bass","🎸 Bass")}
            {instBtn("piano","🎹 Piano")}
          </div>

          {/* Guitar */}
          {instrument === "guitar" && (
            <div>
              {qualityBtns(Object.keys(GUITAR_CHORDS), GUITAR_QUALITY_LABELS, gQuality, setGQuality)}
              <div style={{ marginBottom:"1rem" }}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chords…"
                  style={{ padding:"0.5rem 0.75rem", border:"1px solid var(--border-strong)", borderRadius:6, fontFamily:"Inter,sans-serif", fontSize:"0.875rem", color:"var(--charcoal)", background:"var(--cream)", width:"100%", maxWidth:280, boxSizing:"border-box" }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))", gap:"0.875rem" }}>
                {(search
                  ? Object.values(GUITAR_CHORDS).flat().filter(c=>c.name.toLowerCase().includes(search.toLowerCase()))
                  : GUITAR_CHORDS[gQuality]
                ).map(chord => (
                  <div key={chord.name} style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:8, padding:"0.75rem 0.375rem", display:"flex", justifyContent:"center" }}>
                    <ChordDiagram chord={chord} strings={6} openFreqs={GUITAR_OPEN_FREQS}
                      onPlay={() => playSound(chordFreqs(chord.frets, GUITAR_OPEN_FREQS), "pluck")} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ukulele */}
          {instrument === "ukulele" && (
            <div>
              {qualityBtns(Object.keys(UKULELE_CHORDS), UKE_QUALITY_LABELS, uQuality, setUQuality)}
              <div style={{ marginBottom:"1rem" }}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chords…"
                  style={{ padding:"0.5rem 0.75rem", border:"1px solid var(--border-strong)", borderRadius:6, fontFamily:"Inter,sans-serif", fontSize:"0.875rem", color:"var(--charcoal)", background:"var(--cream)", width:"100%", maxWidth:280, boxSizing:"border-box" }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))", gap:"0.875rem" }}>
                {(search
                  ? Object.values(UKULELE_CHORDS).flat().filter(c=>c.name.toLowerCase().includes(search.toLowerCase()))
                  : UKULELE_CHORDS[uQuality]
                ).map(chord => (
                  <div key={chord.name} style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:8, padding:"0.75rem 0.375rem", display:"flex", justifyContent:"center" }}>
                    <ChordDiagram chord={chord} strings={4} openFreqs={UKE_OPEN_FREQS}
                      onPlay={() => playSound(chordFreqs(chord.frets, UKE_OPEN_FREQS), "pluck")} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bass */}
          {instrument === "bass" && (
            <div>
              <p style={{ fontSize:"0.8125rem", color:"var(--muted)", marginBottom:"1.25rem" }}>Power chords (root + 5th) — the foundation of bass playing in most genres.</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))", gap:"0.875rem" }}>
                {BASS_CHORDS.map(chord => (
                  <div key={chord.name} style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:8, padding:"0.75rem 0.375rem", display:"flex", justifyContent:"center" }}>
                    <ChordDiagram chord={chord} strings={4} openFreqs={BASS_OPEN_FREQS}
                      onPlay={() => playSound(chordFreqs(chord.frets, BASS_OPEN_FREQS), "pluck")} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Piano */}
          {instrument === "piano" && (
            <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:8, padding:"1.5rem" }}>
              {/* Root picker */}
              <div style={{ marginBottom:"1rem" }}>
                <p style={{ fontSize:"0.6875rem", fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 0.625rem" }}>Root note</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"0.375rem" }}>
                  {NOTE_NAMES.map((note, idx) => (
                    <button key={idx} onClick={() => setRoot(idx)} style={{
                      padding:"0.375rem 0.625rem", borderRadius:4, border:"1px solid var(--border-strong)",
                      background: root === idx ? "var(--charcoal)" : "transparent",
                      color: root === idx ? "var(--white)" : "var(--charcoal)",
                      fontFamily:"Inter,sans-serif", fontSize:"0.8125rem", fontWeight:500, cursor:"pointer", minWidth:40,
                    }}>
                      {note}
                      {ENHARMONIC[note] && <span style={{ fontSize:"0.5625rem", display:"block", color: root===idx ? "rgba(255,255,255,0.6)" : "var(--muted)" }}>{ENHARMONIC[note]}</span>}
                    </button>
                  ))}
                </div>
              </div>
              {/* Chord type */}
              <div style={{ marginBottom:"1.5rem" }}>
                <p style={{ fontSize:"0.6875rem", fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 0.625rem" }}>Chord type</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"0.375rem" }}>
                  {PIANO_CHORD_TYPES.map(ct => (
                    <button key={ct.id} onClick={() => setChordType(ct.id)} style={{
                      padding:"0.375rem 0.75rem", borderRadius:4, border:"1px solid var(--border-strong)",
                      background: chordType === ct.id ? "#B85C3A" : "transparent",
                      color: chordType === ct.id ? "#fff" : "var(--charcoal)",
                      fontFamily:"Inter,sans-serif", fontSize:"0.8125rem", cursor:"pointer",
                    }}>{ct.label}</button>
                  ))}
                </div>
              </div>
              {/* Chord name + play */}
              <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.25rem" }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:"1.125rem", color:"var(--charcoal)" }}>
                    {NOTE_NAMES[root]}{chordType === "maj" ? "" : ` ${pianoChord.label}`}
                  </div>
                  <div style={{ fontSize:"0.75rem", color:"var(--muted)", marginTop:2 }}>
                    {highlightedNotes.map(n => NOTE_NAMES[n]).join(" – ")}
                  </div>
                </div>
                <button onClick={() => playSound(pianoChordFreqs(root, pianoChord.intervals), "piano")} style={{
                  padding:"0.5rem 1rem", borderRadius:6, border:"1px solid var(--border-strong)",
                  background:"var(--charcoal)", color:"var(--white)", fontFamily:"Inter,sans-serif",
                  fontSize:"0.875rem", cursor:"pointer",
                }}>▶ Play</button>
              </div>
              <PianoKeyboard highlightedNotes={highlightedNotes} />
            </div>
          )}
        </div>
      )}

      {/* ── PRACTICE TAB ── */}
      {mainTab === "practice" && (
        <div style={{ display:"grid", gap:"1rem" }}>
          {PRACTICE_GUIDES.map(g => (
            <div key={g.title} style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, padding:"1.25rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem" }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${g.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.25rem", flexShrink:0 }}>{g.icon}</div>
                <div style={{ fontWeight:600, fontSize:"0.9375rem", color:"var(--charcoal)" }}>{g.title}</div>
              </div>
              <p style={{ fontSize:"0.875rem", color:"var(--muted)", margin:0, lineHeight:1.7 }}>{g.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── THEORY TAB ── */}
      {mainTab === "theory" && (
        <div style={{ display:"grid", gap:"1.25rem" }}>

          {/* Intervals */}
          <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
            <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid var(--border)", fontWeight:600, fontSize:"0.875rem", color:"var(--charcoal)" }}>Intervals</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8125rem" }}>
                <thead><tr style={{ background:"var(--cream)" }}>
                  {["Semitones","Name","Symbol","Distance"].map(h=>(
                    <th key={h} style={{ padding:"0.5rem 1rem", textAlign:"left", fontWeight:500, color:"var(--muted)", fontSize:"0.75rem", letterSpacing:"0.04em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {INTERVALS.map(([st,name,sym,dist],i) => (
                    <tr key={i} style={{ borderTop:"1px solid var(--border)" }}>
                      <td style={{ padding:"0.5rem 1rem", color:"var(--muted)", fontVariantNumeric:"tabular-nums" }}>{st}</td>
                      <td style={{ padding:"0.5rem 1rem", color:"var(--charcoal)", fontWeight:500 }}>{name}</td>
                      <td style={{ padding:"0.5rem 1rem", color:"var(--muted)", fontFamily:"Georgia,serif" }}>{sym}</td>
                      <td style={{ padding:"0.5rem 1rem", color:"var(--muted)" }}>{dist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key signatures + Tempo side by side */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>
            <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid var(--border)", fontWeight:600, fontSize:"0.875rem", color:"var(--charcoal)" }}>Key signatures</div>
              {KEY_SIGS.map(([key,sig],i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"0.5rem 1.25rem", borderTop: i>0 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontWeight:600, fontSize:"0.875rem", color:"var(--charcoal)", minWidth:32 }}>{key}</span>
                  <span style={{ fontSize:"0.75rem", color:"var(--muted)", textAlign:"right" }}>{sig}</span>
                </div>
              ))}
            </div>
            <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid var(--border)", fontWeight:600, fontSize:"0.875rem", color:"var(--charcoal)" }}>Tempo markings</div>
              {TEMPO_MARKS.map(([term,bpm,desc],i) => (
                <div key={i} style={{ padding:"0.5rem 1.25rem", borderTop: i>0 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontWeight:600, fontSize:"0.8125rem", color:"var(--charcoal)", fontStyle:"italic" }}>{term}</span>
                    <span style={{ fontSize:"0.75rem", color:"#B85C3A", fontWeight:500 }}>{bpm}</span>
                  </div>
                  <div style={{ fontSize:"0.6875rem", color:"var(--muted)", marginTop:2 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamics */}
          <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
            <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid var(--border)", fontWeight:600, fontSize:"0.875rem", color:"var(--charcoal)" }}>Dynamics</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))" }}>
              {DYNAMICS.map(([sym,name,desc],i) => (
                <div key={i} style={{ padding:"0.75rem 1.25rem", borderTop:"1px solid var(--border)" }}>
                  <span style={{ fontWeight:700, fontSize:"1rem", color:"var(--charcoal)", fontStyle:"italic", marginRight:"0.5rem" }}>{sym}</span>
                  <span style={{ fontSize:"0.75rem", color:"var(--muted)" }}>{name} — {desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scales */}
          <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, padding:"1.25rem" }}>
            <div style={{ fontWeight:600, fontSize:"0.875rem", color:"var(--charcoal)", marginBottom:"1rem" }}>Scale formulas (semitone steps)</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"0.75rem" }}>
              {[
                ["Major (Ionian)","W W H W W W H","2 2 1 2 2 2 1"],
                ["Natural Minor (Aeolian)","W H W W H W W","2 1 2 2 1 2 2"],
                ["Harmonic Minor","W H W W H A2 H","2 1 2 2 1 3 1"],
                ["Melodic Minor (asc.)","W H W W W W H","2 1 2 2 2 2 1"],
                ["Dorian","W H W W W H W","2 1 2 2 2 1 2"],
                ["Phrygian","H W W W H W W","1 2 2 2 1 2 2"],
                ["Lydian","W W W H W W H","2 2 2 1 2 2 1"],
                ["Mixolydian","W W H W W H W","2 2 1 2 2 1 2"],
                ["Pentatonic Major","W W 1½ W 1½","2 2 3 2 3"],
                ["Pentatonic Minor","1½ W W 1½ W","3 2 2 3 2"],
                ["Blues","1½ W H H 1½ W","3 2 1 1 3 2"],
                ["Chromatic","H H H H H H…","1 1 1 1 1 1…"],
              ].map(([name,_,steps]) => (
                <div key={name} style={{ background:"var(--cream)", borderRadius:6, padding:"0.75rem" }}>
                  <div style={{ fontWeight:600, fontSize:"0.8125rem", color:"var(--charcoal)", marginBottom:4 }}>{name}</div>
                  <div style={{ fontFamily:"monospace", fontSize:"0.75rem", color:"var(--muted)", letterSpacing:"0.05em" }}>{steps}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── RCM TECHNIQUE TAB ── */}
      {mainTab === "rcm" && <RcmTechnique />}
    </div>
  );
}
