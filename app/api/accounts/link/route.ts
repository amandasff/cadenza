import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * POST /api/accounts/link
 * Body: { email: string }
 * Links the current user's account to the account with the given email.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = getSupabaseAdminClient();

    // Look up the target account by email
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return NextResponse.json({ error: 'Could not look up accounts' }, { status: 500 });
    const targetAuthUser = users.find((u: { email?: string; id: string }) => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetAuthUser) return NextResponse.json({ error: 'No account found with that email' }, { status: 404 });

    if (targetAuthUser.id === user.id) {
      return NextResponse.json({ error: 'Cannot link an account to itself' }, { status: 400 });
    }

    // Check not already linked
    const { data: existing } = await admin
      .from('linked_accounts')
      .select('id')
      .or(`and(user_id.eq.${user.id},linked_user_id.eq.${targetAuthUser.id}),and(user_id.eq.${targetAuthUser.id},linked_user_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) return NextResponse.json({ error: 'Accounts are already linked' }, { status: 409 });

    // Create the link (bidirectional: two rows)
    await admin.from('linked_accounts').insert([
      { user_id: user.id, linked_user_id: targetAuthUser.id },
      { user_id: targetAuthUser.id, linked_user_id: user.id },
    ]);

    // Return the linked profile for the UI
    const { data: profile } = await admin
      .from('profiles')
      .select('id, display_name, avatar_url, role')
      .eq('id', targetAuthUser.id)
      .single();

    return NextResponse.json({ linked: profile });
  } catch (e) {
    console.error('[accounts/link POST]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/accounts/link
 * Body: { linkedUserId: string }
 * Removes the link between the current user and the given account (both directions).
 */
export async function DELETE(request: Request) {
  try {
    const { linkedUserId } = await request.json();
    if (!linkedUserId) return NextResponse.json({ error: 'linkedUserId required' }, { status: 400 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = getSupabaseAdminClient();

    // Delete both directions
    await admin.from('linked_accounts').delete()
      .or(`and(user_id.eq.${user.id},linked_user_id.eq.${linkedUserId}),and(user_id.eq.${linkedUserId},linked_user_id.eq.${user.id})`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[accounts/link DELETE]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
