import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/accounts/link
 * Body: { email: string; password: string }
 * Verifies the credentials of the other account, then creates a bidirectional link.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, password } = await request.json() as { email: string; password: string };
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // Verify the credentials by signing in as the other account in a throwaway client
  // (does not affect the current user's session)
  const throwaway = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: signInData, error: signInError } = await throwaway.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (signInError || !signInData.user) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  const targetId = signInData.user.id;
  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot link to your own account' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Create bidirectional link (ignore conflicts — already linked is fine)
  await admin.from('linked_accounts').upsert([
    { user_id: user.id, linked_user_id: targetId },
    { user_id: targetId, linked_user_id: user.id },
  ], { onConflict: 'user_id,linked_user_id' });

  // Return the linked user's profile for display
  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .eq('id', targetId)
    .single();

  return NextResponse.json({ linked: profile });
}

/**
 * DELETE /api/accounts/link
 * Body: { linkedUserId: string }
 * Removes the link between current user and the target (both directions).
 */
export async function DELETE(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { linkedUserId } = await request.json() as { linkedUserId: string };
  if (!linkedUserId) return NextResponse.json({ error: 'linkedUserId is required' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  await Promise.all([
    admin.from('linked_accounts').delete().match({ user_id: user.id,       linked_user_id: linkedUserId }),
    admin.from('linked_accounts').delete().match({ user_id: linkedUserId,  linked_user_id: user.id }),
  ]);

  return NextResponse.json({ ok: true });
}
