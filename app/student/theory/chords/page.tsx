"use client";
import React, { useState } from "react";
import { useI18n } from "@/lib/context/I18nContext";

// ── Note data ──────────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ENHARMONIC: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb",
};

const CHORD_TYPES: { id: string; label: string; intervals: number[] }[] = [
  { id: "maj",   label: "Major",       intervals: [0, 4, 7] },
  { id: "min",   label: "Minor",       intervals: [0, 3, 7] },
  { id: "7",     label: "Dom 7",       intervals: [0, 4, 7, 10] },
  { id: "maj7",  label: "Major 7",     intervals: [0, 4, 7, 11] },
  { id: "m7",    label: "Minor 7",     intervals: [0, 3, 7, 10] },
  { id: "dim",   label: "Dim",         intervals: [0, 3, 6] },
  { id: "aug",   label: "Aug",         intervals: [0, 4, 8] },
  { id: "sus2",  label: "Sus 2",       intervals: [0, 2, 7] },
  { id: "sus4",  label: "Sus 4",       intervals: [0, 5, 7] },
  { id: "9",     label: "Dom 9",       intervals: [0, 4, 7, 10, 14] },
  { id: "m9",    label: "Minor 9",     intervals: [0, 3, 7, 10, 14] },
  { id: "add9",  label: "Add 9",       intervals: [0, 4, 7, 14] },
];

// ── Guitar chord database ──────────────────────────────────────────────────────
// frets[]: 6 values (low E → high e), -1=muted, 0=open, 1-N=fret number
// baseFret: which fret the diagram starts at (default 1)

interface GChord { name: string; frets: number[]; baseFret?: number; fingers?: number[]; }

const GUITAR_CHORDS: GChord[] = [
  // ── Major ──
  { name: "C",  frets: [-1, 3, 2, 0, 1, 0] },
  { name: "D",  frets: [-1, -1, 0, 2, 3, 2] },
  { name: "E",  frets: [0, 2, 2, 1, 0, 0] },
  { name: "F",  frets: [1, 1, 2, 3, 3, 1] },
  { name: "G",  frets: [3, 2, 0, 0, 0, 3] },
  { name: "A",  frets: [-1, 0, 2, 2, 2, 0] },
  { name: "B",  frets: [-1, 2, 4, 4, 4, 2], baseFret: 2 },
  // ── Minor ──
  { name: "Am", frets: [-1, 0, 2, 2, 1, 0] },
  { name: "Bm", frets: [-1, 2, 4, 4, 3, 2], baseFret: 2 },
  { name: "Cm", frets: [-1, 3, 5, 5, 4, 3], baseFret: 3 },
  { name: "Dm", frets: [-1, -1, 0, 2, 3, 1] },
  { name: "Em", frets: [0, 2, 2, 0, 0, 0] },
  { name: "Fm", frets: [1, 3, 3, 1, 1, 1] },
  { name: "Gm", frets: [3, 5, 5, 3, 3, 3], baseFret: 3 },
  // ── 7th ──
  { name: "A7", frets: [-1, 0, 2, 0, 2, 0] },
  { name: "B7", frets: [-1, 2, 1, 2, 0, 2] },
  { name: "C7", frets: [-1, 3, 2, 3, 1, 0] },
  { name: "D7", frets: [-1, -1, 0, 2, 1, 2] },
  { name: "E7", frets: [0, 2, 0, 1, 0, 0] },
  { name: "G7", frets: [3, 2, 0, 0, 0, 1] },
  // ── Minor 7th ──
  { name: "Am7", frets: [-1, 0, 2, 0, 1, 0] },
  { name: "Em7", frets: [0, 2, 0, 0, 0, 0] },
  { name: "Dm7", frets: [-1, -1, 0, 2, 1, 1] },
];

// Ukulele chord database (strings: G C E A, low to high)
const UKULELE_CHORDS: GChord[] = [
  { name: "C",  frets: [0, 0, 0, 3] },
  { name: "D",  frets: [2, 2, 2, 0] },
  { name: "E",  frets: [4, 4, 4, 2], baseFret: 2 },
  { name: "F",  frets: [2, 0, 1, 0] },
  { name: "G",  frets: [0, 2, 3, 2] },
  { name: "A",  frets: [2, 1, 0, 0] },
  { name: "Am", frets: [2, 0, 0, 0] },
  { name: "Dm", frets: [2, 2, 1, 0] },
  { name: "Em", frets: [0, 4, 3, 2] },
  { name: "Bm", frets: [4, 2, 2, 2], baseFret: 2 },
  { name: "A7", frets: [0, 1, 0, 0] },
  { name: "C7", frets: [0, 0, 0, 1] },
  { name: "D7", frets: [2, 2, 2, 3] },
  { name: "E7", frets: [1, 2, 0, 2] },
  { name: "G7", frets: [0, 2, 1, 2] },
  { name: "Am7", frets: [0, 0, 0, 0] },
  { name: "Em7", frets: [0, 2, 0, 2] },
];

// ── Piano keyboard component ───────────────────────────────────────────────────

