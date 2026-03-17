import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { PracticeSegment } from '@/lib/types';

interface LogSessionBody {
  studioId: string;
  goalId?: string;
  pieceId?: string;
  durationSeconds: number;
  notes?: string;
  segments?: PracticeSegment[];
  recordingUrl?: string;
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as LogSessionBody;
  const admin = getSupabaseAdminClient();

  // Insert the practice session
  const { data: session, error: sessionError } = await admin
    .from('practice_sessions')
    .insert({
      student_id: user.id,
      studio_id: body.studioId,
      goal_id: body.goalId ?? null,
      piece_id: body.pieceId ?? null,
      duration_seconds: body.durationSeconds,
      notes: body.notes ?? null,
      segments_json: body.segments ?? null,
      recording_url: body.recordingUrl ?? null,
    })
    .select()
    .single();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  // UTC date helpers — Vercel servers run UTC, so use UTC methods to stay
  // consistent with the live-streak computation in AuthService.fetchUser().
  function toUTCDateStr(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const now = new Date();
  const todayStr = toUTCDateStr(now);
  const yesterdayStr = toUTCDateStr(new Date(now.getTime() - 86_400_000));

  // Most recent session before this one
  const { data: prevSessions } = await admin
    .from('practice_sessions')
    .select('created_at')
    .eq('student_id', user.id)
    .neq('id', session.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const lastDate = prevSessions?.[0]?.created_at
    ? toUTCDateStr(new Date(prevSessions[0].created_at))
    : null;

  // Fetch current profile
  const { data: profile, error: profileFetchError } = await admin
    .from('profiles')
    .select('streak_days, total_points, streak_freeze_count')
    .eq('id', user.id)
    .single();

  if (profileFetchError) return NextResponse.json({ error: profileFetchError.message }, { status: 500 });

  const current = profile as { streak_days: number; total_points: number; streak_freeze_count: number };
  const twoDaysAgoStr = toUTCDateStr(new Date(now.getTime() - 2 * 86_400_000));

  // Streak calculation — freeze protects exactly one missed day
  let newStreak: number;
  let consumeFreeze = false;
  if (lastDate === null) {
    newStreak = 1;
  } else if (lastDate === todayStr) {
    newStreak = current.streak_days;
  } else if (lastDate === yesterdayStr) {
    newStreak = current.streak_days + 1;
  } else if (lastDate === twoDaysAgoStr && (current.streak_freeze_count ?? 0) > 0) {
    // Missed exactly one day but has a freeze — streak continues
    newStreak = current.streak_days + 1;
    consumeFreeze = true;
  } else {
    newStreak = 1;
  }

  // Points calculation
  const isFirstSessionToday = lastDate !== todayStr;
  const sessionBonus = isFirstSessionToday ? 100 : 0;
  const weekStreakBonus = (newStreak > 0 && newStreak % 7 === 0) ? 500 : 0;
  const pointsEarned = sessionBonus + weekStreakBonus;

  // Update profile
  const updates: Record<string, number> = {};
  if (newStreak !== current.streak_days) updates.streak_days = newStreak;
  if (pointsEarned > 0) updates.total_points = current.total_points + pointsEarned;
  if (consumeFreeze) updates.streak_freeze_count = Math.max(0, (current.streak_freeze_count ?? 0) - 1);

  if (Object.keys(updates).length > 0) {
    await admin.from('profiles').update(updates).eq('id', user.id);
  }

  return NextResponse.json({
    session,
    pointsEarned,
    newStreak,
    totalPoints: current.total_points + pointsEarned,
  });
}
