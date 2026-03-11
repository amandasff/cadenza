import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/studio/public?slug=xxx
 * Returns public studio info for the enrollment form (no auth required).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const admin = getSupabaseAdminClient();

  const { data: studio } = await admin
    .from('studios')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!studio) return NextResponse.json({ error: 'Studio not found' }, { status: 404 });

  // Get teachers in this studio for preference dropdown
  const { data: teachers } = await admin
    .from('studio_teachers')
    .select('teacher_id, role')
    .eq('studio_id', studio.id);

  const teacherIds = (teachers ?? []).map((t: { teacher_id: string }) => t.teacher_id);

  let teacherList: { id: string; display_name: string }[] = [];
  if (teacherIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name')
      .in('id', teacherIds);
    teacherList = (profiles ?? []) as { id: string; display_name: string }[];
  }

  return NextResponse.json({
    studio: { id: studio.id, name: studio.name, slug: studio.slug },
    teachers: teacherList,
  });
}
