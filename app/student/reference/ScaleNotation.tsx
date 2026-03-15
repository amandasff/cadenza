"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { TechItem } from "./rcm-data";

// ── Scale note data ────────────────────────────────────────────────────────────
// Note names (lowercase) used by VexFlow: "f#", "bb", etc.

const MAJOR_NOTES: Record<string, string[]> = {
  C:   ["c", "d", "e", "f", "g", "a", "b"],
  G:   ["g", "a", "b", "c", "d", "e", "f#"],
  D:   ["d", "e", "f#", "g", "a", "b", "c#"],
  A:   ["a", "b", "c#", "d", "e", "f#", "g#"],
  E:   ["e", "f#", "g#", "a", "b", "c#", "d#"],
  B:   ["b", "c#", "d#", "e", "f#", "g#", "a#"],
  "F#": ["f#", "g#", "a#", "b", "c#", "d#", "e#"],
  F:   ["f", "g", "a", "bb", "c", "d", "e"],
  Bb:  ["bb", "c", "d", "eb", "f", "g", "a"],
  Eb:  ["eb", "f", "g", "ab", "bb", "c", "d"],
  Ab:  ["ab", "bb", "c", "db", "eb", "f", "g"],
  Db:  ["db", "eb", "f", "gb", "ab", "bb", "c"],
  Gb:  ["gb", "ab", "bb", "cb", "db", "eb", "f"],
};

const NATURAL_MINOR_NOTES: Record<string, string[]> = {
  A:   ["a", "b", "c", "d", "e", "f", "g"],
  E:   ["e", "f#", "g", "a", "b", "c", "d"],
  B:   ["b", "c#", "d", "e", "f#", "g", "a"],
  "F#": ["f#", "g#", "a", "b", "c#", "d", "e"],
  D:   ["d", "e", "f", "g", "a", "bb", "c"],
  G:   ["g", "a", "bb", "c", "d", "eb", "f"],
  C:   ["c", "d", "eb", "f", "g", "ab", "bb"],
  F:   ["f", "g", "ab", "bb", "c", "db", "eb"],
};

const HARMONIC_MINOR_NOTES: Record<string, string[]> = {
  A:   ["a", "b", "c", "d", "e", "f", "g#"],
  E:   ["e", "f#", "g", "a", "b", "c", "d#"],
  B:   ["b", "c#", "d", "e", "f#", "g", "a#"],
  "F#": ["f#", "g#", "a", "b", "c#", "d", "e#"],
  D:   ["d", "e", "f", "g", "a", "bb", "c#"],
  G:   ["g", "a", "bb", "c", "d", "eb", "f#"],
  C:   ["c", "d", "eb", "f", "g", "ab", "b"],
  F:   ["f", "g", "ab", "bb", "c", "db", "e"],
};

// VexFlow key signature string for each root + mode
const VF_KEY_SIG: Record<string, string> = {
  C: "C", G: "G", D: "D", A: "A", E: "E", B: "B", "F#": "F#", "C#": "C#",
  F: "F", Bb: "Bb", Eb: "Eb", Ab: "Ab", Db: "Db", Gb: "Gb",
  // Natural minor: use relative major's key sig
  Am: "Am", Em: "Em", Bm: "Bm", "F#m": "F#m",
  Dm: "Dm", Gm: "Gm", Cm: "Cm", Fm: "Fm",
};

// ── Note sequence builders ─────────────────────────────────────────────────────

const LETTER_IDX: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

/** Build ascending scale note strings with correct octave numbers */
function buildAscending(diatonic: string[], startOctave: number, numOctaves: number): string[] {
  const result: string[] = [];
  let oct = startOctave;
  let prevIdx = LETTER_IDX[diatonic[0][0]];
  for (let i = 0; i <= numOctaves * 7; i++) {
    const note = diatonic[i % 7];
    const letterIdx = LETTER_IDX[note[0]];
    if (i > 0 && letterIdx <= prevIdx) oct++;
    result.push(`${note}/${oct}`);
    prevIdx = letterIdx;
  }
  return result;
}

/** Arpeggio: root, 3rd, 5th, octave (major or minor) */
function buildArpeggio(diatonic: string[], startOctave: number, numOctaves: number, isMinor: boolean): string[] {
  const degrees = isMinor ? [0, 2, 4] : [0, 2, 4]; // same positions, different intervals
  const allAscending = buildAscending(diatonic, startOctave, numOctaves);
  const result: string[] = [];
  for (let oct = 0; oct < numOctaves; oct++) {
    degrees.forEach(deg => result.push(allAscending[oct * 7 + deg]));
  }
  result.push(allAscending[numOctaves * 7]); // top note
  return result;
}

