import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface FeedbackBody {
  pieceTitle: string;
  keySignature: string | null;
  totalNotes: number;
  hitCount: number;
  missedNoteNames: string[]; // note names that were missed (e.g. ["F#4", "D4"])
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: FeedbackBody;
  try {
    body = await request.json() as FeedbackBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { pieceTitle, keySignature, totalNotes, hitCount, missedNoteNames } = body;
  if (!pieceTitle || typeof totalNotes !== 'number' || typeof hitCount !== 'number' || !Array.isArray(missedNoteNames)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const accuracy = totalNotes > 0 ? Math.round((hitCount / totalNotes) * 100) : 0;
  const weakNotes = missedNoteNames.length > 0
    ? missedNoteNames.slice(0, 5).join(', ')
    : 'none';

  const prompt = `A music student just practiced "${pieceTitle}"${keySignature ? ` in ${keySignature}` : ''} using a note-by-note practice game.

Results:
- ${hitCount} out of ${totalNotes} notes played correctly (${accuracy}% accuracy)
- Notes they struggled with most: ${weakNotes}

Write 2-3 sentences of warm, encouraging, specific feedback. Tell them what they did well. If they missed specific notes, give one concrete tip (like "check the key signature for ${weakNotes.split(',')[0]?.trim() || 'those notes'}"). Keep it conversational — like a supportive teacher, not a report card. No bullet points.`;

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content.find(b => b.type === 'text');
  return NextResponse.json({ feedback: text?.type === 'text' ? text.text : 'Great work practicing today!' });
}
