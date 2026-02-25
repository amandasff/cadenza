import type { SupabaseClient } from '@supabase/supabase-js';

export interface PortfolioItemRow {
  id: string;
  student_id: string;
  studio_id: string | null;
  title: string;
  description: string | null;
  recording_url: string | null;
  session_id: string | null;
  created_at: string;
}

interface AddItemInput {
  studentId: string;
  studioId?: string;
  title: string;
  description?: string;
  recordingUrl?: string;
  sessionId?: string;
}

export class PortfolioService {
  private constructor(private supabase: SupabaseClient) {}

  static getInstance(supabase: SupabaseClient): PortfolioService {
    return new PortfolioService(supabase);
  }

  async getItems(studentId: string): Promise<PortfolioItemRow[]> {
    const { data, error } = await this.supabase
      .from('portfolio_items')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as PortfolioItemRow[];
  }

  async addItem(input: AddItemInput): Promise<PortfolioItemRow> {
    const { data, error } = await this.supabase
      .from('portfolio_items')
      .insert({
        student_id: input.studentId,
        studio_id: input.studioId ?? null,
        title: input.title,
        description: input.description ?? null,
        recording_url: input.recordingUrl ?? null,
        session_id: input.sessionId ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as PortfolioItemRow;
  }

  async updateItem(id: string, updates: { title?: string; description?: string }): Promise<void> {
    const { error } = await this.supabase
      .from('portfolio_items')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('portfolio_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
