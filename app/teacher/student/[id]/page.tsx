"use client";
import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { GoalService } from "../../../../lib/services/GoalService";
import { PracticeService } from "../../../../lib/services/PracticeService";
import { ChatService } from "../../../../lib/services/ChatService";
import { Teacher } from "../../../../lib/models/Teacher";
import type { ProfileRow, GoalRow, PracticeSessionRow } from "../../../../lib/types";

const AREAS: Record<string, { label: string; color: string }> = {
  technique:    { label: "Technique",    color: "var(--sage)" },
  repertoire:   { label: "Repertoire",   color: "var(--rose)" },
  ear_training: { label: "Ear Training", color: "var(--sky)" },
  theory:       { label: "Theory",       color: "var(--butter)" },
};

const PRESET_AWARDS = [5, 10, 25, 50];

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function StudentProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [student, setStudent] = useState<ProfileRow | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Award stars state
  const [customAward, setCustomAward] = useState("");
  const [awardNote, setAwardNote] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState(false);
  const [awardError, setAwardError] = useState("");

  // Goal completion state
  const [completingGoalId, setCompletingGoalId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();

        if (profileErr || !profileData) { setNotFound(true); return; }
        setStudent(profileData as ProfileRow);

        const [studentGoals, studentSessions] = await Promise.all([
          GoalService.getInstance(supabase).getTeacherGoalsByStudent(teacher.id, id),
          PracticeService.getInstance(supabase).getStudentSessions(id, 10),
        ]);
        setGoals(studentGoals);
        setSessions(studentSessions);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, teacher?.id]);

  async function handleAward(points: number) {
    if (!student || awarding || points <= 0) return;
    setAwarding(true);
    setAwardError("");
    setAwardSuccess(false);
    try {
      const supabase = getSupabaseBrowserClient();
      await GoalService.getInstance(supabase).awardPoints(student.id, points);

      if (teacher?.studioId) {
        const note = awardNote.trim() ? ` — "${awardNote.trim()}"` : "";
        await ChatService.getInstance(supabase).postSystemMessage(
          teacher.studioId, teacher.id, student.id,
          `Your teacher awarded you ${points} points!${note}`
        ).catch(() => {});
      }

      setStudent(prev => prev ? { ...prev, total_points: prev.total_points + points } : prev);
      setCustomAward("");
      setAwardNote("");
      setAwardSuccess(true);
      setTimeout(() => setAwardSuccess(false), 3000);
    } catch (err) {
      const e = err as { message?: string };
      setAwardError(e?.message ?? "Failed to award points");
    } finally {
      setAwarding(false);
    }
  }

  async function handleCompleteGoal(goal: GoalRow) {
    if (completingGoalId) return;
    setCompletingGoalId(goal.id);
    try {
      const supabase = getSupabaseBrowserClient();
      await GoalService.getInstance(supabase).completeGoal(goal.id, goal.student_id, goal.points);

      if (teacher?.studioId) {
        await ChatService.getInstance(supabase).postSystemMessage(
          teacher.studioId, teacher.id, goal.student_id,
          `Your teacher marked "${goal.title}" complete — you earned ${goal.points} points!`
        ).catch(() => {});
      }

      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: "completed" } : g));
      setStudent(prev => prev ? { ...prev, total_points: prev.total_points + goal.points } : prev);
    } catch (err) {
      console.error("complete goal error:", err);
    } finally {
      setCompletingGoalId(null);
    }
  }

  const completedGoals = goals.filter(g => g.status === "completed");
  const currentGoals = goals.filter(g => g.status === "current");
  const pct = goals.length > 0 ? Math.round((completedGoals.length / goals.length) * 100) : 0;
  const initials = student
    ? student.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: i === 1 ? 60 : 140, borderRadius: 4 }} />
        ))}
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="empty-state" style={{ padding: "3rem 0" }}>
        <div className="empty-state-title">Student not found</div>
        <Link href="/teacher" style={{ marginTop: "1rem", display: "inline-block", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", textDecoration: "underline" }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/teacher" style={{ color: "var(--muted)", textDecoration: "none", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>← Back</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flex: 1 }}>
          <div style={{
            width: 44, height: 44,
            background: "var(--charcoal)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--white)",
            flexShrink: 0, letterSpacing: "0.02em",
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "1.125rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
              {student.display_name}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "0.125rem 0 0", fontFamily: "Inter, sans-serif" }}>
              {goals.length} goal{goals.length !== 1 ? "s" : ""} · joined {new Date(student.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
        {[
          { value: student.total_points.toLocaleString(), label: "Points" },
          { value: student.streak_days, label: "Day streak" },
          { value: `${pct}%`, label: "Goals done" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.75rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="r-two-col" style={{ gridTemplateColumns: "1fr 280px" }}>

        {/* Left: Goals + Sessions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Goals */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Goals ({goals.length})
              </span>
              <Link
                href={`/teacher/goals?student=${id}`}
                style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--charcoal)", textDecoration: "none", letterSpacing: "0.02em" }}
              >
                + Add goal
              </Link>
            </div>

            {goals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No goals yet</div>
                <p className="empty-state-desc">Add a goal to start tracking progress.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {/* Current goals */}
                {currentGoals.length > 0 && (
                  <>
                    <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem" }}>
                      In Progress
                    </div>
                    {currentGoals.map(g => {
                      const area = AREAS[g.practice_area] ?? AREAS["technique"];
                      const isCompleting = completingGoalId === g.id;
                      return (
                        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", borderRadius: 3, border: "1px solid var(--border)", background: "var(--cream)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {g.title}
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: area.color, fontFamily: "Inter, sans-serif", marginTop: "0.125rem" }}>
                              {area.label} · {g.points} pts
                            </div>
                          </div>
                          <button
                            onClick={() => handleCompleteGoal(g)}
                            disabled={!!completingGoalId}
                            style={{
                              flexShrink: 0,
                              padding: "0.375rem 0.75rem",
                              borderRadius: 3,
                              border: "1px solid var(--border-strong)",
                              background: isCompleting ? "var(--border)" : "var(--white)",
                              color: "var(--charcoal)",
                              fontFamily: "Inter, sans-serif",
                              fontWeight: 500,
                              fontSize: "0.75rem",
                              cursor: completingGoalId ? "default" : "pointer",
                              transition: "all 0.15s",
                              letterSpacing: "0.01em",
                            }}
                          >
                            {isCompleting ? "Saving…" : "Complete"}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Completed goals */}
                {completedGoals.length > 0 && (
                  <>
                    <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: currentGoals.length > 0 ? "0.75rem" : 0, marginBottom: "0.375rem" }}>
                      Completed ({completedGoals.length})
                    </div>
                    {completedGoals.map(g => {
                      const area = AREAS[g.practice_area] ?? AREAS["technique"];
                      return (
                        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", borderRadius: 3, opacity: 0.5 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {g.title}
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: area.color, fontFamily: "Inter, sans-serif", marginTop: "0.125rem" }}>
                              {area.label} · {g.points} pts
                            </div>
                          </div>
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>Done</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
              Recent Sessions ({sessions.length})
            </div>
            {sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No sessions yet</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {sessions.map(s => {
                  const mins = Math.max(1, Math.round(s.duration_seconds / 60));
                  const segCount = Array.isArray(s.segments_json) ? s.segments_json.length : 0;
                  return (
                    <Link
                      key={s.id}
                      href={`/teacher/review/${s.id}`}
                      style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.75rem", borderRadius: 3, background: "transparent", textDecoration: "none", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--cream)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                          {mins} min session
                          {s.recording_url && <span style={{ marginLeft: "0.375rem", color: "var(--muted)", fontSize: "0.75rem" }}>· rec</span>}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.125rem" }}>
                          {segCount > 0 ? `${segCount} segment${segCount !== 1 ? "s" : ""}` : "No segments"} · {timeAgo(s.created_at)}
                        </div>
                      </div>
                      <span style={{ color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500, flexShrink: 0 }}>Review →</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Award Points */}
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.25rem", alignSelf: "start" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
            Award Points
          </div>

          {/* Quick preset buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem", marginBottom: "1rem" }}>
            {PRESET_AWARDS.map(pts => (
              <button
                key={pts}
                onClick={() => handleAward(pts)}
                disabled={awarding}
                style={{
                  padding: "0.625rem",
                  borderRadius: 3,
                  border: "1px solid var(--border-strong)",
                  background: "var(--cream)",
                  color: "var(--charcoal)",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  cursor: awarding ? "default" : "pointer",
                  opacity: awarding ? 0.5 : 1,
                  transition: "all 0.15s",
                  letterSpacing: "0.01em",
                }}
              >
                +{pts}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.75rem" }}>
            <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>
              Custom amount
            </label>
            <input
              type="number"
              min="1"
              max="9999"
              value={customAward}
              onChange={e => setCustomAward(e.target.value)}
              placeholder="e.g. 15"
              style={{
                borderRadius: 3,
                border: "1px solid var(--border-strong)",
                padding: "0.5rem 0.75rem",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.875rem",
                background: "var(--cream)",
                color: "var(--charcoal)",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Optional note */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.875rem" }}>
            <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={awardNote}
              onChange={e => setAwardNote(e.target.value)}
              placeholder="Great work on your recital!"
              style={{
                borderRadius: 3,
                border: "1px solid var(--border-strong)",
                padding: "0.5rem 0.75rem",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.875rem",
                background: "var(--cream)",
                color: "var(--charcoal)",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={() => {
              const pts = parseInt(customAward, 10);
              if (!isNaN(pts) && pts > 0) handleAward(pts);
            }}
            disabled={awarding || !customAward || parseInt(customAward, 10) <= 0}
            style={{
              width: "100%",
              padding: "0.625rem",
              borderRadius: 3,
              border: "none",
              background: awardSuccess
                ? "var(--sage)"
                : !customAward || parseInt(customAward, 10) <= 0
                  ? "var(--border)"
                  : "var(--charcoal)",
              color: "white",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: "0.875rem",
              cursor: awarding || !customAward ? "default" : "pointer",
              transition: "background 0.15s",
              letterSpacing: "0.01em",
            }}
          >
            {awardSuccess ? "Awarded!" : awarding ? "Awarding…" : "Award Custom Points"}
          </button>

          {awardError && (
            <div style={{ marginTop: "0.5rem", background: "var(--cream-deep)", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "var(--charcoal)", fontFamily: "Inter, sans-serif" }}>
              {awardError}
            </div>
          )}

          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            Points are added to {student.display_name.split(" ")[0]}&apos;s total and they receive a notification in chat.
          </p>
        </div>
      </div>
    </div>
  );
}
