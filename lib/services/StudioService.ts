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

  async listStudios(search?: string): Promise<{ id: string; name: string; teacher_name: string }[]> {
    let query = this.supabase
      .from('studios')
      .select('id, name, profiles!owner_id(display_name)')
      .order('name', { ascending: true })
      .limit(50);

    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row: { id: string; name: string; profiles: { display_name: string } | null }) => ({
      id: row.id,
      name: row.name,
      teacher_name: row.profiles?.display_name ?? 'Unknown teacher',
    }));
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
