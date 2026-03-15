import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillingConfigRow, TuitionRecordRow, BillingChargeRow, PaymentMethod } from '../types';

export class BillingService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): BillingService {
    return new BillingService(supabase);
  }

  async getConfig(studentId: string, teacherId: string): Promise<BillingConfigRow | null> {
    const { data } = await this.supabase
      .from('billing_configs')
      .select()
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .maybeSingle();
    return data as BillingConfigRow | null;
  }

  async upsertConfig(input: {
    studioId: string;
    studentId: string | null;
    externalStudentId?: string | null;
    teacherId: string;
    monthlyRateCents: number;
    billingDay?: number;
    notes?: string;
  }): Promise<BillingConfigRow> {
    const { data, error } = await this.supabase
      .from('billing_configs')
      .upsert({
        studio_id: input.studioId,
        student_id: input.studentId,
        external_student_id: input.externalStudentId ?? null,
        teacher_id: input.teacherId,
        monthly_rate_cents: input.monthlyRateCents,
        billing_day: input.billingDay ?? 1,
        notes: input.notes ?? null,
      }, { onConflict: 'studio_id,student_id' })
      .select()
      .single();
    if (error) throw error;
    return data as BillingConfigRow;
  }

  async getRecords(studentId: string, teacherId: string, months = 12): Promise<TuitionRecordRow[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const { data, error } = await this.supabase
      .from('tuition_records')
      .select()
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .gte('period_month', since.toISOString().slice(0, 10))
      .order('period_month', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TuitionRecordRow[];
  }

  async getAllRecords(teacherId: string): Promise<TuitionRecordRow[]> {
    const { data, error } = await this.supabase
      .from('tuition_records')
      .select()
      .eq('teacher_id', teacherId)
      .order('period_month', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TuitionRecordRow[];
  }

  async createTuitionRecord(input: {
    billingConfigId: string;
    studioId: string;
    studentId: string | null;
    externalStudentId?: string | null;
    teacherId: string;
    periodMonth: string;   // "YYYY-MM-01"
    amountCents: number;
  }): Promise<TuitionRecordRow> {
    const { data, error } = await this.supabase
      .from('tuition_records')
      .insert({
        billing_config_id: input.billingConfigId,
        studio_id: input.studioId,
        student_id: input.studentId,
        external_student_id: input.externalStudentId ?? null,
        teacher_id: input.teacherId,
        period_month: input.periodMonth,
        amount_cents: input.amountCents,
        status: 'unpaid',
      })
      .select()
      .single();
    if (error) throw error;
    return data as TuitionRecordRow;
  }

  async markTuitionPaid(recordId: string, method: PaymentMethod, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('tuition_records')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: method })
      .eq('id', recordId)
      .eq('teacher_id', teacherId);
    if (error) throw error;
  }

  async markTuitionUnpaid(recordId: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('tuition_records')
      .update({ status: 'unpaid', paid_at: null, payment_method: null })
      .eq('id', recordId)
      .eq('teacher_id', teacherId);
    if (error) throw error;
  }

  async getCharges(studentId: string, teacherId: string): Promise<BillingChargeRow[]> {
    const { data, error } = await this.supabase
      .from('billing_charges')
      .select()
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .order('charge_date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as BillingChargeRow[];
  }

  async addCharge(input: {
    studioId: string;
    studentId: string | null;
    externalStudentId?: string | null;
    teacherId: string;
    description: string;
    amountCents: number;
    chargeDate?: string;
  }): Promise<BillingChargeRow> {
    const { data, error } = await this.supabase
      .from('billing_charges')
      .insert({
        studio_id: input.studioId,
        student_id: input.studentId,
        external_student_id: input.externalStudentId ?? null,
        teacher_id: input.teacherId,
        description: input.description,
        amount_cents: input.amountCents,
        charge_date: input.chargeDate ?? new Date().toISOString().slice(0, 10),
        status: 'unpaid',
      })
      .select()
      .single();
    if (error) throw error;
    return data as BillingChargeRow;
  }

  async markChargePaid(chargeId: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('billing_charges')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', chargeId)
      .eq('teacher_id', teacherId);
    if (error) throw error;
  }

  async getOutstandingBalance(studentId: string, teacherId: string): Promise<number> {
    const [records, charges] = await Promise.all([
      this.getRecords(studentId, teacherId),
      this.getCharges(studentId, teacherId),
    ]);
    const unpaidTuition = records.filter(r => r.status === 'unpaid').reduce((s, r) => s + r.amount_cents, 0);
    const unpaidCharges = charges.filter(c => c.status === 'unpaid').reduce((s, c) => s + c.amount_cents, 0);
    return unpaidTuition + unpaidCharges;
  }

  // Generate the current month's tuition record from billing config
  async generateCurrentMonthRecord(config: BillingConfigRow): Promise<TuitionRecordRow> {
    const now = new Date();
    const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return this.createTuitionRecord({
      billingConfigId: config.id,
      studioId: config.studio_id,
      studentId: config.student_id,
      externalStudentId: config.external_student_id,
      teacherId: config.teacher_id,
      periodMonth,
      amountCents: config.monthly_rate_cents,
    });
  }
}
