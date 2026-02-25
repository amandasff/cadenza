"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { StudioService } from "../../lib/services/StudioService";
import { GoalService } from "../../lib/services/GoalService";
import { PracticeService } from "../../lib/services/PracticeService";
import { Teacher } from "../../lib/models/Teacher";
import type { ProfileRow, GoalRow, PracticeSessionRow } from "../../lib/types";

interface StudentWithGoals {
  profile: ProfileRow;
  goals: GoalRow[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [students, setStudents] = useState<StudentWithGoals[]>([]);
  const [recentSessions, setRecentSessions] = useState<PracticeSessionRow[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    if (!teacher?.studioId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const studioService = StudioService.getInstance(supabase);
      const goalService = GoalService.getInstance(supabase);
      const practiceService = PracticeService.getInstance(supabase);

      const [profiles, sessions] = await Promise.all([
        studioService.getStudents(teacher.studioId),
        practiceService.getStudioSessions(teacher.studioId, 8),
      ]);

      const withGoals = await Promise.all(
        profiles.map(async (p) => ({
          profile: p,
          goals: await goalService.getTeacherGoalsByStudent(teacher.id, p.id),
        }))
      );
      setStudents(withGoals);

      const map: Record<string, ProfileRow> = {};
      for (const p of profiles) map[p.id] = p;
      setStudentMap(map);
      setRecentSessions(sessions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teacher?.studioId, teacher?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function copyInviteCode() {
    if (!teacher?.inviteCode) return;
    navigator.clipboard.writeText(teacher.inviteCode.toUpperCase()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const completedGoalsCount = students.reduce(
    (sum, s) => sum + s.goals.filter(g => g.status === "completed").length,
    0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.6rem", color: "var(--charcoal)", margin: 0 }}>
          {getGreeting()}, {teacher?.displayName?.split(" ")[0]} 👋
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem", fontFamily: "DM Sans, sans-serif" }}>
          {loading ? "Loading..." : `${students.length} student${students.length !== 1 ? "s" : ""} · ${completedGoalsCount} goals completed`}
        </p>
      </div>

      {/* Invite code card */}
      {teacher?.inviteCode && (
        <div style={{
          background: "linear-gradient(135deg, var(--peach) 0%, #e8875c 100%)",
          borderRadius: "var(--radius-xl)",
          padding: "1.5rem",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          boxShadow: "var(--shadow-peach)",
        }}>
          <div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", opacity: 0.85, marginBottom: "0.35rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Studio Invite Code
            </div>
            <div className="invite-code" style={{ color: "white", background: "rgba(255,255,255,0.2)", border: "none", fontSize: "1.75rem" }}>
              {teacher.inviteCode.toUpperCase()}
            </div>
            <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", opacity: 0.8, marginTop: "0.5rem" }}>
              Share this with your students so they can join
            </div>
          </div>
          <button
            onClick={copyInviteCode}
            style={{
              background: "rgba(255,255,255,0.25)",
              border: "1.5px solid rgba(255,255,255,0.5)",
              color: "white",
              borderRadius: "var(--radius-md)",
              padding: "0.6rem 1.1rem",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.15s",
            }}
          >
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/teacher/goals" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.65rem 1.25rem", fontSize: "0.875rem" }}>
          🎯 Create Goal
        </Link>
        <Link href="/teacher/review" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.65rem 1.25rem", fontSize: "0.875rem" }}>
          🎙 Review Sessions
        </Link>
        <Link href="/teacher/chat" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.65rem 1.25rem", fontSize: "0.875rem" }}>
          💬 Open Chat
        </Link>
      </div>

      {/* Two-column layout: Students + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>

        {/* Students */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Students ({students.length})
            </div>
          </div>

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 140, borderRadius: "var(--radius-xl)" }} />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎹</div>
              <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "var(--charcoal)", margin: 0 }}>No students yet</p>
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
                Share your invite code to get started
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
              {students.map(({ profile, goals }) => {
                const completed = goals.filter(g => g.status === "completed").length;
                const total = goals.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const initials = profile.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

                return (
                  <Link
                    key={profile.id}
                    href={`/teacher/student/${profile.id}`}
                    className="card-hover"
                    style={{ padding: "1.25rem", textDecoration: "none", display: "block" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div style={{
                        width: 42, height: 42,
                        background: "var(--peach)",
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.85rem", color: "white",
                        flexShrink: 0,
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {profile.display_name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                          {total} goal{total !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--sky)", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                        View →
                      </span>
                    </div>

                    {/* Progress bar */}
                    {total > 0 && (
                      <div style={{ marginBottom: "0.875rem" }}>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "0.3rem", fontFamily: "DM Sans, sans-serif" }}>
                          {completed}/{total} goals complete
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }}>
                      <div style={{ background: "var(--peach-bg)", borderRadius: "var(--radius-sm)", padding: "0.45rem", textAlign: "center" }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.9rem", color: "var(--peach)" }}>🔥 {profile.streak_days}</div>
                        <div style={{ fontSize: "0.6rem", color: "var(--muted)" }}>streak</div>
                      </div>
                      <div style={{ background: "var(--butter-bg)", borderRadius: "var(--radius-sm)", padding: "0.45rem", textAlign: "center" }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.8rem", color: "var(--butter)" }}>⭐ {profile.total_points.toLocaleString()}</div>
                        <div style={{ fontSize: "0.6rem", color: "var(--muted)" }}>pts</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--border)", padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Recent Activity
            </div>
            <Link href="/teacher/review" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--sky)", textDecoration: "none" }}>
              See all →
            </Link>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎵</div>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
                No sessions yet
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentSessions.map(s => {
                const profile = studentMap[s.student_id];
                const initials = profile
                  ? profile.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                  : "?";
                const mins = Math.max(1, Math.round(s.duration_seconds / 60));
                return (
                  <Link
                    key={s.id}
                    href={`/teacher/review/${s.id}`}
                    style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0.625rem", borderRadius: 12, background: "var(--cream)", textDecoration: "none", transition: "background 0.12s" }}
                  >
                    <div style={{
                      width: 30, height: 30, background: "var(--peach)", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.65rem", color: "white", flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {profile?.display_name ?? "Student"}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                        {mins} min · {timeAgo(s.created_at)}
                      </div>
                    </div>
                    {s.recording_url && (
                      <span style={{ fontSize: "0.75rem" }}>🎙</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
