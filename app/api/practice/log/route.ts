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
  isPrivate?: boolean;
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
      is_private: body.isPrivate ?? false,
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
    .select('streak_days, total_points, streak_freeze_count, total_days_practiced')
    .eq('id', user.id)
    .single();

  if (profileFetchError) return NextResponse.json({ error: profileFetchError.message }, { status: 500 });

  const current = profile as { streak_days: number; total_points: number; streak_freeze_count: number; total_days_practiced: number };
  // Compute gap in days between last session date and today
  const lastDateMs = lastDate ? new Date(lastDate + 'T00:00:00Z').getTime() : null;
  const todayMs = new Date(todayStr + 'T00:00:00Z').getTime();
  const gapDays = lastDateMs !== null ? Math.round((todayMs - lastDateMs) / 86_400_000) : null;
  // missedDays = days with no session between lastDate and today (gap=1 → practiced yesterday, 0 missed)
  const missedDays = gapDays !== null ? gapDays - 1 : null;
  const availableFreezes = current.streak_freeze_count ?? 0;

  // Streak calculation — each freeze protects one missed day
  let newStreak: number;
  let freezesConsumed = 0;
  if (gapDays === null) {
    newStreak = 1;
  } else if (gapDays === 0) {
    // Already practiced today — no change
    newStreak = current.streak_days;
  } else if (gapDays === 1) {
    // Practiced yesterday — streak continues
    newStreak = current.streak_days + 1;
  } else if (missedDays! <= availableFreezes && availableFreezes > 0) {
    // Freeze(s) cover all missed days — streak continues, consume one freeze per missed day
    newStreak = current.streak_days + 1;
    freezesConsumed = missedDays!;
  } else {
    newStreak = 1;
  }

  // Points calculation
  const isFirstSessionToday = gapDays !== 0;
  const sessionBonus = isFirstSessionToday ? 100 : 0;
  const weekStreakBonus = (newStreak > 0 && newStreak % 7 === 0) ? 500 : 0;
  const pointsEarned = sessionBonus + weekStreakBonus;

  // Update profile
  const updates: Record<string, number> = {};
  if (newStreak !== current.streak_days) updates.streak_days = newStreak;
  if (pointsEarned > 0) updates.total_points = current.total_points + pointsEarned;
  if (freezesConsumed > 0) updates.streak_freeze_count = Math.max(0, availableFreezes - freezesConsumed);
  if (isFirstSessionToday) updates.total_days_practiced = (current.total_days_practiced ?? 0) + 1;

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
