import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/teacher/excuse-absence
 *
 * Inserts a backdated practice session for a student on a given date,
 * then recomputes and writes the correct streak. This lets teachers
 * restore a streak after an excused absence.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { studentId: string; date: string };
  const { studentId, date } = body;
  if (!studentId || !date) {
    return NextResponse.json({ error: 'studentId and date are required' }, { status: 400 });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify caller is a teacher who owns/belongs to the student's studio
  const [{ data: teacherProfile }, { data: studentProfile }] = await Promise.all([
    admin.from('profiles').select('role, studio_id').eq('id', user.id).single(),
    admin.from('profiles').select('studio_id').eq('id', studentId).single(),
  ]);

  if (!teacherProfile || teacherProfile.role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can excuse absences' }, { status: 403 });
  }

  // Check teacher owns the studio the student belongs to
  const { data: studio } = await admin.from('studios').select('id').eq('owner_id', user.id).single();
  if (!studio || studio.id !== studentProfile?.studio_id) {
    return NextResponse.json({ error: 'Student is not in your studio' }, { status: 403 });
  }

  // Check if the student already has a session on that date
  const dateStart = `${date}T00:00:00Z`;
  const dateEnd = `${date}T23:59:59Z`;
  const { data: existing } = await admin
    .from('practice_sessions')
    .select('id')
    .eq('student_id', studentId)
    .gte('created_at', dateStart)
    .lte('created_at', dateEnd)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Student already has a session on this date' }, { status: 409 });
  }

  // Insert a zero-duration excused session at noon UTC on that date
  const { error: insertError } = await admin
    .from('practice_sessions')
    .insert({
      student_id: studentId,
      studio_id: studentProfile?.studio_id ?? null,
      duration_seconds: 0,
      notes: '[excused absence]',
      created_at: `${date}T12:00:00Z`,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Recompute the streak from scratch
  const { data: sessions } = await admin
    .from('practice_sessions')
    .select('created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  const { data: profile } = await admin
    .from('profiles')
    .select('streak_freeze_count')
    .eq('id', studentId)
    .single();

  const freezeCount = (profile?.streak_freeze_count as number) ?? 0;

  // Walk backwards through session dates to compute the correct streak
  const toUTCDateStr = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  const uniqueDates = [...new Set((sessions ?? []).map((s: { created_at: string }) => toUTCDateStr(new Date(s.created_at))))];
  // uniqueDates is already sorted descending (from the query order)

  const now = new Date();
  const todayUTC = toUTCDateStr(now);
  const yesterdayUTC = toUTCDateStr(new Date(now.getTime() - 86_400_000));

  let newStreak = 0;
  if (uniqueDates.length > 0) {
    const mostRecent = uniqueDates[0];
    if (mostRecent === todayUTC || mostRecent === yesterdayUTC) {
      // Walk back counting consecutive days (allowing freeze gaps)
      newStreak = 1;
      let remainingFreezes = freezeCount;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevMs = new Date(uniqueDates[i - 1] + 'T00:00:00Z').getTime();
        const currMs = new Date(uniqueDates[i] + 'T00:00:00Z').getTime();
        const gap = Math.round((prevMs - currMs) / 86_400_000);
        if (gap === 1) {
          newStreak++;
        } else if (gap - 1 <= remainingFreezes) {
          remainingFreezes -= (gap - 1);
          newStreak++;
        } else {
          break;
        }
      }
    }
  }

  await admin.from('profiles').update({ streak_days: newStreak }).eq('id', studentId);

  return NextResponse.json({ ok: true, streak_days: newStreak });
}
