import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getWebPush } from '@/lib/webpush';

/**
 * POST /api/messages/send
 * Inserts a chat message and fires push notifications to recipients.
 * Body: { studioId, content, recipientId? }
 *   - recipientId null/omitted → announcement (visible to all studio members)
 *   - recipientId set → private DM
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { studioId, content, recipientId = null } = await request.json() as {
    studioId: string;
    content: string;
    recipientId?: string | null;
  };

  if (!studioId || !content?.trim()) {
    return NextResponse.json({ error: 'studioId and content are required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Get sender display name
  const { data: senderProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const senderName = senderProfile?.display_name ?? 'Someone';

  // Insert the message
  const { data: message, error: insertError } = await admin
    .from('messages')
    .insert({
      studio_id: studioId,
      sender_id: user.id,
      sender_name: senderName,
      recipient_id: recipientId,
      content: content.trim(),
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Fire push notifications (best-effort, don't block the response)
  sendPushNotifications({ admin, studioId, senderId: user.id, senderName, content: content.trim(), recipientId }).catch(() => {});

  return NextResponse.json({ message });
}

async function sendPushNotifications({
  admin,
  studioId,
  senderId,
  senderName,
  content,
  recipientId,
}: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  studioId: string;
  senderId: string;
  senderName: string;
  content: string;
  recipientId: string | null;
}) {
  const wp = getWebPush();
  if (!wp) return;

  // Determine which user IDs to notify
  let recipientUserIds: string[];

  if (recipientId) {
    // Private DM — only notify the recipient
    recipientUserIds = [recipientId];
  } else {
    // Announcement — notify all studio members except the sender
    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('studio_id', studioId)
      .neq('id', senderId);
    recipientUserIds = (profiles ?? []).map((p: { id: string }) => p.id);
  }

  if (!recipientUserIds.length) return;

  // Get push subscriptions + roles for all recipients
  const [{ data: subs }, { data: recipientProfiles }] = await Promise.all([
    admin
      .from('push_subscriptions')
      .select('user_id, subscription, endpoint')
      .in('user_id', recipientUserIds),
    admin
      .from('profiles')
      .select('id, role')
      .in('id', recipientUserIds),
  ]);

  if (!subs?.length) return;

  const roleMap = Object.fromEntries((recipientProfiles ?? []).map((p: { id: string; role: string }) => [p.id, p.role]));
  const preview = content.length > 80 ? content.slice(0, 77) + '…' : content;

  for (const row of subs) {
    const role = roleMap[row.user_id] ?? 'student';
    const url = role === 'teacher' ? '/teacher/chat' : '/student/chat';
    const payload = JSON.stringify({ title: senderName, body: preview, url });
    try {
      await wp.sendNotification(row.subscription as Parameters<typeof wp.sendNotification>[0], payload);
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
      }
    }
  }
}
