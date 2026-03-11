"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PracticeService } from "../../../lib/services/PracticeService";
import { Student } from "../../../lib/models/Student";
import type { PracticeSessionRow, GoalRow } from "../../../lib/types";

// ── Level system ─────────────────────────────────────────────────────────────
// Calibrated so:
//  • Apprentice reachable in ~1 week of casual practice (150 pts)
//  • Performer in ~10 weeks of consistent practice (900 pts)
//  • Virtuoso after ~6 months of serious daily practice (4500 pts)
//  • Maestro is the long-term prestige tier (9000 pts)
const LEVELS = [
  { name: "Beginner",   min: 0,    color: "var(--muted)" },
  { name: "Apprentice", min: 150,  color: "var(--sage)" },
  { name: "Student",    min: 400,  color: "#7b9cbf" },
  { name: "Performer",  min: 900,  color: "#9b8bbf" },
  { name: "Advanced",   min: 2000, color: "var(--peach)" },
  { name: "Virtuoso",   min: 4500, color: "#c9a227" },
  { name: "Maestro",    min: 9000, color: "var(--charcoal)" },
];

function getLevel(points: number) {
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) { idx = i; break; }
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const progress = next
    ? Math.min(100, ((points - current.min) / (next.min - current.min)) * 100)
    : 100;
  return { current, next, progress, idx };
}

// ── Badge definitions ─────────────────────────────────────────────────────────
// Inspired by Tonara's achievement system + behavioral psychology:
//  • Early badges are easy wins (hook the habit loop)
//  • Streak badges create loss aversion (don't break the chain!)
//  • Points/time badges show long-term progress
//  • Goal badges tie back to teacher-set milestones
interface BadgeStats {
  sessions: number;
  totalMinutes: number;
  streakDays: number;
  totalPoints: number;
  completedGoals: number;
  completedAssignments: number;
}

const BADGES = [
  // ── Habit formation ──
  { id: "first_note",    icon: "♪",  name: "First Note",       desc: "Log your first practice session",  unlocked: (s: BadgeStats) => s.sessions >= 1 },
  { id: "on_a_roll",     icon: "🔥", name: "On a Roll",         desc: "3-day practice streak",            unlocked: (s: BadgeStats) => s.streakDays >= 3 },
  { id: "daily_ten",     icon: "📅", name: "10 Sessions",       desc: "Complete 10 practice sessions",    unlocked: (s: BadgeStats) => s.sessions >= 10 },
  // ── Streak milestones (loss aversion loop) ──
  { id: "week_warrior",  icon: "⚡", name: "Week Warrior",      desc: "7-day streak — +500 bonus!",      unlocked: (s: BadgeStats) => s.streakDays >= 7 },
  { id: "fortnight",     icon: "💫", name: "Fortnight Fire",    desc: "14-day streak — +500 bonus!",     unlocked: (s: BadgeStats) => s.streakDays >= 14 },
  { id: "monthly",       icon: "👑", name: "Monthly Maestro",   desc: "30-day streak — +500 bonus!",     unlocked: (s: BadgeStats) => s.streakDays >= 30 },
  // ── Practice time ──
  { id: "hour_power",    icon: "⏱", name: "Hour Power",        desc: "Practice 60 minutes total",       unlocked: (s: BadgeStats) => s.totalMinutes >= 60 },
  { id: "ten_hours",     icon: "⌛", name: "Ten Hours",          desc: "Practice 10 hours total",         unlocked: (s: BadgeStats) => s.totalMinutes >= 600 },
  { id: "fifty_hours",   icon: "🏆", name: "Fifty Hours",       desc: "Practice 50 hours total",         unlocked: (s: BadgeStats) => s.totalMinutes >= 3000 },
  // ── Goals & assignments ──
  { id: "goal_getter",   icon: "🎵", name: "Goal Getter",       desc: "Complete your first goal",        unlocked: (s: BadgeStats) => s.completedGoals >= 1 },
  { id: "overachiever",  icon: "🌟", name: "Overachiever",      desc: "Complete 5 goals",                unlocked: (s: BadgeStats) => s.completedGoals >= 5 },
  { id: "assignment_ace",icon: "✅", name: "Assignment Ace",    desc: "Complete 5 assignments",          unlocked: (s: BadgeStats) => s.completedAssignments >= 5 },
  // ── Points milestones ──
  { id: "rising_star",   icon: "⭐", name: "Rising Star",       desc: "Earn 500 points",                 unlocked: (s: BadgeStats) => s.totalPoints >= 500 },
  { id: "high_achiever", icon: "💎", name: "High Achiever",     desc: "Earn 2,000 points",               unlocked: (s: BadgeStats) => s.totalPoints >= 2000 },
  { id: "elite",         icon: "🎹", name: "Elite",              desc: "Earn 5,000 points",               unlocked: (s: BadgeStats) => s.totalPoints >= 5000 },
];

