export type UserRole = 'student' | 'teacher' | 'parent';

export interface ProfileRow {
  id: string;
  role: UserRole;
  display_name: string;
  streak_days: number;
  total_points: number;
  total_days_practiced?: number;
  streak_freeze_count?: number;
  studio_id: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  instrument?: string | null;
  birth_year?: number | null;
  gender?: string | null;       // 'boy' | 'girl' | null
  music_since?: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: 'free' | 'active' | 'canceled' | 'past_due';
  created_at: string;
}

export interface StudioRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  slug: string | null;
  teacher_invite_code: string | null;
  created_at: string;
}

// ============================================================
// Multi-teacher
// ============================================================

export type StudioTeacherRole = 'director' | 'teacher';

export interface StudioTeacherRow {
  id: string;
  studio_id: string;
  teacher_id: string;
  role: StudioTeacherRole;
  invited_by: string | null;
  joined_at: string;
}

export interface TeacherStudentAssignmentRow {
  id: string;
  studio_id: string;
  teacher_id: string;
  student_id: string;
  started_at: string;
  ended_at: string | null;
}

export type EnrollmentStatus = 'pending' | 'approved' | 'waitlisted' | 'denied';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface EnrollmentApplicationRow {
  id: string;
  studio_id: string;
  student_name: string;
  parent_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  instrument: string | null;
  age: number | null;
  experience_level: ExperienceLevel | null;
  preferred_teacher_id: string | null;
  preferred_days: string[] | null;
  notes: string | null;
  status: EnrollmentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
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
  piece_id: string | null;
  duration_seconds: number;
  notes: string | null;
  segments_json: PracticeSegment[] | null;
  recording_url: string | null;
  ai_feedback: string | null;
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
  score_url: string | null;
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

export interface PieceRecording {
  id: string;
  piece_id: string;
  youtube_id: string;
  title: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  added_by_id: string;
  created_at: string;
}

export interface Inspiration {
  id: string;
  user_id: string;
  youtube_id: string;
  title: string;
  thumbnail_url: string | null;
  notes: string | null;
  collection_name: string | null;
  is_public: boolean;
  created_at: string;
}

export interface InspirationComment {
  id: string;
  inspiration_id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
}

export interface YouTubeResult {
  id: string;
  title: string;
  thumbnail: string;
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

// ============================================================
// Lessons & Assignments
// ============================================================

export type LessonStatus = 'scheduled' | 'completed' | 'cancelled';
export type AssignmentType = 'practice' | 'listen' | 'theory' | 'memorize' | 'record';
export type AssignmentStatus = 'active' | 'completed' | 'reviewed';
export type SelfRating = 'struggling' | 'getting_there' | 'nailed_it';

export interface ExternalStudentRow {
  id: string;
  studio_id: string;
  teacher_id: string;
  name: string;
  email: string | null;
  instrument: string | null;
  notes: string | null;
  created_at: string;
}

export interface LessonRow {
  id: string;
  studio_id: string;
  student_id: string | null;           // null for external-student lessons
  external_student_id: string | null;  // set for external-student lessons
  teacher_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: LessonStatus;
  lesson_notes: string | null;
  covered_notes: string | null;
  focus_notes: string | null;
  next_lesson_notes: string | null;
  attendance: 'attended' | 'cancelled' | 'no_show' | null;
  recurrence_id: string | null;
  created_at: string;
}

export interface LessonRecurrenceRow {
  id: string;
  studio_id: string;
  student_id: string | null;
  external_student_id: string | null;
  teacher_id: string;
  day_of_week: number;   // 0=Sunday
  time_of_day: string;   // "HH:MM:SS"
  duration_minutes: number;
  active: boolean;
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  studio_id: string;
  student_id: string;
  teacher_id: string;
  lesson_id: string | null;
  piece_id: string | null;
  title: string;
  instructions: string | null;
  focus: string | null;
  type: AssignmentType;
  target_minutes_per_day: number | null;
  times_per_week: number | null;
  week_start: string | null;  // "YYYY-MM-DD" Monday of the week
  due_date: string | null;    // "YYYY-MM-DD"
  status: AssignmentStatus;
  reference_audio_url: string | null;
  youtube_id: string | null;
  theory_game: string | null;  // set when type === 'theory'; matches View keys in theory page
  created_at: string;
}

export interface AssignmentCompletionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  self_rating: SelfRating | null;
  student_notes: string | null;
  completed_at: string;
}

export interface AssignmentWithContext extends AssignmentRow {
  piece_title?: string | null;
  completion?: AssignmentCompletionRow | null;
}

export interface LessonWithAssignments extends LessonRow {
  student_name?: string;
  student_avatar?: string | null;
  is_external?: boolean;
  assignments: AssignmentRow[];
  completion_count: number;
}

// ============================================================
// Video Rooms (Daily.co)
// ============================================================

export interface VideoRoomRow {
  id: string;
  studio_id: string;
  teacher_id: string;
  student_id: string;
  daily_room_name: string;
  daily_room_url: string;
  status: 'waiting' | 'live' | 'ended';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

// ============================================================
// Billing & Payments
// ============================================================

export type LessonType = 'in_person' | 'online';
export type BillingType = 'private' | 'studio';

export interface BillingConfigRow {
  id: string;
  studio_id: string;
  student_id: string | null;
  external_student_id: string | null;
  teacher_id: string;
  monthly_rate_cents: number;
  billing_day: number;
  notes: string | null;
  // Simple billing fields
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  lesson_rate_cents: number;
  lesson_type: LessonType;
  billing_type: BillingType;
  makeup_credits: number;
  family_id: string | null;
  created_at: string;
}

export type TuitionStatus = 'unpaid' | 'paid' | 'waived';
export type PaymentMethod = 'cash' | 'e-transfer' | 'cheque' | 'other';

export interface TuitionRecordRow {
  id: string;
  billing_config_id: string;
  studio_id: string;
  student_id: string | null;
  external_student_id: string | null;
  teacher_id: string;
  period_month: string;   // "YYYY-MM-DD" (first of month)
  amount_cents: number;
  status: TuitionStatus;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  // Invoice detail
  lesson_count: number;
  makeup_credits_applied: number;
  extra_charges_cents: number;
  extra_charges_desc: string | null;
  created_at: string;
}

export interface BillingChargeRow {
  id: string;
  studio_id: string;
  student_id: string | null;
  external_student_id: string | null;
  teacher_id: string;
  description: string;
  amount_cents: number;
  status: 'unpaid' | 'paid';
  paid_at: string | null;
  charge_date: string;
  created_at: string;
}

// ============================================================
// Parent Portal
// ============================================================

export interface ParentStudentLinkRow {
  id: string;
  parent_id: string;
  student_id: string;
  studio_id: string;
  last_summary_sent_at: string | null;
  created_at: string;
}

// ============================================================
// Progress Reports
// ============================================================

export type ReportStatus = 'draft' | 'sent' | 'archived';

export interface ProgressReportRow {
  id: string;
  studio_id: string;
  student_id: string;
  teacher_id: string;
  term: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  overall_summary: string | null;
  strengths: string | null;
  areas_for_growth: string | null;
  goals_summary: string | null;
  practice_summary: string | null;
  repertoire_summary: string | null;
  teacher_comments: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// RCM Exam Prep
// ============================================================

export type RcmExamStatus = 'preparing' | 'completed' | 'withdrawn';
export type RcmCategory = 'list_a' | 'list_b' | 'list_c' | 'etudes' | 'technical' | 'theory' | 'ear_training' | 'sight_reading';

export interface RcmExamRow {
  id: string;
  studio_id: string;
  student_id: string;
  teacher_id: string;
  grade_level: string;
  instrument: string;
  exam_date: string | null;
  status: RcmExamStatus;
  exam_result: string | null;
  created_at: string;
}

export interface RcmChecklistItemRow {
  id: string;
  exam_id: string;
  category: RcmCategory;
  title: string;
  composer: string | null;
  notes: string | null;
  piece_id: string | null;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

// ============================================================
// Availability
// ============================================================

export interface AvailabilityBlockRow {
  id: string;
  teacher_id: string;
  studio_id: string;
  day_of_week: number;   // 0=Sunday
  start_time: string;   // "HH:MM:SS"
  end_time: string;
  active: boolean;
  created_at: string;
}
