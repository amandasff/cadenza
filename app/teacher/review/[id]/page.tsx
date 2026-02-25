"use client";
import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { GoalService } from "../../../../lib/services/GoalService";
import { ChatService } from "../../../../lib/services/ChatService";
import { Teacher } from "../../../../lib/models/Teacher";
import type { PracticeSessionRow, GoalRow, ProfileRow, PracticeSegment } from "../../../../lib/types";

const AREAS: Record<string, { label: string; color: string; icon: string }> = {
  technique:    { label: "Technique",    color: "var(--sage)",   icon: "🌿" },
  repertoire:   { label: "Repertoire",   color: "var(--rose)",   icon: "🌸" },
  ear_training: { label: "Ear Training", color: "var(--sky)",    icon: "🎧" },
  theory:       { label: "Theory",       color: "var(--butter)", icon: "⭐" },
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function RecordingReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [session, setSession] = useState<PracticeSessionRow | null>(null);
  const [student, setStudent] = useState<ProfileRow | null>(null);
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [feedback, setFeedback] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        const { data: sessionData, error: sessionError } = await supabase
          .from("practice_sessions")
          .select("*")
          .eq("id", id)
          .single();

        if (sessionError || !sessionData) { setNotFound(true); return; }
        const s = sessionData as PracticeSessionRow;
        setSession(s);

        // Load student profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", s.student_id)
          .single();
        if (profileData) setStudent(profileData as ProfileRow);

        // Load associated goal if any
        if (s.goal_id) {
          const { data: goalData } = await supabase
            .from("goals")
            .select("*")
            .eq("id", s.goal_id)
            .single();
          if (goalData) {
            const g = goalData as GoalRow;
            setGoal(g);
            setApproved(g.status === "completed");
            if (g.teacher_feedback) setFeedback(g.teacher_feedback);
          }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  async function handleApprove() {
    if (!session || !goal || !student || approving || approved) return;
    setApproving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await GoalService.getInstance(supabase).completeGoal(goal.id, student.id, goal.points);

      // Notify student via system message (recipient = student)
      await ChatService.getInstance(supabase).postSystemMessage(
        session.studio_id, teacher.id, student.id,
        `🎉 Goal approved by your teacher!\n📌 ${goal.title}\n⭐ +${goal.points} stars awarded`
      ).catch(() => {});

      setApproved(true);
      setGoal((prev) => prev ? { ...prev, status: "completed" } : prev);
    } catch (err) {
      console.error("approve error:", err);
    } finally {
      setApproving(false);
    }
  }

  async function handleSaveFeedback() {
    if (!goal || !feedback.trim() || savingFeedback) return;
    setSavingFeedback(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await GoalService.getInstance(supabase).addFeedback(goal.id, feedback.trim());

      // Send feedback as chat message to student
      if (session && student) {
        await ChatService.getInstance(supabase).sendPrivateMessage(
          session.studio_id, teacher.id, teacher.displayName, student.id,
          `📝 Feedback on "${goal.title}":\n${feedback.trim()}`
        ).catch(() => {});
      }

      setFeedbackSaved(true);
      setTimeout(() => setFeedbackSaved(false), 3000);
    } catch (err) {
      console.error("feedback error:", err);
    } finally {
      setSavingFeedback(false);
    }
  }

  const segments = (session?.segments_json ?? []) as PracticeSegment[];
  const mins = session ? Math.max(1, Math.round(session.duration_seconds / 60)) : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="skeleton" style={{ height: 32, width: "50%", borderRadius: 100 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 20 }} />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="empty-state" style={{ padding: "3rem 0" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>😕</div>
        <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--charcoal)", margin: 0 }}>Session not found</p>
        <Link href="/teacher/review" style={{ marginTop: "1rem", display: "inline-block", color: "var(--peach)", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" }}>
          ← Back to queue
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link href="/teacher/review" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "1.1rem" }}>←</Link>
        <div>
          <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "var(--charcoal)", margin: 0 }}>
            {student?.display_name ?? "Student"} — Session Review
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.125rem 0 0" }}>
            {new Date(session.created_at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · {mins} minutes
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem", alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Goal info */}
          {goal && (
            <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Goal Being Practiced
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--charcoal)" }}>{goal.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", marginTop: 2 }}>⭐ {goal.points} stars</div>
                </div>
                <span style={{
                  padding: "0.25rem 0.75rem", borderRadius: 100, fontSize: "0.72rem",
                  fontFamily: "Nunito, sans-serif", fontWeight: 700,
                  background: goal.status === "completed" ? "var(--sage-bg)" : "var(--peach-bg)",
                  color: goal.status === "completed" ? "var(--sage)" : "var(--peach)",
                }}>
                  {goal.status === "completed" ? "✓ Completed" : "In Progress"}
                </span>
              </div>
            </div>
          )}

          {/* Recording */}
          <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
              Recording
            </div>
            {session.recording_url ? (
              <audio controls src={session.recording_url} style={{ width: "100%", borderRadius: 8 }} />
            ) : (
              <div style={{ background: "var(--cream)", borderRadius: 12, padding: "1.25rem", textAlign: "center", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem" }}>
                No recording for this session
              </div>
            )}
          </div>

          {/* Segments */}
          {segments.length > 0 && (
            <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
                Segments ({segments.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {segments.map((seg, i) => {
                  const area = AREAS[seg.practice_area] ?? AREAS["technique"];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0", borderBottom: i < segments.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: "1rem" }}>{area.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--charcoal)" }}>{seg.title}</div>
                        <div style={{ fontSize: "0.7rem", color: area.color, fontFamily: "DM Sans, sans-serif" }}>{area.label} · {fmt(seg.start_seconds)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Student notes */}
          {session.notes && (
            <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Student Notes
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--charcoal)", lineHeight: 1.6, margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                {session.notes}
              </p>
            </div>
          )}

          {/* Approve goal button — only shown if session has a goal */}
          {goal && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleApprove}
                disabled={approving || approved}
                style={{
                  flex: 1, padding: "0.85rem", borderRadius: 100, border: "none", cursor: approved || approving ? "default" : "pointer",
                  background: approved ? "var(--sage)" : "var(--sage-bg)",
                  color: approved ? "white" : "var(--sage)",
                  fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.9rem",
                  transition: "all 0.15s", opacity: approving ? 0.7 : 1,
                }}
              >
                {approved ? "✓ Goal Approved" : approving ? "Approving…" : "✓ Approve Goal"}
              </button>
            </div>
          )}
        </div>

        {/* Right column — feedback */}
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
            {goal ? "Feedback on Goal" : "Notes"}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={goal ? `Leave feedback on "${goal.title}"…` : "Leave a note about this session…"}
            style={{
              width: "100%", borderRadius: 12, border: "1.5px solid var(--border)",
              padding: "0.75rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem",
              background: "var(--cream)", color: "var(--charcoal)", resize: "none",
              minHeight: 140, outline: "none", boxSizing: "border-box", lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleSaveFeedback}
            disabled={!feedback.trim() || savingFeedback || !goal}
            style={{
              width: "100%", marginTop: "0.75rem", padding: "0.65rem", borderRadius: 100,
              border: "none", cursor: !feedback.trim() || !goal ? "default" : "pointer",
              background: feedbackSaved ? "var(--sage)" : !feedback.trim() || !goal ? "var(--border)" : "var(--sky)",
              color: "white", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem",
              transition: "background 0.15s",
            }}
          >
            {feedbackSaved ? "✓ Sent!" : savingFeedback ? "Sending…" : "Send Feedback"}
          </button>
          {!goal && (
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.5rem", textAlign: "center" }}>
              No goal linked to this session
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
