import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/accounts/switch
 * Body: { targetUserId: string }
 * Verifies the current user has a link to targetUserId, then generates
 * a one-time magic link for the target account and returns its URL.
 * The client navigates to the URL → Supabase signs them in as the target.
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

  // Get target user's email and role so we can deep-link to the right dashboard
  const [{ data: targetAuth }, { data: targetProfile }] = await Promise.all([
    admin.auth.admin.getUserById(targetUserId),
    admin.from('profiles').select('role').eq('id', targetUserId).single(),
  ]);

  if (!targetAuth.user?.email) return NextResponse.json({ error: 'Target account has no email' }, { status: 500 });

  const role = targetProfile?.role ?? 'student';
  // Use the request origin so switching works in both dev and production
  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/${role}`;

  // Generate a one-time magic link for the target account
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetAuth.user.email,
    options: { redirectTo },
  });

  if (error || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: 'Failed to generate switch link' }, { status: 500 });
  }

  return NextResponse.json({ url: linkData.properties.action_link });
}
