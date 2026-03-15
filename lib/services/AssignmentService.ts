import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AssignmentRow,
  AssignmentWithContext,
  AssignmentCompletionRow,
  AssignmentType,
  SelfRating,
} from '../types';
import { getSupabaseBrowserClient } from '../supabase/client';

interface CreateAssignmentInput {
  studioId: string;
  studentId: string;
  teacherId: string;
  lessonId?: string;
  pieceId?: string;
  title: string;
  instructions?: string;
  focus?: string;
  type?: AssignmentType;
  targetMinutesPerDay?: number;
  timesPerWeek?: number;
  weekStart?: string;         // "YYYY-MM-DD" Monday of the week
  dueDate?: string;           // "YYYY-MM-DD"
  referenceAudioUrl?: string;
  youtubeId?: string;
}

export class AssignmentService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): AssignmentService {
    return new AssignmentService(supabase);
  }

  // Student: active assignments for This Week view (with piece title + completion)
  async getActiveAssignments(studentId: string): Promise<AssignmentWithContext[]> {
    const { data: assignments, error } = await this.supabase
      .from('assignments')
      .select()
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    if (!assignments || assignments.length === 0) return [];

    // Enrich with piece titles
    const pieceIds = [...new Set(assignments.map((a: AssignmentRow) => a.piece_id).filter(Boolean))] as string[];
    const { data: pieces } = pieceIds.length
      ? await this.supabase.from('pieces').select('id, title').in('id', pieceIds)
      : { data: [] };

    const pieceMap = new Map((pieces ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));

    // Fetch completions
    const assignmentIds = assignments.map((a: AssignmentRow) => a.id);
    const { data: completions } = await this.supabase
      .from('assignment_completions')
      .select()
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentId);

    const completionMap = new Map(
      (completions ?? []).map((c: AssignmentCompletionRow) => [c.assignment_id, c])
    );

    return (assignments as AssignmentRow[]).map((a) => ({
      ...a,
      piece_title: a.piece_id ? (pieceMap.get(a.piece_id) ?? null) : null,
      completion: completionMap.get(a.id) ?? null,
    }));
  }

  // Teacher: all assignments for a lesson (with context, for lesson notes page)
  async getAssignmentsForLesson(lessonId: string, teacherId: string): Promise<AssignmentWithContext[]> {
    const { data, error } = await this.supabase
      .from('assignments')
      .select()
      .eq('lesson_id', lessonId)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AssignmentWithContext[];
  }

  // Teacher: all assignments for a lesson (raw)
  async getAssignmentsByLesson(lessonId: string): Promise<AssignmentRow[]> {
    const { data, error } = await this.supabase
      .from('assignments')
      .select()
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as AssignmentRow[];
  }

  // Teacher: pre-lesson report for a student (all active assignments with completion data)
  async getAssignmentsWithCompletions(
    teacherId: string,
    studentId: string
  ): Promise<AssignmentWithContext[]> {
    const { data: assignments, error } = await this.supabase
      .from('assignments')
      .select()
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!assignments || assignments.length === 0) return [];

    const assignmentIds = assignments.map((a: AssignmentRow) => a.id);
    const { data: completions } = await this.supabase
      .from('assignment_completions')
      .select()
      .in('assignment_id', assignmentIds);

    const completionMap = new Map(
      (completions ?? []).map((c: AssignmentCompletionRow) => [c.assignment_id, c])
    );

    const pieceIds = [...new Set(assignments.map((a: AssignmentRow) => a.piece_id).filter(Boolean))] as string[];
    const { data: pieces } = pieceIds.length
      ? await this.supabase.from('pieces').select('id, title').in('id', pieceIds)
      : { data: [] };

    const pieceMap = new Map((pieces ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));

    return (assignments as AssignmentRow[]).map((a) => ({
      ...a,
      piece_title: a.piece_id ? (pieceMap.get(a.piece_id) ?? null) : null,
      completion: completionMap.get(a.id) ?? null,
    }));
  }

  // Teacher: create an assignment
  async createAssignment(input: CreateAssignmentInput): Promise<AssignmentRow> {
    const { data, error } = await this.supabase
      .from('assignments')
      .insert({
        studio_id: input.studioId,
        student_id: input.studentId,
        teacher_id: input.teacherId,
        lesson_id: input.lessonId ?? null,
        piece_id: input.pieceId ?? null,
        title: input.title,
        instructions: input.instructions ?? null,
        focus: input.focus ?? null,
        type: input.type ?? 'practice',
        target_minutes_per_day: input.targetMinutesPerDay ?? null,
        times_per_week: input.timesPerWeek ?? null,
        week_start: input.weekStart ?? null,
        due_date: input.dueDate ?? null,
        reference_audio_url: input.referenceAudioUrl ?? null,
        youtube_id: input.youtubeId ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data as AssignmentRow;
  }

  // Teacher: update assignment (e.g. after recording voice note)
  async updateAssignment(
    assignmentId: string,
    updates: Partial<Pick<AssignmentRow, 'title' | 'instructions' | 'focus' | 'type' | 'target_minutes_per_day' | 'due_date' | 'reference_audio_url' | 'youtube_id' | 'status'>>,
    teacherId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Teacher: delete an assignment
  async deleteAssignment(assignmentId: string, teacherId: string): Promise<void> {
    const { error } = await this.supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('teacher_id', teacherId);

    if (error) throw error;
  }

  // Student: mark assignment complete with self-rating
  async completeAssignment(
    assignmentId: string,
    studentId: string,
    rating: SelfRating,
    notes?: string
  ): Promise<void> {
    // Insert completion record
    const { error: completionError } = await this.supabase
      .from('assignment_completions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        self_rating: rating,
        student_notes: notes ?? null,
      });

    if (completionError) throw completionError;

    // Mark assignment as completed
    const { error: updateError } = await this.supabase
      .from('assignments')
      .update({ status: 'completed' })
      .eq('id', assignmentId)
      .eq('student_id', studentId);

    if (updateError) throw updateError;

    // Award 50 points for completing an assignment (silently — don't block if points fail)
    try {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('total_points')
        .eq('id', studentId)
        .single();

      if (profile) {
        const current = profile as { total_points: number };
        await this.supabase
          .from('profiles')
          .update({ total_points: current.total_points + 50 })
          .eq('id', studentId);
      }
    } catch { /* points are a bonus — never fail the completion */ }
  }

  // Upload teacher voice note to Supabase storage, return public URL
  async uploadVoiceNote(audioBlob: Blob, assignmentId: string): Promise<string> {
    const supabase = getSupabaseBrowserClient();
    const timestamp = Date.now();
    const path = `${assignmentId}/${timestamp}.webm`;

    const { error } = await supabase.storage
      .from('assignment-voice-notes')
      .upload(path, audioBlob, { upsert: true, contentType: 'audio/webm' });

    if (error) throw error;

    const { data } = supabase.storage.from('assignment-voice-notes').getPublicUrl(path);
    return data.publicUrl;
  }
}
