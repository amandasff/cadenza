"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PracticeService } from "../../../lib/services/PracticeService";
import { Student } from "../../../lib/models/Student";
import type { PracticeSessionRow } from "../../../lib/types";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthCells(firstOfMonth: Date): (number | null)[] {
  const year = firstOfMonth.getFullYear();
  const month = firstOfMonth.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();
  // Mon=0 offset
  let startDow = firstOfMonth.getDay(); // 0=Sun
  startDow = (startDow + 6) % 7;
  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Rewards() {
  const { user } = useAuth();
  const student = user as Student;

  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePoints, setLivePoints] = useState<number | null>(null);
  const [liveStreak, setLiveStreak] = useState<number | null>(null);

  // Calendar navigation — default to current month
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadSessions = useCallback(async () => {
    if (!student?.id) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const service = PracticeService.getInstance(supabase);
      const data = await service.getStudentSessions(student.id, 500);
      setSessions(data);
    } catch (err) {
      const e = err as { message?: string };
      console.error("loadSessions error:", e?.message);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("total_points, streak_days")
      .eq("id", student.id)
      .single()
      .then(({ data }: { data: { total_points: number; streak_days: number } | null }) => {
        if (data) {
          setLivePoints(data.total_points);
          setLiveStreak(data.streak_days);
        }
      });
  }, [student?.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  if (!student) return null;

  const totalPoints = livePoints ?? student.totalPoints;
  const streakDays  = liveStreak  ?? student.streakDays;
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.round(s.duration_seconds / 60), 0);

  // Set of "YYYY-MM-DD" strings that have at least one session
  const practicedDays = new Set(sessions.map(s => s.created_at.slice(0, 10)));

  const today = new Date();
  const isCurrentMonth =
    calendarDate.getFullYear() === today.getFullYear() &&
    calendarDate.getMonth() === today.getMonth();

  const monthCells = getMonthCells(calendarDate);

  function prevMonth() {
    setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    if (!isCurrentMonth) setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // Count sessions in the visible month (for the month label)
  const monthSessionCount = sessions.filter(s => {
    const dt = new Date(s.created_at);
    return dt.getFullYear() === calendarDate.getFullYear() && dt.getMonth() === calendarDate.getMonth();
  }).length;

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%" }}>

      {/* Page header */}
      <div style={{ padding: "1.5rem 1.5rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)",
            fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            Progress
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
      </div>

      <div style={{ padding: "0 1.5rem 3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Points */}
        <div className="card-base" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div>
            <div style={{
              fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "2.5rem",
              color: "var(--charcoal)", lineHeight: 1, letterSpacing: "-0.02em",
            }}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)",
              marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              Points earned
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.625rem" }}>
          {[
            { value: loading ? "—" : String(sessions.length), label: "Sessions" },
            { value: loading ? "—" : String(totalMinutes),    label: "Minutes" },
            { value: String(streakDays),                       label: "Day streak" },
          ].map(({ value, label }) => (
            <div key={label} className="card-base" style={{ padding: "1rem 0.75rem", textAlign: "center" }}>
              <div style={{
                fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.75rem",
                color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1,
              }}>
                {value}
              </div>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)",
                marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase",
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="card-base" style={{ padding: "1.25rem 1.5rem" }}>
          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <button
              onClick={prevMonth}
              style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 2,
                width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", color: "var(--muted)", fontSize: "0.875rem",
              }}
            >
              ‹
            </button>

            <div style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem",
                color: "var(--charcoal)", letterSpacing: "0.005em",
              }}>
                {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              {!loading && monthSessionCount > 0 && (
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--sage)",
                  marginTop: "0.125rem", letterSpacing: "0.04em",
                }}>
                  {monthSessionCount} session{monthSessionCount !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 2,
                width: 28, height: 28, cursor: isCurrentMonth ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isCurrentMonth ? "var(--border)" : "var(--muted)", fontSize: "0.875rem",
              }}
            >
              ›
            </button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.125rem", marginBottom: "0.25rem" }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: "0.5625rem", color: "var(--muted)",
                fontFamily: "Inter, sans-serif", paddingBottom: "0.25rem", letterSpacing: "0.02em",
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.1875rem" }}>
            {monthCells.map((day, i) => {
              if (day === null) return <div key={i} />;

              const dateStr = toDateStr(calendarDate.getFullYear(), calendarDate.getMonth(), day);
              const practiced = practicedDays.has(dateStr);
              const isToday =
                today.getFullYear() === calendarDate.getFullYear() &&
                today.getMonth()    === calendarDate.getMonth() &&
                today.getDate()     === day;
              const isFuture =
                isCurrentMonth && day > today.getDate();

              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 3,
                    background: practiced ? "var(--sage)" : isToday ? "var(--cream-deep)" : "transparent",
                    border: isToday && !practiced ? "1px solid var(--border-strong)" : "1px solid transparent",
                    fontSize: "0.625rem",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: isToday ? 600 : 400,
                    color: practiced ? "white" : isFuture ? "var(--border-strong)" : "var(--muted)",
                    opacity: isFuture ? 0.4 : 1,
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Legend */}
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
