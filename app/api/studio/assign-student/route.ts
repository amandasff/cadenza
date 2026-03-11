import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/studio/assign-student
 * Director reassigns a student to a different teacher.
 * Ends the current active assignment and creates a new one.
 * Body: { studioId, studentId, newTeacherId }
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { studioId, studentId, newTeacherId } = await request.json() as {
    studioId: string;
    studentId: string;
    newTeacherId: string;
  };

  if (!studioId || !studentId || !newTeacherId) {
    return NextResponse.json({ error: 'studioId, studentId, and newTeacherId are required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify requester is a director
  const { data: membership } = await admin
    .from('studio_teachers')
    .select('role')
    .eq('studio_id', studioId)
    .eq('teacher_id', user.id)
    .maybeSingle();

  if (membership?.role !== 'director') {
    return NextResponse.json({ error: 'Only directors can reassign students' }, { status: 403 });
  }

  // Verify new teacher is in this studio
  const { data: newTeacherMembership } = await admin
    .from('studio_teachers')
    .select('teacher_id')
    .eq('studio_id', studioId)
    .eq('teacher_id', newTeacherId)
    .maybeSingle();

  if (!newTeacherMembership) {
    return NextResponse.json({ error: 'New teacher is not in this studio' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // End all current active assignments for this student in this studio
  await admin
    .from('teacher_student_assignments')
    .update({ ended_at: now })
    .eq('studio_id', studioId)
    .eq('student_id', studentId)
    .is('ended_at', null);

  // Create new assignment
  const { data, error } = await admin
    .from('teacher_student_assignments')
    .insert({
      studio_id: studioId,
      teacher_id: newTeacherId,
      student_id: studentId,
      started_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}
