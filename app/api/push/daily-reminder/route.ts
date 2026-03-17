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
  age: number | null;           // computed from birth_year
  instrument: string | null;
  gender: string | null;        // 'boy' | 'girl' | null
  streakDays: number;
  streakAlive: boolean;         // practiced yesterday → streak still intact
  lastPiece: string | null;
  lastMood: string | null;      // great / good / okay / hard
  totalPoints: number;
}

// Push notification char limits
const TITLE_MAX = 50;
const BODY_MAX  = 100;

async function generateMessage(ctx: StudentContext): Promise<{ title: string; body: string }> {
  const ageLine = ctx.age
    ? `Age: ${ctx.age}.`
    : "";

  const instrumentLine = ctx.instrument
    ? `Instrument: ${ctx.instrument}.`
    : "";

  const genderLine = ctx.gender
    ? `Gender: ${ctx.gender}. Use appropriate pronouns and tone.`
    : "Gender unknown — use gender-neutral language.";

  const streakLine = ctx.streakDays > 0
    ? ctx.streakAlive
      ? `Active ${ctx.streakDays}-day streak — it ends if they skip today.`
      : `Streak just reset — encourage a fresh start.`
    : "New student, no streak yet.";

  const pieceLine = ctx.lastPiece ? `Last piece worked on: "${ctx.lastPiece}".` : "";
  const moodLine  = ctx.lastMood
    ? `Mood last session: ${ctx.lastMood}. ${ctx.lastMood === "hard" ? "Be extra encouraging." : ""}`
    : "";

  const prompt = `You write push notifications for Cadenza, a music practice app for students.
Generate ONE push notification to nudge a student who hasn't practiced yet today.

Student context:
- Name: ${ctx.firstName ?? "the student"}
- ${ageLine}
- ${instrumentLine}
- ${genderLine}
- ${streakLine}
- ${pieceLine}
- ${moodLine}
- Total points earned: ${ctx.totalPoints}

Tone guidelines by age:
- Under 10: super playful, simple words, animal/game analogies, lots of energy
- 10-13: fun and cool, light humour, gaming references okay, not too babyish
- 14-18: more casual and peer-like, maybe a little witty or self-aware, never cringe
- Unknown age: warm and friendly, moderate fun

Instrument ideas (use sparingly, only if it adds colour):
- Guitar/Bass: "riff", "strings", "shred"
- Piano: "keys", "notes waiting", "fingers"
- Violin/Viola/Cello: "bow", "strings"
- Ukulele: keep it breezy and cheerful
- Voice: "warm up those vocals", "your voice"
- Drums: "beat", "groove", "sticks"

Rules:
- Title: max ${TITLE_MAX} chars. Start with a relevant emoji.
- Body: max ${BODY_MAX} chars. One punchy sentence. No filler phrases like "don't forget" or "remember to".
- If streak is alive and ≥ 3 days, create mild urgency about protecting it — but make it fun, not guilt-tripping.
- You can make a very short music joke or pun if it fits the age and instrument — but keep it groan-worthy-good, not forced.
- If mood was "hard" last time, be warm and supportive.
- Never use exclamation marks in both title and body.
- Return ONLY valid JSON with no markdown: {"title":"...","body":"..."}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const raw  = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as { title: string; body: string };

    return {
      title: parsed.title.slice(0, TITLE_MAX),
      body:  parsed.body.slice(0, BODY_MAX),
    };
  } catch {
    // Fallback — decent generic message using what we know
    const name = ctx.firstName ?? "you";
    if (ctx.streakAlive && ctx.streakDays >= 3) {
      return {
        title: `🔥 ${ctx.streakDays}-day streak on the line`,
        body:  `${name}, a few minutes today keeps the streak alive. You've got this!`,
      };
    }
    if (ctx.instrument) {
      return {
        title: `🎵 Time to pick up the ${ctx.instrument.toLowerCase()}`,
        body:  `Hey ${name} — even a short session counts. Let's go!`,
      };
    }
    return {
      title: "🎵 Time to practice",
      body:  `Hey ${name}! Open Cadenza and play something — even 5 minutes counts.`,
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

  const now            = new Date();
  const currentYear    = now.getUTCFullYear();
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

  // 2. Exclude students who already practiced today
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

  // 3. Fetch all context in parallel
  const [profilesRes, lastSessionsRes, yesterdayRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, total_points, instrument, birth_year, gender")
      .in("id", notifyUserIds),

    admin
      .from("practice_sessions")
      .select("student_id, notes, piece_id, created_at")
      .in("student_id", notifyUserIds)
      .lt("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false }),

    admin
      .from("practice_sessions")
      .select("student_id")
      .in("student_id", notifyUserIds)
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString()),
  ]);

  const profiles    = profilesRes.data ?? [];
  const allSessions = lastSessionsRes.data ?? [];
  const practicedYesterdaySet = new Set((yesterdayRes.data ?? []).map((r) => r.student_id));

  // Most recent session per student
  const lastSessionMap = new Map<string, typeof allSessions[number]>();
  for (const s of allSessions) {
    if (!lastSessionMap.has(s.student_id)) lastSessionMap.set(s.student_id, s);
  }

  // Fetch piece titles
  const pieceIds = [...new Set(
    [...lastSessionMap.values()].map((s) => s.piece_id).filter(Boolean),
  )] as string[];

  const pieceTitleMap = new Map<string, string>();
  if (pieceIds.length > 0) {
    const { data: pieces } = await admin.from("pieces").select("id, title").in("id", pieceIds);
    for (const p of pieces ?? []) pieceTitleMap.set(p.id, p.title);
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const contexts: StudentContext[] = notifyUserIds.map((userId) => {
    const profile     = profileMap.get(userId);
    const lastSession = lastSessionMap.get(userId);
    const firstName   = profile?.display_name?.split(" ")[0] ?? null;
    const totalPoints = profile?.total_points ?? 0;
    const streakAlive = practicedYesterdaySet.has(userId);
    const streakDays  = streakAlive ? Math.max(1, Math.round(totalPoints / 50)) : 0;
    const age         = profile?.birth_year ? currentYear - profile.birth_year : null;
    const moodMatch   = lastSession?.notes?.match(/\[mood:(\w+)\]/);

    return {
      userId,
      firstName,
      age,
      instrument: profile?.instrument ?? null,
      gender:     profile?.gender ?? null,
      streakDays,
      streakAlive,
      lastPiece:  lastSession?.piece_id ? (pieceTitleMap.get(lastSession.piece_id) ?? null) : null,
      lastMood:   moodMatch?.[1] ?? null,
      totalPoints,
    };
  });

  // 4. Generate AI messages — 5 concurrent to stay within rate limits
  const CONCURRENCY = 5;
  const messageMap = new Map<string, { title: string; body: string }>();

  for (let i = 0; i < contexts.length; i += CONCURRENCY) {
    const batch   = contexts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((ctx) => generateMessage(ctx)));
    batch.forEach((ctx, j) => messageMap.set(ctx.userId, results[j]));
  }

  // 5. Send
  let sent = 0;
  const staleEndpoints: string[] = [];
  const toNotify = subs.filter((s) => notifyUserIds.includes(s.user_id));

  for (const row of toNotify) {
    const msg = messageMap.get(row.user_id) ?? {
      title: "🎵 Time to practice",
      body:  "Open Cadenza and keep your streak alive!",
    };

    const payload = JSON.stringify({ ...msg, url: "/student" });

    try {
      await wp.sendNotification(
        row.subscription as Parameters<typeof wp.sendNotification>[0],
        payload,
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) staleEndpoints.push(row.endpoint);
    }
  }

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
