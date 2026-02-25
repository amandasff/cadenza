export type UserRole = 'student' | 'teacher';

export interface ProfileRow {
  id: string;
  role: UserRole;
  display_name: string;
  streak_days: number;
  total_points: number;
  studio_id: string | null;
  created_at: string;
}

export interface StudioRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

export interface GoalRow {
  id: string;
  studio_id: string;
  student_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  practice_area: string;
  points: number;
  bonus_title: string | null;
  bonus_points: number | null;
  is_boss: boolean;
  status: 'locked' | 'current' | 'completed';
  path_order: number;
  due_date: string | null;
  teacher_feedback: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  studio_id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  message_type: 'user' | 'system';
  content: string;
  created_at: string;
}

export interface PracticeSegment {
  title: string;
  practice_area: string;
  start_seconds: number;
}

export interface PracticeSessionRow {
  id: string;
  student_id: string;
  studio_id: string;
  goal_id: string | null;
  duration_seconds: number;
  notes: string | null;
  segments_json: PracticeSegment[] | null;
  recording_url: string | null;
  status: string;
  created_at: string;
}

export interface StudioMemberRow extends ProfileRow {
  studioName: string;
}