/** Chromatic scale from root */
function buildChromatic(startMidi: number, numOctaves: number): string[] {
  const CHROMATIC_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const result: string[] = [];
  for (let i = 0; i <= numOctaves * 12; i++) {
    const midi = startMidi + i;
    const name = CHROMATIC_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    result.push(`${name}/${octave}`);
  }
  return result;
}

/** Pentascale: first 5 notes of scale */
function buildPentascale(diatonic: string[], startOctave: number): string[] {
  const first5 = diatonic.slice(0, 5);
  return buildAscending(first5, startOctave, 1).slice(0, 6); // 5 notes + top
}

// ── MIDI conversion for audio ──────────────────────────────────────────────────

const NOTE_SEMITONES: Record<string, number> = {
  c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, "e#": 5, fb: 4,
  f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11, cb: 11,
};

function vfNoteToMidi(vfNote: string): number {
  const [noteWithAcc, octStr] = vfNote.split("/");
  const octave = parseInt(octStr);
  const semitone = NOTE_SEMITONES[noteWithAcc] ?? 0;
  return (octave + 1) * 12 + semitone;
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Key / scale inference ─────────────────────────────────────────────────────

export function inferKeyAndScale(sectionTitle: string, item: TechItem): {
  keyRoot: string;
  scaleType: "major" | "minor" | "harmonicMinor" | "arpeggio" | "chromatic" | "pentascale";
  isMinorArp: boolean;
  vfKeySig: string;
  diatonicNotes: string[];
  isSupported: boolean;
  displayOctaves: number;
} {
  const t = sectionTitle.toLowerCase();
  const l = item.label.toLowerCase();

  // Unsupported: cadences, contrary motion, blocked chords
  if (t.includes("cadence") || l.includes("cadence")) {
    return { keyRoot: "C", scaleType: "major", isMinorArp: false, vfKeySig: "C", diatonicNotes: MAJOR_NOTES.C, isSupported: false, displayOctaves: 1 };
  }
  if (l.includes("contrary") || t.includes("contrary")) {
    return { keyRoot: "C", scaleType: "major", isMinorArp: false, vfKeySig: "C", diatonicNotes: MAJOR_NOTES.C, isSupported: false, displayOctaves: 1 };
  }

  // Parse key from keys field: "C, G, D, A, E major" → "C"
  const keysStr = item.keys ?? "";
  const isAllKeys = keysStr.toLowerCase().includes("all");
  let keyRoot = "C";
  if (!isAllKeys) {
    const m = keysStr.match(/([A-G][b#]?)(?:\s*m(?:in(?:or)?)?)?/);
    if (m) keyRoot = m[1];
  }

  // Determine if minor
  const isMinor = l.includes("minor") || l.includes(" min") || t.includes("minor");
  const isHarmonicMinor = l.includes("harmonic");

  // Scale type
  let scaleType: "major" | "minor" | "harmonicMinor" | "arpeggio" | "chromatic" | "pentascale" = "major";
  let isMinorArp = false;

  if (t.includes("chromatic") || l.includes("chromatic")) {
    scaleType = "chromatic";
  } else if (t.includes("arpeg") || l.includes("arpeg")) {
    scaleType = "arpeggio";
    isMinorArp = isMinor;
  } else if (t.includes("penta") || t.includes("5-finger")) {
    scaleType = "pentascale";
  } else if (isHarmonicMinor) {
    scaleType = "harmonicMinor";
  } else if (isMinor) {
    scaleType = "minor";
  }

  // Get diatonic notes for this key
  let diatonicNotes: string[];
  let vfKeySig: string;

  if (scaleType === "major" || scaleType === "arpeggio" && !isMinorArp || scaleType === "pentascale") {
    diatonicNotes = MAJOR_NOTES[keyRoot] ?? MAJOR_NOTES.C;
    vfKeySig = VF_KEY_SIG[keyRoot] ?? "C";
  } else if (scaleType === "minor") {
    diatonicNotes = NATURAL_MINOR_NOTES[keyRoot] ?? NATURAL_MINOR_NOTES.A;
    vfKeySig = `${keyRoot}m`;
  } else if (scaleType === "harmonicMinor") {
    diatonicNotes = HARMONIC_MINOR_NOTES[keyRoot] ?? HARMONIC_MINOR_NOTES.A;
    vfKeySig = `${keyRoot}m`;
  } else if (isMinorArp) {
    diatonicNotes = NATURAL_MINOR_NOTES[keyRoot] ?? NATURAL_MINOR_NOTES.A;
    vfKeySig = `${keyRoot}m`;
  } else {
    diatonicNotes = MAJOR_NOTES[keyRoot] ?? MAJOR_NOTES.C;
    vfKeySig = VF_KEY_SIG[keyRoot] ?? "C";
  }

  // Cap display at 2 octaves for visual clarity (audio plays full)
  const displayOctaves = Math.min(item.octaves, 2);

  return { keyRoot, scaleType, isMinorArp, vfKeySig, diatonicNotes, isSupported: true, displayOctaves };
}

// ── Starting octave for treble clef display ───────────────────────────────────
// Choose octave so 2-octave scale fits comfortably in treble+bass range
const TREBLE_START_OCTAVE: Record<string, number> = {
  c: 4, d: 4, e: 4, f: 4, g: 4, a: 3, b: 3,
};
function getStartOctave(noteRoot: string): number {
  return TREBLE_START_OCTAVE[noteRoot[0]] ?? 4;
}

// ── Main ScaleNotation component ──────────────────────────────────────────────

interface Props {
  sectionTitle: string;
  item: TechItem;
}

export default function ScaleNotation({ sectionTitle, item }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentNote, setCurrentNote] = useState(-1);
  const [bpm, setBpm] = useState(item.bpm);
  const [vfError, setVfError] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);
  const noteXRef = useRef<number[]>([]);
  const noteYRef = useRef<number>(0);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; stopPlayback(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const info = useMemo(() => inferKeyAndScale(sectionTitle, item), [sectionTitle, item]);

  // Build note sequences
  const displayNotes = useMemo((): string[] => {
    if (!info.isSupported) return [];
    const { scaleType, diatonicNotes, isMinorArp, keyRoot, displayOctaves } = info;
    const startOct = getStartOctave(diatonicNotes[0]);

    if (scaleType === "chromatic") {
      const rootMidi = (4 + 1) * 12 + (NOTE_SEMITONES[keyRoot.toLowerCase()] ?? 0);
      const asc = buildChromatic(rootMidi, displayOctaves);
      return [...asc, ...asc.slice().reverse().slice(1)];
    }
    if (scaleType === "arpeggio") {
      const asc = buildArpeggio(diatonicNotes, startOct, displayOctaves, isMinorArp);
      return [...asc, ...asc.slice().reverse().slice(1)];
    }
    if (scaleType === "pentascale") {
      const asc = buildPentascale(diatonicNotes, startOct);
      return [...asc, ...asc.slice().reverse().slice(1)];
    }
    const asc = buildAscending(diatonicNotes, startOct, displayOctaves);
    return [...asc, ...asc.slice().reverse().slice(1)];
  }, [info]);

  // Full audio notes (item.octaves, not capped)
  const audioNotes = useMemo((): string[] => {
    if (!info.isSupported) return [];
    const { scaleType, diatonicNotes, isMinorArp, keyRoot } = info;
    const numOct = item.octaves;
    const startOct = getStartOctave(diatonicNotes[0]);

    if (scaleType === "chromatic") {
      const rootMidi = (4 + 1) * 12 + (NOTE_SEMITONES[keyRoot.toLowerCase()] ?? 0);
      const asc = buildChromatic(rootMidi, numOct);
      return [...asc, ...asc.slice().reverse().slice(1)];
    }
    if (scaleType === "arpeggio") {
      const asc = buildArpeggio(diatonicNotes, startOct, numOct, isMinorArp);
      return [...asc, ...asc.slice().reverse().slice(1)];
    }
    if (scaleType === "pentascale") {
      const asc = buildPentascale(diatonicNotes, startOct);
      return [...asc, ...asc.slice().reverse().slice(1)];
    }
    const asc = buildAscending(diatonicNotes, startOct, numOct);
    return [...asc, ...asc.slice().reverse().slice(1)];
  }, [info, item.octaves]);

  // ── VexFlow rendering ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !info.isSupported || displayNotes.length === 0) return;
    const div = containerRef.current;
    div.innerHTML = "";
    setVfError(false);

    import("vexflow").then((VF) => {
      if (!mountedRef.current || !div) return;
      try {
        const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Accidental, StaveConnector } = VF;

        // ── Layout constants ──
        // Each note gets ~38px; enough horizontal room for ledger-line accidentals
        const NOTE_W = 38;
        const STAVE_WIDTH = Math.max(500, displayNotes.length * NOTE_W + 120);
        // Extra vertical space above staff to avoid clipping high ledger lines
        const TOP_STAVE_Y = 60;
        const STAVE_GAP = 105;
        const showGrandStaff = item.hands === "HT";
        // Extra space below: bass staff needs room for low ledger lines
        const BOTTOM_PAD = showGrandStaff ? 70 : 55;
        const totalH = showGrandStaff
          ? TOP_STAVE_Y + STAVE_GAP + BOTTOM_PAD
          : TOP_STAVE_Y + BOTTOM_PAD;

        const renderer = new Renderer(div, Renderer.Backends.SVG);
        renderer.resize(STAVE_WIDTH + 24, totalH);
        const ctx = renderer.getContext();
        ctx.setFont("Arial", 10);

        // ── Treble stave ──
        const trebleStave = new Stave(12, TOP_STAVE_Y, STAVE_WIDTH);
        trebleStave.addClef("treble").addKeySignature(info.vfKeySig);
        trebleStave.setContext(ctx).draw();

        // ── Bass stave (HT only) ──
        let bassStave: InstanceType<typeof Stave> | null = null;
        if (showGrandStaff) {
          bassStave = new Stave(12, TOP_STAVE_Y + STAVE_GAP, STAVE_WIDTH);
          bassStave.addClef("bass").addKeySignature(info.vfKeySig);
          bassStave.setContext(ctx).draw();

          const connector = new StaveConnector(trebleStave, bassStave);
          connector.setType(StaveConnector.type.BRACE);
          connector.setContext(ctx).draw();
          const lineConn = new StaveConnector(trebleStave, bassStave);
          lineConn.setType(StaveConnector.type.SINGLE_LEFT);
          lineConn.setContext(ctx).draw();
        }

        // ── Build treble notes (all 8th notes — standard scale notation) ──
        const rhNotes = displayNotes.map((vfNote) =>
          new StaveNote({ keys: [vfNote], duration: "8" })
        );

        const rhVoice = new Voice({ numBeats: displayNotes.length, beatValue: 8 });
        rhVoice.setStrict(false);
        rhVoice.addTickables(rhNotes);
        try { Accidental.applyAccidentals([rhVoice], info.vfKeySig); } catch { /* ignore */ }

        // ── Format + draw ──
        const formatter = new Formatter();
        if (showGrandStaff && bassStave) {
          const lhNotes = displayNotes.map((vfNote) => {
            const [note, octStr] = vfNote.split("/");
            const lhNote = `${note}/${parseInt(octStr) - 2}`;
            return new StaveNote({ keys: [lhNote], duration: "8", clef: "bass" });
          });

          const lhVoice = new Voice({ numBeats: displayNotes.length, beatValue: 8 });
          lhVoice.setStrict(false);
          lhVoice.addTickables(lhNotes);
          try { Accidental.applyAccidentals([lhVoice], info.vfKeySig); } catch { /* ignore */ }

          formatter.joinVoices([rhVoice, lhVoice]).format([rhVoice, lhVoice], STAVE_WIDTH - 70);
          lhVoice.draw(ctx, bassStave);

          const lhBeams = Beam.generateBeams(lhNotes);
          lhBeams.forEach(b => b.setContext(ctx).draw());
        } else {
          formatter.joinVoices([rhVoice]).format([rhVoice], STAVE_WIDTH - 70);
        }

        rhVoice.draw(ctx, trebleStave);

        // Beam 8th notes in natural groups
        const rhBeams = Beam.generateBeams(rhNotes);
        rhBeams.forEach(b => b.setContext(ctx).draw());

        // Store note X positions for playback highlight
        noteXRef.current = rhNotes.map(n => {
          try { return n.getAbsoluteX(); } catch { return 0; }
        });
        noteYRef.current = TOP_STAVE_Y + 40; // mid-staff y for highlight indicator

      } catch (err) {
        console.error("VexFlow render error:", err);
        if (mountedRef.current) setVfError(true);
      }
    }).catch(() => { if (mountedRef.current) setVfError(true); });
  }, [info, displayNotes, item.hands]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Highlight current note during playback ─────────────────────────────────
  // We overlay a thin colored marker line at the current note's x position
  const markerX = currentNote >= 0 && noteXRef.current[currentNote]
    ? noteXRef.current[currentNote]
    : null;

  // ── Audio playback ──────────────────────────────────────────────────────────
  function stopPlayback() {
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
    if (mountedRef.current) { setPlaying(false); setCurrentNote(-1); }
  }

  const handlePlay = useCallback(() => {
    if (playing) { stopPlayback(); return; }
    if (audioNotes.length === 0) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const beatSec = 60 / bpm;
    const noteDur = item.beatUnit.includes("♪") ? beatSec * 0.5 : beatSec;

    audioNotes.forEach((vfNote, i) => {
      const midi = vfNoteToMidi(vfNote);
      const hz = midiToHz(midi);
      const when = ctx.currentTime + i * noteDur;

      [[1, 0.4], [2, 0.16], [3, 0.08], [4, 0.04]].forEach(([h, a]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = hz * (h as number);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime((a as number) / (h as number), when + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, when + noteDur * 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(when);
        osc.stop(when + noteDur + 0.05);
      });

      // Highlight display note (map audio note idx to display note idx)
      const displayIdx = Math.min(i, displayNotes.length - 1);
      const t = setTimeout(() => {
        if (mountedRef.current) setCurrentNote(displayIdx);
      }, (when - ctx.currentTime) * 1000);
      timeoutsRef.current.push(t);
    });

    setPlaying(true);
    setCurrentNote(0);

    const doneMs = audioNotes.length * noteDur * 1000 + 500;
    const doneT = setTimeout(() => {
      if (mountedRef.current) { setPlaying(false); setCurrentNote(-1); }
      try { ctx.close(); } catch {}
    }, doneMs);
    timeoutsRef.current.push(doneT);
  }, [playing, audioNotes, bpm, item.beatUnit, displayNotes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Not supported yet ───────────────────────────────────────────────────────
  if (!info.isSupported) {
    return (
      <div style={{
        marginTop: "0.875rem", padding: "0.75rem 1rem",
        background: "var(--cream)", borderRadius: 6, border: "1px solid var(--border)",
        fontFamily: "Inter,sans-serif", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.6,
      }}>
        Notation preview not available for this exercise type — see your RCM Technical Requirements book for the exact score.
      </div>
    );
  }

  const { keyRoot, scaleType, displayOctaves } = info;
  const keyLabel = item.keys.toLowerCase().includes("all") ? `C (preview — apply to all keys)` : keyRoot;
  const typeLabel = scaleType === "major" ? "Major" : scaleType === "minor" ? "Natural Minor" :
    scaleType === "harmonicMinor" ? "Harmonic Minor" : scaleType === "arpeggio" ? "Arpeggio" :
    scaleType === "chromatic" ? "Chromatic" : "Pentascale";

  return (
    <div style={{ marginTop: "0.875rem" }}>
      {/* Info row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.625rem" }}>
        <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
          Scale preview
        </span>
        <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 99, padding: "0.1rem 0.5rem" }}>
          {typeLabel} · {keyLabel}
        </span>
        <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 99, padding: "0.1rem 0.5rem" }}>
          {displayOctaves} oct. shown
        </span>
        {item.octaves > displayOctaves && (
          <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.6875rem", color: "var(--muted)", fontStyle: "italic" }}>
            (audio plays {item.octaves} oct.)
          </span>
        )}
      </div>

      {/* Staff container */}
      <div style={{ position: "relative", overflowX: "auto", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 4px 8px" }}>
        {vfError ? (
          <div style={{ padding: "1rem", fontFamily: "Inter,sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
            Could not render notation. Try refreshing.
          </div>
        ) : (
          <div ref={containerRef} style={{ minWidth: "100%" }} />
        )}
        {/* Playback highlight marker */}
        {markerX !== null && (
          <div style={{
            position: "absolute",
            left: markerX - 10,
            top: 0,
            bottom: 4,
            width: 22,
            background: "rgba(184, 92, 58, 0.15)",
            borderRadius: 3,
            pointerEvents: "none",
            transition: "left 0.05s linear",
          }} />
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.625rem", flexWrap: "wrap" }}>
        <button
          onClick={handlePlay}
          style={{
            padding: "0.375rem 1rem", borderRadius: 4, border: "none",
            background: playing ? "#C0392B" : "#1E8449",
            color: "#fff", fontFamily: "Inter,sans-serif",
            fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.3rem",
          }}
        >
          {playing ? "⏹ Stop" : "▶ Play"}
        </button>

        {/* Tempo slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.6875rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
            {bpm} BPM
          </span>
          <input
            type="range" min={40} max={200} step={4} value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            style={{ width: 90, accentColor: "var(--charcoal)", cursor: "pointer" }}
          />
          <button
            onClick={() => setBpm(item.bpm)}
            style={{ fontFamily: "Inter,sans-serif", fontSize: "0.5625rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            reset
          </button>
        </div>

        <span style={{ fontFamily: "Inter,sans-serif", fontSize: "0.6875rem", color: "var(--muted)", fontStyle: "italic" }}>
          min: {item.beatUnit} = {item.bpm}
        </span>
      </div>
    </div>
  );
}
