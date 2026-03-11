import type { SupabaseClient } from '@supabase/supabase-js';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';
import type { ProfileRow, StudioRow, UserRole } from '../types';

export type AuthUser = Student | Teacher;

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

    // Explicitly upsert the profile — do not rely solely on the DB trigger.
    const { error: upsertError } = await this.supabase
      .from('profiles')
      .upsert(
        { id: data.user.id, role, display_name: displayName },
        { onConflict: 'id' },
      );

    if (upsertError) {
      throw new Error(
        upsertError.message.includes('relation')
          ? 'Database schema not found. Run the SQL setup in Supabase SQL Editor first.'
          : `Could not create profile: ${upsertError.message}`,
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
      // Profile missing — happens when email confirmation is enabled and the profile
      // upsert during signUp() was skipped. Recreate it from auth metadata.
      const role = (data.user.user_metadata?.role ?? 'student') as UserRole;
      const displayName =
        data.user.user_metadata?.display_name ??
        email.split('@')[0];

      const { error: upsertError } = await this.supabase
        .from('profiles')
        .upsert({ id: data.user.id, role, display_name: displayName }, { onConflict: 'id' });

      if (upsertError) throw new Error(`Could not create profile: ${upsertError.message}`);

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
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single<ProfileRow>();

    if (error || !profile) {
      throw new Error('Profile not found. Please try signing in again.');
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
    return new Student(profile, email);
  }
}
