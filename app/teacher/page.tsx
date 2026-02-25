"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { StudioService } from "../../lib/services/StudioService";
import { GoalService } from "../../lib/services/GoalService";
import { Teacher } from "../../lib/models/Teacher";
import type { ProfileRow, GoalRow } from "../../lib/types";

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


export default function TeacherDashboard() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [students, setStudents] = useState<StudentWithGoals[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!teacher?.studioId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const studioService = StudioService.getInstance(supabase);
      const goalService = GoalService.getInstance(supabase);

      const profiles = await studioService.getStudents(teacher.studioId);
      const withGoals = await Promise.all(
        profiles.map(async (p) => ({
          profile: p,
          goals: await goalService.getTeacherGoalsByStudent(teacher.id, p.id),
        }))
      );
      setStudents(withGoals);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teacher?.studioId, teacher?.id]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

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
        <Link href="/teacher/chat" className="btn btn-secondary" style={{ textDecoration: "none", padding: "0.65rem 1.25rem", fontSize: "0.875rem" }}>
          💬 Open Chat
        </Link>
      </div>

      {/* Students */}
      <div>
        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>
          Students ({students.length})
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
            {students.map(({ profile, goals }) => {
              const completed = goals.filter(g => g.status === "completed").length;
              const total = goals.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const initials = profile.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

              return (
                <div key={profile.id} className="card-hover" style={{ padding: "1.25rem" }}>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
