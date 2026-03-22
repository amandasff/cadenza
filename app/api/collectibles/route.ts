import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/collectibles?userId=xxx
 * Returns a user's composer collectibles using the admin client (bypasses RLS).
 * Used when visiting another student's studio.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();

  // Step 1: get the student's collected avatar IDs
  const { data: collectiblesRaw, error } = await admin
    .from('student_collectibles')
    .select('avatar_id, shard_count, acquired_at')
    .eq('student_id', userId)
    .order('acquired_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = collectiblesRaw ?? [];
  if (rows.length === 0) return NextResponse.json({ collectibles: [] });

  // Step 2: resolve avatar details
  const avatarIds = rows.map((r: { avatar_id: string }) => r.avatar_id);
  const { data: avatars } = await admin
    .from('composer_avatars')
    .select('id, composer_name, era, rarity, image_path, youtube_id, drop_weight')
    .in('id', avatarIds);

  const avatarMap = new Map((avatars ?? []).map((a: { id: string }) => [a.id, a]));

  const collectibles = rows.map((r: { avatar_id: string; shard_count: number; acquired_at: string }) => ({
    avatar_id: r.avatar_id,
    shard_count: r.shard_count,
    acquired_at: r.acquired_at,
    composer_avatars: avatarMap.get(r.avatar_id) ?? null,
  }));

  return NextResponse.json({ collectibles });
}
