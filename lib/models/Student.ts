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
    if (this.totalPoints >= 9000) return 'Maestro';
    if (this.totalPoints >= 4500) return 'Virtuoso';
    if (this.totalPoints >= 2000) return 'Advanced';
    if (this.totalPoints >= 900)  return 'Performer';
    if (this.totalPoints >= 400)  return 'Student';
    if (this.totalPoints >= 150)  return 'Apprentice';
    return 'Beginner';
  }
}