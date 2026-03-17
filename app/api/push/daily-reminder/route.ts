import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWebPush } from "@/lib/webpush";

// Called by Vercel Cron at 20:00 UTC daily.
// Sends a practice reminder only to students who haven't practiced today (UTC).
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or manually with the secret)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wp = getWebPush();
  if (!wp) return NextResponse.json({ ok: true, sent: 0, reason: "VAPID not configured" });

  const admin = getSupabaseAdminClient();

  // UTC date boundaries for "today"
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd   = new Date(todayStart.getTime() + 86_400_000); // +24h

  // 1. All distinct students who have push subscriptions
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id, subscription, endpoint");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const userIds = [...new Set(subs.map((s) => s.user_id))];

  // 2. Students who HAVE practiced today — we exclude these
  const { data: practicedToday } = await admin
    .from("practice_sessions")
    .select("student_id")
    .in("student_id", userIds)
    .gte("created_at", todayStart.toISOString())
    .lt("created_at", todayEnd.toISOString());

  const practicedSet = new Set((practicedToday ?? []).map((r) => r.student_id));

  // 3. Only notify students who haven't practiced
  const toNotify = subs.filter((s) => !practicedSet.has(s.user_id));

  if (toNotify.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "Everyone practiced today 🎉" });
  }

  // 4. Fetch first names for personalized messages
  const notifyUserIds = [...new Set(toNotify.map((s) => s.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", notifyUserIds);

  const nameMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name?.split(" ")[0] ?? null])
  );

  // 5. Send — one push per subscription
  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const row of toNotify) {
    const firstName = nameMap[row.user_id];
    const body = firstName
      ? `Don't break your streak, ${firstName}! A few minutes of practice goes a long way. 🎵`
      : `Don't break your streak! A few minutes of practice goes a long way. 🎵`;

    const payload = JSON.stringify({
      title: "Practice reminder 🔥",
      body,
      url: "/student",
    });

    try {
      await wp.sendNotification(
        row.subscription as Parameters<typeof wp.sendNotification>[0],
        payload
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        staleEndpoints.push(row.endpoint);
      }
    }
  }

  // 6. Clean up expired subscriptions
  if (staleEndpoints.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped: practicedSet.size,
    staleCleaned: staleEndpoints.length,
  });
}
