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

  // Upsert — only sets role/display_name on INSERT; leaves existing rows untouched
  const { error: upsertError } = await admin
    .from('profiles')
    .upsert(
      { id: user.id, role: role ?? 'student', display_name: display_name ?? user.email?.split('@')[0] ?? 'User' },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Return the full profile so callers can bypass a second RLS-blocked read
  const { data: profile, error: fetchError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (fetchError || !profile) {
    return NextResponse.json({ error: 'Profile not found after upsert' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile });
}
