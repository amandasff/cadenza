import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * PATCH /api/pieces/[pieceId]/update-game
 * Persists user-corrected notes back to piece_games.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> }
) {
  const { pieceId } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { notes } = await req.json() as {
    notes: { note: string; octave: number; duration: number; beat: number; string?: number; fret?: number }[];
  };

  if (!Array.isArray(notes) || notes.length === 0) {
    return NextResponse.json({ error: 'notes array is required' }, { status: 400 });
  }

  // RLS ensures student can only update their own piece_games
  const { error } = await supabase
    .from('piece_games')
    .update({ notes_json: notes })
    .eq('piece_id', pieceId)
    .eq('student_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
