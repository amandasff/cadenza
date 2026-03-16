import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillingConfigRow, TuitionRecordRow, PaymentMethod, LessonType, BillingType, LessonRow } from '../types';

export class BillingService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): BillingService {
    return new BillingService(supabase);
  }

  // ── Config ───────────────────────────────────────────────────

  async getConfig(studentId: string, teacherId: string): Promise<BillingConfigRow | null> {
    const { data } = await this.supabase
      .from('billing_configs')
      .select()
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .maybeSingle();
    return data as BillingConfigRow | null;
  }

  async getConfigByExternal(externalStudentId: string, teacherId: string): Promise<BillingConfigRow | null> {
    const { data } = await this.supabase
      .from('billing_configs')
      .select()
      .eq('external_student_id', externalStudentId)
      .eq('teacher_id', teacherId)
      .maybeSingle();
    return data as BillingConfigRow | null;
  }

  async upsertConfig(input: {
    studioId: string;
    studentId: string | null;
    externalStudentId?: string | null;
    teacherId: string;
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string;
    lessonRateCents: number;
    lessonType?: LessonType;
    billingType?: BillingType;
    notes?: string;
  }): Promise<BillingConfigRow> {
    const { data, error } = await this.supabase
      .from('billing_configs')
      .upsert({
        studio_id: input.studioId,
        student_id: input.studentId,
        external_student_id: input.externalStudentId ?? null,
        teacher_id: input.teacherId,
        monthly_rate_cents: input.lessonRateCents,
        lesson_rate_cents: input.lessonRateCents,
        parent_name: input.parentName ?? null,
        parent_email: input.parentEmail ?? null,
        parent_phone: input.parentPhone ?? null,
        lesson_type: input.lessonType ?? 'in_person',
        billing_type: input.billingType ?? 'private',
        notes: input.notes ?? null,
      }, { onConflict: 'studio_id,student_id' })
      .select()
      .single();
    if (error) throw error;
    return data as BillingConfigRow;
  }

  // ── Lesson counting ──────────────────────────────────────────

  async getBillableLessons(
    teacherId: string,
    studentId: string | null,
    externalStudentId: string | null,
    year: number,
    month: number,
  ): Promise<LessonRow[]> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    let query = this.supabase
      .from('lessons')
      .select('*')
      .eq('teacher_id', teacherId)
      .gte('scheduled_at', start)
      .lt('scheduled_at', nextMonth)
      .neq('attendance', 'cancelled');

    if (studentId) {
      query = query.eq('student_id', studentId);
    } else if (externalStudentId) {
      query = query.eq('external_student_id', externalStudentId);
    }

    const { data, error } = await query.order('scheduled_at');
    if (error) throw error;
    return (data ?? []) as LessonRow[];
  }

  // ── Invoices ─────────────────────────────────────────────────

  async getInvoice(
    teacherId: string,
    studentId: string | null,
    externalStudentId: string | null,
    periodMonth: string,
  ): Promise<TuitionRecordRow | null> {
    let query = this.supabase
      .from('tuition_records')
      .select()
      .eq('teacher_id', teacherId)
      .eq('period_month', periodMonth);

    if (studentId) {
      query = query.eq('student_id', studentId);
    } else if (externalStudentId) {
      query = query.eq('external_student_id', externalStudentId);
    }

    const { data } = await query.maybeSingle();
    return data as TuitionRecordRow | null;
  }

  async getInvoices(teacherId: string, studentId: string | null, externalStudentId: string | null): Promise<TuitionRecordRow[]> {
    let query = this.supabase
      .from('tuition_records')
      .select()
      .eq('teacher_id', teacherId)
      .order('period_month', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    } else if (externalStudentId) {
      query = query.eq('external_student_id', externalStudentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TuitionRecordRow[];
  }

  async generateInvoice(input: {
    config: BillingConfigRow;
    periodMonth: string;
    lessonCount: number;
    makeupCreditsApplied: number;
    extraChargesCents: number;
    extraChargesDesc?: string;
  }): Promise<TuitionRecordRow> {
    const billable = Math.max(0, input.lessonCount - input.makeupCreditsApplied);
    const amountCents = billable * input.config.lesson_rate_cents + input.extraChargesCents;

    const existing = await this.getInvoice(
      input.config.teacher_id,
      input.config.student_id,
      input.config.external_student_id,
      input.periodMonth,
    );

    const payload = {
      amount_cents: amountCents,
      lesson_count: input.lessonCount,
      makeup_credits_applied: input.makeupCreditsApplied,
      extra_charges_cents: input.extraChargesCents,
      extra_charges_desc: input.extraChargesDesc ?? null,
      status: 'unpaid' as const,
      paid_at: null as string | null,
      payment_method: null as PaymentMethod | null,
    };

    let record: TuitionRecordRow;

    if (existing) {
      const { data, error } = await this.supabase
        .from('tuition_records')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      record = data as TuitionRecordRow;
    } else {
      const { data, error } = await this.supabase
        .from('tuition_records')
        .insert({
          billing_config_id: input.config.id,
          studio_id: input.config.studio_id,
          student_id: input.config.student_id,
          external_student_id: input.config.external_student_id,
          teacher_id: input.config.teacher_id,
          period_month: input.periodMonth,
          ...payload,
        })
        .select()
        .single();
      if (error) throw error;
      record = data as TuitionRecordRow;
    }

    if (input.makeupCreditsApplied > 0) {
      await this.supabase
        .from('billing_configs')
        .update({ makeup_credits: Math.max(0, input.config.makeup_credits - input.makeupCreditsApplied) })
        .eq('id', input.config.id);
    }

    return record;
  }

  async markInvoicePaid(invoiceId: string, method: PaymentMethod, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('tuition_records')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: method })
      .eq('id', invoiceId)
      .eq('teacher_id', teacherId);
    if (error) throw error;
  }

  async markInvoiceUnpaid(invoiceId: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('tuition_records')
      .update({ status: 'unpaid', paid_at: null, payment_method: null })
      .eq('id', invoiceId)
      .eq('teacher_id', teacherId);
    if (error) throw error;
  }

  // ── Makeup credits ───────────────────────────────────────────

  async addMakeupCredit(configId: string, currentCredits: number): Promise<void> {
    const { error } = await this.supabase
      .from('billing_configs')
      .update({ makeup_credits: currentCredits + 1 })
      .eq('id', configId);
    if (error) throw error;
  }

  // ── Overview ─────────────────────────────────────────────────

  async getAllConfigs(teacherId: string): Promise<BillingConfigRow[]> {
    const { data, error } = await this.supabase
      .from('billing_configs')
      .select()
      .eq('teacher_id', teacherId);
    if (error) throw error;
    return (data ?? []) as BillingConfigRow[];
  }

  async getAllInvoicesForMonth(teacherId: string, periodMonth: string): Promise<TuitionRecordRow[]> {
    const { data, error } = await this.supabase
      .from('tuition_records')
      .select()
      .eq('teacher_id', teacherId)
      .eq('period_month', periodMonth);
    if (error) throw error;
    return (data ?? []) as TuitionRecordRow[];
  }

  // Legacy
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
}
