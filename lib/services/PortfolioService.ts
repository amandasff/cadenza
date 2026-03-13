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
  media_type: 'audio' | 'video' | null;
  is_public: boolean | null;
  view_count?: number;
}

interface AddItemInput {
  studentId: string;
  studioId?: string;
  title: string;
  description?: string;
  recordingUrl?: string;
  sessionId?: string;
  mediaType?: 'audio' | 'video';
  isPublic?: boolean;
}

export class PortfolioService {
  private constructor(private supabase: SupabaseClient) {}

  static create(supabase: SupabaseClient): PortfolioService {
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

  async getPublicItems(): Promise<(PortfolioItemRow & { display_name?: string })[]> {
    const { data, error } = await this.supabase
      .from('portfolio_items')
      .select('*, profiles(display_name)')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data ?? []) as unknown as (PortfolioItemRow & { profiles?: { display_name: string } })[]).map(row => ({
      ...row,
      display_name: row.profiles?.display_name,
    }));
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
        media_type: input.mediaType ?? 'audio',
        is_public: input.isPublic ?? false,
      })
      .select()
      .single();

    if (error) throw error;
    return data as PortfolioItemRow;
  }

  async updateItem(id: string, updates: { title?: string; description?: string; is_public?: boolean }): Promise<void> {
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
