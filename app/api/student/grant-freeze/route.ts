import { getSupabaseServerClient } from '../../../../lib/supabase/server';
import { getSupabaseAdminClient } from '../../../../lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { studentId } = await request.json() as { studentId: string };
  if (!studentId) return Response.json({ error: 'studentId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();

  // Verify the caller is a teacher in the student's studio
  const { data: studentProfile } = await admin
    .from('profiles')
    .select('studio_id')
    .eq('id', studentId)
    .single();

  if (!studentProfile?.studio_id) {
    return Response.json({ error: 'Student not found' }, { status: 404 });
  }

  // Teacher must own or belong to the student's studio
  const [{ data: ownedStudio }, { data: teacherRole }] = await Promise.all([
    admin.from('studios').select('id').eq('id', studentProfile.studio_id).eq('owner_id', user.id).single(),
    admin.from('studio_teachers').select('id').eq('studio_id', studentProfile.studio_id).eq('teacher_id', user.id).single(),
  ]);

  if (!ownedStudio && !teacherRole) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Increment freeze count
  const { data: current } = await admin
    .from('profiles')
    .select('streak_freeze_count')
    .eq('id', studentId)
    .single();

  const currentCount = (current as { streak_freeze_count?: number } | null)?.streak_freeze_count ?? 0;

  await admin
    .from('profiles')
    .update({ streak_freeze_count: currentCount + 1 })
    .eq('id', studentId);

  return Response.json({ ok: true, newCount: currentCount + 1 });
}
