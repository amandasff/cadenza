import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/invoices?studioId=xxx[&status=xxx]
 * Returns invoices with student names for the teacher's studio.
 */
export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const studioId = searchParams.get('studioId');
  const status = searchParams.get('status');
  if (!studioId) return NextResponse.json({ error: 'studioId required' }, { status: 400 });

  const admin = getSupabaseAdminClient();

  let query = admin
    .from('invoices')
    .select('*')
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data: invoices, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoices?.length) return NextResponse.json({ invoices: [] });

  // Enrich with student names
  const studentIds = [...new Set(invoices.map((i: { student_id: string }) => i.student_id))];
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', studentIds);

  const nameMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    nameMap[(p as { id: string }).id] = (p as { display_name: string }).display_name;
  }

  const enriched = invoices.map((inv: Record<string, unknown>) => ({
    ...inv,
    student_name: nameMap[inv.student_id as string] ?? 'Unknown',
  }));

  return NextResponse.json({ invoices: enriched });
}

/**
 * POST /api/invoices
 * Create a new invoice with optional line items.
 * Body: { studioId, studentId, dueDate?, description?, notes?, lineItems: [{description, quantity, unitPriceCents}] }
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    studioId: string;
    studentId: string;
    dueDate?: string;
    description?: string;
    notes?: string;
    lineItems: { description: string; quantity: number; unitPriceCents: number }[];
  };

  if (!body.studioId || !body.studentId || !body.lineItems?.length) {
    return NextResponse.json({ error: 'studioId, studentId, and lineItems are required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Generate invoice number: count existing + 1
  const { count } = await admin
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', body.studioId);

  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(3, '0')}`;

  const totalCents = body.lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0
  );

  const { data: invoice, error: invError } = await admin
    .from('invoices')
    .insert({
      studio_id: body.studioId,
      student_id: body.studentId,
      teacher_id: user.id,
      invoice_number: invoiceNumber,
      description: body.description?.trim() ?? null,
      amount_cents: totalCents,
      due_date: body.dueDate ?? null,
      notes: body.notes?.trim() ?? null,
      status: 'draft',
    })
    .select()
    .single();

  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });

  // Insert line items
  const lineItemRows = body.lineItems.map(item => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price_cents: item.unitPriceCents,
    total_cents: Math.round(item.quantity * item.unitPriceCents),
  }));

  await admin.from('invoice_line_items').insert(lineItemRows);

  return NextResponse.json({ invoice }, { status: 201 });
}