// ── Date helpers ──────────────────────────────────────────────────────────────
// Always use LOCAL dates so the calendar and streak match what the student sees.
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthCells(firstOfMonth: Date): (number | null)[] {
  const year = firstOfMonth.getFullYear();
  const month = firstOfMonth.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();
  let startDow = firstOfMonth.getDay();
  startDow = (startDow + 6) % 7;
  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Rewards() {
  const { user } = useAuth();
  const student = user as Student;

  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePoints, setLivePoints] = useState<number | null>(null);
  const [liveStreak, setLiveStreak] = useState<number | null>(null);
  const [completedGoals, setCompletedGoals] = useState<GoalRow[]>([]);
  const [completedAssignments, setCompletedAssignments] = useState(0);

  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadAll = useCallback(async () => {
    if (!student?.id) return;
    const supabase = getSupabaseBrowserClient();
    try {
      const [sessionData] = await Promise.all([
        PracticeService.getInstance(supabase).getStudentSessions(student.id, 500),
      ]);
      setSessions(sessionData);

      // Live stats
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_points, streak_days")
        .eq("id", student.id)
        .single();
      if (profile) {
        const p = profile as { total_points: number; streak_days: number };
        setLivePoints(p.total_points);
        setLiveStreak(p.streak_days);
      }

      // Completed goals (for badges)
      const { data: goals } = await supabase
        .from("goals")
        .select()
        .eq("student_id", student.id)
        .eq("status", "completed");
      setCompletedGoals((goals ?? []) as GoalRow[]);

      // Assignment completions (silently skip if table doesn't exist)
      try {
        const { data: completions } = await supabase
          .from("assignment_completions")
          .select("id")
          .eq("student_id", student.id);
        setCompletedAssignments((completions ?? []).length);
      } catch { /* table may not exist yet */ }

    } catch (err) {
      console.error("rewards load error:", err);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!student) return null;

  const totalPoints = livePoints ?? student.totalPoints;
  const streakDays  = liveStreak  ?? student.streakDays;
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.round(s.duration_seconds / 60), 0);

  // Level
  const { current: lvl, next: nextLvl, progress: lvlProgress } = getLevel(totalPoints);

  // Effective streak — must come before streakMultiplier call.
  // The stored streak_days only changes when a session is logged, so it can be stale
  // after a student misses a day. Calculate the real display value from session history.
  const lastSessionDate = sessions.length > 0 ? toLocalDateStr(new Date(sessions[0].created_at)) : null;
  const todayLocal = toLocalDateStr(new Date());
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayLocal = toLocalDateStr(yesterdayDate);
  const streakIsActive = lastSessionDate === todayLocal || lastSessionDate === yesterdayLocal;
  const effectiveStreak = streakIsActive ? streakDays : 0;

  // This week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSessions = sessions.filter(s => new Date(s.created_at) >= weekAgo);
  const weekMinutes  = weekSessions.reduce((sum, s) => sum + Math.round(s.duration_seconds / 60), 0);
  const weekPtsEst   = weekSessions.length * 100; // 100 pts per session

  // Badges (use effective streak so badges don't show as earned when streak lapsed)
  const badgeStats: BadgeStats = {
    sessions: sessions.length,
    totalMinutes,
    streakDays: effectiveStreak,
    totalPoints,
    completedGoals: completedGoals.length,
    completedAssignments,
  };
  const badges = BADGES.map(b => ({ ...b, earned: b.unlocked(badgeStats) }));
  const earnedCount = badges.filter(b => b.earned).length;

  // Calendar — use local dates so sessions show on the day the student actually practiced
  const practicedDays = new Set(sessions.map(s => toLocalDateStr(new Date(s.created_at))));
  const today = new Date();
  const isCurrentMonth =
    calendarDate.getFullYear() === today.getFullYear() &&
    calendarDate.getMonth()    === today.getMonth();
  const monthCells = getMonthCells(calendarDate);
  const monthSessionCount = sessions.filter(s => {
    const dt = new Date(s.created_at);
    return dt.getFullYear() === calendarDate.getFullYear() && dt.getMonth() === calendarDate.getMonth();
  }).length;

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%" }}>

      {/* Header */}
      <div style={{ padding: "1.5rem 1.5rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Progress
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
      </div>

      <div style={{ padding: "1rem 1.5rem 5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>

        {/* ── Level card ── */}
        <div className="card-base" style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)", letterSpacing: "-0.01em" }}>
                {lvl.name}
              </div>
              {nextLvl ? (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  {(nextLvl.min - totalPoints).toLocaleString()} pts to {nextLvl.name}
                </div>
              ) : (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  Maximum level reached
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "2rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {totalPoints.toLocaleString()}
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>
                total points
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 7, background: "var(--cream-deep)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${lvlProgress}%`,
              background: lvl.color,
              borderRadius: 4,
              transition: "width 0.8s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.375rem" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)" }}>
              {lvl.min.toLocaleString()}
            </span>
            {nextLvl && (
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)" }}>
                {nextLvl.min.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
          {[
            {
              value: String(effectiveStreak),
              label: "Day streak",
              sub: effectiveStreak > 0 && lastSessionDate === yesterdayLocal
                ? "Practice today!"
                : effectiveStreak > 0 && effectiveStreak % 7 === 0 ? "+500 this week!" : undefined,
              subColor: effectiveStreak > 0 && lastSessionDate === yesterdayLocal
                ? "var(--peach)"
                : "var(--sage)",
            },
            {
              value: String(sessions.length),
              label: "Sessions",
              sub: undefined,
              subColor: undefined,
            },
            {
              value: totalMinutes >= 60
                ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                : `${totalMinutes}m`,
              label: "Practiced",
              sub: undefined,
              subColor: undefined,
            },
            {
              value: String(completedGoals.length),
              label: "Goals done",
              sub: undefined,
              subColor: undefined,
            },
          ].map(({ value, label, sub, subColor }) => (
            <div key={label} className="card-base" style={{ padding: "0.875rem 0.5rem", textAlign: "center" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.375rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", marginTop: "0.25rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {label}
              </div>
              {sub && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.4375rem", color: subColor, marginTop: "0.125rem", letterSpacing: "0.02em" }}>
                  {sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── This week ── */}
        {!loading && weekSessions.length > 0 && (
          <div className="card-base" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
              This Week
            </div>
            <div style={{ display: "flex", gap: "2rem", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.5rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {weekSessions.length}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "0.25rem" }}>
                  sessions
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.5rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {weekMinutes}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "0.25rem" }}>
                  minutes
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.5rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  ~{weekPtsEst}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "0.25rem" }}>
                  pts earned
                </div>
              </div>
            </div>
            {effectiveStreak > 0 && effectiveStreak % 7 === 0 && (
              <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "var(--cream-deep)", borderRadius: 3, fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)" }}>
                🔥 {effectiveStreak}-day streak — <strong>+500 bonus</strong> awarded this week!
              </div>
            )}
          </div>
        )}

        {/* ── How to earn points ── */}
        <div className="card-base" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            How you earn points
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              { label: "Practice session",      value: "+100 pts" },
              { label: "7-day streak",          value: "+500 bonus" },
              { label: "14-day streak",         value: "+500 bonus" },
              { label: "21-day streak",         value: "+500 bonus" },
              { label: "Complete goal",         value: "Points set by your teacher" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", flexShrink: 0 }}>{label}</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Badges ── */}
        <div className="card-base" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Achievements
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
              {earnedCount} / {badges.length} earned
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem" }}>
            {badges.map(badge => (
              <div
                key={badge.id}
                title={badge.desc}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.75rem 0.25rem 0.625rem",
                  borderRadius: 4,
                  background: badge.earned ? "var(--cream-deep)" : "transparent",
                  border: "1px solid var(--border)",
                  opacity: badge.earned ? 1 : 0.35,
                  cursor: "default",
                }}
              >
                <span style={{ fontSize: "1.125rem", filter: badge.earned ? "none" : "grayscale(1)" }}>
                  {badge.icon}
                </span>
                <span style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.4375rem",
                  fontWeight: badge.earned ? 600 : 400,
                  color: badge.earned ? "var(--charcoal)" : "var(--muted)",
                  textAlign: "center",
                  lineHeight: 1.3,
                  letterSpacing: "0.01em",
                }}>
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Practice calendar ── */}
        <div className="card-base" style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <button
              onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.875rem" }}
            >
              ‹
            </button>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", letterSpacing: "0.005em" }}>
                {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              {!loading && monthSessionCount > 0 && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--sage)", marginTop: "0.125rem", letterSpacing: "0.04em" }}>
                  {monthSessionCount} session{monthSessionCount !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <button
              onClick={() => { if (!isCurrentMonth) setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }}
              disabled={isCurrentMonth}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, width: 28, height: 28, cursor: isCurrentMonth ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: isCurrentMonth ? "var(--border)" : "var(--muted)", fontSize: "0.875rem" }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.125rem", marginBottom: "0.25rem" }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: "0.5625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", paddingBottom: "0.25rem", letterSpacing: "0.02em" }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.1875rem" }}>
            {monthCells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const dateStr = toDateStr(calendarDate.getFullYear(), calendarDate.getMonth(), day);
              const practiced = practicedDays.has(dateStr);
              const isToday =
                today.getFullYear() === calendarDate.getFullYear() &&
                today.getMonth()    === calendarDate.getMonth() &&
                today.getDate()     === day;
              const isFuture = isCurrentMonth && day > today.getDate();
              return (
                <div key={i} style={{
                  aspectRatio: "1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 3,
                  background: practiced ? "var(--sage)" : isToday ? "var(--cream-deep)" : "transparent",
                  border: isToday && !practiced ? "1px solid var(--border-strong)" : "1px solid transparent",
                  fontSize: "0.625rem",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: isToday ? 600 : 400,
                  color: practiced ? "white" : isFuture ? "var(--border-strong)" : "var(--muted)",
                  opacity: isFuture ? 0.4 : 1,
                }}>
                  {day}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.875rem", justifyContent: "flex-end" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--sage)" }} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", letterSpacing: "0.03em" }}>
              Practice day
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
