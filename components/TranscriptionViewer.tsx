"use client";
import React, { useEffect, useRef, useState } from "react";
import { X, Trash2, Plus, Save, Volume2 } from "lucide-react";

interface OMRNote {
  note: string;
  octave: number;
  duration: number;
  beat: number;
  string?: number; // present for TAB-sourced pieces
  fret?: number;
}

export interface GameData {
  notes_json: OMRNote[];
  key_signature: string | null;
  time_signature: string | null;
  bpm_suggestion: number;
  omr_confidence: number;
}

interface Props {
  title: string;
  game: GameData;
  onClose: () => void;
  /** When provided, enables editing mode with save capability */
  onSave?: (notes: OMRNote[]) => Promise<void>;
}

const NOTE_COLORS: Record<string, string> = {
  C: "#e74c3c", D: "#e67e22", E: "#f1c40f",
  F: "#2ecc71", G: "#1abc9c", A: "#3498db", B: "#9b59b6",
};

const STRING_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#9b59b6"];
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];

const ALL_NOTES = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
const DURATIONS = [
  { value: 4, label: "Whole" },
  { value: 3, label: "Dot Half" },
  { value: 2, label: "Half" },
  { value: 1.5, label: "Dot Qtr" },
  { value: 1, label: "Quarter" },
  { value: 0.75, label: "Dot 8th" },
  { value: 0.5, label: "Eighth" },
  { value: 0.25, label: "16th" },
];

function noteColor(name: string): string {
  return NOTE_COLORS[name.charAt(0)] ?? "#888";
}

function durLabel(d: number): string {
  if (d === 4) return "whole";
  if (d === 3) return "d.half";
  if (d === 2) return "half";
  if (d === 1.5) return "d.qtr";
  if (d === 1) return "qtr";
  if (d === 0.75) return "d.8th";
  if (d === 0.5) return "8th";
  if (d === 0.25) return "16th";
  return `${d}b`;
}

const NOTE_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, "E#": 5, F: 5, Fb: 4, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11, "B#": 0, Cb: 11,
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playNotePreview(note: OMRNote) {
  try {
    const ctx = new AudioContext();
    const midi = (note.octave + 1) * 12 + (NOTE_SEMITONES[note.note] ?? 0);
    const freq = midiToFreq(midi);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.85);
    setTimeout(() => ctx.close(), 1000);
  } catch { /* audio not supported */ }
}

