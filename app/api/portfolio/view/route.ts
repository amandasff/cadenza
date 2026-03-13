import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/portfolio/view
 * Body: { itemId: string }
 * Increments view_count on portfolio_items by 1.
 * Requires auth (so bots can't inflate counts).
 *
 * SQL needed (run once in Supabase):
 *   ALTER TABLE public.portfolio_items
 *     ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemId } = await request.json() as { itemId?: string };
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc('increment_portfolio_view', { item_id: itemId }).select();

  if (error) {
    // If the RPC doesn't exist yet, fall back to a direct update
    const { data: row, error: fetchErr } = await admin
      .from('portfolio_items')
      .select('view_count')
      .eq('id', itemId)
      .single();
    if (fetchErr) return NextResponse.json({ views: 0 });
    const current = (row as { view_count?: number })?.view_count ?? 0;
    await admin.from('portfolio_items').update({ view_count: current + 1 }).eq('id', itemId);
    return NextResponse.json({ views: current + 1 });
  }

  return NextResponse.json({ views: (data as unknown as number) ?? 1 });
}
