import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  StudioTeacherRow,
  TeacherStudentAssignmentRow,
  EnrollmentApplicationRow,
  ProfileRow,
} from '../types';

export class OrgService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): OrgService {
    return new OrgService(supabase);
  }

  // ── Teachers ──────────────────────────────────────────────

  /** All teachers (and directors) in a studio */
  async getStudioTeachers(studioId: string): Promise<(StudioTeacherRow & { display_name: string; avatar_url?: string | null })[]> {
    const { data: members, error } = await this.supabase
      .from('studio_teachers')
      .select('*')
      .eq('studio_id', studioId)
      .order('role', { ascending: true }); // director first

    if (error) throw error;
    if (!members?.length) return [];

    const teacherIds = members.map((m: StudioTeacherRow) => m.teacher_id);
    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', teacherIds);

    const profileMap: Record<string, { display_name: string; avatar_url?: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[(p as { id: string }).id] = p as { display_name: string; avatar_url?: string | null };
    }

    return members.map((m: StudioTeacherRow) => ({
      ...m,
      display_name: profileMap[m.teacher_id]?.display_name ?? 'Unknown',
      avatar_url: profileMap[m.teacher_id]?.avatar_url ?? null,
    }));
  }

  /** What role does this user have in this studio? null = not a teacher here */
  async getTeacherRole(studioId: string, teacherId: string): Promise<'director' | 'teacher' | null> {
    const { data } = await this.supabase
      .from('studio_teachers')
      .select('role')
      .eq('studio_id', studioId)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    return (data as { role: 'director' | 'teacher' } | null)?.role ?? null;
  }

  // ── Student Assignments ───────────────────────────────────

  /** All students assigned to a teacher (active assignments only) */
  async getAssignedStudents(teacherId: string, studioId: string): Promise<ProfileRow[]> {
    const { data: assignments, error } = await this.supabase
      .from('teacher_student_assignments')
      .select('student_id')
      .eq('teacher_id', teacherId)
      .eq('studio_id', studioId)
      .is('ended_at', null);

    if (error) throw error;
    if (!assignments?.length) return [];

    const studentIds = assignments.map((a: { student_id: string }) => a.student_id);
    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('*')
      .in('id', studentIds)
      .order('display_name', { ascending: true });

    return (profiles ?? []) as ProfileRow[];
  }

  /** All active assignments for a studio (director view — all students + their assigned teacher) */
  async getAllAssignments(studioId: string): Promise<(TeacherStudentAssignmentRow & { student_name: string; teacher_name: string })[]> {
    const { data, error } = await this.supabase
      .from('teacher_student_assignments')
      .select('*')
      .eq('studio_id', studioId)
      .is('ended_at', null)
      .order('started_at', { ascending: true });

    if (error) throw error;
    if (!data?.length) return [];

    const userIds = [...new Set([
      ...data.map((r: TeacherStudentAssignmentRow) => r.teacher_id),
      ...data.map((r: TeacherStudentAssignmentRow) => r.student_id),
    ])];

    const { data: profiles } = await this.supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);

    const nameMap: Record<string, string> = {};
    for (const p of profiles ?? []) {
      nameMap[(p as { id: string }).id] = (p as { display_name: string }).display_name;
    }

    return data.map((r: TeacherStudentAssignmentRow) => ({
      ...r,
      student_name: nameMap[r.student_id] ?? 'Unknown student',
      teacher_name: nameMap[r.teacher_id] ?? 'Unknown teacher',
    }));
  }

  // ── Enrollment Applications ───────────────────────────────

  async getEnrollmentApplications(studioId: string, status?: string): Promise<EnrollmentApplicationRow[]> {
    let query = this.supabase
      .from('enrollment_applications')
      .select('*')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as EnrollmentApplicationRow[];
  }
}