// Layout for 2 octaves starting at C (indices 0–23 relative to C3)
// White key positions: C D E F G A B C D E F G A B (14 total)
// Each white key = 1 unit wide; black keys overlap at half-widths

const WHITE_ORDER  = [0, 2, 4, 5, 7, 9, 11]; // semitones from C for white keys
const BLACK_OFFSET = [0.75, 1.75, 3.75, 4.75, 5.75]; // left offset in white-key units
const BLACK_NOTE   = [1, 3, 6, 8, 10]; // semitones with black keys (C#/Db etc)

function PianoKeyboard({ highlightedNotes }: { highlightedNotes: number[] }) {
  const highlighted = new Set(highlightedNotes.map(n => n % 12));
  const W = 34; const H = 120; const BW = 22; const BH = 72;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <svg width={14 * W + 1} height={H + 2} style={{ display: "block" }}>
        {/* White keys */}
        {Array.from({ length: 14 }, (_, i) => {
          const octave = Math.floor(i / 7);
          const noteInOctave = WHITE_ORDER[i % 7];
          const semitone = (noteInOctave) % 12;
          const isHighlighted = highlighted.has(semitone);
          return (
            <g key={i}>
              <rect
                x={i * W + 1} y={1} width={W - 1} height={H}
                fill={isHighlighted ? "#B85C3A" : "#FDFCFA"}
                stroke="#CCC" strokeWidth={1} rx={2}
              />
              {isHighlighted && (
                <text x={i * W + W / 2} y={H - 10} textAnchor="middle" fontSize={10} fill="#FFF" fontFamily="Inter, sans-serif" fontWeight={600}>
                  {NOTE_NAMES[semitone]}
                </text>
              )}
            </g>
          );
        })}
        {/* Black keys */}
        {Array.from({ length: 2 }, (_, octave) =>
          BLACK_OFFSET.map((offset, bIdx) => {
            const semitone = BLACK_NOTE[bIdx];
            const isHighlighted = highlighted.has(semitone);
            const x = (octave * 7 + offset) * W;
            return (
              <g key={octave * 5 + bIdx}>
                <rect
                  x={x} y={1} width={BW} height={BH}
                  fill={isHighlighted ? "#B85C3A" : "#1A1714"}
                  stroke="#111" strokeWidth={1} rx={2}
                />
                {isHighlighted && (
                  <text x={x + BW / 2} y={BH - 8} textAnchor="middle" fontSize={9} fill="#FFF" fontFamily="Inter, sans-serif" fontWeight={600}>
                    {NOTE_NAMES[semitone]}
                  </text>
                )}
              </g>
            );
          })
        ).flat()}
      </svg>
    </div>
  );
}

// ── Guitar/Ukulele diagram component ─────────────────────────────────────────

