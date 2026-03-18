import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ComposerAvatarRow,
  StudentCollectibleWithAvatar,
  CollectibleDropResult,
  CollectibleRarity,
  AcquisitionMethod,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

// After this many eligible sessions without a drop, guarantee at least a Rare.
const PITY_TIMER_THRESHOLD = 10;

// Base rarity weights (out of 100)
const RARITY_WEIGHTS: Record<CollectibleRarity, number> = {
  common:    60,
  rare:      30,
  epic:       8,
  legendary:  2,
};

// Normalise a composer name for fuzzy matching against the DB
function normaliseName(name: string): string {
  return name.toLowerCase().trim();
}

// ── Service ───────────────────────────────────────────────────────────────────

export class CollectibleService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static create(supabase: SupabaseClient): CollectibleService {
    return new CollectibleService(supabase);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Attempt to award a collectible drop to a student after a practice session.
   * Call this once per session (the award route enforces idempotency via session_id).
   *
   * @param studentId     UUID of the student
   * @param composerName  Optional: composer of the piece practiced (for weighted drops)
   * @param sessionId     UUID of the practice session (used for idempotency)
   * @param forceMethod   Force a specific acquisition method (e.g. 'welcome_gift')
   */
  async tryAwardDrop(
    studentId: string,
    composerName: string | null,
    sessionId: string,
    forceMethod?: AcquisitionMethod,
  ): Promise<CollectibleDropResult> {
    const noDropResult: CollectibleDropResult = {
      dropped: false, avatar: null, method: null, isDuplicate: false,
      sessionsUntilGuaranteed: 0,
    };

    // ── 1. Fetch all active avatars ──────────────────────────────────────────
    const { data: allAvatars, error: avatarErr } = await this.supabase
      .from('composer_avatars')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (avatarErr || !allAvatars?.length) return noDropResult;
    const avatars = allAvatars as ComposerAvatarRow[];

    // ── 2. Fetch student's existing collection ───────────────────────────────
    const { data: owned } = await this.supabase
      .from('student_collectibles')
      .select('avatar_id, shard_count')
      .eq('student_id', studentId);

    const ownedIds = new Set((owned ?? []).map((r: { avatar_id: string }) => r.avatar_id));
    const unowned = avatars.filter(a => !ownedIds.has(a.id));

    // ── 3. Check pity timer ──────────────────────────────────────────────────
    const { data: profileData } = await this.supabase
      .from('profiles')
      .select('collectible_sessions_since_drop')
      .eq('id', studentId)
      .single();

    const sessionsSinceDrop = (profileData as { collectible_sessions_since_drop?: number } | null)
      ?.collectible_sessions_since_drop ?? 0;

    const sessionsUntilGuaranteed = Math.max(0, PITY_TIMER_THRESHOLD - 1 - sessionsSinceDrop);
    const pitying = sessionsSinceDrop >= PITY_TIMER_THRESHOLD;

    // ── 4. Determine if a drop fires ─────────────────────────────────────────
    // If forced (welcome gift, streak bonus, etc.) always drop.
    // Otherwise use a 40% base drop chance per eligible session.
    const shouldDrop = forceMethod != null || pitying || Math.random() < 0.40;

    if (!shouldDrop) {
      // Increment sessions-since-drop counter
      await this.supabase
        .from('profiles')
        .update({ collectible_sessions_since_drop: sessionsSinceDrop + 1 })
        .eq('id', studentId);

      return { ...noDropResult, sessionsUntilGuaranteed: sessionsUntilGuaranteed - 1 };
    }

    // ── 5. Pick rarity ───────────────────────────────────────────────────────
    let rarity: CollectibleRarity;
    if (forceMethod === 'welcome_gift') {
      rarity = 'common';
    } else if (forceMethod === 'streak_bonus') {
      rarity = 'rare';
    } else if (forceMethod === 'goal_milestone') {
      rarity = 'rare';
    } else if (pitying) {
      // Pity timer guarantees at least Rare
      rarity = rollRarity({ common: 0, rare: 70, epic: 20, legendary: 10 });
    } else {
      rarity = rollRarity(RARITY_WEIGHTS);
    }

    // ── 6. Pick composer ─────────────────────────────────────────────────────
    // Filter candidates by rarity first
    let candidates = avatars.filter(a => a.rarity === rarity);

    // If no unowned at this rarity → fall back to all at this rarity (will be a shard)
    const unownedCandidates = candidates.filter(a => !ownedIds.has(a.id));
    if (unownedCandidates.length === 0 && unowned.length > 0) {
      // Upgrade: find next rarity up with unowned avatars
      const rarityOrder: CollectibleRarity[] = ['common', 'rare', 'epic', 'legendary'];
      const currentIdx = rarityOrder.indexOf(rarity);
      for (let i = currentIdx + 1; i < rarityOrder.length; i++) {
        const upgraded = unowned.filter(a => a.rarity === rarityOrder[i]);
        if (upgraded.length > 0) { candidates = upgraded; break; }
      }
      // If still nothing, just go to any unowned
      if (candidates.every(a => ownedIds.has(a.id))) candidates = unowned.length ? unowned : candidates;
    } else if (unownedCandidates.length > 0) {
      candidates = unownedCandidates;
    }

    // Weight toward the composer being practiced (3× bonus)
    const pickedAvatar = weightedPick(candidates, composerName);

    const isDuplicate = ownedIds.has(pickedAvatar.id);
    const method: AcquisitionMethod = forceMethod ?? 'practice_drop';

    // ── 7. Upsert into student_collectibles ──────────────────────────────────
    if (isDuplicate) {
      // Increment shard count
      const existing = (owned ?? []).find((r: { avatar_id: string; shard_count: number }) => r.avatar_id === pickedAvatar.id);
      const newShards = ((existing as { shard_count?: number } | undefined)?.shard_count ?? 0) + 1;
      await this.supabase
        .from('student_collectibles')
        .update({ shard_count: newShards })
        .eq('student_id', studentId)
        .eq('avatar_id', pickedAvatar.id);
    } else {
      await this.supabase
        .from('student_collectibles')
        .insert({
          student_id: studentId,
          avatar_id: pickedAvatar.id,
          acquisition_method: method,
        });
    }

    // ── 8. Reset pity timer ──────────────────────────────────────────────────
    await this.supabase
      .from('profiles')
      .update({ collectible_sessions_since_drop: 0 })
      .eq('id', studentId);

    return {
      dropped: true,
      avatar: pickedAvatar,
      method,
      isDuplicate,
      sessionsUntilGuaranteed: PITY_TIMER_THRESHOLD,
    };
  }

