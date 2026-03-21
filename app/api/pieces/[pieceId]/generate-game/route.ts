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
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        },
        {
          type: 'text',
          text: `Analyze this sheet music image. Extract the melody line (top voice in treble clef, or single melodic line for any instrument).

Return ONLY valid JSON with no markdown fences and no explanation:
{
  "notes": [
    {"note": "C", "octave": 4, "duration": 1.0, "beat": 0.0}
  ],
  "key": "G major",
  "timeSignature": "4/4",
  "bpmSuggestion": 80,
  "confidence": 0.85
}

Rules:
- note: letter + optional # or b (e.g. "C", "C#", "Bb", "D"). Never use "Cb" — use "B" instead.
- octave: integer. Middle C = octave 4 (C4). The note above middle C is D4.
- duration: beats (whole=4.0, half=2.0, quarter=1.0, eighth=0.5, sixteenth=0.25, dotted quarter=1.5)
- beat: cumulative position from start. First note = 0.0. Each note's beat = previous beat + previous duration.
- Skip rests entirely — do not include them in the notes array.
- Maximum 64 notes. If the piece is longer, transcribe the first 64 notes.
- If chords appear, include only the highest note (the melody).
- confidence: 0.0-1.0. Use 0.9+ for clean printed music, 0.6 for slightly unclear, 0.3 for handwritten.`,
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

  // Clamp and validate notes
  const notes = parsed.notes
    .slice(0, 64)
    .filter(n => n.note && typeof n.octave === 'number' && typeof n.beat === 'number');

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
