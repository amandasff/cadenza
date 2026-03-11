import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  // Verify requester is a teacher with a studio
  const [{ data: teacherProfile }, { data: studio }] = await Promise.all([
    admin.from('profiles').select('display_name, role').eq('id', user.id).single(),
    admin.from('studios').select('id').eq('owner_id', user.id).single(),
  ]);

  if (teacherProfile?.role !== 'teacher' || !studio) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { studentId } = await request.json() as { studentId: string };

  // Verify student is in this teacher's studio
  const { data: studentProfile } = await admin
    .from('profiles')
    .select('studio_id')
    .eq('id', studentId)
    .single();

  if (!studentProfile || studentProfile.studio_id !== studio.id) {
    return NextResponse.json({ error: 'Student not in your studio' }, { status: 403 });
  }

  // Get all push subscriptions for this student
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('user_id', studentId);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const payload = JSON.stringify({
    title: 'Time to practice! 🎵',
    body: `${teacherProfile.display_name} is cheering you on — open Cadenza and practice today!`,
    url: '/student',
  });

  let sent = 0;
  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload);
      sent++;
    } catch (err) {
      // Remove expired or invalid subscriptions
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
