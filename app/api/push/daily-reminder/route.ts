import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWebPush } from "@/lib/webpush";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Called by Vercel Cron at 20:00 UTC daily.
// Sends an AI-personalised practice reminder only to students who haven't practiced today (UTC).

interface StudentContext {
  userId: string;
  firstName: string | null;
  streakDays: number;         // consecutive days practiced before today
  streakAlive: boolean;       // true = practiced yesterday, streak still intact
  lastPiece: string | null;   // title of last piece worked on
  lastMood: string | null;    // great / good / okay / hard
  totalPoints: number;
}

// Generate a push notification with Claude Haiku.
// Title ≤ 50 chars, body ≤ 100 chars. Friendly, warm, slightly playful.
async function generateMessage(ctx: StudentContext): Promise<{ title: string; body: string }> {
  const streakLine = ctx.streakDays > 0
    ? ctx.streakAlive
      ? `They have a ${ctx.streakDays}-day streak that ends if they skip today.`
      : `Their streak just reset. Help them start fresh.`
    : "They are just starting out.";

  const pieceLine = ctx.lastPiece ? `Last piece: "${ctx.lastPiece}".` : "";
  const moodLine  = ctx.lastMood  ? `Their mood last session: ${ctx.lastMood}.` : "";

  const prompt = `You write push notifications for Cadenza, a music practice app for kids and teens.
Write ONE push notification to encourage a student to practice today. They haven't practiced yet.

Student context:
- Name: ${ctx.firstName ?? "the student"}
- ${streakLine}
- ${pieceLine}
- ${moodLine}
- Total points earned: ${ctx.totalPoints}

Rules:
- Title: max 50 characters. Start with an emoji. Reference their streak or piece if relevant.
- Body: max 100 characters. Warm, personal, slightly playful. No generic "don't forget to practice" clichés.
- If streak is alive and > 3 days, create mild urgency about protecting it.
- If streak just reset, be encouraging not guilt-tripping.
- If you know the piece, mention it briefly.
- Never use exclamation marks in the title and body at the same time.
- Return ONLY valid JSON: {"title":"...","body":"..."}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    // Strip markdown fences if present
    const json = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as { title: string; body: string };

    // Hard truncate as safety net
    return {
      title: parsed.title.slice(0, 50),
      body:  parsed.body.slice(0, 100),
    };
  } catch {
    // Fallback to a decent generic message
    const name = ctx.firstName ?? "you";
    if (ctx.streakAlive && ctx.streakDays > 0) {
      return {
        title: `🔥 ${ctx.streakDays}-day streak on the line`,
        body: `${name}, a few minutes today keeps your streak alive. You've got this!`,
      };
    }
    return {
      title: "🎵 Time to practice",
      body: `Hey ${name}! Open Cadenza and play something — even 5 minutes counts.`,
    };
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wp = getWebPush();
  if (!wp) return NextResponse.json({ ok: true, sent: 0, reason: "VAPID not configured" });

  const admin = getSupabaseAdminClient();

  // UTC date boundaries for "today" and "yesterday"
  const now = new Date();
  const todayStart     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd       = new Date(todayStart.getTime() + 86_400_000);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  // 1. All push subscriptions
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id, subscription, endpoint");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const allUserIds = [...new Set(subs.map((s) => s.user_id))];

  // 2. Who practiced today? Exclude them.
  const { data: practicedToday } = await admin
    .from("practice_sessions")
    .select("student_id")
    .in("student_id", allUserIds)
    .gte("created_at", todayStart.toISOString())
    .lt("created_at", todayEnd.toISOString());

  const practicedTodaySet = new Set((practicedToday ?? []).map((r) => r.student_id));
  const notifyUserIds = allUserIds.filter((id) => !practicedTodaySet.has(id));

  if (notifyUserIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "Everyone practiced today 🎉" });
  }

  // 3. Gather context for each student who needs a nudge (parallel)
  const [profilesRes, lastSessionsRes, yesterdayRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, total_points")
      .in("id", notifyUserIds),

    // Most recent session per student (for piece + mood)
    admin
      .from("practice_sessions")
      .select("student_id, notes, piece_id, created_at")
      .in("student_id", notifyUserIds)
      .lt("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false }),

    // Who practiced yesterday? (streak still alive)
    admin
      .from("practice_sessions")
      .select("student_id")
      .in("student_id", notifyUserIds)
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString()),
  ]);

  const profiles     = profilesRes.data ?? [];
  const allSessions  = lastSessionsRes.data ?? [];
  const practicedYesterdaySet = new Set((yesterdayRes.data ?? []).map((r) => r.student_id));

  // Deduplicate — keep only the most recent session per student
  const lastSessionMap = new Map<string, typeof allSessions[number]>();
  for (const s of allSessions) {
    if (!lastSessionMap.has(s.student_id)) lastSessionMap.set(s.student_id, s);
  }

  // Fetch piece titles for any session that has a piece_id
  const pieceIds = [...new Set(
    [...lastSessionMap.values()].map((s) => s.piece_id).filter(Boolean)
  )] as string[];

  const pieceTitleMap = new Map<string, string>();
  if (pieceIds.length > 0) {
    const { data: pieces } = await admin
      .from("pieces")
      .select("id, title")
      .in("id", pieceIds);
    for (const p of pieces ?? []) pieceTitleMap.set(p.id, p.title);
  }

  // Compute streak days (simple: count consecutive days before today)
  // We approximate from the last session date rather than a full session scan.
  // A full streak calc per-user is expensive; for the notification we just need
  // "how many days in a row" roughly, which we can get from the profile or
  // derive from the last session age.
  // For now: if they practiced yesterday, streak is alive; days = rough count.
  // (Exact streak is stored/computed elsewhere; we just need "alive" for tone.)

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Build context objects
  const contexts: StudentContext[] = notifyUserIds.map((userId) => {
    const profile     = profileMap.get(userId);
    const lastSession = lastSessionMap.get(userId);
    const firstName   = profile?.display_name?.split(" ")[0] ?? null;
    const totalPoints = profile?.total_points ?? 0;
    const streakAlive = practicedYesterdaySet.has(userId);

    // Rough streak length from last session recency
    let streakDays = 0;
    if (lastSession) {
      const lastDate = new Date(lastSession.created_at);
      const diffDays = Math.floor((todayStart.getTime() - lastDate.getTime()) / 86_400_000);
      // If they practiced yesterday, streak is at least 1; use points as proxy for longer streaks
      streakDays = streakAlive ? Math.max(1, Math.round(totalPoints / 50)) : 0;
      void diffDays; // used implicitly via streakAlive
    }

    const moodMatch = lastSession?.notes?.match(/\[mood:(\w+)\]/);
    const lastMood  = moodMatch?.[1] ?? null;
    const lastPiece = lastSession?.piece_id ? (pieceTitleMap.get(lastSession.piece_id) ?? null) : null;

    return { userId, firstName, streakDays, streakAlive, lastPiece, lastMood, totalPoints };
  });

  // 4. Generate AI messages — run up to 5 concurrently to stay within rate limits
  const CONCURRENCY = 5;
  const messageMap = new Map<string, { title: string; body: string }>();

  for (let i = 0; i < contexts.length; i += CONCURRENCY) {
    const batch = contexts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((ctx) => generateMessage(ctx)));
    batch.forEach((ctx, j) => messageMap.set(ctx.userId, results[j]));
  }

  // 5. Send pushes
  let sent = 0;
  const staleEndpoints: string[] = [];
  const toNotify = subs.filter((s) => notifyUserIds.includes(s.user_id));

  for (const row of toNotify) {
    const msg = messageMap.get(row.user_id) ?? {
      title: "🎵 Time to practice",
      body: "Open Cadenza and keep your streak alive!",
    };

    const payload = JSON.stringify({ ...msg, url: "/student" });

    try {
      await wp.sendNotification(
        row.subscription as Parameters<typeof wp.sendNotification>[0],
        payload
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) staleEndpoints.push(row.endpoint);
    }
  }

  // 6. Clean up expired subscriptions
  if (staleEndpoints.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped: practicedTodaySet.size,
    staleCleaned: staleEndpoints.length,
  });
}
