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

interface TabNote {
  string: number;  // 1 = high e, 6 = low E
  fret: number;    // 0-22
  beat: number;
  duration: number;
}

interface ClaudeOMRResponse {
  format?: 'tab' | 'pitch';
  notes: OMRNote[];
  tabNotes?: TabNote[];
  key?: string;
  timeSignature?: string;
  bpmSuggestion?: number;
  confidence?: number;
}

// Guitar standard tuning MIDI values: strings 1-6 (high e → low E)
const STRING_OPEN_MIDI_SERVER = [64, 59, 55, 50, 45, 40];
const NOTE_NAMES_SERVER = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function tabToNote(string: number, fret: number): { note: string; octave: number } {
  const midi = (STRING_OPEN_MIDI_SERVER[string - 1] ?? 64) + fret;
  return { note: NOTE_NAMES_SERVER[midi % 12], octave: Math.floor(midi / 12) - 1 };
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
          text: `Analyze this sheet music. First, check whether guitar TAB is present (a 6-line grid with numbers below the staff). Then follow the matching path below.

Return ONLY valid JSON — no markdown fences, no explanation, no trailing text.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PATH A — Guitar TAB is present
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use this format:
{
  "format": "tab",
  "tabNotes": [
    {"string": 1, "fret": 7, "beat": 0.0, "duration": 0.333}
  ],
  "notes": [],
  "key": "E minor",
  "timeSignature": "3/4",
  "bpmSuggestion": 100,
  "confidence": 0.92
}

TAB READING RULES:
- The TAB has 6 horizontal lines. Top line = string 1 (high e). Bottom line = string 6 (low E).
- The number on a line = fret number (0 = open string).
- Numbers aligned in the same vertical column = notes played simultaneously.
- MELODY SELECTION: For each simultaneous group, output ONLY the note on the lowest-numbered string (string 1 if it has a number, else string 2, etc.). Skip pure bass/accompaniment open strings that repeat throughout.
- TIMING: Get beat positions and durations from the rhythmic notation (note heads, stems, beams) above the TAB, not from the TAB numbers themselves.
- BEAT: beat 0.0 = first note. Each note's beat = previous beat + previous duration. In 3/4 time, measure 2 = beat 3.0, measure 3 = beat 6.0. In 4/4, measure 2 = beat 4.0.
- DURATION: whole=4.0, half=2.0, quarter=1.0, eighth=0.5, sixteenth=0.25. Dotted=1.5×base.
- Maximum 128 melody notes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PATH B — Standard notation only (no TAB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use this format:
{
  "format": "pitch",
  "notes": [
    {"note": "C", "octave": 4, "duration": 1.0, "beat": 0.0}
  ],
  "tabNotes": [],
  "key": "G major",
  "timeSignature": "4/4",
  "bpmSuggestion": 80,
  "confidence": 0.85
}

PITCH READING RULES:
- Extract melody (top voice / stems-up notes in treble clef).
- Note names: C C# Db D Eb E F F# Gb G Ab A Bb B
- Apply key signature accidentals to every note (e.g. G major → every F becomes F# unless natural sign).
- Octave: middle C = 4. Treble clef lines bottom→top: E4 G4 B4 D5 F5. Spaces: F4 A4 C5 E5.
- Duration and beat: same rules as Path A.
- If chords, include only the highest note.
- Maximum 128 notes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
confidence: 0.9+ clean print, 0.6 slightly unclear, 0.3 handwritten/blurry`,
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

  // ── Build final note list from whichever format Claude returned ─────────────
  const isTabFormat = parsed.format === 'tab' && Array.isArray(parsed.tabNotes) && parsed.tabNotes.length > 0;

  let notes: OMRNote[];

  if (isTabFormat) {
    // TAB path: convert string+fret → note+octave, keep string/fret on the object
    // so omrPieceToSong() can use them directly without re-mapping
    notes = (parsed.tabNotes ?? [])
      .slice(0, 128)
      .filter(t =>
        typeof t.string === 'number' && t.string >= 1 && t.string <= 6 &&
        typeof t.fret === 'number' && t.fret >= 0 && t.fret <= 22 &&
        typeof t.beat === 'number' &&
        typeof t.duration === 'number' && t.duration > 0
      )
      .sort((a, b) => a.beat - b.beat)
      .map(t => {
        const { note, octave } = tabToNote(t.string, t.fret);
        return { note, octave, beat: t.beat, duration: t.duration, string: t.string, fret: t.fret };
      });
  } else {
    // Pitch path: standard notation — apply key signature corrections
    if (!parsed.notes || !Array.isArray(parsed.notes) || parsed.notes.length === 0) {
      return NextResponse.json({ error: 'No notes found in sheet music' }, { status: 500 });
    }

    const KEY_ACCIDENTALS: Record<string, Record<string, string>> = {
      'G major':  { F: 'F#' }, 'D major': { F: 'F#', C: 'C#' },
      'A major':  { F: 'F#', C: 'C#', G: 'G#' },
      'E major':  { F: 'F#', C: 'C#', G: 'G#', D: 'D#' },
      'B major':  { F: 'F#', C: 'C#', G: 'G#', D: 'D#', A: 'A#' },
      'F# major': { F: 'F#', C: 'C#', G: 'G#', D: 'D#', A: 'A#' },
      'F major':  { B: 'Bb' }, 'Bb major': { B: 'Bb', E: 'Eb' },
      'Eb major': { B: 'Bb', E: 'Eb', A: 'Ab' },
      'Ab major': { B: 'Bb', E: 'Eb', A: 'Ab', D: 'Db' },
      'Db major': { B: 'Bb', E: 'Eb', A: 'Ab', D: 'Db', G: 'Gb' },
      'E minor':  { F: 'F#' }, 'B minor': { F: 'F#', C: 'C#' },
      'A minor':  {}, 'D minor': { B: 'Bb' }, 'G minor': { B: 'Bb', E: 'Eb' },
    };
    const rawKey = (parsed.key ?? '').trim();
    const keyAccidentals = KEY_ACCIDENTALS[rawKey]
      ?? KEY_ACCIDENTALS[Object.keys(KEY_ACCIDENTALS).find(k => k.toLowerCase() === rawKey.toLowerCase()) ?? '']
      ?? {};

    notes = parsed.notes
      .slice(0, 128)
      .filter(n =>
        n.note &&
        typeof n.octave === 'number' &&
        typeof n.beat === 'number' &&
        typeof n.duration === 'number' &&
        n.duration > 0
      )
      .map(n => {
        const corrected = keyAccidentals[n.note];
        return corrected ? { ...n, note: corrected } : n;
      })
      .sort((a, b) => a.beat - b.beat);
  }

  if (notes.length === 0) {
    return NextResponse.json({ error: 'No valid notes found in sheet music' }, { status: 500 });
  }

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
