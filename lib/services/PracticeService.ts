import type { SupabaseClient } from '@supabase/supabase-js';
import type { PracticeSessionRow, PracticeSegment } from '../types';

interface LogSessionInput {
  studentId: string;
  studioId: string;
  goalId?: string;
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
        duration_seconds: input.durationSeconds,
        notes: input.notes ?? null,
        segments_json: input.segments ?? null,
        recording_url: input.recordingUrl ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Work out today and yesterday as UTC date strings (Supabase timestamps are UTC)
    const todayStr = new Date().toISOString().slice(0, 10);
    const yDate = new Date();
    yDate.setUTCDate(yDate.getUTCDate() - 1);
    const yesterdayStr = yDate.toISOString().slice(0, 10);

    // Find the most recent session BEFORE this one to determine last practice date
    const { data: prevSessions } = await this.supabase
      .from('practice_sessions')
      .select('created_at')
      .eq('student_id', input.studentId)
      .neq('id', data.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastDate = prevSessions?.[0]?.created_at?.slice(0, 10) ?? null;

    const { data: profile, error: profileFetchError } = await this.supabase
      .from('profiles')
      .select('streak_days')
      .eq('id', input.studentId)
      .single();

    if (profileFetchError) throw profileFetchError;

    const current = profile as { streak_days: number };

    let newStreak: number;
    if (lastDate === null) {
      // Very first session ever
      newStreak = 1;
    } else if (lastDate === todayStr) {
      // Already practiced today — don't touch the streak
      newStreak = current.streak_days;
    } else if (lastDate === yesterdayStr) {
      // Practiced yesterday — extend the streak
      newStreak = current.streak_days + 1;
    } else {
      // Gap of 2+ days — streak broken, restart at 1
      newStreak = 1;
    }

    if (newStreak !== current.streak_days) {
      const { error: updateError } = await this.supabase
        .from('profiles')
        .update({ streak_days: newStreak })
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
