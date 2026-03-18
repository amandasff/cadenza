import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/accounts/switch
 * Body: { targetUserId: string }
 *
 * Returns a token_hash the client can pass to supabase.auth.verifyOtp().
 * This avoids the redirect_to / Site URL problem entirely — the session
 * is established directly in the browser without any Supabase redirect.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetUserId } = await request.json() as { targetUserId: string };
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });

  const admin = getSupabaseAdminClient();

  // Verify the link exists
  const { data: link } = await admin
    .from('linked_accounts')
    .select('id')
    .match({ user_id: user.id, linked_user_id: targetUserId })
    .single();

  if (!link) return NextResponse.json({ error: 'No link found' }, { status: 403 });

  // Get target email + role
  const [{ data: targetAuth }, { data: targetProfile }] = await Promise.all([
    admin.auth.admin.getUserById(targetUserId),
    admin.from('profiles').select('role').eq('id', targetUserId).single(),
  ]);

  if (!targetAuth.user?.email) {
    return NextResponse.json({ error: 'Target account has no email' }, { status: 500 });
  }

  const role = (targetProfile?.role as string | null) ?? 'student';

  // Generate magic link — we only use the hashed_token, not the action_link URL,
  // so Supabase's Site URL / Redirect URL config is irrelevant.
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetAuth.user.email,
    // redirectTo can be anything valid; we ignore it on the client
    options: { redirectTo: new URL(request.url).origin },
  });

  if (error || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Failed to generate switch token' }, { status: 500 });
  }

  return NextResponse.json({
    token_hash: linkData.properties.hashed_token,
    next: `/${role}`,
  });
}
