import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/lessons/[id]/attendance
 * Body: { attendanceStatus: 'present' | 'absent' | 'late' | 'cancelled' | 'makeup' }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { attendanceStatus } = await request.json() as { attendanceStatus: string };
  const valid = ['present', 'absent', 'late', 'cancelled', 'makeup'];
  if (!valid.includes(attendanceStatus)) {
    return NextResponse.json({ error: 'Invalid attendance status' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('lessons')
    .update({ attendance_status: attendanceStatus })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson: data });
}
