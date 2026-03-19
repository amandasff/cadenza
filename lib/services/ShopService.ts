import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShopItemRow, StudentInventoryRow, InventoryItemWithDetails } from '../types';

export class ShopService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): ShopService {
    return new ShopService(supabase);
  }

  async getAllItems(): Promise<ShopItemRow[]> {
    const { data, error } = await this.supabase
      .from('shop_items')
      .select('*')
      .eq('is_available', true)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as ShopItemRow[];
  }

  async getInventory(studentId: string): Promise<InventoryItemWithDetails[]> {
    const { data, error } = await this.supabase
      .from('student_inventory')
      .select('*, shop_items(*)')
      .eq('student_id', studentId)
      .order('purchased_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as InventoryItemWithDetails[];
  }

  async getOwnedItemIds(studentId: string): Promise<Set<string>> {
    const { data } = await this.supabase
      .from('student_inventory')
      .select('item_id')
      .eq('student_id', studentId);
    return new Set((data ?? []).map((r: { item_id: string }) => r.item_id));
  }

  async purchaseItem(studentId: string, itemId: string): Promise<void> {
    // Fetch item cost and student points atomically via API route
    const { data: item, error: itemErr } = await this.supabase
      .from('shop_items')
      .select('cost_points')
      .eq('id', itemId)
      .single();
    if (itemErr || !item) throw new Error('Item not found');

    const { data: profile, error: profileErr } = await this.supabase
      .from('profiles')
      .select('total_points')
      .eq('id', studentId)
      .single();
    if (profileErr || !profile) throw new Error('Profile not found');

    const cost = (item as { cost_points: number }).cost_points;
    const points = (profile as { total_points: number }).total_points;

    if (points < cost) throw new Error('Not enough points');

    // Deduct points
    const { error: updateErr } = await this.supabase
      .from('profiles')
      .update({ total_points: points - cost })
      .eq('id', studentId);
    if (updateErr) throw updateErr;

    // Add to inventory
    const { error: insertErr } = await this.supabase
      .from('student_inventory')
      .insert({ student_id: studentId, item_id: itemId });
    if (insertErr) {
      // Rollback points if insert fails
      await this.supabase
        .from('profiles')
        .update({ total_points: points })
        .eq('id', studentId);
      throw insertErr;
    }
  }
}
