"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { GoalService } from "../../lib/services/GoalService";
import { Student } from "../../lib/models/Student";
import type { GoalRow } from "../../lib/types";

const AREA_COLORS: Record<string, { color: string; bg: string }> = {
  technique:    { color: "var(--sage)",   bg: "var(--sage-bg)" },
  repertoire:   { color: "var(--rose)",   bg: "var(--rose-bg)" },
  ear_training: { color: "var(--sky)",    bg: "var(--sky-bg)" },
  theory:       { color: "var(--butter)", bg: "var(--butter-bg)" },
};

function NodeMark({ goal }: { goal: GoalRow }) {
  if (goal.status === "completed") {
    return <span style={{ fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 600, color: "inherit", opacity: 0.7 }}>✓</span>;
  }
  if (goal.is_boss) {
    return <span style={{ fontSize: "0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7 }}>Boss</span>;
  }
  if (goal.status === "current") {
    return <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "block", opacity: 0.9 }} />;
  }
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "block", opacity: 0.3 }} />;
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
      console.error("loadGoals error:", e?.message, e?.code, e?.details);
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

      {/* Practice CTA */}
      <div style={{ padding: "1.5rem 1.5rem 1rem" }}>
        <Link href="/student/practice" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--charcoal)",
          borderRadius: 4,
          padding: "1rem 1.25rem",
          textDecoration: "none",
          color: "white",
          transition: "background 0.15s",
        }}>
          <div>
            <div style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "0.9375rem",
              letterSpacing: "0.005em",
            }}>
              Begin Practice
            </div>
            {currentGoal && (
              <div style={{
                fontSize: "0.75rem",
                opacity: 0.55,
                marginTop: "0.25rem",
                fontFamily: "Inter, sans-serif",
                fontWeight: 400,
              }}>
                {currentGoal.title}
              </div>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.7, flexShrink: 0 }}>
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Section label */}
      <div style={{ padding: "0.5rem 1.5rem 1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        <span style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "0.6875rem",
          color: "var(--muted)",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          Your Path
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>

      {/* Goal nodes */}
      <div style={{ padding: "0 2rem 3rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center", padding: "2rem 0" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ width: 56, height: 56, borderRadius: "50%" }} />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No goals yet</div>
            <p className="empty-state-desc">Your teacher will add goals to your path.</p>
          </div>
        ) : (
          [...goals].reverse().map((goal, i) => {
            const area = AREA_COLORS[goal.practice_area] ?? AREA_COLORS["technique"];
            const isLeft = i % 2 === 1;
            const isCurrent = goal.status === "current";
            const isBoss = goal.is_boss;
            const isLocked = goal.status === "locked";
            const isDone = goal.status === "completed";
            const nodeSize = isBoss ? 72 : isCurrent ? 64 : 54;

            return (
              <div key={goal.id} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: isLeft ? "flex-start" : "flex-end" }}>
                {/* Connector line */}
                {i > 0 && (
                  <div style={{
                    width: 1,
                    height: 24,
                    background: isLocked ? "var(--border)" : area.color,
                    marginLeft: isLeft ? nodeSize / 2 : undefined,
                    marginRight: isLeft ? undefined : nodeSize / 2,
                    opacity: isLocked ? 0.3 : 0.5,
                  }} />
                )}

                <Link href={isLocked ? "#" : `/student/goal/${goal.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                    {/* Node circle */}
                    <div style={{
                      width: nodeSize,
                      height: nodeSize,
                      background: isLocked ? "var(--border)" : isDone ? area.bg : area.bg,
                      border: isCurrent
                        ? `2px solid ${area.color}`
                        : isBoss
                          ? `2px solid ${area.color}`
                          : isDone
                            ? `1.5px solid ${area.color}`
                            : "1.5px solid transparent",
                      borderRadius: isBoss ? 6 : "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isLocked ? "var(--muted)" : area.color,
                      opacity: isLocked ? 0.45 : 1,
                      transition: "transform 0.15s ease",
                    }}>
                      <NodeMark goal={goal} />
                    </div>

                    {/* Label */}
                    <div style={{ textAlign: "center", maxWidth: 110 }}>
                      <div style={{
                        fontSize: "0.6875rem",
                        fontFamily: "Inter, sans-serif",
                        fontWeight: isCurrent ? 500 : 400,
                        color: isLocked ? "var(--muted)" : "var(--charcoal)",
                        lineHeight: 1.35,
                        letterSpacing: "0.005em",
                      }}>
                        {goal.title}
                      </div>
                      {!isLocked && (
                        <div style={{
                          fontSize: "0.625rem",
                          color: area.color,
                          fontWeight: 500,
                          marginTop: "0.125rem",
                          letterSpacing: "0.02em",
                        }}>
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

        {/* Path origin marker */}
        {!loading && goals.length > 0 && (
          <div style={{
            marginTop: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}>
            <div style={{ height: 1, width: 24, background: "var(--border)" }} />
            <span style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.625rem",
              color: "var(--muted)",
              fontWeight: 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              Origin
            </span>
            <div style={{ height: 1, width: 24, background: "var(--border)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
