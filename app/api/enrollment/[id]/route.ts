import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/enrollment/[id]  — director only
 * Update an enrollment application status (approve / deny / waitlist).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await request.json() as { status: string };
  if (!['pending', 'approved', 'waitlisted', 'denied'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Fetch application to get studio_id
  const { data: app } = await admin
    .from('enrollment_applications')
    .select('studio_id')
    .eq('id', id)
    .maybeSingle();

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  // Verify requester is a director
  const { data: membership } = await admin
    .from('studio_teachers')
    .select('role')
    .eq('studio_id', app.studio_id)
    .eq('teacher_id', user.id)
    .maybeSingle();

  if (membership?.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('enrollment_applications')
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data });
}
