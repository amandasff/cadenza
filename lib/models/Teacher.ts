import { User } from './User';
import type { ProfileRow, StudioRow } from '../types';

export class Teacher extends User {
  public studioName: string;
  public studioId: string | null;
  public inviteCode: string | null;
  public streakDays: number;
  public totalPoints: number;

  constructor(profile: ProfileRow, email: string, studio?: StudioRow) {
    super(
      profile.id,
      email,
      'teacher',
      profile.display_name,
      new Date(profile.created_at),
    );
    this.studioId = studio?.id ?? null;
    this.studioName = studio?.name ?? `${profile.display_name}'s Studio`;
    this.inviteCode = studio?.invite_code ?? null;
    this.streakDays = profile.streak_days;
    this.totalPoints = profile.total_points;
  }

  getHomeRoute(): string {
    return '/teacher';
  }

  hasStudio(): boolean {
    return this.studioId !== null;
  }
}