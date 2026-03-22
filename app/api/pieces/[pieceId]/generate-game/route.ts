import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

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

  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
  if (contentType.includes('pdf')) {
    return NextResponse.json({
      error: 'PDF not yet supported. Please upload a JPG or PNG photo of your sheet music.',
    }, { status: 400 });
  }

  const imgBuf = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuf).toString('base64');
  const mimeType = (contentType.split(';')[0] as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg';

  // Ask Claude to extract the melody as JSON
  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        },
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
    const raw = textBlock.text.trim()
      .replace(/^```json?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    parsed = JSON.parse(raw) as ClaudeOMRResponse;
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
    'F# major': { F: 'F#', C: 'C#', G: 'G#', D: 'D#', A: 'A#', E: 'E#' },
    // flats
    'F major':  { B: 'Bb' }, 'Bb major': { B: 'Bb', E: 'Eb' },
    'Eb major': { B: 'Bb', E: 'Eb', A: 'Ab' },
    'Ab major': { B: 'Bb', E: 'Eb', A: 'Ab', D: 'Db' },
    'Db major': { B: 'Bb', E: 'Eb', A: 'Ab', D: 'Db', G: 'Gb' },
    // relative minors map to same accidentals as their relative major
    'E minor':  { F: 'F#' }, 'B minor': { F: 'F#', C: 'C#' },
    'A minor':  {}, 'D minor': { B: 'Bb' }, 'G minor': { B: 'Bb', E: 'Eb' },
  };
  const keyAccidentals = KEY_ACCIDENTALS[parsed.key ?? ''] ?? {};

  // Clamp and validate notes
  const notes = parsed.notes
    .slice(0, 64)
    .filter(n => n.note && typeof n.octave === 'number' && typeof n.beat === 'number')
    .map(n => {
      // If the key says this letter should be sharped/flatted and the note is natural, fix it
      const corrected = keyAccidentals[n.note];
      return corrected ? { ...n, note: corrected } : n;
    });

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
