import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/accounts/switch
 * Body: { targetUserId: string }
 *
 * Verifies the current user has the target linked, then generates
 * a Supabase magic link for the target account and returns the URL.
 * The client navigates to it, signing in as the target user.
 */
export async function POST(request: Request) {
  try {
    const { targetUserId } = await request.json();
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });

    // Get the current authenticated user via SSR client
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = getSupabaseAdminClient();

    // Verify a link exists between current user and target (in either direction)
    const { data: link } = await admin
      .from('linked_accounts')
      .select('id')
      .or(`and(user_id.eq.${user.id},linked_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},linked_user_id.eq.${user.id})`)
      .maybeSingle();

    if (!link) return NextResponse.json({ error: 'No link found between these accounts' }, { status: 403 });

    // Get the target user's email via admin API
    const { data: targetUser, error: userErr } = await admin.auth.admin.getUserById(targetUserId);
    if (userErr || !targetUser?.user?.email) {
      return NextResponse.json({ error: 'Could not find target account' }, { status: 404 });
    }

    // Generate a magic link for the target account
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email,
    });

    if (linkErr || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: 'Failed to generate switch link' }, { status: 500 });
    }

    return NextResponse.json({ url: linkData.properties.action_link });
  } catch (e) {
    console.error('[accounts/switch]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
