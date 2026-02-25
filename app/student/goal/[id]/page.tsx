"use client";
import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { GoalService } from "../../../../lib/services/GoalService";
import { ChatService } from "../../../../lib/services/ChatService";
import { Student } from "../../../../lib/models/Student";
import type { GoalRow } from "../../../../lib/types";

const AREAS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  technique:    { label: "Technique",    color: "var(--sage)",   bg: "var(--sage-bg)",   icon: "🌿" },
  repertoire:   { label: "Repertoire",   color: "var(--rose)",   bg: "var(--rose-bg)",   icon: "🌸" },
  ear_training: { label: "Ear Training", color: "var(--sky)",    bg: "var(--sky-bg)",    icon: "🎧" },
  theory:       { label: "Theory",       color: "var(--butter)", bg: "var(--butter-bg)", icon: "⭐" },
};

export default function GoalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const student = user as Student;

  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");

  useEffect(() => {
    const fetchGoal = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("goals")
          .select("*")
          .eq("id", id)
          .single();
        if (error || !data) {
          setNotFound(true);
        } else {
          const g = data as GoalRow;
          setGoal(g);
          const { data: studioData } = await supabase
            .from("studios")
            .select("owner_id")
            .eq("id", g.studio_id)
            .single();
          setTeacherId(studioData?.owner_id ?? null);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchGoal();
  }, [id]);

  async function handleClaim() {
    if (!goal || !student?.studioId || claiming) return;
    setClaiming(true);
    setClaimError("");
    try {
      const supabase = getSupabaseBrowserClient();
      await GoalService.getInstance(supabase).completeGoal(goal.id, student.id, goal.points);

      if (teacherId) {
        const bonusLine = goal.bonus_title && goal.bonus_points
          ? `\n⭐ Bonus: ${goal.bonus_title} (+${goal.bonus_points} pts)`
          : "";
        await ChatService.getInstance(supabase).postSystemMessage(
          goal.studio_id, student.id, teacherId,
          `🎉 Goal completed!\n📌 ${goal.title}\n⭐ +${goal.points} stars earned${bonusLine}`
        ).catch(() => {});
      }

      setGoal((prev) => prev ? { ...prev, status: "completed" } : prev);
    } catch (err) {
      const e = err as { message?: string };
      setClaimError(e?.message ?? "Something went wrong");
    } finally {
      setClaiming(false);
    }
  }

  const area = goal ? (AREAS[goal.practice_area] ?? AREAS["technique"]) : null;
  const statusLabel = goal?.status === "current" ? "In Progress" : goal?.status === "completed" ? "Completed" : "Locked";
  const statusColor = goal?.status === "current" ? "var(--peach)" : goal?.status === "completed" ? "var(--sage)" : "var(--muted)";
  const statusBg = goal?.status === "current" ? "var(--peach-bg)" : goal?.status === "completed" ? "var(--sage-bg)" : "var(--border)";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)" }}>
      <div style={{ background: "var(--white)", borderBottom: "1.5px solid var(--border)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "var(--charcoal)", flex: 1, margin: 0 }}>
          Goal Detail
        </h1>
      </div>

      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {loading ? (
          <>
            <div className="skeleton" style={{ height: 32, borderRadius: 100, width: "40%" }} />
            <div className="skeleton" style={{ height: 100, borderRadius: "var(--radius-xl)" }} />
            <div className="skeleton" style={{ height: 80, borderRadius: "var(--radius-xl)" }} />
          </>
        ) : notFound || !goal || !area ? (
          <div className="empty-state" style={{ padding: "3rem 1rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>😕</div>
            <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--charcoal)", margin: 0 }}>Goal not found</p>
            <Link href="/student" style={{ marginTop: "1rem", display: "inline-block", color: "var(--peach)", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" }}>
              ← Back to your path
            </Link>
          </div>
        ) : (
          <>
            {/* Badges row */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ background: area.bg, color: area.color, padding: "0.25rem 0.75rem", borderRadius: 100, fontSize: "0.75rem", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                {area.icon} {area.label}
              </span>
              <span style={{ background: statusBg, color: statusColor, padding: "0.25rem 0.75rem", borderRadius: 100, fontSize: "0.75rem", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                {statusLabel}
              </span>
              {goal.is_boss && (
                <span style={{ background: "var(--butter-bg)", color: "var(--butter)", padding: "0.25rem 0.75rem", borderRadius: 100, fontSize: "0.75rem", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                  ⭐ Boss Node
                </span>
              )}
            </div>

            {/* Main card */}
            <div className="card-base" style={{ padding: "1.25rem" }}>
              <h2 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.1rem", color: "var(--charcoal)", marginBottom: "0.75rem", marginTop: 0 }}>
                {goal.title}
              </h2>
              <div style={{ display: "flex", gap: "1.5rem" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: 2, fontFamily: "DM Sans, sans-serif" }}>Stars</div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "var(--butter)", fontSize: "1rem" }}>⭐ {goal.points}</div>
                </div>
                {goal.due_date && (
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: 2, fontFamily: "DM Sans, sans-serif" }}>Due</div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "var(--charcoal)", fontSize: "0.9rem" }}>
                      {new Date(goal.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {goal.description && (
              <div className="card-base" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Instructions
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--charcoal)", lineHeight: 1.6, margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                  {goal.description}
                </p>
              </div>
            )}

            {/* Bonus challenge */}
            {goal.bonus_title && (
              <div style={{ background: "var(--butter-bg)", borderRadius: "var(--radius-xl)", padding: "1.25rem", border: "1.5px solid var(--butter-light)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--butter)", marginBottom: "0.5rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ⭐ Bonus Challenge
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--charcoal)", margin: "0 0 0.5rem", fontFamily: "DM Sans, sans-serif" }}>
                  {goal.bonus_title}
                </p>
                <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "var(--butter)" }}>
                  +{goal.bonus_points} pts
                </span>
              </div>
            )}

            {/* Teacher feedback */}
            {goal.teacher_feedback && (
              <div className="card-base" style={{ padding: "1.25rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Teacher Feedback
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div style={{ width: 36, height: 36, background: "var(--sky-bg)", borderRadius: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                    👩‍🏫
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--charcoal)", lineHeight: 1.5, margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                    {goal.teacher_feedback}
                  </p>
                </div>
              </div>
            )}

            {/* Completed celebration */}
            {goal.status === "completed" && (
              <div style={{ background: "var(--sage-bg)", border: "1.5px solid var(--sage)", borderRadius: "var(--radius-xl)", padding: "1.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.05rem", color: "var(--sage)" }}>
                  Goal Complete!
                </div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  You earned ⭐ {goal.points} stars
                </div>
              </div>
            )}

            {/* CTAs — only for current goals */}
            {goal.status === "current" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingBottom: "1rem" }}>
                <Link href="/student/practice" style={{ background: "var(--peach)", color: "white", padding: "0.9rem", borderRadius: 100, textAlign: "center", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", display: "block", boxShadow: "var(--shadow-peach)" }}>
                  🎙 Record Practice Session
                </Link>

                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  style={{
                    width: "100%", padding: "0.9rem", borderRadius: 100,
                    border: "2px solid var(--butter)",
                    background: "var(--butter-bg)",
                    color: "var(--butter)", fontFamily: "Nunito, sans-serif", fontWeight: 800,
                    fontSize: "0.95rem", cursor: claiming ? "default" : "pointer",
                    opacity: claiming ? 0.7 : 1, transition: "all 0.15s",
                  }}
                >
                  {claiming ? "Claiming…" : `⭐ Complete & Claim ${goal.points} Stars`}
                </button>

                {claimError && (
                  <div style={{ background: "var(--rose-bg)", border: "1.5px solid var(--rose-light)", borderRadius: 12, padding: "0.6rem 0.875rem", fontSize: "0.8rem", color: "var(--rose)", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                    {claimError}
                  </div>
                )}

                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", margin: 0 }}>
                  Claim when you feel ready — your teacher will be notified
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
