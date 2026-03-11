import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/enrollment  — public, no auth required
 * Submit a new enrollment application.
 */
export async function POST(request: Request) {
  const body = await request.json() as {
    studioId: string;
    studentName: string;
    parentName?: string;
    contactEmail: string;
    contactPhone?: string;
    instrument?: string;
    age?: number;
    experienceLevel?: string;
    preferredTeacherId?: string;
    preferredDays?: string[];
    notes?: string;
  };

  const { studioId, studentName, contactEmail } = body;
  if (!studioId || !studentName?.trim() || !contactEmail?.trim()) {
    return NextResponse.json({ error: 'studioId, studentName, and contactEmail are required' }, { status: 400 });
  }

  // Validate email format lightly
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Verify studio exists
  const { data: studio } = await admin.from('studios').select('id').eq('id', studioId).maybeSingle();
  if (!studio) return NextResponse.json({ error: 'Studio not found' }, { status: 404 });

  const { data, error } = await admin
    .from('enrollment_applications')
    .insert({
      studio_id: studioId,
      student_name: studentName.trim(),
      parent_name: body.parentName?.trim() ?? null,
      contact_email: contactEmail.trim().toLowerCase(),
      contact_phone: body.contactPhone?.trim() ?? null,
      instrument: body.instrument?.trim() ?? null,
      age: body.age ?? null,
      experience_level: body.experienceLevel ?? null,
      preferred_teacher_id: body.preferredTeacherId ?? null,
      preferred_days: body.preferredDays ?? null,
      notes: body.notes?.trim() ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data }, { status: 201 });
}

/**
 * GET /api/enrollment?studioId=xxx  — director only
 * List enrollment applications for a studio.
 */
export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const studioId = searchParams.get('studioId');
  const status = searchParams.get('status') ?? undefined;

  if (!studioId) return NextResponse.json({ error: 'studioId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();

  // Verify requester is a director of this studio
  const { data: membership } = await admin
    .from('studio_teachers')
    .select('role')
    .eq('studio_id', studioId)
    .eq('teacher_id', user.id)
    .maybeSingle();

  if (membership?.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let query = admin
    .from('enrollment_applications')
    .select('*')
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ applications: data });
}
