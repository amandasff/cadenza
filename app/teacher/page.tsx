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
  if (diffDays < 7) return `${diffDays}d ago`;
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
  // Encouragement modal state
  const [encourageTarget, setEncourageTarget] = useState<ProfileRow | null>(null);
  const [encourageMsg, setEncourageMsg] = useState("");
  const [encourageSending, setEncourageSending] = useState(false);
  const [sentReminderIds, setSentReminderIds] = useState<Set<string>>(new Set());
  const [encourageError, setEncourageError] = useState<string | null>(null);

  function openEncourage(profile: ProfileRow) {
    setEncourageTarget(profile);
    setEncourageMsg(`Keep it up, ${profile.display_name.split(" ")[0]}! Time to practice today 🎵`);
    setEncourageError(null);
  }

  async function sendEncouragement() {
    if (!encourageTarget || !teacher?.studioId || encourageSending) return;
    setEncourageSending(true);
    setEncourageError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId: teacher.studioId,
          content: encourageMsg.trim(),
          recipientId: encourageTarget.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to send message");
      }
      setSentReminderIds(prev => new Set(prev).add(encourageTarget.id));
      setTimeout(() => setSentReminderIds(prev => { const next = new Set(prev); next.delete(encourageTarget!.id); return next; }), 3000);
      setEncourageTarget(null);
    } catch (err) {
      setEncourageError(err instanceof Error ? err.message : "Failed to send. Please try again.");
    } finally {
      setEncourageSending(false);
    }
  }

  const loadData = useCallback(async () => {
    if (!teacher?.studioId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const studioService = StudioService.create(supabase);
      const goalService = GoalService.create(supabase);
      const practiceService = PracticeService.create(supabase);

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

  const [copiedLink, setCopiedLink] = useState(false);

  function copyInviteCode() {
    if (!teacher?.inviteCode) return;
    navigator.clipboard.writeText(teacher.inviteCode.toUpperCase()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyInviteLink() {
    if (!teacher?.inviteCode) return;
    const link = `${window.location.origin}/student/join?code=${teacher.inviteCode.toUpperCase()}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  const completedGoalsCount = students.reduce(
    (sum, s) => sum + s.goals.filter(g => g.status === "completed").length,
    0
  );

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

      {/* Header */}
      <div>
        <h1 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontWeight: 500,
          fontSize: "2rem",
          color: "var(--charcoal)",
          margin: 0,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}>
          {getGreeting()}, {teacher?.displayName?.split(" ")[0]}.
        </h1>
        <p style={{
          color: "var(--muted)",
          fontSize: "0.8125rem",
          marginTop: "0.5rem",
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          letterSpacing: "0.005em",
        }}>
          {loading
            ? "Loading studio data\u2026"
            : `${students.length} student${students.length !== 1 ? "s" : ""} \u00b7 ${completedGoalsCount} goals completed`
          }
        </p>
      </div>

      {/* Invite */}
      {teacher?.inviteCode && (
        <div style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}>
          <div style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            fontSize: "0.6875rem",
            color: "var(--muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            Invite students
          </div>

          {/* Link row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              flex: 1,
              fontFamily: "Inter, sans-serif",
              fontSize: "0.8125rem",
              color: "var(--charcoal)",
              background: "var(--cream)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "0.5rem 0.75rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {typeof window !== "undefined"
                ? `${window.location.origin}/student/join?code=${teacher.inviteCode.toUpperCase()}`
                : `/student/join?code=${teacher.inviteCode.toUpperCase()}`}
            </div>
            <button
              onClick={copyInviteLink}
              className="btn btn-primary"
              style={{ flexShrink: 0, padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
            >
              {copiedLink ? "Copied!" : "Copy link"}
            </button>
          </div>

          {/* Code row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
              Or share the code:
            </div>
            <div className="invite-code" style={{ fontSize: "1rem", letterSpacing: "0.2em" }}>
              {teacher.inviteCode.toUpperCase()}
            </div>
            <button
              onClick={copyInviteCode}
              className="btn btn-secondary"
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/teacher/goals" className="btn btn-primary" style={{ textDecoration: "none" }}>
          Create Goal
        </Link>
        <Link href="/teacher/review" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Review Sessions
        </Link>
        <Link href="/teacher/chat" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Open Chat
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="r-two-col" style={{ gridTemplateColumns: "1fr 300px" }}>

        {/* Students */}
        <div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid var(--border)",
          }}>
            <span style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: "0.6875rem",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Students ({students.length})
            </span>
          </div>

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 128, borderRadius: 4 }} />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No students yet</div>
              <p className="empty-state-desc">Share your invite code to get started.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
              {students.map(({ profile, goals }) => {
                const completed = goals.filter(g => g.status === "completed").length;
                const total = goals.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const initials = profile.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

                return (
                  <div key={profile.id} style={{ position: "relative" }}>
                  <Link
                    href={`/teacher/student/${profile.id}`}
                    className="card-base card-interactive"
                    style={{ padding: "1.25rem", textDecoration: "none", display: "block" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", paddingRight: "2rem" }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        background: "var(--charcoal)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 600,
                        fontSize: "0.6875rem",
                        color: "var(--white)",
                        flexShrink: 0,
                        letterSpacing: "0.02em",
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 500,
                          fontSize: "0.875rem",
                          color: "var(--charcoal)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {profile.display_name}
                        </div>
                        <div style={{
                          fontSize: "0.6875rem",
                          color: "var(--muted)",
                          fontFamily: "Inter, sans-serif",
                          marginTop: "0.125rem",
                        }}>
                          {total} goal{total !== 1 ? "s" : ""} · view repertoire →
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    {total > 0 && (
                      <div style={{ marginBottom: "0.875rem" }}>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div style={{
                          fontSize: "0.625rem",
                          color: "var(--muted)",
                          marginTop: "0.375rem",
                          fontFamily: "Inter, sans-serif",
                          letterSpacing: "0.02em",
                        }}>
                          {completed} of {total} complete
                        </div>
                      </div>
                    )}

                    {/* Stats row */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div style={{
                        flex: 1,
                        background: "var(--cream)",
                        borderRadius: 2,
                        padding: "0.375rem 0.5rem",
                        textAlign: "center",
                        border: "1px solid var(--border)",
                      }}>
                        <div style={{
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          color: "var(--charcoal)",
                        }}>
                          {profile.streak_days}
                        </div>
                        <div style={{
                          fontSize: "0.5625rem",
                          color: "var(--muted)",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          marginTop: "0.125rem",
                        }}>
                          Day streak
                        </div>
                      </div>
                      <div style={{
                        flex: 1,
                        background: "var(--cream)",
                        borderRadius: 2,
                        padding: "0.375rem 0.5rem",
                        textAlign: "center",
                        border: "1px solid var(--border)",
                      }}>
                        <div style={{
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          color: "var(--charcoal)",
                        }}>
                          {profile.total_points.toLocaleString()}
                        </div>
                        <div style={{
                          fontSize: "0.5625rem",
                          color: "var(--muted)",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          marginTop: "0.125rem",
                        }}>
                          Points
                        </div>
                      </div>
                    </div>
                  </Link>
                  {/* Encourage button — outside Link to avoid nested interactive elements */}
                  <button
                    onClick={() => openEncourage(profile)}
                    title="Send encouragement"
                    style={{
                      position: "absolute", top: 10, right: 10,
                      width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: sentReminderIds.has(profile.id) ? "var(--sage)" : "var(--cream)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      zIndex: 1,
                      transition: "background 0.2s",
                    }}
                  >
                    {sentReminderIds.has(profile.id) ? "✓" : "🔔"}
                  </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{
          background: "var(--white)",
          borderRadius: 4,
          border: "1px solid var(--border)",
          padding: "1.25rem 1.5rem",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid var(--border)",
          }}>
            <span style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: "0.6875rem",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Recent Activity
            </span>
            <Link href="/teacher/review" style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: "0.6875rem",
              color: "var(--muted)",
              textDecoration: "none",
              letterSpacing: "0.02em",
              transition: "color 0.15s",
            }}>
              All →
            </Link>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 46, borderRadius: 3 }} />
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem",
                color: "var(--muted)",
                margin: 0,
              }}>
                No sessions yet
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      padding: "0.5rem 0.625rem",
                      borderRadius: 3,
                      background: "transparent",
                      textDecoration: "none",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--cream)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      background: "var(--charcoal)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 600,
                      fontSize: "0.5625rem",
                      color: "var(--white)",
                      flexShrink: 0,
                      letterSpacing: "0.02em",
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 500,
                        fontSize: "0.8125rem",
                        color: "var(--charcoal)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {profile?.display_name ?? "Student"}
                      </div>
                      <div style={{
                        fontSize: "0.6875rem",
                        color: "var(--muted)",
                        fontFamily: "Inter, sans-serif",
                        marginTop: "0.125rem",
                        letterSpacing: "0.01em",
                      }}>
                        {mins} min · {timeAgo(s.created_at)}
                      </div>
                    </div>
                    {s.recording_url && (
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--peach)",
                        flexShrink: 0,
                      }} />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Encouragement modal */}
    {encourageTarget && (
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "1.5rem" }}
        onClick={e => { if (e.target === e.currentTarget) setEncourageTarget(null); }}
      >
        <div style={{ background: "var(--white)", borderRadius: 6, padding: "1.75rem", width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
          <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", margin: "0 0 0.25rem" }}>
            Encourage {encourageTarget.display_name.split(" ")[0]}
          </h2>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>
            Sends as a private message in chat + a push notification if they've enabled it.
          </p>
          <textarea
            value={encourageMsg}
            onChange={e => setEncourageMsg(e.target.value)}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", borderRadius: 4,
              border: "1px solid var(--border-strong)", padding: "0.625rem 0.875rem",
              fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)",
              background: "var(--cream)", outline: "none", resize: "none", lineHeight: 1.5,
              marginBottom: "1rem",
            }}
            autoFocus
          />
          {encourageError && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--rose, #c0392b)", margin: "0 0 0.75rem" }}>
              {encourageError}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button
              onClick={() => setEncourageTarget(null)}
              style={{ flex: 1, padding: "0.625rem", borderRadius: 3, border: "1px solid var(--border-strong)", background: "none", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={sendEncouragement}
              disabled={encourageSending || !encourageMsg.trim()}
              style={{ flex: 1, padding: "0.625rem", borderRadius: 3, border: "none", background: encourageMsg.trim() && !encourageSending ? "var(--charcoal)" : "var(--border)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "var(--white)", cursor: encourageMsg.trim() && !encourageSending ? "pointer" : "default", transition: "background 0.15s" }}
            >
              {encourageSending ? "Sending…" : "Send 🔔"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
