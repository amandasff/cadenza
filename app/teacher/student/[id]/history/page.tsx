"use client";
import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { Teacher } from "../../../../../lib/models/Teacher";

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  practice_area: string;
  points: number;
  teacher_feedback: string | null;
  piece_id: string | null;
  target_minutes_per_day: number | null;
  completed_at: string | null;
  created_at: string;
  status: string;
}

interface PieceRow {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
}

type GoalWithPiece = GoalRow & { piece: PieceRow | null };

const CATEGORY_COLORS: Record<string, string> = {
  technique: "var(--sage)",
  etude: "var(--sky)",
  repertoire: "var(--rose)",
  theory: "var(--butter)",
  ear_training: "var(--lavender)",
  sight_reading: "var(--muted)",
  free: "var(--muted)",
};

function getCategoryColor(goal: GoalWithPiece): string {
  const key = goal.piece?.category ?? goal.practice_area ?? "free";
  return CATEGORY_COLORS[key] ?? "var(--muted)";
}

function formatMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupByMonth(goals: GoalWithPiece[]): { key: string; label: string; goals: GoalWithPiece[] }[] {
  const map = new Map<string, GoalWithPiece[]>();
  for (const g of goals) {
    const dateStr = g.completed_at ?? g.created_at;
    const key = getMonthKey(dateStr);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return Array.from(map.entries()).map(([key, goals]) => ({
    key,
    label: formatMonthLabel(goals[0].completed_at ?? goals[0].created_at),
    goals,
  }));
}

export default function StudentHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();

  const [studentName, setStudentName] = useState("");
  const [goals, setGoals] = useState<GoalWithPiece[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacher?.id) return;
    loadData();
  }, [teacher?.id, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [profileRes, goalsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
        supabase
          .from("goals")
          .select("*")
          .eq("student_id", studentId)
          .eq("status", "completed")
          .order("completed_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ]);

      setStudentName((profileRes.data as { display_name: string } | null)?.display_name ?? "Student");

      const rawGoals = (goalsRes.data ?? []) as GoalRow[];
      const pieceIds = [...new Set(rawGoals.map((g) => g.piece_id).filter(Boolean) as string[])];

      let piecesMap = new Map<string, PieceRow>();
      if (pieceIds.length > 0) {
        const piecesRes = await supabase
          .from("pieces")
          .select("id, title, composer, category")
          .in("id", pieceIds);
        for (const p of (piecesRes.data ?? []) as PieceRow[]) {
          piecesMap.set(p.id, p);
        }
      }

      setGoals(
        rawGoals.map((g) => ({
          ...g,
          piece: g.piece_id ? (piecesMap.get(g.piece_id) ?? null) : null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  const months = groupByMonth(goals);

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 48, borderRadius: 4, marginBottom: "1rem" }} />
        <div className="skeleton" style={{ height: 300, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem", gap: "1rem" }}>
        <div>
          <button
            onClick={() => router.push(`/teacher/student/${studentId}`)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
              marginBottom: "0.625rem", display: "flex", alignItems: "center", gap: "0.25rem",
            }}
          >
            ← Back
          </button>
          <h1 style={{
            fontFamily: "Cormorant Garamond, serif", fontSize: "2.25rem",
            fontWeight: 600, color: "var(--charcoal)", margin: 0, lineHeight: 1.15,
          }}>
            📖 Dictation Book
          </h1>
          {studentName && (
            <p style={{
              margin: "0.375rem 0 0", color: "var(--muted)", fontSize: "0.9375rem",
              fontFamily: "Inter, sans-serif",
            }}>
              {studentName}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingTop: "2rem" }}>
          <span style={{
            background: "var(--charcoal)", color: "var(--white)", borderRadius: 20,
            padding: "0.25rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500,
            whiteSpace: "nowrap",
          }}>
            {goals.length} completed
          </span>
          <button
            onClick={() => window.print()}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 4,
              padding: "0.375rem 0.75rem", cursor: "pointer", fontSize: "0.8125rem",
              color: "var(--muted)", fontFamily: "Inter, sans-serif",
              display: "none",
            }}
            className="print-btn"
          >
            Print
          </button>
        </div>
      </div>

      {/* Print button (desktop only via media query workaround) */}
      <style>{`
        @media (min-width: 640px) { .print-btn { display: inline-block !important; } }
        @media print {
          button { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* Body */}
      {goals.length === 0 ? (
        <div style={{
          background: "var(--white)", border: "1px solid var(--border)", borderRadius: 6,
          padding: "3rem 2rem", textAlign: "center", color: "var(--muted)",
          fontSize: "0.9375rem", fontStyle: "italic",
        }}>
          No completed goals yet — this is where the journey is recorded.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {months.map((month) => (
            <div key={month.key}>
              {/* Month header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap",
                }}>
                  {month.label}
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              {/* Goal entries */}
              <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                {month.goals.map((goal, i) => {
                  const color = getCategoryColor(goal);
                  const dateStr = goal.completed_at ?? goal.created_at;
                  return (
                    <div
                      key={goal.id}
                      style={{
                        display: "flex", alignItems: "stretch",
                        borderBottom: i < month.goals.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      {/* Colored left bar */}
                      <div style={{ width: 3, flexShrink: 0, background: color }} />

                      {/* Entry content */}
                      <div style={{ flex: 1, padding: "0.875rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                          {/* Date */}
                          <span style={{
                            fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap",
                            paddingTop: "0.125rem", minWidth: "3.5rem",
                          }}>
                            {formatShortDate(dateStr)}
                          </span>

                          {/* Main content */}
                          <div style={{ flex: 1 }}>
                            {goal.piece && (
                              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.125rem" }}>
                                <em>
                                  {goal.piece.title}
                                  {goal.piece.composer ? ` — ${goal.piece.composer}` : ""}
                                </em>
                              </div>
                            )}
                            <div style={{
                              fontSize: "0.9375rem", fontWeight: 500, color: "var(--charcoal)",
                              lineHeight: 1.4,
                            }}>
                              {goal.title}
                            </div>
                            <div style={{
                              display: "flex", flexWrap: "wrap", gap: "0.375rem",
                              marginTop: "0.375rem", alignItems: "center",
                            }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                {goal.points} pts
                              </span>
                              {goal.target_minutes_per_day != null && (
                                <>
                                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>·</span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                    {goal.target_minutes_per_day} min/day
                                  </span>
                                </>
                              )}
                              {goal.teacher_feedback && (
                                <>
                                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>·</span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
                                    {goal.teacher_feedback}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
