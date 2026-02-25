import type { UserRole } from '../types';

export abstract class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly role: UserRole,
    public readonly displayName: string,
    public readonly createdAt: Date,
  ) {}

  abstract getHomeRoute(): string;

  isStudent(): boolean {
    return this.role === 'student';
  }

  isTeacher(): boolean {
    return this.role === 'teacher';
  }

  getInitials(): string {
    return this.displayName
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}