  /**
   * Check if a specific guaranteed unlock condition is met and award it.
   * Called after significant events: streak milestone, goal count, etc.
   */
  async tryAwardMilestone(
    studentId: string,
    trigger: 'first_session' | 'streak_7' | 'goals_5' | 'sessions_20' | 'ear_training',
  ): Promise<CollectibleDropResult | null> {
    const noDropResult: CollectibleDropResult = {
      dropped: false, avatar: null, method: null, isDuplicate: false, sessionsUntilGuaranteed: 0,
    };

    // Check if this milestone has already been awarded (avoid double-gifting)
    const milestoneAvatarName = MILESTONE_COMPOSERS[trigger];
    if (!milestoneAvatarName) return null;

    const { data: avatar } = await this.supabase
      .from('composer_avatars')
      .select('*')
      .eq('composer_name', milestoneAvatarName)
      .single();

    if (!avatar) return noDropResult;
    const composerAvatar = avatar as ComposerAvatarRow;

    const { data: existing } = await this.supabase
      .from('student_collectibles')
      .select('id, shard_count')
      .eq('student_id', studentId)
      .eq('avatar_id', composerAvatar.id)
      .maybeSingle();

    const method: AcquisitionMethod =
      trigger === 'first_session' ? 'welcome_gift'
      : trigger === 'streak_7'   ? 'streak_bonus'
      : 'goal_milestone';

    if (existing) {
      // Already owned — give a shard instead
      const existingRow = existing as { id: string; shard_count: number };
      await this.supabase
        .from('student_collectibles')
        .update({ shard_count: existingRow.shard_count + 1 })
        .eq('id', existingRow.id);
      return { dropped: true, avatar: composerAvatar, method, isDuplicate: true, sessionsUntilGuaranteed: 0 };
    }

    await this.supabase
      .from('student_collectibles')
      .insert({ student_id: studentId, avatar_id: composerAvatar.id, acquisition_method: method });

    return { dropped: true, avatar: composerAvatar, method, isDuplicate: false, sessionsUntilGuaranteed: 0 };
  }

  /**
   * Fetch the student's full collection with avatar details.
   */
  async getCollection(studentId: string): Promise<StudentCollectibleWithAvatar[]> {
    const { data, error } = await this.supabase
      .from('student_collectibles')
      .select('*, composer_avatars(*)')
      .eq('student_id', studentId)
      .order('acquired_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as StudentCollectibleWithAvatar[];
  }

  /**
   * Fetch all composer avatars (for the locked/unlocked gallery view).
   */
  async getAllAvatars(): Promise<ComposerAvatarRow[]> {
    const { data, error } = await this.supabase
      .from('composer_avatars')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return (data ?? []) as ComposerAvatarRow[];
  }

  /**
   * Get how many sessions until the next guaranteed drop.
   */
  async getSessionsUntilGuaranteed(studentId: string): Promise<number> {
    const { data } = await this.supabase
      .from('profiles')
      .select('collectible_sessions_since_drop')
      .eq('id', studentId)
      .single();

    const since = (data as { collectible_sessions_since_drop?: number } | null)
      ?.collectible_sessions_since_drop ?? 0;
    return Math.max(0, PITY_TIMER_THRESHOLD - since);
  }

  /**
   * Toggle a collectible as favourite (for profile showcase).
   */
  async setFavorite(studentId: string, avatarId: string, isFavorite: boolean): Promise<void> {
    await this.supabase
      .from('student_collectibles')
      .update({ is_favorite: isFavorite })
      .eq('student_id', studentId)
      .eq('avatar_id', avatarId);
  }
}

// ── Milestone mappings ────────────────────────────────────────────────────────
// Which composer is guaranteed at each milestone

const MILESTONE_COMPOSERS: Record<string, string> = {
  first_session: 'Bach',        // Always gifted on session 1
  streak_7:      'Beethoven',   // 7-day streak → dramatic Beethoven
  goals_5:       'Brahms',      // 5 goals → methodical Brahms
  sessions_20:   'Tchaikovsky', // 20 sessions → consistent practitioner
  ear_training:  'Debussy',     // Ear training → impressionist sound master
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function rollRarity(weights: Record<CollectibleRarity, number>): CollectibleRarity {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights) as [CollectibleRarity, number][]) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

function weightedPick(
  candidates: ComposerAvatarRow[],
  composerName: string | null,
): ComposerAvatarRow {
  if (!candidates.length) throw new Error('No candidates to pick from');

  // Build weights: base = drop_weight, composer match = 3×
  const normed = composerName ? normaliseName(composerName) : null;
  const weights = candidates.map(a => {
    const isMatch = normed && normaliseName(a.composer_name) === normed;
    return isMatch ? a.drop_weight * 3 : a.drop_weight;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
