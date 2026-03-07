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
    // Step 1: fetch all studios
    const { data: studioData, error: studioError } = await this.supabase
      .from('studios')
      .select('id, name, owner_id')
      .order('name', { ascending: true })
      .limit(100);

    if (studioError) throw studioError;
    if (!studioData || studioData.length === 0) return [];

    // Step 2: fetch teacher names for all owner_ids
    const ownerIds = [...new Set(studioData.map((s: { owner_id: string }) => s.owner_id))];
    const { data: profileData } = await this.supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', ownerIds);

    const nameMap: Record<string, string> = {};
    for (const p of profileData ?? []) {
      nameMap[(p as { id: string; display_name: string }).id] = (p as { id: string; display_name: string }).display_name;
    }

    const mapped = studioData.map((s: { id: string; name: string; owner_id: string }) => ({
      id: s.id,
      name: s.name,
      teacher_name: nameMap[s.owner_id] ?? 'Unknown teacher',
    }));

    if (!search?.trim()) return mapped;

    const term = search.trim().toLowerCase();
    return mapped.filter((s: { name: string; teacher_name: string }) =>
      s.name.toLowerCase().includes(term) ||
      s.teacher_name.toLowerCase().includes(term)
    );
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
