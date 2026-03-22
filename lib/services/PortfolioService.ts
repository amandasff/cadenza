import type { SupabaseClient } from '@supabase/supabase-js';

export type Visibility = 'private' | 'friends' | 'public';

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
  visibility: Visibility;
  view_count?: number;
  price_points?: number;
  collection_count?: number;
}

export interface PortfolioCollectionRow {
  id: string;
  portfolio_item_id: string;
  collector_id: string;
  points_paid: number;
  created_at: string;
}

interface AddItemInput {
  studentId: string;
  studioId?: string;
  title: string;
  description?: string;
  recordingUrl?: string;
  sessionId?: string;
  mediaType?: 'audio' | 'video';
  visibility?: Visibility;
  displayAs?: 'real' | 'alias' | 'anonymous';
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
    const visibility: Visibility = input.visibility ?? 'private';
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
        visibility,
        is_public: visibility === 'public',
        display_as: input.displayAs ?? 'real',
      })
      .select()
      .single();

    if (error) throw error;
    return data as PortfolioItemRow;
  }

  async updateItem(id: string, updates: { title?: string; description?: string; is_public?: boolean; visibility?: Visibility; price_points?: number }): Promise<void> {
    // Keep is_public in sync with visibility if visibility is being updated
    const patch = { ...updates };
    if (updates.visibility) patch.is_public = updates.visibility === 'public';
    const { error } = await this.supabase
      .from('portfolio_items')
      .update(patch)
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

  /** Returns the set of portfolio_item IDs the given user has in their Crate */
  async getCollectedIds(userId: string): Promise<Set<string>> {
    const { data } = await this.supabase
      .from('portfolio_collections')
      .select('portfolio_item_id')
      .eq('collector_id', userId);
    return new Set((data ?? []).map((r: { portfolio_item_id: string }) => r.portfolio_item_id));
  }

  /** Returns all portfolio items the user has collected, with original artist info */
  async getCrate(userId: string): Promise<(PortfolioItemRow & { display_name?: string; avatar_url?: string | null })[]> {
    const { data } = await this.supabase
      .from('portfolio_collections')
      .select('portfolio_item_id, portfolio_items(*, profiles(display_name, avatar_url))')
      .eq('collector_id', userId)
      .order('created_at', { ascending: false });

    return ((data ?? []) as unknown as Array<{
      portfolio_item_id: string;
      portfolio_items: PortfolioItemRow & { profiles?: { display_name: string; avatar_url: string | null } };
    }>).map(r => ({
      ...r.portfolio_items,
      display_name: r.portfolio_items.profiles?.display_name,
      avatar_url: r.portfolio_items.profiles?.avatar_url ?? null,
    }));
  }

  /**
   * Collect (add to Crate) a portfolio item.
   * Deducts points from collector, credits 80% to artist, increments collection_count.
   * Must be called from an API route (admin client) so RLS doesn't block cross-user point updates.
   */
  async collectItem(collectorId: string, itemId: string): Promise<void> {
    // Fetch item + collector profile in parallel
    const [{ data: item }, { data: collectorProfile }] = await Promise.all([
      this.supabase.from('portfolio_items').select('student_id, price_points, collection_count').eq('id', itemId).single(),
      this.supabase.from('profiles').select('total_points').eq('id', collectorId).single(),
    ]);

    const price = (item as { price_points: number } | null)?.price_points ?? 0;
    const collectorPoints = (collectorProfile as { total_points: number } | null)?.total_points ?? 0;
    const artistId = (item as { student_id: string } | null)?.student_id;
    const currentCount = (item as { collection_count: number } | null)?.collection_count ?? 0;

    if (price > 0 && collectorPoints < price) throw new Error('Not enough points');

    const artistCut = Math.floor(price * 0.8);

    await this.supabase.from('portfolio_collections').insert({ portfolio_item_id: itemId, collector_id: collectorId, points_paid: price });
    await this.supabase.from('portfolio_items').update({ collection_count: currentCount + 1 }).eq('id', itemId);

    if (price > 0) {
      await this.supabase.from('profiles').update({ total_points: collectorPoints - price }).eq('id', collectorId);
    }

    if (price > 0 && artistId && artistCut > 0) {
      const { data: artistProfile } = await this.supabase.from('profiles').select('total_points').eq('id', artistId).single();
      const artistPoints = (artistProfile as { total_points: number } | null)?.total_points ?? 0;
      await this.supabase.from('profiles').update({ total_points: artistPoints + artistCut }).eq('id', artistId);
    }
  }
}
