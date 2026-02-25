import type { GoalRow } from '../types';

export type GoalStatus = 'locked' | 'current' | 'completed' | 'boss';

export class Goal {
  public readonly id: string;
  public readonly studentId: string;
  public readonly teacherId: string;
  public readonly title: string;
  public readonly description: string | null;
  public readonly practiceArea: string;
  public readonly points: number;
  public readonly bonusTitle: string | null;
  public readonly bonusPoints: number | null;
  public readonly isBoss: boolean;
  public readonly status: GoalRow['status'];
  public readonly pathOrder: number;
  public readonly dueDate: Date | null;
  public readonly createdAt: Date;

  constructor(row: GoalRow) {
    this.id = row.id;
    this.studentId = row.student_id;
    this.teacherId = row.teacher_id;
    this.title = row.title;
    this.description = row.description;
    this.practiceArea = row.practice_area;
    this.points = row.points;
    this.bonusTitle = row.bonus_title;
    this.bonusPoints = row.bonus_points;
    this.isBoss = row.is_boss;
    this.status = row.status;
    this.pathOrder = row.path_order;
    this.dueDate = row.due_date ? new Date(row.due_date) : null;
    this.createdAt = new Date(row.created_at);
  }

  getDisplayStatus(): GoalStatus {
    if (this.isBoss && this.status === 'current') return 'boss';
    return this.status;
  }

  isCompleted(): boolean {
    return this.status === 'completed';
  }

  isLocked(): boolean {
    return this.status === 'locked';
  }

  getZoneColor(): string {
    const map: Record<string, string> = {
      technique: 'var(--sage)',
      repertoire: 'var(--rose)',
      ear: 'var(--sky)',
      theory: 'var(--butter)',
      sight_reading: 'var(--lavender)',
      free: 'var(--peach)',
    };
    return map[this.practiceArea] ?? 'var(--muted)';
  }
}