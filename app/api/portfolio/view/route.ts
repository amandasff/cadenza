import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/portfolio/view
 * Body: { itemId: string }
 * Atomically increments view_count via the increment_portfolio_view RPC.
 * Run supabase/add_portfolio_views.sql once to create the function + column.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemId } = await request.json() as { itemId?: string };
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc('increment_portfolio_view', { item_id: itemId });

  if (error) {
    console.error('increment_portfolio_view RPC error:', error.message, '— run supabase/add_portfolio_views.sql');
    return NextResponse.json({ views: 0 });
  }

  return NextResponse.json({ views: (data as unknown as number) ?? 1 });
}
