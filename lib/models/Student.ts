import { User } from './User';
import type { ProfileRow } from '../types';

export class Student extends User {
  public streakDays: number;
  public totalPoints: number;
  public studioId: string | null;

  constructor(profile: ProfileRow, email: string) {
    super(
      profile.id,
      email,
      'student',
      profile.display_name,
      new Date(profile.created_at),
    );
    this.streakDays = profile.streak_days;
    this.totalPoints = profile.total_points;
    this.studioId = profile.studio_id;
  }

  getHomeRoute(): string {
    return '/student';
  }

  getLevelLabel(): string {
    if (this.totalPoints >= 5000) return 'Virtuoso';
    if (this.totalPoints >= 2000) return 'Performer';
    if (this.totalPoints >= 500) return 'Practitioner';
    return 'Beginner';
  }
}