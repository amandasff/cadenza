export type UserRole = 'student' | 'teacher';

export interface ProfileRow {
  id: string;
  role: UserRole;
  display_name: string;
  streak_days: number;
  total_points: number;
  studio_id: string | null;
  avatar_url?: string | null;
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
  piece_id: string | null;
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

export type PieceCategory = 'technique' | 'etude' | 'repertoire' | 'theory' | 'ear_training' | 'sight_reading' | 'free';
export type PieceStatus = 'learning' | 'polishing' | 'performance_ready' | 'completed';

export interface PieceRow {
  id: string;
  student_id: string;
  teacher_id: string;
  studio_id: string;
  program_id: string | null;
  title: string;
  composer: string | null;
  book: string | null;
  category: PieceCategory;
  status: PieceStatus;
  sort_order: number;
  sheet_music_url: string | null;
  created_at: string;
}

export interface StrokeData {
  color: string;
  width: number;
  points: [number, number][];
}

export interface AnnotationRow {
  piece_id: string;
  student_id: string;
  page_index: number;
  strokes: StrokeData[];
  updated_at: string;
}

export interface ProgramRow {
  id: string;
  student_id: string;
  teacher_id: string;
  studio_id: string;
  title: string;
  status: 'active' | 'completed';
  created_at: string;
}
