import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/contacts?studioId=xxx[&studentId=xxx]
 */
export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const studioId = searchParams.get('studioId');
  const studentId = searchParams.get('studentId');
  if (!studioId) return NextResponse.json({ error: 'studioId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  let query = admin
    .from('student_contacts')
    .select('*')
    .eq('studio_id', studioId)
    .order('is_primary', { ascending: false })
    .order('name');

  if (studentId) query = query.eq('student_id', studentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}

/**
 * POST /api/contacts
 * Body: { studioId, studentId, name, email?, phone?, relationship?, isPrimary?, notes? }
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    studioId: string;
    studentId: string;
    name: string;
    email?: string;
    phone?: string;
    relationship?: string;
    isPrimary?: boolean;
    notes?: string;
  };

  if (!body.studioId || !body.studentId || !body.name?.trim()) {
    return NextResponse.json({ error: 'studioId, studentId, and name are required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // If marking as primary, unset other primaries for this student
  if (body.isPrimary) {
    await admin
      .from('student_contacts')
      .update({ is_primary: false })
      .eq('student_id', body.studentId);
  }

  const { data, error } = await admin
    .from('student_contacts')
    .insert({
      studio_id: body.studioId,
      student_id: body.studentId,
      name: body.name.trim(),
      email: body.email?.trim().toLowerCase() ?? null,
      phone: body.phone?.trim() ?? null,
      relationship: body.relationship ?? 'parent',
      is_primary: body.isPrimary ?? false,
      notes: body.notes?.trim() ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 201 });
}
