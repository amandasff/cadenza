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

const AREAS: Record<string, { label: string; color: string; icon: string }> = {
  technique:    { label: "Technique",    color: "var(--sage)",   icon: "🌿" },
  repertoire:   { label: "Repertoire",   color: "var(--rose)",   icon: "🌸" },
  ear_training: { label: "Ear Training", color: "var(--sky)",    icon: "🎧" },
  theory:       { label: "Theory",       color: "var(--butter)", icon: "⭐" },
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

      // Notify student via chat
      if (teacher?.studioId) {
        const note = awardNote.trim() ? `\n"${awardNote.trim()}"` : "";
        await ChatService.getInstance(supabase).postSystemMessage(
          teacher.studioId, teacher.id, student.id,
          `⭐ Your teacher awarded you ${points} stars!${note}`
        ).catch(() => {});
      }

      setStudent(prev => prev ? { ...prev, total_points: prev.total_points + points } : prev);
      setCustomAward("");
      setAwardNote("");
      setAwardSuccess(true);
      setTimeout(() => setAwardSuccess(false), 3000);
    } catch (err) {
      const e = err as { message?: string };
      setAwardError(e?.message ?? "Failed to award stars");
    } finally {
      setAwarding(false);
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
        <div className="skeleton" style={{ height: 32, width: "40%", borderRadius: 100 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 20 }} />
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="empty-state" style={{ padding: "3rem 0" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>😕</div>
        <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--charcoal)", margin: 0 }}>Student not found</p>
        <Link href="/teacher" style={{ marginTop: "1rem", display: "inline-block", color: "var(--peach)", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/teacher" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "1.1rem" }}>←</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flex: 1 }}>
          <div style={{
            width: 52, height: 52,
            background: "var(--peach)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1rem", color: "white",
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.3rem", color: "var(--charcoal)", margin: 0 }}>
              {student.display_name}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.1rem 0 0", fontFamily: "DM Sans, sans-serif" }}>
              {goals.length} goals · joined {new Date(student.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--border)", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "var(--butter)" }}>
            ⭐ {student.total_points.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>Total Stars</div>
        </div>
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--border)", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "var(--peach)" }}>
            🔥 {student.streak_days}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>Day Streak</div>
        </div>
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--border)", padding: "1rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "var(--sage)" }}>
            {pct}%
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>Goals Done</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="r-two-col" style={{ gridTemplateColumns: "1fr 300px" }}>

        {/* Left: Goals + Sessions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Goals */}
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--border)", padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Goals ({goals.length})
              </div>
              <Link
                href={`/teacher/goals?student=${id}`}
                style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--peach)", textDecoration: "none" }}
              >
                + Add Goal
              </Link>
            </div>

            {goals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem" }}>
                No goals yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {/* Current goals first */}
                {currentGoals.length > 0 && (
                  <>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "Nunito, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.25rem" }}>
                      In Progress
                    </div>
                    {currentGoals.map(g => {
                      const area = AREAS[g.practice_area] ?? AREAS["technique"];
                      return (
                        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.75rem", borderRadius: 12, background: "var(--cream)" }}>
                          <span style={{ fontSize: "1rem" }}>{area.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {g.title}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: area.color, fontFamily: "DM Sans, sans-serif" }}>{area.label}</div>
                          </div>
                          <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--butter)", whiteSpace: "nowrap" }}>
                            ⭐ {g.points}
                          </span>
                          <span style={{ background: "var(--peach-bg)", color: "var(--peach)", padding: "0.15rem 0.5rem", borderRadius: 100, fontSize: "0.65rem", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                            Active
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Completed goals */}
                {completedGoals.length > 0 && (
                  <>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "Nunito, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                      Completed ({completedGoals.length})
                    </div>
                    {completedGoals.map(g => {
                      const area = AREAS[g.practice_area] ?? AREAS["technique"];
                      return (
                        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.75rem", borderRadius: 12, opacity: 0.7 }}>
                          <span style={{ fontSize: "1rem" }}>{area.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {g.title}
                            </div>
                          </div>
                          <span style={{ background: "var(--sage-bg)", color: "var(--sage)", padding: "0.15rem 0.5rem", borderRadius: 100, fontSize: "0.65rem", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                            ✓ Done
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--border)", padding: "1.25rem" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
              Recent Sessions ({sessions.length})
            </div>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem" }}>
                No sessions yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {sessions.map(s => {
                  const mins = Math.max(1, Math.round(s.duration_seconds / 60));
                  const segCount = Array.isArray(s.segments_json) ? s.segments_json.length : 0;
                  return (
                    <Link
                      key={s.id}
                      href={`/teacher/review/${s.id}`}
                      style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.75rem", borderRadius: 12, background: "var(--cream)", textDecoration: "none" }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--charcoal)" }}>
                          {mins} min session
                          {s.recording_url && <span style={{ marginLeft: "0.4rem", fontSize: "0.8rem" }}>🎙</span>}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                          {segCount > 0 ? `${segCount} segment${segCount !== 1 ? "s" : ""}` : "No segments"} · {timeAgo(s.created_at)}
                        </div>
                      </div>
                      <span style={{ color: "var(--sky)", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem" }}>Review →</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Award Stars */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--border)", padding: "1.25rem" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
            Award Stars
          </div>

          {/* Quick preset buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
            {PRESET_AWARDS.map(pts => (
              <button
                key={pts}
                onClick={() => handleAward(pts)}
                disabled={awarding}
                style={{
                  padding: "0.65rem",
                  borderRadius: 12,
                  border: "1.5px solid var(--butter-light, #f0d060)",
                  background: "var(--butter-bg)",
                  color: "var(--butter)",
                  fontFamily: "Nunito, sans-serif",
                  fontWeight: 800,
                  fontSize: "0.875rem",
                  cursor: awarding ? "default" : "pointer",
                  opacity: awarding ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                ⭐ +{pts}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: "0.35rem" }}>
              Custom amount
            </div>
            <input
              type="number"
              min="1"
              max="9999"
              value={customAward}
              onChange={e => setCustomAward(e.target.value)}
              placeholder="e.g. 15"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1.5px solid var(--border)",
                padding: "0.55rem 0.75rem",
                fontFamily: "DM Sans, sans-serif",
                fontSize: "0.875rem",
                background: "var(--cream)",
                color: "var(--charcoal)",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Optional note */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: "0.35rem" }}>
              Note (optional)
            </div>
            <input
              type="text"
              value={awardNote}
              onChange={e => setAwardNote(e.target.value)}
              placeholder="Great work on your recital!"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1.5px solid var(--border)",
                padding: "0.55rem 0.75rem",
                fontFamily: "DM Sans, sans-serif",
                fontSize: "0.875rem",
                background: "var(--cream)",
                color: "var(--charcoal)",
                boxSizing: "border-box",
                outline: "none",
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
              padding: "0.7rem",
              borderRadius: 100,
              border: "none",
              background: awardSuccess ? "var(--sage)" : !customAward ? "var(--border)" : "var(--peach)",
              color: "white",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 800,
              fontSize: "0.875rem",
              cursor: awarding || !customAward ? "default" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {awardSuccess ? "✓ Stars Awarded!" : awarding ? "Awarding…" : "Award Custom Stars"}
          </button>

          {awardError && (
            <div style={{ marginTop: "0.5rem", background: "var(--rose-bg)", borderRadius: 10, padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--rose)", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
              {awardError}
            </div>
          )}

          <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.875rem" }}>
            <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", lineHeight: 1.5 }}>
              Stars are added to {student.display_name.split(" ")[0]}&apos;s total and they receive a notification in chat.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
