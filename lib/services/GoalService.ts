import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoalRow } from '../types';

interface CreateGoalInput {
  studioId: string;
  studentId: string;
  teacherId: string;
  title: string;
  description?: string;
  practiceArea: string;
  points: number;
  bonusTitle?: string;
  bonusPoints?: number;
  isBoss?: boolean;
  dueDate?: string;
  pieceId?: string;
  initialStatus?: 'locked' | 'current';
}

export class GoalService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): GoalService {
    return new GoalService(supabase);
  }

  async getStudentGoals(studentId: string): Promise<GoalRow[]> {
    const { data, error } = await this.supabase
      .from('goals')
      .select()
      .eq('student_id', studentId)
      .order('path_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as GoalRow[];
  }

  async getTeacherGoalsByStudent(
    teacherId: string,
    studentId: string
  ): Promise<GoalRow[]> {
    const { data, error } = await this.supabase
      .from('goals')
      .select()
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .order('path_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as GoalRow[];
  }

  async createGoal(input: CreateGoalInput): Promise<GoalRow> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('goals')
      .select('path_order')
      .eq('student_id', input.studentId)
      .order('path_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const nextOrder = existing ? (existing as { path_order: number }).path_order + 1 : 1;

    const { data, error } = await this.supabase
      .from('goals')
      .insert({
        studio_id: input.studioId,
        student_id: input.studentId,
        teacher_id: input.teacherId,
        title: input.title,
        description: input.description ?? null,
        practice_area: input.practiceArea,
        points: input.points,
        bonus_title: input.bonusTitle ?? null,
        bonus_points: input.bonusPoints ?? null,
        is_boss: input.isBoss ?? false,
        due_date: input.dueDate ?? null,
        piece_id: input.pieceId ?? null,
        status: input.initialStatus ?? 'current',
        path_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return data as GoalRow;
  }

  async completeGoal(
    goalId: string,
    studentId: string,
    pointsToAward: number
  ): Promise<void> {
    // Fetch goal bonus_points and current profile in parallel
    const [{ data: goalData }, { data: profile, error: profileFetchError }] = await Promise.all([
      this.supabase.from('goals').select('bonus_points').eq('id', goalId).single(),
      this.supabase.from('profiles').select('total_points').eq('id', studentId).single(),
    ]);

    if (profileFetchError) throw profileFetchError;

    const bonusPoints = (goalData as { bonus_points: number | null } | null)?.bonus_points ?? 0;
    const totalToAward = pointsToAward + bonusPoints;
    const current = profile as { total_points: number };

    // Write goal status + profile points in parallel
    const [{ error: goalError }, { error: updateError }] = await Promise.all([
      this.supabase.from('goals').update({ status: 'completed' }).eq('id', goalId),
      this.supabase.from('profiles').update({ total_points: current.total_points + totalToAward }).eq('id', studentId),
    ]);

    if (goalError) throw goalError;
    if (updateError) throw updateError;
  }

  async updateGoalStatus(
    goalId: string,
    status: 'locked' | 'current' | 'completed'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('goals')
      .update({ status })
      .eq('id', goalId);

    if (error) throw error;
  }

  async addFeedback(goalId: string, feedback: string): Promise<void> {
    const { error } = await this.supabase
      .from('goals')
      .update({ teacher_feedback: feedback })
      .eq('id', goalId);

    if (error) throw error;
  }

  async deleteGoal(goalId: string): Promise<void> {
    const { error } = await this.supabase
      .from('goals')
      .delete()
      .eq('id', goalId);
    if (error) throw error;
  }

  async updateGoal(goalId: string, updates: { title?: string; description?: string; points?: number }): Promise<void> {
    const { error } = await this.supabase
      .from('goals')
      .update(updates)
      .eq('id', goalId);
    if (error) throw error;
  }

  async awardPoints(studentId: string, points: number): Promise<void> {
    const { data: profile, error: fetchErr } = await this.supabase
      .from('profiles')
      .select('total_points')
      .eq('id', studentId)
      .single();

    if (fetchErr) throw fetchErr;

    const current = profile as { total_points: number };

    const { error } = await this.supabase
      .from('profiles')
      .update({ total_points: current.total_points + points })
      .eq('id', studentId);

    if (error) throw error;
  }
}
