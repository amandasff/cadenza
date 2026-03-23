import type { SupabaseClient } from '@supabase/supabase-js';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';
import { Parent } from '../models/Parent';
import type { ProfileRow, StudioRow, UserRole } from '../types';

export type AuthUser = Student | Teacher | Parent;

export class AuthService {
  private static instance: AuthService | null = null;

  private constructor(private supabase: SupabaseClient) {}

  static getInstance(supabase: SupabaseClient): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(supabase);
    }
    AuthService.instance['supabase'] = supabase;
    return AuthService.instance;
  }

  async signUp(
    email: string,
    password: string,
    role: UserRole,
    displayName: string,
  ): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, display_name: displayName },
      },
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Sign up failed — no user returned');

    // Without a session, email confirmation is still enabled in Supabase.
    // Go to: Authentication → Providers → Email → disable "Confirm email"
    if (!data.session) {
      throw new Error('Check your email to confirm your account, then sign in.');
    }

    // Create the profile via the server API route which uses the admin client
    // and bypasses RLS — avoids "violates row-level security" errors on signup.
    const res = await fetch('/api/profile/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, display_name: displayName }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error
          ? `Could not create profile: ${(body as { error: string }).error}`
          : 'Could not create profile. Please try again.',
      );
    }

    // Build the user directly from known data — no extra DB round-trip needed.
    const profileRow: ProfileRow = {
      id: data.user.id,
      role,
      display_name: displayName,
      streak_days: 0,
      total_points: 0,
      studio_id: null,
      created_at: new Date().toISOString(),
    };
    return this.buildUser(profileRow, email);
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Sign in failed');

    try {
      return await this.fetchUser(data.user.id, email);
    } catch {
      // Profile missing or unreadable (broken RLS SELECT policy) — use the server
      // API which runs with the admin client and bypasses RLS entirely.
      const role = (data.user.user_metadata?.role ?? 'student') as UserRole;
      const displayName =
        data.user.user_metadata?.display_name ??
        email.split('@')[0];

      const res = await fetch('/api/profile/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, display_name: displayName }),
      });

      const body = await res.json() as { ok?: boolean; profile?: ProfileRow; error?: string };

      if (!res.ok) {
        throw new Error(`Could not load profile: ${body.error ?? 'unknown error'}`);
      }

      // Use the profile returned by the server (fetched via admin client, bypasses RLS)
      // instead of calling fetchUser() again — avoids a second RLS-blocked read.
      if (body.profile) {
        return this.buildUser(body.profile, email);
      }

      return this.fetchUser(data.user.id, email);
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new Error(error.message);
    AuthService.instance = null;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;
    try {
      return await this.fetchUser(user.id, user.email ?? '');
    } catch {
      return null;
    }
  }

  private async fetchUser(id: string, email: string): Promise<AuthUser> {
    const [{ data: profile, error }, { data: lastSession, error: sessionError }] = await Promise.all([
      this.supabase.from('profiles').select('*').eq('id', id).single<ProfileRow>(),
      this.supabase
        .from('practice_sessions')
        .select('created_at')
        .eq('student_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    if (error || !profile) {
      throw new Error('Profile not found. Please try signing in again.');
    }

    // Compute live streak: streak_days in the DB is only updated when a session
    // is logged — there is no cron job to zero it. Recompute it here so the
    // displayed value is always accurate.
    // If the session query errored (e.g. RLS policy), skip zeroing — trust the DB value.
    if (profile.streak_days > 0 && !sessionError) {
      const lastAt = lastSession?.created_at ?? null;
      if (!lastAt) {
        profile.streak_days = 0;
      } else {
        const toUTCDateStr = (d: Date) =>
          `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        const now = new Date();
        const todayUTC = toUTCDateStr(now);
        const yesterdayUTC = toUTCDateStr(new Date(now.getTime() - 86_400_000));
        const lastUTC = toUTCDateStr(new Date(lastAt));
        if (lastUTC !== todayUTC && lastUTC !== yesterdayUTC) {
          // Check if freeze(s) cover all missed days
          const lastMs = new Date(lastUTC + 'T00:00:00Z').getTime();
          const todayMs = new Date(todayUTC + 'T00:00:00Z').getTime();
          const gapDays = Math.round((todayMs - lastMs) / 86_400_000);
          const missedDays = gapDays - 1;
          const hasFreezeProtection =
            missedDays >= 1 && missedDays <= (profile.streak_freeze_count ?? 0);
          if (!hasFreezeProtection) {
            profile.streak_days = 0;
          }
        }
      }
    }

    return this.buildUser(profile, email);
  }

  private async buildUser(profile: ProfileRow, email: string): Promise<AuthUser> {
    if (profile.role === 'teacher') {
      const { data: studio } = await this.supabase
        .from('studios')
        .select('*')
        .eq('owner_id', profile.id)
        .single<StudioRow>();
      return new Teacher(profile, email, studio ?? undefined);
    }
    if (profile.role === 'parent') {
      return new Parent(profile, email);
    }
    return new Student(profile, email);
  }
}
