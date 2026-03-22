import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60; // Vercel serverless: extend timeout for Claude Vision call

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface OMRNote {
  note: string;    // e.g. "C", "C#", "Bb"
  octave: number;  // 4 = middle C octave
  duration: number; // beats (quarter=1.0, half=2.0, whole=4.0, eighth=0.5)
  beat: number;    // cumulative beat position from start
}

interface ClaudeOMRResponse {
  notes: OMRNote[];
  key?: string;
  timeSignature?: string;
  bpmSuggestion?: number;
  confidence?: number;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pieceId } = await params;
  const admin = getSupabaseAdminClient();

  // Fetch piece — verify ownership
  const { data: piece, error: pieceError } = await admin
    .from('pieces')
    .select('id, title, sheet_music_url, student_id')
    .eq('id', pieceId)
    .single();

  if (pieceError || !piece) {
    return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
  }
  if (piece.student_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!piece.sheet_music_url) {
    return NextResponse.json({ error: 'No sheet music uploaded for this piece' }, { status: 400 });
  }

  // Download the image from Supabase storage
  const imgRes = await fetch(piece.sheet_music_url);
  if (!imgRes.ok) {
    return NextResponse.json({ error: 'Could not fetch sheet music image' }, { status: 500 });
  }

  // Supabase Storage often returns application/octet-stream — derive type from URL extension
  const rawContentType = imgRes.headers.get('content-type') ?? '';
  let detectedMime = rawContentType.split(';')[0].trim();
  const ext = piece.sheet_music_url.split('.').pop()?.toLowerCase() ?? '';
  if (!detectedMime.startsWith('image/') && detectedMime !== 'application/pdf') {
    const EXT_MIME: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
    };
    detectedMime = EXT_MIME[ext] ?? 'image/jpeg';
  }

  const fileBuf = await imgRes.arrayBuffer();
  const MAX_BYTES = 32 * 1024 * 1024; // Claude accepts up to ~32 MB for documents
  if (fileBuf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File is too large (max 32 MB).' }, { status: 400 });
  }

  const base64 = Buffer.from(fileBuf).toString('base64');
  const isPdf = detectedMime === 'application/pdf' || ext === 'pdf';

  // Ask Claude to extract the melody as JSON
  // PDFs are sent as document type; images as image type — both supported natively
  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        isPdf
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
          : { type: 'image', source: { type: 'base64', media_type: detectedMime as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } },
        {
          type: 'text',
          text: `Analyze this sheet music image carefully. Extract the melody line (top voice in treble clef, or the single melodic line for monophonic instruments like flute, violin, voice).

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
- confidence: 0.9+ for clean printed music, 0.6 for slightly unclear, 0.3 for handwritten/blurry.`,
        },
      ],
    }],
  });

  const textBlock = claudeRes.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'No response from Claude' }, { status: 500 });
  }

  let parsed: ClaudeOMRResponse;
  try {
    let raw = textBlock.text.trim()
      .replace(/^```json?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    // If JSON is truncated (hit max_tokens), attempt to recover completed notes.
    // Find the last complete note object and close the array/object.
    let jsonToParse = raw;
    try {
      JSON.parse(raw);
    } catch {
      // Find last complete note: last '}' before any incomplete entry
      const lastComplete = raw.lastIndexOf('},');
      const lastClose = raw.lastIndexOf('}');
      const cutPoint = lastComplete !== -1 ? lastComplete + 1 : lastClose !== -1 ? lastClose + 1 : -1;
      if (cutPoint > 0) {
        // Close the notes array and object with minimal required fields
        jsonToParse = raw.slice(0, cutPoint) + ']}';
        // Ensure outer object structure
        if (!jsonToParse.trimStart().startsWith('{')) {
          jsonToParse = '{"notes":' + jsonToParse;
        }
        console.warn('OMR response truncated — recovered partial JSON');
      }
    }

    parsed = JSON.parse(jsonToParse) as ClaudeOMRResponse;
  } catch {
    console.error('OMR parse error. Raw:', textBlock.text.slice(0, 500));
    return NextResponse.json({ error: 'Could not parse note data from sheet music' }, { status: 500 });
  }

  if (!parsed.notes || !Array.isArray(parsed.notes) || parsed.notes.length === 0) {
    return NextResponse.json({ error: 'No notes found in sheet music' }, { status: 500 });
  }

  // ── Apply key signature accidentals the model may have missed ────────────────
  // Build a set of pitch classes (0-11) that are sharp/flat in the declared key.
  const KEY_ACCIDENTALS: Record<string, Record<string, string>> = {
    // sharps: note letter → sharped version
    'G major':  { F: 'F#' }, 'D major': { F: 'F#', C: 'C#' },
    'A major':  { F: 'F#', C: 'C#', G: 'G#' },
    'E major':  { F: 'F#', C: 'C#', G: 'G#', D: 'D#' },
    'B major':  { F: 'F#', C: 'C#', G: 'G#', D: 'D#', A: 'A#' },
    'F# major': { F: 'F#', C: 'C#', G: 'G#', D: 'D#', A: 'A#' }, // E# omitted: same pitch as F, not in client NOTE_SEMITONES
    // flats
    'F major':  { B: 'Bb' }, 'Bb major': { B: 'Bb', E: 'Eb' },
    'Eb major': { B: 'Bb', E: 'Eb', A: 'Ab' },
    'Ab major': { B: 'Bb', E: 'Eb', A: 'Ab', D: 'Db' },
    'Db major': { B: 'Bb', E: 'Eb', A: 'Ab', D: 'Db', G: 'Gb' },
    // relative minors map to same accidentals as their relative major
    'E minor':  { F: 'F#' }, 'B minor': { F: 'F#', C: 'C#' },
    'A minor':  {}, 'D minor': { B: 'Bb' }, 'G minor': { B: 'Bb', E: 'Eb' },
  };
  // Normalize key string: trim whitespace, handle case variants
  const rawKey = (parsed.key ?? '').trim();
  const keyAccidentals = KEY_ACCIDENTALS[rawKey]
    ?? KEY_ACCIDENTALS[Object.keys(KEY_ACCIDENTALS).find(k => k.toLowerCase() === rawKey.toLowerCase()) ?? '']
    ?? {};

  // Clamp and validate notes; sort by beat in case Claude returned them out of order
  const notes = parsed.notes
    .slice(0, 64)
    .filter(n =>
      n.note &&
      typeof n.octave === 'number' &&
      typeof n.beat === 'number' &&
      typeof n.duration === 'number' &&
      n.duration > 0
    )
    .map(n => {
      // If the key says this letter should be sharped/flatted and the note is natural, fix it
      const corrected = keyAccidentals[n.note];
      return corrected ? { ...n, note: corrected } : n;
    })
    .sort((a, b) => a.beat - b.beat);

  // Upsert — regenerating a piece replaces the old game
  const { data: game, error: saveError } = await admin
    .from('piece_games')
    .upsert({
      piece_id: pieceId,
      student_id: user.id,
      notes_json: notes,
      key_signature: parsed.key ?? null,
      time_signature: parsed.timeSignature ?? null,
      bpm_suggestion: parsed.bpmSuggestion ?? 80,
      omr_confidence: parsed.confidence ?? 0,
      source_url: piece.sheet_music_url,
    }, { onConflict: 'piece_id,student_id' })
    .select()
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    game,
    noteCount: notes.length,
    confidence: parsed.confidence ?? 0,
    key: parsed.key,
  });
}
