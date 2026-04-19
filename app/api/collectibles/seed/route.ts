import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('composer_avatars')
    .upsert({
      composer_name: "Queenie's Blob",
      era: 'student_art',
      rarity: 'legendary',
      image_path: '/composers/queenie.jpg',
      fun_fact: 'Queenie is a ukelele player from Hamilton. This is one of her origional drawings! Check out her music at cadenza.studio/queenie.',
      unlock_hint: 'A special collectible featuring original student artwork.',
      drop_weight: 2,
      sort_order: 20,
      is_active: true,
    }, { onConflict: 'composer_name' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
