import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/teacher/set-streak
 *
 * Directly sets a student's streak to a given value. Also ensures there
 * is a practice session for today so the streak sync logic doesn't
 * immediately zero it on the student's next login.
 *
 * The streak continues naturally — if the student practices tomorrow,
 * the practice log route sees gap=1 and increments from this value.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { studentId: string; streak: number };
  const { studentId, streak } = body;

  if (!studentId || streak == null || streak < 0 || !Number.isInteger(streak)) {
    return NextResponse.json({ error: 'studentId and a non-negative integer streak are required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify caller is the teacher who owns the student's studio
  const [{ data: teacherProfile }, { data: studentProfile }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('profiles').select('studio_id').eq('id', studentId).single(),
  ]);

  if (!teacherProfile || teacherProfile.role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can set streaks' }, { status: 403 });
  }

  const { data: studio } = await admin.from('studios').select('id').eq('owner_id', user.id).single();
  if (!studio || studio.id !== studentProfile?.studio_id) {
    return NextResponse.json({ error: 'Student is not in your studio' }, { status: 403 });
  }

  // Set the streak
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ streak_days: streak })
    .eq('id', studentId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Ensure a practice session exists for today so the streak sync won't zero it.
  // If the student already practiced today, skip.
  const toUTCDateStr = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const todayStr = toUTCDateStr(new Date());
  const todayStart = `${todayStr}T00:00:00Z`;
  const todayEnd = `${todayStr}T23:59:59Z`;

  const { data: todaySession } = await admin
    .from('practice_sessions')
    .select('id')
    .eq('student_id', studentId)
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd)
    .limit(1);

  if (!todaySession || todaySession.length === 0) {
    await admin.from('practice_sessions').insert({
      student_id: studentId,
      studio_id: studentProfile?.studio_id ?? null,
      duration_seconds: 0,
      notes: '[streak adjustment]',
    });
  }

  return NextResponse.json({ ok: true, streak_days: streak });
}
