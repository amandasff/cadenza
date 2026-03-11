import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/profile/ensure
 * Creates a profile row for the authenticated user if one doesn't exist.
 * Uses the admin client to bypass RLS.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, display_name } = await request.json();

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('profiles')
    .upsert(
      { id: user.id, role: role ?? 'student', display_name: display_name ?? user.email?.split('@')[0] ?? 'User' },
      { onConflict: 'id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
