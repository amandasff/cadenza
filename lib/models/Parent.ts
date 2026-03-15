import { User } from './User';
import type { ProfileRow } from '../types';

export class Parent extends User {
  constructor(profile: ProfileRow, email: string) {
    super(profile.id, email, 'parent', profile.display_name, new Date(profile.created_at));
  }

  getHomeRoute(): string {
    return '/parent';
  }
}
