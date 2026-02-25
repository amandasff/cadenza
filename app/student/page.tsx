"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { GoalService } from "../../lib/services/GoalService";
import { Student } from "../../lib/models/Student";
import type { GoalRow } from "../../lib/types";

const AREAS: Record<string, { color: string; bg: string; icon: string }> = {
  technique:    { color: "var(--sage)",   bg: "var(--sage-bg)",   icon: "🌿" },
  repertoire:   { color: "var(--rose)",   bg: "var(--rose-bg)",   icon: "🌸" },
  ear_training: { color: "var(--sky)",    bg: "var(--sky-bg)",    icon: "🎧" },
  theory:       { color: "var(--butter)", bg: "var(--butter-bg)", icon: "⭐" },
};

function NodeIcon({ goal }: { goal: GoalRow }) {
  if (goal.status === "completed") return <span style={{ fontSize: "1.4rem" }}>✅</span>;
  if (goal.is_boss) return <span style={{ fontSize: "1.6rem" }}>⭐</span>;
  if (goal.status === "current") return <span style={{ fontSize: "1.4rem" }}>🎵</span>;
  return <span style={{ fontSize: "1.4rem" }}>🔒</span>;
}

export default function StudentPath() {
  const { user } = useAuth();
  const student = user as Student;

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = GoalService.getInstance(supabase);
      const data = await service.getStudentGoals(student.id);
      setGoals(data);
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string };
      console.error('loadGoals error:', e?.message, e?.code, e?.details);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const currentGoal = goals.find(g => g.status === "current");

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%" }}>
      {/* Start practice CTA */}
      <div style={{ padding: "1rem 1.25rem 0.5rem" }}>
        <Link href="/student/practice" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--peach)", borderRadius: "var(--radius-lg)", padding: "0.9rem 1.1rem",
          textDecoration: "none", color: "white",
          boxShadow: "var(--shadow-peach)",
        }}>
          <div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.05rem" }}>
              Start Practice
            </div>
            {currentGoal && (
              <div style={{ fontSize: "0.78rem", opacity: 0.85, marginTop: 2, fontFamily: "DM Sans, sans-serif" }}>
                Now: {currentGoal.title}
              </div>
            )}
          </div>
          <span style={{ fontSize: "1.6rem" }}>🎙</span>
        </Link>
      </div>

      {/* Path header */}
      <div style={{ padding: "0.75rem 1.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ height: 1.5, flex: 1, background: "var(--border)" }} />
        <span style={{ fontFamily: "Nunito, sans-serif", fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
          Your Path
        </span>
        <div style={{ height: 1.5, flex: 1, background: "var(--border)" }} />
      </div>

      {/* Nodes */}
      <div style={{ padding: "0.5rem 2rem 2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center", padding: "2rem 0" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ width: 64, height: 64, borderRadius: "50%" }} />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="empty-state" style={{ padding: "3rem 1rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🗺</div>
            <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--charcoal)", margin: 0, fontSize: "1rem" }}>
              No goals yet!
            </p>
            <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0", textAlign: "center" }}>
              Your teacher will add goals to your path soon.
            </p>
          </div>
        ) : (
          [...goals].reverse().map((goal, i) => {
            const area = AREAS[goal.practice_area] ?? AREAS["technique"];
            const isLeft = i % 2 === 1;
            const isCurrent = goal.status === "current";
            const isBoss = goal.is_boss;
            const isLocked = goal.status === "locked";
            const isDone = goal.status === "completed";
            const nodeSize = isBoss ? 80 : isCurrent ? 72 : 62;

            return (
              <div key={goal.id} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: isLeft ? "flex-start" : "flex-end" }}>
                {i > 0 && (
                  <div style={{
                    width: 3, height: 28,
                    background: isLocked ? "var(--border)" : area.color,
                    marginLeft: isLeft ? 39 : undefined,
                    marginRight: isLeft ? undefined : 39,
                    opacity: isLocked ? 0.4 : 0.8,
                    borderRadius: 2,
                  }} />
                )}
                <Link href={isLocked ? "#" : `/student/goal/${goal.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    animation: isCurrent ? "pulse-soft 2.5s ease-in-out infinite" : undefined,
                  }}>
                    <div style={{
                      width: nodeSize, height: nodeSize,
                      background: isLocked ? "#ECECEC" : isDone ? area.bg : area.bg,
                      border: isDone ? `2px solid ${area.color}` : isCurrent ? `3px solid ${area.color}` : isBoss ? `3px solid ${area.color}` : "2px solid transparent",
                      borderRadius: isBoss ? 20 : 100,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isCurrent ? `0 4px 16px ${area.color}44` : isBoss ? `0 4px 20px ${area.color}66` : undefined,
                      opacity: isLocked ? 0.5 : 1,
                      position: "relative",
                    }}>
                      <NodeIcon goal={goal} />
                      {isDone && (
                        <div style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, background: "var(--sage)", borderRadius: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "white", fontWeight: 700, border: "2px solid var(--white)" }}>
                          ✓
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "center", maxWidth: 120 }}>
                      <div style={{ fontSize: "0.7rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, color: isLocked ? "var(--muted)" : "var(--charcoal)", lineHeight: 1.3 }}>
                        {goal.title}
                      </div>
                      {!isLocked && (
                        <div style={{ fontSize: "0.65rem", color: area.color, fontWeight: 600, marginTop: 1 }}>
                          {goal.points} pts
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })
        )}

        {!loading && goals.length > 0 && (
          <div style={{ marginTop: 24, padding: "0.6rem 1.25rem", background: "var(--white)", border: "1.5px solid var(--border)", borderRadius: 100 }}>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: "0.9rem", color: "var(--muted)", fontWeight: 600 }}>
              🎵 Your journey begins here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
