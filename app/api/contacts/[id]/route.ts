import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/contacts/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    name?: string;
    email?: string;
    phone?: string;
    relationship?: string;
    isPrimary?: boolean;
    notes?: string;
  };

  const admin = getSupabaseAdminClient();

  // If marking as primary, fetch student_id first and unset others
  if (body.isPrimary) {
    const { data: existing } = await admin
      .from('student_contacts')
      .select('student_id')
      .eq('id', id)
      .single();
    if (existing) {
      await admin
        .from('student_contacts')
        .update({ is_primary: false })
        .eq('student_id', (existing as { student_id: string }).student_id);
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.email !== undefined) updates.email = body.email?.trim().toLowerCase() ?? null;
  if (body.phone !== undefined) updates.phone = body.phone?.trim() ?? null;
  if (body.relationship !== undefined) updates.relationship = body.relationship;
  if (body.isPrimary !== undefined) updates.is_primary = body.isPrimary;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() ?? null;

  const { data, error } = await admin
    .from('student_contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

/**
 * DELETE /api/contacts/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  await admin.from('student_contacts').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
