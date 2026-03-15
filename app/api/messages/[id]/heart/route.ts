import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

function getDbClient() {
  try {
    return getSupabaseAdminClient();
  } catch {
    return null;
  }
}

// POST /api/messages/[id]/heart — toggle heart on a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;
  const server = await getSupabaseServerClient();
  const { data: { user } } = await server.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDbClient() ?? server;

  // Verify the message exists and the user is in its studio (as sender or recipient)
  const { data: message } = await db
    .from('messages')
    .select('id, studio_id, sender_id, recipient_id')
    .eq('id', messageId)
    .single();

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // Verify user belongs to this studio (as a studio member, sender, or recipient)
  const { data: membership } = await server
    .from('studio_students')
    .select('id')
    .eq('studio_id', message.studio_id)
    .eq('student_id', user.id)
    .maybeSingle();

  const { data: studioOwner } = await server
    .from('studios')
    .select('id')
    .eq('id', message.studio_id)
    .eq('owner_id', user.id)
    .maybeSingle();

  const isParticipant = message.sender_id === user.id || message.recipient_id === user.id;

  if (!membership && !studioOwner && !isParticipant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if already hearted
  const { data: existing } = await db
    .from('message_hearts')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    await db.from('message_hearts').delete().eq('id', existing.id);
    return NextResponse.json({ hearted: false });
  } else {
    await db.from('message_hearts').insert({ message_id: messageId, user_id: user.id });
    return NextResponse.json({ hearted: true });
  }
}
