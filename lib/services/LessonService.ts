import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonRow, LessonRecurrenceRow, LessonWithAssignments, ExternalStudentRow } from '../types';

interface CreateLessonInput {
  studioId: string;
  studentId?: string;
  externalStudentId?: string;
  teacherId: string;
  scheduledAt: string;       // ISO datetime string
  durationMinutes?: number;
  recurrenceId?: string;
}

interface CreateRecurrenceInput {
  studioId: string;
  studentId?: string;
  externalStudentId?: string;
  teacherId: string;
  dayOfWeek: number;         // 0=Sunday
  timeOfDay: string;         // "HH:MM"
  durationMinutes?: number;
}

interface CreateExternalStudentInput {
  studioId: string;
  teacherId: string;
  name: string;
  email?: string;
  instrument?: string;
}

export class LessonService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): LessonService {
    return new LessonService(supabase);
  }

  // Teacher: upcoming lessons for the next 14 days
  async getUpcomingLessons(teacherId: string): Promise<LessonRow[]> {
    const now = new Date().toISOString();
    const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('lessons')
      .select()
      .eq('teacher_id', teacherId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now)
      .lte('scheduled_at', twoWeeksOut)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as LessonRow[];
  }

  // Teacher: all lessons for a specific student
  async getLessonsForStudent(teacherId: string, studentId: string): Promise<LessonRow[]> {
    const { data, error } = await this.supabase
      .from('lessons')
      .select()
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .order('scheduled_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as LessonRow[];
  }

  // Student: next upcoming lesson
  async getStudentNextLesson(studentId: string): Promise<LessonRow | null> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('lessons')
      .select()
      .eq('student_id', studentId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as LessonRow | null;
  }

  // Teacher: create an external (off-app) student
  async createExternalStudent(input: CreateExternalStudentInput): Promise<ExternalStudentRow> {
    const { data, error } = await this.supabase
      .from('external_students')
      .insert({
        studio_id: input.studioId,
        teacher_id: input.teacherId,
        name: input.name,
        email: input.email ?? null,
        instrument: input.instrument ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as ExternalStudentRow;
  }

  // Teacher: list external students
  async getExternalStudents(teacherId: string): Promise<ExternalStudentRow[]> {
    const { data, error } = await this.supabase
      .from('external_students')
      .select()
      .eq('teacher_id', teacherId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ExternalStudentRow[];
  }

  // Teacher: schedule a single lesson
  async createLesson(input: CreateLessonInput): Promise<LessonRow> {
    const { data, error } = await this.supabase
      .from('lessons')
      .insert({
        studio_id: input.studioId,
        student_id: input.studentId ?? null,
        external_student_id: input.externalStudentId ?? null,
        teacher_id: input.teacherId,
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMinutes ?? 45,
        recurrence_id: input.recurrenceId ?? null,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) throw error;
    return data as LessonRow;
  }

  // Teacher: update lesson time / duration
  async updateLesson(lessonId: string, patch: { scheduledAt?: string; durationMinutes?: number }, teacherId: string): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.scheduledAt !== undefined) update.scheduled_at = patch.scheduledAt;
    if (patch.durationMinutes !== undefined) update.duration_minutes = patch.durationMinutes;

    const { error } = await this.supabase
      .from('lessons')
      .update(update)
      .eq('id', lessonId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Teacher: save a recurring lesson template + generate 8 weeks of lessons
  async createRecurrence(input: CreateRecurrenceInput): Promise<LessonRecurrenceRow> {
    const { data, error } = await this.supabase
      .from('lesson_recurrences')
      .insert({
        studio_id: input.studioId,
        student_id: input.studentId ?? null,
        external_student_id: input.externalStudentId ?? null,
        teacher_id: input.teacherId,
        day_of_week: input.dayOfWeek,
        time_of_day: input.timeOfDay,
        duration_minutes: input.durationMinutes ?? 45,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;
    const recurrence = data as LessonRecurrenceRow;

    // Generate next 8 weeks of lessons from this recurrence
    await this.generateLessonsFromRecurrence(recurrence, 8);

    return recurrence;
  }

  // Generate N weeks of lesson instances from a recurrence template
  async generateLessonsFromRecurrence(
    recurrence: LessonRecurrenceRow,
    weeksAhead: number
  ): Promise<void> {
    const [hours, minutes] = recurrence.time_of_day.split(':').map(Number);
    const lessons = [];

    for (let week = 0; week < weeksAhead; week++) {
      const date = this.nextDayOfWeek(recurrence.day_of_week, week);
      date.setHours(hours, minutes, 0, 0);

      // Only generate future lessons
      if (date > new Date()) {
        lessons.push({
          studio_id: recurrence.studio_id,
          student_id: recurrence.student_id ?? null,
          external_student_id: recurrence.external_student_id ?? null,
          teacher_id: recurrence.teacher_id,
          scheduled_at: date.toISOString(),
          duration_minutes: recurrence.duration_minutes,
          recurrence_id: recurrence.id,
          status: 'scheduled',
        });
      }
    }

    if (lessons.length === 0) return;

    const { error } = await this.supabase.from('lessons').insert(lessons);
    if (error) throw error;
  }

  // Teacher: mark lesson as complete and save notes
  async completeLesson(lessonId: string, notes: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lessons')
      .update({ status: 'completed', lesson_notes: notes })
      .eq('id', lessonId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Teacher: cancel a lesson
  async cancelLesson(lessonId: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lessons')
      .update({ status: 'cancelled' })
      .eq('id', lessonId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Teacher: update lesson notes (auto-save on blur)
  async updateNotes(lessonId: string, notes: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lessons')
      .update({ lesson_notes: notes })
      .eq('id', lessonId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Teacher: save structured post-lesson notes
  async updateStructuredNotes(
    lessonId: string,
    fields: {
      coveredNotes?: string;
      focusNotes?: string;
      nextLessonNotes?: string;
      attendance?: 'attended' | 'cancelled' | 'no_show';
    },
    teacherId: string
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (fields.coveredNotes !== undefined) update.covered_notes = fields.coveredNotes;
    if (fields.focusNotes !== undefined) update.focus_notes = fields.focusNotes;
    if (fields.nextLessonNotes !== undefined) update.next_lesson_notes = fields.nextLessonNotes;
    if (fields.attendance !== undefined) update.attendance = fields.attendance;

    const { error } = await this.supabase
      .from('lessons')
      .update(update)
      .eq('id', lessonId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Teacher: get completed lessons for a student (lesson log)
  async getCompletedLessonsForStudent(teacherId: string, studentId: string): Promise<import('../types').LessonRow[]> {
    const { data, error } = await this.supabase
      .from('lessons')
      .select()
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return (data ?? []) as import('../types').LessonRow[];
  }

  // Teacher: list active recurring templates
  async getRecurrences(teacherId: string): Promise<LessonRecurrenceRow[]> {
    const { data, error } = await this.supabase
      .from('lesson_recurrences')
      .select()
      .eq('teacher_id', teacherId)
      .eq('active', true)
      .order('day_of_week', { ascending: true });

    if (error) throw error;
    return (data ?? []) as LessonRecurrenceRow[];
  }

  // Teacher: deactivate a recurrence (doesn't delete existing scheduled lessons)
  async deactivateRecurrence(recurrenceId: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('lesson_recurrences')
      .update({ active: false })
      .eq('id', recurrenceId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Helper: find the next occurrence of a given weekday
  private nextDayOfWeek(dayOfWeek: number, weeksAhead: number): Date {
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntil = (dayOfWeek - currentDay + 7) % 7;
    const result = new Date(now);
    result.setDate(now.getDate() + daysUntil + weeksAhead * 7);
    return result;
  }

  // Enrich upcoming lessons with student profiles and assignment counts
  async getUpcomingLessonsWithContext(teacherId: string): Promise<LessonWithAssignments[]> {
    const lessons = await this.getUpcomingLessons(teacherId);
    if (lessons.length === 0) return [];

    // Fetch registered student profiles
    const studentIds = [...new Set(lessons.map((l) => l.student_id).filter((id): id is string => !!id))];
    const profileMap = new Map<string, { id: string; display_name: string; avatar_url: string | null }>();
    if (studentIds.length > 0) {
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', studentIds);
      for (const p of profiles ?? []) profileMap.set(p.id, p);
    }

    // Fetch external student names
    const extIds = [...new Set(lessons.map((l) => l.external_student_id).filter((id): id is string => !!id))];
    const extMap = new Map<string, string>();
    if (extIds.length > 0) {
      const { data: extStudents } = await this.supabase
        .from('external_students')
        .select('id, name')
        .in('id', extIds);
      for (const e of extStudents ?? []) extMap.set(e.id, e.name);
    }

    // Fetch assignments for these lessons
    const lessonIds = lessons.map((l) => l.id);
    const { data: assignments } = await this.supabase
      .from('assignments')
      .select()
      .in('lesson_id', lessonIds);

    const assignmentMap = new Map<string, typeof assignments>();
    for (const a of assignments ?? []) {
      const list = assignmentMap.get(a.lesson_id) ?? [];
      list.push(a);
      assignmentMap.set(a.lesson_id, list);
    }

    // Fetch completion counts
    const assignmentIds = (assignments ?? []).map((a: { id: string }) => a.id);
    const { data: completions } = assignmentIds.length
      ? await this.supabase
          .from('assignment_completions')
          .select('assignment_id')
          .in('assignment_id', assignmentIds)
      : { data: [] };

    const completedSet = new Set((completions ?? []).map((c: { assignment_id: string }) => c.assignment_id));

    return lessons.map((lesson) => {
      const isExternal = !lesson.student_id && !!lesson.external_student_id;
      const profile = lesson.student_id ? profileMap.get(lesson.student_id) : undefined;
      const extName = lesson.external_student_id ? extMap.get(lesson.external_student_id) : undefined;
      const lessonAssignments = assignmentMap.get(lesson.id) ?? [];
      const completionCount = lessonAssignments.filter((a: { id: string }) => completedSet.has(a.id)).length;

      return {
        ...lesson,
        student_name: extName ?? profile?.display_name ?? 'Student',
        student_avatar: profile?.avatar_url ?? null,
        is_external: isExternal,
        assignments: lessonAssignments,
        completion_count: completionCount,
      } as LessonWithAssignments;
    });
  }
}
