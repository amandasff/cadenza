import type { SupabaseClient } from '@supabase/supabase-js';
import type { RcmExamRow, RcmChecklistItemRow, RcmCategory } from '../types';

// Standard RCM requirements by grade
const RCM_DEFAULTS: Record<string, Array<{ category: RcmCategory; title: string; composer?: string }>> = {
  'Preparatory A': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'technical', title: 'Five-finger patterns' },
    { category: 'ear_training', title: 'Clap the beat' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Preparatory B': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'technical', title: 'Five-finger patterns, two octaves' },
    { category: 'ear_training', title: 'Clap the beat and rhythm' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 1': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Scales & triads' },
    { category: 'theory', title: 'Basic Musicianship Level 1' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 2': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Scales, arpeggios & triads' },
    { category: 'theory', title: 'Basic Musicianship Level 2' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 3': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Scales, arpeggios, triads & dominant 7th' },
    { category: 'theory', title: 'Theory Level 3' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 4': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Scales, arpeggios, triads & chords' },
    { category: 'theory', title: 'Theory Level 4' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 5': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Full technical requirements Grade 5' },
    { category: 'theory', title: 'Theory Level 5' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 6': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Full technical requirements Grade 6' },
    { category: 'theory', title: 'Theory Level 6' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 7': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Full technical requirements Grade 7' },
    { category: 'theory', title: 'Theory Level 7' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 8': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Full technical requirements Grade 8' },
    { category: 'theory', title: 'Theory Level 8' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 9': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Full technical requirements Grade 9' },
    { category: 'theory', title: 'Theory Level 9' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'Grade 10': [
    { category: 'list_a', title: 'Piece from List A' },
    { category: 'list_b', title: 'Piece from List B' },
    { category: 'list_c', title: 'Piece from List C' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'Full technical requirements Grade 10' },
    { category: 'theory', title: 'Theory Level 10' },
    { category: 'ear_training', title: 'Ear training exercises' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
  'ARCT': [
    { category: 'list_a', title: 'Baroque / Classical concerto or sonata' },
    { category: 'list_b', title: 'Romantic or contemporary work' },
    { category: 'list_c', title: 'Canadian or 20th-century work' },
    { category: 'etudes', title: 'Étude' },
    { category: 'technical', title: 'ARCT technical requirements' },
    { category: 'theory', title: 'Theory Level 10 + History' },
    { category: 'ear_training', title: 'Advanced ear training' },
    { category: 'sight_reading', title: 'Sight reading' },
  ],
};

export const RCM_GRADE_LEVELS = Object.keys(RCM_DEFAULTS);

export class RcmService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): RcmService {
    return new RcmService(supabase);
  }

  async getActiveExam(studentId: string): Promise<RcmExamRow | null> {
    const { data } = await this.supabase
      .from('rcm_exams')
      .select()
      .eq('student_id', studentId)
      .eq('status', 'preparing')
      .maybeSingle();
    return data as RcmExamRow | null;
  }

  async getExamsForStudent(teacherId: string, studentId: string): Promise<RcmExamRow[]> {
    const { data, error } = await this.supabase
      .from('rcm_exams')
      .select()
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as RcmExamRow[];
  }

  async createExam(input: {
    studioId: string;
    studentId: string;
    teacherId: string;
    gradeLevel: string;
    instrument?: string;
    examDate?: string;
  }): Promise<RcmExamRow> {
    const { data, error } = await this.supabase
      .from('rcm_exams')
      .insert({
        studio_id: input.studioId,
        student_id: input.studentId,
        teacher_id: input.teacherId,
        grade_level: input.gradeLevel,
        instrument: input.instrument ?? 'Piano',
        exam_date: input.examDate ?? null,
        status: 'preparing',
      })
      .select()
      .single();
    if (error) throw error;
    return data as RcmExamRow;
  }

  async updateExam(examId: string, patch: { examDate?: string; status?: 'preparing' | 'completed' | 'withdrawn'; examResult?: string }, teacherId: string): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.examDate !== undefined) update.exam_date = patch.examDate;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.examResult !== undefined) update.exam_result = patch.examResult;
    const { error } = await this.supabase
      .from('rcm_exams')
      .update(update)
      .eq('id', examId)
      .eq('teacher_id', teacherId);
    if (error) throw error;
  }

  async getChecklist(examId: string): Promise<RcmChecklistItemRow[]> {
    const { data, error } = await this.supabase
      .from('rcm_checklist_items')
      .select()
      .eq('exam_id', examId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as RcmChecklistItemRow[];
  }

  async seedDefaultChecklist(examId: string, gradeLevel: string): Promise<void> {
    const defaults = RCM_DEFAULTS[gradeLevel] ?? [];
    if (defaults.length === 0) return;
    const rows = defaults.map((item, i) => ({
      exam_id: examId,
      category: item.category,
      title: item.title,
      composer: item.composer ?? null,
      completed: false,
      sort_order: i,
    }));
    const { error } = await this.supabase.from('rcm_checklist_items').insert(rows);
    if (error) throw error;
  }

  async addChecklistItem(input: {
    examId: string;
    category: RcmCategory;
    title: string;
    composer?: string;
    notes?: string;
    pieceId?: string;
  }): Promise<RcmChecklistItemRow> {
    const { data, error } = await this.supabase
      .from('rcm_checklist_items')
      .insert({
        exam_id: input.examId,
        category: input.category,
        title: input.title,
        composer: input.composer ?? null,
        notes: input.notes ?? null,
        piece_id: input.pieceId ?? null,
        completed: false,
        sort_order: 999,
      })
      .select()
      .single();
    if (error) throw error;
    return data as RcmChecklistItemRow;
  }

  async toggleItem(itemId: string, completed: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('rcm_checklist_items')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', itemId);
    if (error) throw error;
  }

  async updateItem(itemId: string, patch: { title?: string; composer?: string; notes?: string; pieceId?: string | null }): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.composer !== undefined) update.composer = patch.composer;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if ('pieceId' in patch) update.piece_id = patch.pieceId;
    const { error } = await this.supabase.from('rcm_checklist_items').update(update).eq('id', itemId);
    if (error) throw error;
  }

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await this.supabase.from('rcm_checklist_items').delete().eq('id', itemId);
    if (error) throw error;
  }
}