function ChordDiagram({ chord, strings = 6 }: { chord: GChord; strings?: number }) {
  const FRETS = 5;
  const SW = strings === 4 ? 36 : 30; // string spacing
  const FH = 24; // fret height
  const PAD = 18;
  const W = (strings - 1) * SW + PAD * 2;
  const H = FRETS * FH + PAD * 2 + 16;
  const baseFret = chord.baseFret ?? 1;
  const maxFret = Math.max(...chord.frets.filter(f => f > 0));
  const displayBase = maxFret > FRETS ? baseFret : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--charcoal)", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
        {chord.name}
      </div>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {/* Nut (thick top bar if at fret 1) */}
        {displayBase === 1 && (
          <rect x={PAD} y={PAD} width={(strings - 1) * SW} height={4} fill="var(--charcoal)" rx={1} />
        )}
        {/* Fret lines */}
        {Array.from({ length: FRETS }, (_, f) => (
          <line key={f} x1={PAD} y1={PAD + f * FH} x2={PAD + (strings - 1) * SW} y2={PAD + f * FH}
            stroke="#CCC" strokeWidth={f === 0 && displayBase === 1 ? 0 : 1} />
        ))}
        {/* String lines */}
        {Array.from({ length: strings }, (_, s) => (
          <line key={s} x1={PAD + s * SW} y1={PAD} x2={PAD + s * SW} y2={PAD + FRETS * FH}
            stroke="#999" strokeWidth={1} />
        ))}
        {/* Mute / Open indicators above nut */}
        {chord.frets.map((fret, s) => (
          <text key={s} x={PAD + s * SW} y={PAD - 5} textAnchor="middle"
            fontSize={10} fill={fret === -1 ? "#999" : "#555"} fontFamily="Inter, sans-serif">
            {fret === -1 ? "×" : fret === 0 ? "○" : ""}
          </text>
        ))}
        {/* Finger dots */}
        {chord.frets.map((fret, s) => {
          if (fret <= 0) return null;
          const displayFret = fret - displayBase + 1;
          if (displayFret < 1 || displayFret > FRETS) return null;
          return (
            <circle key={s}
              cx={PAD + s * SW}
              cy={PAD + (displayFret - 0.5) * FH}
              r={9}
              fill="var(--charcoal)"
            />
          );
        })}
        {/* Base fret label */}
        {displayBase > 1 && (
          <text x={W - 4} y={PAD + FH * 0.5 + 4} fontSize={9} fill="var(--muted)" fontFamily="Inter, sans-serif">
            {displayBase}fr
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "piano" | "guitar" | "ukulele";

export default function ChordsPage() {
  const { t: tr } = useI18n();
  const [tab, setTab] = useState<Tab>("piano");
  const [root, setRoot] = useState(0); // index into NOTE_NAMES
  const [chordType, setChordType] = useState("maj");
  const [search, setSearch] = useState("");

  const selectedChord = CHORD_TYPES.find(c => c.id === chordType) ?? CHORD_TYPES[0];
  const highlightedNotes = selectedChord.intervals.map(i => (root + i) % 12);
  const chordName = NOTE_NAMES[root] + (chordType === "maj" ? "" : ` ${selectedChord.label}`);
  const noteNames = highlightedNotes.map(n => NOTE_NAMES[n]).join(" – ");

  const guitarFiltered = GUITAR_CHORDS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const ukuFiltered = UKULELE_CHORDS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: 0 }}>
          Chord Reference
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
          Piano keyboard · guitar & ukulele diagrams
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.5rem" }}>
        {(["piano", "guitar", "ukulele"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "0.5rem 1rem", borderRadius: 4, border: "1px solid var(--border-strong)",
            background: tab === t ? "var(--charcoal)" : "transparent",
            color: tab === t ? "var(--white)" : "var(--muted)",
            fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: tab === t ? 500 : 400,
            cursor: "pointer",
          }}>
            {t === "piano" ? "🎹 Piano" : t === "guitar" ? "🎸 Guitar" : "🪕 Ukulele"}
          </button>
        ))}
      </div>

      {/* ── Piano tab ── */}
      {tab === "piano" && (
        <div style={{ background: "var(--white)", borderRadius: 8, border: "1px solid var(--border)", padding: "1.5rem" }}>
          {/* Root note picker */}
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.625rem" }}>
              {tr.student.referencePianoRootNote}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {NOTE_NAMES.map((note, idx) => (
                <button key={idx} onClick={() => setRoot(idx)} style={{
                  padding: "0.375rem 0.625rem", borderRadius: 4,
                  border: "1px solid var(--border-strong)",
                  background: root === idx ? "var(--charcoal)" : "transparent",
                  color: root === idx ? "var(--white)" : "var(--charcoal)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
                  cursor: "pointer", minWidth: 40,
                }}>
                  {note}
                  {ENHARMONIC[note] && <span style={{ fontSize: "0.625rem", display: "block", color: root === idx ? "rgba(255,255,255,0.6)" : "var(--muted)" }}>{ENHARMONIC[note]}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Chord type picker */}
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.625rem" }}>
              {tr.student.referencePianoChordType}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {CHORD_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setChordType(ct.id)} style={{
                  padding: "0.375rem 0.75rem", borderRadius: 4,
                  border: "1px solid var(--border-strong)",
                  background: chordType === ct.id ? "var(--charcoal)" : "transparent",
                  color: chordType === ct.id ? "var(--white)" : "var(--charcoal)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                  cursor: "pointer",
                }}>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chord name + notes */}
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.5rem", fontWeight: 600, color: "var(--charcoal)", margin: 0 }}>
              {chordName}
            </p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
              {noteNames}
            </p>
          </div>

          {/* Piano keyboard */}
          <PianoKeyboard highlightedNotes={highlightedNotes} />
        </div>
      )}

      {/* ── Guitar tab ── */}
      {tab === "guitar" && (
        <div>
          <input
            type="text"
            placeholder={tr.student.referenceSearchChords}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", borderRadius: 4, border: "1px solid var(--border-strong)",
              padding: "0.625rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
              background: "var(--white)", color: "var(--charcoal)", outline: "none",
              boxSizing: "border-box", marginBottom: "1.25rem",
            }}
          />
          {guitarFiltered.length === 0 ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>{tr.student.referenceNoChordsFound}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "1rem" }}>
              {guitarFiltered.map(chord => (
                <div key={chord.name} style={{ background: "var(--white)", borderRadius: 8, border: "1px solid var(--border)", padding: "1rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChordDiagram chord={chord} strings={6} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Ukulele tab ── */}
      {tab === "ukulele" && (
        <div>
          <input
            type="text"
            placeholder={tr.student.referenceSearchChords}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", borderRadius: 4, border: "1px solid var(--border-strong)",
              padding: "0.625rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
              background: "var(--white)", color: "var(--charcoal)", outline: "none",
              boxSizing: "border-box", marginBottom: "1.25rem",
            }}
          />
          {ukuFiltered.length === 0 ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>{tr.student.referenceNoChordsFound}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "1rem" }}>
              {ukuFiltered.map(chord => (
                <div key={chord.name} style={{ background: "var(--white)", borderRadius: 8, border: "1px solid var(--border)", padding: "1rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChordDiagram chord={chord} strings={4} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
