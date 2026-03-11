import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/studio/invite-teacher
 * Director invites a teacher (by email) to their studio as a co-teacher.
 * The teacher must already have a Cadenza account with role='teacher'.
 * Body: { studioId, email }
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { studioId, email } = await request.json() as { studioId: string; email: string };
  if (!studioId || !email?.trim()) {
    return NextResponse.json({ error: 'studioId and email are required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify requester is a director of this studio
  const { data: membership } = await admin
    .from('studio_teachers')
    .select('role')
    .eq('studio_id', studioId)
    .eq('teacher_id', user.id)
    .maybeSingle();

  if (membership?.role !== 'director') {
    return NextResponse.json({ error: 'Only directors can invite teachers' }, { status: 403 });
  }

  // Look up user by email via auth.users (admin only)
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const targetAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

  if (!targetAuthUser) {
    return NextResponse.json({
      error: 'No Cadenza account found with that email. Ask them to sign up first.',
    }, { status: 404 });
  }

  // Verify they have the teacher role
  const { data: profile } = await admin
    .from('profiles')
    .select('role, display_name')
    .eq('id', targetAuthUser.id)
    .maybeSingle();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({
      error: 'That user is not registered as a teacher in Cadenza.',
    }, { status: 400 });
  }

  // Don't add someone already in the studio
  const { data: existing } = await admin
    .from('studio_teachers')
    .select('id, role')
    .eq('studio_id', studioId)
    .eq('teacher_id', targetAuthUser.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: `${profile.display_name} is already a ${existing.role} in this studio.`,
    }, { status: 409 });
  }

  const { data, error } = await admin
    .from('studio_teachers')
    .insert({
      studio_id: studioId,
      teacher_id: targetAuthUser.id,
      role: 'teacher',
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ membership: data, teacherName: profile.display_name });
}

/**
 * DELETE /api/studio/invite-teacher
 * Director removes a co-teacher from their studio.
 * Body: { studioId, teacherId }
 */
export async function DELETE(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { studioId, teacherId } = await request.json() as { studioId: string; teacherId: string };

  const admin = getSupabaseAdminClient();

  const { data: membership } = await admin
    .from('studio_teachers')
    .select('role')
    .eq('studio_id', studioId)
    .eq('teacher_id', user.id)
    .maybeSingle();

  if (membership?.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cannot remove yourself (director)
  if (teacherId === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself as director' }, { status: 400 });
  }

  await admin
    .from('studio_teachers')
    .delete()
    .eq('studio_id', studioId)
    .eq('teacher_id', teacherId);

  return NextResponse.json({ ok: true });
}
