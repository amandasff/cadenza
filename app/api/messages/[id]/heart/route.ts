import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

// POST /api/messages/[id]/heart — toggle heart on a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;
  const server = await getSupabaseServerClient();
  const { data: { user } } = await server.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  // Check if already hearted
  const { data: existing } = await admin
    .from('message_hearts')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    await admin.from('message_hearts').delete().eq('id', existing.id);
    return NextResponse.json({ hearted: false });
  } else {
    await admin.from('message_hearts').insert({ message_id: messageId, user_id: user.id });
    return NextResponse.json({ hearted: true });
  }
}
