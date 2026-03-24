import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/pieces/[pieceId]/game-result
 * Saves a practice game play-through result for accuracy tracking.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const { pieceId } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { totalNotes, hits, misses, accuracy, perNote } = await req.json() as {
    totalNotes: number;
    hits: number;
    misses: number;
    accuracy: number;
    perNote: { note: string; octave: number; result: 'hit' | 'miss' }[];
  };

  if (!totalNotes || typeof accuracy !== 'number') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('piece_game_results')
    .insert({
      piece_id: pieceId,
      student_id: user.id,
      total_notes: totalNotes,
      hits,
      misses,
      accuracy,
      per_note: perNote,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ result: data });
}

/**
 * GET /api/pieces/[pieceId]/game-result
 * Returns accuracy history for a piece (most recent first).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const { pieceId } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('piece_game_results')
    .select('id, total_notes, hits, misses, accuracy, played_at')
    .eq('piece_id', pieceId)
    .eq('student_id', user.id)
    .order('played_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data });
}
