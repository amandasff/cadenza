import type { SupabaseClient } from '@supabase/supabase-js';
import type { PracticeSessionRow, PracticeSegment } from '../types';

interface LogSessionInput {
  studentId: string;
  studioId: string;
  goalId?: string;
  pieceId?: string;
  durationSeconds: number;
  notes?: string;
  segments?: PracticeSegment[];
  recordingUrl?: string;
}

export class PracticeService {
  private supabase: SupabaseClient;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static getInstance(supabase: SupabaseClient): PracticeService {
    return new PracticeService(supabase);
  }

  async logSession(input: LogSessionInput): Promise<PracticeSessionRow> {
    const { data, error } = await this.supabase
      .from('practice_sessions')
      .insert({
        student_id: input.studentId,
        studio_id: input.studioId,
        goal_id: input.goalId ?? null,
        piece_id: input.pieceId ?? null,
        duration_seconds: input.durationSeconds,
        notes: input.notes ?? null,
        segments_json: input.segments ?? null,
        recording_url: input.recordingUrl ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // UTC date strings for streak + daily-bonus logic
    const todayStr = new Date().toISOString().slice(0, 10);
    const yDate = new Date();
    yDate.setUTCDate(yDate.getUTCDate() - 1);
    const yesterdayStr = yDate.toISOString().slice(0, 10);

    // Most recent session BEFORE this one
    const { data: prevSessions } = await this.supabase
      .from('practice_sessions')
      .select('created_at')
      .eq('student_id', input.studentId)
      .neq('id', data.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastDate = prevSessions?.[0]?.created_at?.slice(0, 10) ?? null;

    // Fetch current profile (streak + points)
    const { data: profile, error: profileFetchError } = await this.supabase
      .from('profiles')
      .select('streak_days, total_points')
      .eq('id', input.studentId)
      .single();

    if (profileFetchError) throw profileFetchError;

    const current = profile as { streak_days: number; total_points: number };

    // ── Streak calculation ──────────────────────────────────────────────
    let newStreak: number;
    if (lastDate === null) {
      newStreak = 1;                                // first ever session
    } else if (lastDate === todayStr) {
      newStreak = current.streak_days;              // already practiced today
    } else if (lastDate === yesterdayStr) {
      newStreak = current.streak_days + 1;          // extend streak
    } else {
      newStreak = 1;                                // gap — reset
    }

    // ── Points calculation ──────────────────────────────────────────────
    // 1 pt per minute practiced, scaled by streak multiplier
    // Streak multipliers (inspired by Tonara / Practice Space):
    //   7-day  → 1.5×   (one week of consistency)
    //   14-day → 2×     (two weeks)
    //   30-day → 3×     (one month — significant reward)
    const minutesPracticed = Math.floor(input.durationSeconds / 60);

    let multiplier = 1;
    if (newStreak >= 30) multiplier = 3;
    else if (newStreak >= 14) multiplier = 2;
    else if (newStreak >= 7) multiplier = 1.5;

    // +10 bonus for the first session of each day (daily habit reward)
    const isFirstSessionToday = lastDate !== todayStr; // null also qualifies
    const dailyBonus = isFirstSessionToday && minutesPracticed > 0 ? 10 : 0;

    const pointsEarned = minutesPracticed > 0
      ? Math.round(minutesPracticed * multiplier) + dailyBonus
      : 0;

    // ── Write profile update ────────────────────────────────────────────
    const updates: Record<string, number> = {};
    if (newStreak !== current.streak_days) updates.streak_days = newStreak;
    if (pointsEarned > 0) updates.total_points = current.total_points + pointsEarned;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', input.studentId);

      if (updateError) throw updateError;
    }

    return data as PracticeSessionRow;
  }

  async getStudentSessions(
    studentId: string,
    limit = 20
  ): Promise<PracticeSessionRow[]> {
    const { data, error } = await this.supabase
      .from('practice_sessions')
      .select()
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as PracticeSessionRow[];
  }

  async getStudioSessions(
    studioId: string,
    limit = 50
  ): Promise<PracticeSessionRow[]> {
    const { data, error } = await this.supabase
      .from('practice_sessions')
      .select()
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as PracticeSessionRow[];
  }
}