export default function TranscriptionViewer({ title, game, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editNotes, setEditNotes] = useState<OMRNote[]>(() => [...game.notes_json]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const notes = onSave ? editNotes : game.notes_json;
  const isTab = notes.length > 0 && typeof notes[0].string === "number";
  const editable = !!onSave;

  // Recalculate beat positions from durations (keeps beats consistent after edits)
  function recalcBeats(arr: OMRNote[]): OMRNote[] {
    let beat = 0;
    return arr.map(n => {
      const updated = { ...n, beat };
      beat += n.duration;
      return updated;
    });
  }

  function updateNote(idx: number, field: keyof OMRNote, value: string | number) {
    setEditNotes(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return recalcBeats(next);
    });
    setDirty(true);
  }

  function deleteNote(idx: number) {
    setEditNotes(prev => recalcBeats(prev.filter((_, i) => i !== idx)));
    setSelectedIdx(null);
    setDirty(true);
  }

  function addNoteAfter(idx: number) {
    const ref = editNotes[idx];
    const newNote: OMRNote = {
      note: ref?.note ?? "C",
      octave: ref?.octave ?? 4,
      duration: ref?.duration ?? 1,
      beat: 0,
    };
    setEditNotes(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, newNote);
      return recalcBeats(next);
    });
    setSelectedIdx(idx + 1);
    setDirty(true);
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(editNotes);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || notes.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = isTab ? 150 : 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, W, H);

    const maxBeat = notes.reduce((max, n) => Math.max(max, n.beat + n.duration), 0);
    if (maxBeat === 0) return;

    const PAD_X = 36;
    const PAD_Y = 8;
    const drawW = W - PAD_X - 12;

    if (isTab) {
      const LANES = 6;
      const laneH = (H - PAD_Y * 2) / LANES;
      const noteH = Math.max(6, laneH * 0.45);

      for (let s = 1; s <= LANES; s++) {
        const y = PAD_Y + (s - 0.5) * laneH;
        const color = STRING_COLORS[s - 1];
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.round(laneH * 0.4)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.7;
        ctx.fillText(STRING_LABELS[s - 1], 18, y);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = s <= 2 ? 1 : s <= 4 ? 1.5 : 2;
        ctx.beginPath();
        ctx.moveTo(PAD_X, y);
        ctx.lineTo(W - 12, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        const s = n.string ?? 1;
        if (s < 1 || s > 6) continue;
        const y = PAD_Y + (s - 0.5) * laneH;
        const x = PAD_X + (n.beat / maxBeat) * drawW;
        const w = Math.max(6, (n.duration / maxBeat) * drawW - 1);
        const r = noteH / 2;
        const color = STRING_COLORS[s - 1];
        const isSelected = i === selectedIdx;

        ctx.fillStyle = color;
        ctx.globalAlpha = isSelected ? 1 : 0.85;
        ctx.beginPath();
        ctx.moveTo(x + r, y - noteH / 2);
        ctx.lineTo(x + w - r, y - noteH / 2);
        ctx.arcTo(x + w, y - noteH / 2, x + w, y + noteH / 2, r);
        ctx.arcTo(x + w, y + noteH / 2, x + r, y + noteH / 2, r);
        ctx.lineTo(x + r, y + noteH / 2);
        ctx.arcTo(x, y + noteH / 2, x, y - noteH / 2, r);
        ctx.arcTo(x, y - noteH / 2, x + r, y - noteH / 2, r);
        ctx.closePath();
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        if (w > 14) {
          ctx.fillStyle = "#fff";
          ctx.globalAlpha = 0.9;
          ctx.font = `bold ${Math.round(noteH * 0.55)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(n.fret ?? ""), x + w / 2, y);
        }
        ctx.globalAlpha = 1;
      }
    } else {
      const toMidi = (n: OMRNote) => (n.octave + 1) * 12 + (NOTE_SEMITONES[n.note] ?? 0);
      const midis = notes.map(toMidi);
      const minMidi = Math.min(...midis) - 1;
      const maxMidi = Math.max(...midis) + 1;
      const midiRange = Math.max(1, maxMidi - minMidi);
      const drawH = H - PAD_Y * 2;
      const noteH = Math.max(4, Math.min(14, drawH / midiRange - 1));

      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let m = minMidi; m <= maxMidi; m++) {
        const y = PAD_Y + drawH - ((m - minMidi) / midiRange) * drawH;
        ctx.beginPath(); ctx.moveTo(PAD_X, y); ctx.lineTo(W - 12, y); ctx.stroke();
      }

      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        const midi = toMidi(n);
        const x = PAD_X + (n.beat / maxBeat) * drawW;
        const y = PAD_Y + drawH - ((midi - minMidi) / midiRange) * drawH;
        const w = Math.max(4, (n.duration / maxBeat) * drawW - 1);
        const r = noteH / 2;
        const color = noteColor(n.note);
        const isSelected = i === selectedIdx;

        ctx.fillStyle = color;
        ctx.globalAlpha = isSelected ? 1 : 0.88;
        ctx.beginPath();
        ctx.moveTo(x + r, y - noteH / 2);
        ctx.lineTo(x + w - r, y - noteH / 2);
        ctx.arcTo(x + w, y - noteH / 2, x + w, y + noteH / 2, r);
        ctx.arcTo(x + w, y + noteH / 2, x + r, y + noteH / 2, r);
        ctx.lineTo(x + r, y + noteH / 2);
        ctx.arcTo(x, y + noteH / 2, x, y - noteH / 2, r);
        ctx.arcTo(x, y - noteH / 2, x + r, y - noteH / 2, r);
        ctx.closePath();
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }, [notes, isTab, selectedIdx]);

  const confidence = Math.round((game.omr_confidence ?? 0) * 100);
  const confColor = confidence >= 80 ? "#2ecc71" : confidence >= 60 ? "#f39c12" : "#e74c3c";
  const selected = selectedIdx !== null ? notes[selectedIdx] : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--white, #fff)", borderRadius: 12,
          width: "100%", maxWidth: 620, maxHeight: "90vh",
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "1.125rem 1.375rem", borderBottom: "1px solid var(--border, #e8e3d9)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", fontWeight: 600, color: "var(--charcoal, #2C2824)" }}>{title}</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted, #9a9590)", marginTop: "0.125rem", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
              {editable ? "Edit Transcription" : "AI Transcription"} · {isTab ? "Guitar TAB" : "Standard Notation"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {editable && dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.375rem 0.875rem", background: "var(--sage, #5B9E79)", border: "none",
                  borderRadius: 6, color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
                  cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <Save size={14} /> {saving ? "Saving..." : "Save"}
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted, #9a9590)", padding: "0.25rem", borderRadius: 6 }}>
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Metadata strip */}
        <div style={{ padding: "0.625rem 1.375rem", background: "var(--cream, #f8f6f2)", borderBottom: "1px solid var(--border, #e8e3d9)", display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
          {game.key_signature && (
            <span style={{ fontSize: "0.8125rem", color: "var(--charcoal, #2C2824)", fontFamily: "Inter, sans-serif" }}>
              <span style={{ color: "var(--muted, #9a9590)", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Key </span>
              {game.key_signature}
            </span>
          )}
          {game.time_signature && (
            <span style={{ fontSize: "0.8125rem", color: "var(--charcoal, #2C2824)", fontFamily: "Inter, sans-serif" }}>
              <span style={{ color: "var(--muted, #9a9590)", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Time </span>
              {game.time_signature}
            </span>
          )}
          <span style={{ fontSize: "0.8125rem", color: "var(--charcoal, #2C2824)", fontFamily: "Inter, sans-serif" }}>
            <span style={{ color: "var(--muted, #9a9590)", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Tempo </span>
            {game.bpm_suggestion} BPM
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--charcoal, #2C2824)", fontFamily: "Inter, sans-serif" }}>
            <span style={{ color: "var(--muted, #9a9590)", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Notes </span>
            {notes.length}
          </span>
          <span style={{ fontSize: "0.8125rem", color: confColor, fontFamily: "Inter, sans-serif" }}>
            <span style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Confidence </span>
            {confidence}%
          </span>
        </div>

        {/* Visualization */}
        <div style={{ background: "#0d0d1a", padding: "0.75rem" }}>
          {notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.3)", fontSize: "0.875rem", fontFamily: "Inter, sans-serif" }}>No notes transcribed</div>
          ) : (
            <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 4 }} />
          )}
        </div>

        {/* Edit panel for selected note */}
        {editable && selected && selectedIdx !== null && (
          <div style={{
            padding: "0.75rem 1.375rem",
            background: "var(--cream, #f8f6f2)",
            borderBottom: "1px solid var(--border, #e8e3d9)",
            display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Note {selectedIdx + 1}
            </span>

            {!isTab && (
              <>
                <select
                  value={selected.note}
                  onChange={e => updateNote(selectedIdx, "note", e.target.value)}
                  style={{ padding: "0.25rem 0.5rem", borderRadius: 4, border: "1px solid var(--border)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif" }}
                >
                  {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>

                <input
                  type="number"
                  min={1}
                  max={8}
                  value={selected.octave}
                  onChange={e => updateNote(selectedIdx, "octave", parseInt(e.target.value) || 4)}
                  style={{ width: 48, padding: "0.25rem 0.5rem", borderRadius: 4, border: "1px solid var(--border)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif" }}
                />
              </>
            )}

            {isTab && (
              <>
                <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>String</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={selected.string ?? 1}
                  onChange={e => updateNote(selectedIdx, "string", parseInt(e.target.value) || 1)}
                  style={{ width: 48, padding: "0.25rem 0.5rem", borderRadius: 4, border: "1px solid var(--border)", fontSize: "0.8125rem" }}
                />
                <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Fret</label>
                <input
                  type="number"
                  min={0}
                  max={22}
                  value={selected.fret ?? 0}
                  onChange={e => updateNote(selectedIdx, "fret", parseInt(e.target.value) || 0)}
                  style={{ width: 48, padding: "0.25rem 0.5rem", borderRadius: 4, border: "1px solid var(--border)", fontSize: "0.8125rem" }}
                />
              </>
            )}

            <select
              value={selected.duration}
              onChange={e => updateNote(selectedIdx, "duration", parseFloat(e.target.value))}
              style={{ padding: "0.25rem 0.5rem", borderRadius: 4, border: "1px solid var(--border)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif" }}
            >
              {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>

            <button
              onClick={() => playNotePreview(selected)}
              style={{ padding: "0.25rem 0.5rem", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center" }}
              title="Preview note"
            >
              <Volume2 size={14} />
            </button>

            <button
              onClick={() => addNoteAfter(selectedIdx)}
              style={{ padding: "0.25rem 0.5rem", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--sage, #5B9E79)", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem" }}
              title="Insert note after"
            >
              <Plus size={13} /> Add
            </button>

            <button
              onClick={() => deleteNote(selectedIdx)}
              style={{ padding: "0.25rem 0.5rem", background: "none", border: "1px solid #e74c3c40", borderRadius: 4, cursor: "pointer", color: "#e74c3c", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem" }}
              title="Delete note"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}

        {/* Note chips */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.375rem 1.375rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted, #9a9590)", marginBottom: "0.625rem", fontFamily: "Inter, sans-serif" }}>
            {editable ? "Tap a note to edit" : "Notes in order"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {notes.map((n, i) => {
              const color = isTab ? STRING_COLORS[(n.string ?? 1) - 1] : noteColor(n.note);
              const label = isTab ? `s${n.string} f${n.fret}` : `${n.note}${n.octave}`;
              const isSelected = i === selectedIdx;
              return (
                <span
                  key={i}
                  onClick={() => editable && setSelectedIdx(isSelected ? null : i)}
                  style={{
                    display: "inline-flex", alignItems: "baseline", gap: "0.2rem",
                    padding: "0.2rem 0.5rem", borderRadius: 99,
                    background: isSelected ? color + "40" : color + "18",
                    border: `1.5px solid ${isSelected ? color : color + "40"}`,
                    fontSize: "0.75rem", fontWeight: 700, color,
                    fontFamily: "Inter, sans-serif",
                    cursor: editable ? "pointer" : "default",
                    transition: "all 0.1s",
                  }}
                >
                  {label}
                  <span style={{ fontSize: "0.5625rem", fontWeight: 400, opacity: 0.65 }}>{durLabel(n.duration)}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
