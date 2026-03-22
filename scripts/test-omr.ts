/**
 * Test OMR accuracy against a sheet music URL.
 * Usage:  ANTHROPIC_API_KEY=sk-... bun scripts/test-omr.ts <image-url-or-path>
 *
 * Prints:
 *  - Raw Claude response
 *  - Parsed note list with beat positions
 *  - Accuracy warnings (repeated pitches, beat gaps, octave outliers)
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

const anthropic = new Anthropic({ apiKey });

const input = process.argv[2];
if (!input) {
  console.error("Usage: bun scripts/test-omr.ts <url-or-filepath>");
  process.exit(1);
}

async function getFileData(src: string): Promise<{ base64: string; mime: string; isPdf: boolean }> {
  let buf: ArrayBuffer;
  let mime = "image/jpeg";

  if (src.startsWith("http")) {
    const res = await fetch(src);
    buf = await res.arrayBuffer();
    const ct = res.headers.get("content-type") ?? "";
    mime = ct.split(";")[0].trim();
  } else {
    buf = fs.readFileSync(src).buffer as ArrayBuffer;
  }

  const ext = src.split(".").pop()?.toLowerCase() ?? "";
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    const EXT_MAP: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      webp: "image/webp", pdf: "application/pdf",
    };
    mime = EXT_MAP[ext] ?? "image/jpeg";
  }

  return {
    base64: Buffer.from(buf).toString("base64"),
    mime,
    isPdf: mime === "application/pdf" || ext === "pdf",
  };
}

const PROMPT = `Analyze this sheet music image carefully. Extract the melody line (top voice in treble clef, or the single melodic line for monophonic instruments like flute, violin, voice).

Return ONLY valid JSON — no markdown fences, no explanation, no trailing text:
{
  "notes": [
    {"note": "C", "octave": 4, "duration": 1.0, "beat": 0.0}
  ],
  "key": "G major",
  "timeSignature": "4/4",
  "bpmSuggestion": 80,
  "confidence": 0.85
}

CRITICAL RULES — read all of these before generating:

NOTE NAME:
- Use the letter name + optional accidental: "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"
- APPLY KEY SIGNATURE ACCIDENTALS: if the key is G major (one sharp = F#), every F in the piece must be written as "F#" unless it has a natural sign. Apply ALL key signature sharps/flats to every note throughout the piece.
- Natural signs cancel the key signature for that note only.

OCTAVE:
- Middle C (the C on the first ledger line below the treble clef staff) = octave 4.
- The treble clef staff lines are E4, G4, B4, D5, F5 (bottom to top).
- The treble clef staff spaces are F4, A4, C5, E5 (bottom to top).
- Count ledger lines carefully. One ledger line above the staff = A5. One ledger line below = C4 (middle C).
- Bass clef lines: G2, B2, D3, F3, A3. Bass clef spaces: A2, C3, E3, G3.

DURATION:
- Whole note = 4.0, half = 2.0, quarter = 1.0, eighth = 0.5, sixteenth = 0.25
- Dotted note = 1.5× its base (dotted quarter = 1.5, dotted half = 3.0, dotted eighth = 0.75)
- Tied notes: add the durations together as one entry.

BEAT:
- First note in the piece = beat 0.0.
- Each subsequent note's beat = previous note's beat + previous note's duration.
- Count carefully through rests (rests advance the beat but are not included as notes).
- In 4/4 time, measure 2 starts at beat 4.0, measure 3 at beat 8.0, etc.

OTHER:
- Skip rests — do not include them in the notes array, but DO count their duration when computing beat positions.
- Maximum 64 notes. Transcribe the first 64 if the piece is longer.
- If chords appear, include only the highest note.
- confidence: 0.9+ for clean printed music, 0.6 for slightly unclear, 0.3 for handwritten/blurry.`;

async function main() {
  console.log(`\n📄 Loading: ${input}`);
  const { base64, mime, isPdf } = await getFileData(input);
  console.log(`   MIME: ${mime}  |  Size: ${(base64.length * 0.75 / 1024).toFixed(0)} KB  |  PDF: ${isPdf}`);

  console.log("\n🤖 Calling Claude...");
  const t0 = Date.now();

  const content: Anthropic.MessageParam["content"] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } } as never
      : { type: "image", source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp", data: base64 } },
    { type: "text", text: PROMPT },
  ];

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content }],
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const textBlock = res.content.find(b => b.type === "text");
  if (!textBlock || textBlock.type !== "text") { console.error("No text response"); process.exit(1); }

  console.log(`\n⏱  ${elapsed}s   stop_reason: ${res.stop_reason}`);
  if (res.stop_reason === "max_tokens") {
    console.warn("⚠️  TRUNCATED — hit max_tokens limit. Increase max_tokens or reduce piece size.");
  }

  // ── Raw output ──────────────────────────────────────────────────────────────
  console.log("\n── Raw Claude response ──────────────────────────────────────");
  console.log(textBlock.text.slice(0, 2000));
  if (textBlock.text.length > 2000) console.log(`... (${textBlock.text.length} chars total)`);

  // ── Parse ───────────────────────────────────────────────────────────────────
  let parsed: { notes: Array<{ note: string; octave: number; duration: number; beat: number }>; key?: string; timeSignature?: string; bpmSuggestion?: number; confidence?: number };
  try {
    const raw = textBlock.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    console.error("\n❌ JSON parse failed.");
    process.exit(1);
  }

  const notes = parsed.notes ?? [];
  console.log(`\n── Parsed metadata ──────────────────────────────────────────`);
  console.log(`   Key:        ${parsed.key ?? "unknown"}`);
  console.log(`   Time:       ${parsed.timeSignature ?? "unknown"}`);
  console.log(`   BPM:        ${parsed.bpmSuggestion ?? "unknown"}`);
  console.log(`   Confidence: ${((parsed.confidence ?? 0) * 100).toFixed(0)}%`);
  console.log(`   Note count: ${notes.length}`);

  console.log(`\n── Note list ────────────────────────────────────────────────`);
  notes.slice(0, 80).forEach((n, i) => {
    const dur = n.duration === 4 ? "whole" : n.duration === 2 ? "half" : n.duration === 1 ? "qtr"
      : n.duration === 0.5 ? "8th" : n.duration === 0.25 ? "16th" : `${n.duration}b`;
    console.log(`   [${String(i).padStart(2)}] beat ${String(n.beat).padEnd(6)} ${n.note}${n.octave}  ${dur}`);
  });
  if (notes.length > 80) console.log(`   ... and ${notes.length - 80} more`);

  // ── Accuracy warnings ───────────────────────────────────────────────────────
  console.log(`\n── Accuracy warnings ────────────────────────────────────────`);
  let warnings = 0;

  // 1. Repeated pitch (>60% same note = suspicious)
  const pitchCounts: Record<string, number> = {};
  for (const n of notes) {
    const k = `${n.note}${n.octave}`;
    pitchCounts[k] = (pitchCounts[k] ?? 0) + 1;
  }
  const topPitch = Object.entries(pitchCounts).sort((a, b) => b[1] - a[1])[0];
  if (topPitch && topPitch[1] / notes.length > 0.6) {
    console.log(`   ⚠️  ${topPitch[0]} appears ${topPitch[1]}/${notes.length} times (${(topPitch[1]/notes.length*100).toFixed(0)}%) — likely hallucination or blank image`);
    warnings++;
  }

  // 2. Beat gaps (missing rests that shouldn't create huge gaps)
  for (let i = 1; i < notes.length; i++) {
    const expected = notes[i-1].beat + notes[i-1].duration;
    const actual = notes[i].beat;
    const gap = actual - expected;
    if (gap > 4.0) {
      console.log(`   ⚠️  Large beat gap before note ${i} (${notes[i-1].note}${notes[i-1].octave} beat ${notes[i-1].beat} → ${notes[i].note}${notes[i].octave} beat ${notes[i].beat}, gap=${gap.toFixed(2)})`);
      warnings++;
    }
  }

  // 3. Octave outliers (notes outside normal singing/instrument range E2-C7)
  const MIDI_NOTE: Record<string, number> = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 };
  for (const n of notes) {
    const base = n.note.charAt(0);
    const midi = (n.octave + 1) * 12 + (MIDI_NOTE[base] ?? 0);
    if (midi < 28 || midi > 96) {
      console.log(`   ⚠️  Octave outlier: ${n.note}${n.octave} (MIDI ${midi}) — likely misread ledger line`);
      warnings++;
    }
  }

  // 4. All same duration (suspicious for real music)
  const durCounts: Record<string, number> = {};
  for (const n of notes) durCounts[String(n.duration)] = (durCounts[String(n.duration)] ?? 0) + 1;
  const topDur = Object.entries(durCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDur && topDur[1] / notes.length > 0.95 && notes.length > 8) {
    console.log(`   ⚠️  ${(+topDur[0] === 0.5 ? "eighth" : topDur[0])} note appears ${topDur[1]}/${notes.length} times — rhythm likely not read correctly`);
    warnings++;
  }

  if (warnings === 0) console.log("   ✅ No obvious accuracy issues detected");

  console.log(`\n── Pitch distribution ───────────────────────────────────────`);
  Object.entries(pitchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([k, v]) => console.log(`   ${k.padEnd(6)} ${"█".repeat(Math.round(v/notes.length*30))} ${v}`));

  console.log("\n✅ Done\n");
}

main().catch(e => { console.error(e); process.exit(1); });
