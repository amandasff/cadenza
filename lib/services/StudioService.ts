import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileRow, StudioRow } from '../types';

export class StudioService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static getInstance(supabase: SupabaseClient): StudioService {
    return new StudioService(supabase);
  }

  async createStudio(teacherId: string, name: string): Promise<StudioRow> {
    const { data, error } = await this.supabase
      .from('studios')
      .insert({ owner_id: teacherId, name })
      .select()
      .single();

    if (error) throw error;
    return data as StudioRow;
  }

  async findByInviteCode(code: string): Promise<StudioRow | null> {
    const normalized = code.trim().toLowerCase();

    const { data, error } = await this.supabase
      .from('studios')
      .select()
      .ilike('invite_code', normalized)
      .maybeSingle();

    if (error) throw error;
    return data as StudioRow | null;
  }

  async joinStudio(studentId: string, studioId: string): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ studio_id: studioId })
      .eq('id', studentId);

    if (error) throw error;
  }

  async getStudents(studioId: string): Promise<ProfileRow[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select()
      .eq('studio_id', studioId)
      .order('display_name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProfileRow[];
  }
}
