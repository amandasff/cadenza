import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/streak/sync
 *
 * Computes the live streak from practice_sessions and writes it back to
 * profiles.streak_days so that every consumer (leaderboard, public profile,
 * studio pages, teacher dashboard) sees the correct value.
 *
 * Called fire-and-forget on every app load from AuthContext.
 */
export async function POST() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  const [{ data: profile }, { data: lastSession }] = await Promise.all([
    admin.from('profiles').select('streak_days, streak_freeze_count').eq('id', user.id).single(),
    admin
      .from('practice_sessions')
      .select('created_at')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const stored = profile.streak_days as number;
  const freezeCount = (profile.streak_freeze_count as number) ?? 0;

  // Compute the live streak
  let liveStreak = stored;

  if (stored > 0) {
    const lastAt = lastSession?.created_at ?? null;
    if (!lastAt) {
      liveStreak = 0;
    } else {
      const toUTCDateStr = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const now = new Date();
      const todayUTC = toUTCDateStr(now);
      const yesterdayUTC = toUTCDateStr(new Date(now.getTime() - 86_400_000));
      const lastUTC = toUTCDateStr(new Date(lastAt));

      if (lastUTC !== todayUTC && lastUTC !== yesterdayUTC) {
        const lastMs = new Date(lastUTC + 'T00:00:00Z').getTime();
        const todayMs = new Date(todayUTC + 'T00:00:00Z').getTime();
        const gapDays = Math.round((todayMs - lastMs) / 86_400_000);
        const missedDays = gapDays - 1;
        const hasFreezeProtection = missedDays >= 1 && missedDays <= freezeCount;
        if (!hasFreezeProtection) {
          liveStreak = 0;
        }
      }
    }
  }

  // Write back only if changed
  if (liveStreak !== stored) {
    await admin.from('profiles').update({ streak_days: liveStreak }).eq('id', user.id);
  }

  return NextResponse.json({ streak_days: liveStreak, synced: liveStreak !== stored });
}
