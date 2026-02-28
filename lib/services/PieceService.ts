import type { SupabaseClient } from '@supabase/supabase-js';
import type { PieceRow, GoalRow } from '../types';

export interface PieceWithGoals extends PieceRow {
  goals: GoalRow[];
}

export interface CreatePieceInput {
  studentId: string;
  teacherId: string;
  studioId: string;
  title: string;
  composer?: string;
  book?: string;
  category: string;
  programId?: string;
  sheetMusicUrl?: string;
}

export class PieceService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static getInstance(supabase: SupabaseClient): PieceService {
    return new PieceService(supabase);
  }

  async getStudentPieces(studentId: string): Promise<PieceWithGoals[]> {
    try {
      const { data: pieces, error } = await this.supabase
        .from('pieces')
        .select('*')
        .eq('student_id', studentId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error || !pieces?.length) return [];

      const pieceIds = (pieces as PieceRow[]).map(p => p.id);
      const { data: goals } = await this.supabase
        .from('goals')
        .select('*')
        .in('piece_id', pieceIds)
        .order('path_order', { ascending: true });

      const byPiece: Record<string, GoalRow[]> = {};
      for (const g of (goals ?? []) as GoalRow[]) {
        if (!g.piece_id) continue;
        byPiece[g.piece_id] ??= [];
        byPiece[g.piece_id].push(g);
      }

      return (pieces as PieceRow[]).map(p => ({ ...p, goals: byPiece[p.id] ?? [] }));
    } catch {
      return [];
    }
  }

  async createPiece(input: CreatePieceInput): Promise<PieceRow> {
    const { data: last } = await this.supabase
      .from('pieces')
      .select('sort_order')
      .eq('student_id', input.studentId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = last ? (last as { sort_order: number }).sort_order + 1 : 0;

    const { data, error } = await this.supabase
      .from('pieces')
      .insert({
        student_id: input.studentId,
        teacher_id: input.teacherId,
        studio_id: input.studioId,
        title: input.title,
        composer: input.composer ?? null,
        book: input.book ?? null,
        category: input.category,
        program_id: input.programId ?? null,
        sort_order: nextOrder,
        status: 'learning',
        sheet_music_url: input.sheetMusicUrl ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as PieceRow;
  }

  async updatePiece(
    pieceId: string,
    updates: Partial<Pick<PieceRow, 'status' | 'title' | 'composer' | 'book' | 'category' | 'sheet_music_url'>>
  ): Promise<void> {
    const { error } = await this.supabase.from('pieces').update(updates).eq('id', pieceId);
    if (error) throw error;
  }

  async deletePiece(pieceId: string): Promise<void> {
    const { error } = await this.supabase.from('pieces').delete().eq('id', pieceId);
    if (error) throw error;
  }
}
