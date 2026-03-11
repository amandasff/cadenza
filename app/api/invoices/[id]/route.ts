import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/invoices/[id]  — invoice with line items
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: lineItems } = await admin
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('created_at');

  return NextResponse.json({ invoice: { ...invoice, line_items: lineItems ?? [] } });
}

/**
 * PATCH /api/invoices/[id]
 * Update status, paid_at, notes, due_date.
 * Body: { status?, paidAt?, notes?, dueDate? }
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
    status?: string;
    paidAt?: string;
    notes?: string;
    dueDate?: string;
  };

  const admin = getSupabaseAdminClient();

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.paidAt !== undefined) updates.paid_at = body.paidAt;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.dueDate !== undefined) updates.due_date = body.dueDate;

  // Auto-set paid_at when marking as paid
  if (body.status === 'paid' && !body.paidAt) {
    updates.paid_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

/**
 * DELETE /api/invoices/[id]  — void (soft delete via status)
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
  await admin.from('invoices').update({ status: 'void' }).eq('id', id);
  return NextResponse.json({ ok: true });
}
