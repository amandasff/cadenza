import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/accounts/link
 * Body: { email: string }
 * Links the current user's account to the account with the given email.
 * Creates bidirectional rows so both sides can see the link.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email } = await request.json() as { email: string };
  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const admin = getSupabaseAdminClient();

  // Look up the target user by email
  const { data: targets } = await admin.auth.admin.listUsers();
  const target = targets?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
  if (!target) return NextResponse.json({ error: 'No account found with that email' }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: 'Cannot link to your own account' }, { status: 400 });

  // Insert both directions (ignore conflicts — already linked is fine)
  await admin.from('linked_accounts').upsert([
    { user_id: user.id,    linked_user_id: target.id },
    { user_id: target.id, linked_user_id: user.id   },
  ], { onConflict: 'user_id,linked_user_id' });

  // Return the linked user's profile for display
  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .eq('id', target.id)
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
    admin.from('linked_accounts').delete().match({ user_id: user.id,          linked_user_id: linkedUserId }),
    admin.from('linked_accounts').delete().match({ user_id: linkedUserId, linked_user_id: user.id }),
  ]);

  return NextResponse.json({ ok: true });
}
