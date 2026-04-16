import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = getSupabaseAdminClient();

  const { data: items } = await admin
    .from('portfolio_items')
    .select('id, title, recording_url, display_as, student_id')
    .eq('is_public', true)
    .eq('media_type', 'audio')
    .not('recording_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!items?.length) return NextResponse.json({ recordings: [] });

  const studentIds = [...new Set(items.map((i: { student_id: string }) => i.student_id))];
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, artist_name')
    .in('id', studentIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; display_name: string; artist_name: string | null }) => [p.id, p])
  );

  const recordings = items.map((item: { id: string; title: string; recording_url: string; display_as: string; student_id: string }) => {
    const profile = profileMap.get(item.student_id);
    let artist = 'Student';
    if (item.display_as === 'anonymous') artist = 'Anonymous';
    else if (item.display_as === 'alias' && profile?.artist_name) artist = profile.artist_name;
    else if (profile?.display_name) artist = profile.display_name;

    return {
      id: item.id,
      title: item.title || 'Untitled',
      url: item.recording_url,
      artist,
    };
  });

  return NextResponse.json({ recordings });
}
