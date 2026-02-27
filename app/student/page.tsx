"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { Student } from "../../lib/models/Student";
import type { GoalRow, PieceRow } from "../../lib/types";

type GoalWithPiece = GoalRow & { piece: PieceRow | null };

const SECTIONS: { category: string; label: string; color: string }[] = [
  { category: "technique",    label: "Technique",    color: "var(--sage)" },
  { category: "etude",        label: "Études",       color: "var(--sky)" },
  { category: "repertoire",   label: "Repertoire",   color: "var(--rose)" },
  { category: "theory",       label: "Theory",       color: "var(--butter)" },
  { category: "ear_training", label: "Ear Training", color: "var(--peach)" },
  { category: "sight_reading",label: "Sight Reading",color: "var(--lavender, var(--muted))" },
  { category: "free",         label: "Other",        color: "var(--muted)" },
];

const SECTION_ORDER = SECTIONS.map(s => s.category);

function getSectionCategory(goal: GoalWithPiece): string {
  return goal.piece?.category ?? goal.practice_area ?? "free";
}

function groupGoals(goals: GoalWithPiece[]) {
  // Map: category → Map<pieceId|null → { piece, goals }>
  const sectionMap = new Map<string, Map<string | null, { piece: PieceRow | null; goals: GoalWithPiece[] }>>();

  for (const goal of goals) {
    const cat = getSectionCategory(goal);
    if (!sectionMap.has(cat)) sectionMap.set(cat, new Map());
    const groups = sectionMap.get(cat)!;
    const key = goal.piece_id;
    if (!groups.has(key)) groups.set(key, { piece: goal.piece, goals: [] });
    groups.get(key)!.goals.push(goal);
  }

  return SECTION_ORDER
    .filter(cat => sectionMap.has(cat))
    .map(cat => ({
      category: cat,
      label: SECTIONS.find(s => s.category === cat)!.label,
      color: SECTIONS.find(s => s.category === cat)!.color,
      groups: Array.from(sectionMap.get(cat)!.values()),
    }));
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function ThisWeek() {
  const { user } = useAuth();
  const student = user as Student;

  const [goals, setGoals] = useState<GoalWithPiece[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Fetch current goals
      const { data: goalsData } = await supabase
        .from("goals")
        .select("*")
        .eq("student_id", student.id)
        .eq("status", "current")
        .order("path_order", { ascending: true });

      const rawGoals = (goalsData ?? []) as GoalRow[];

      // Fetch pieces for goals that have piece_id
      const pieceIds = [...new Set(rawGoals.filter(g => g.piece_id).map(g => g.piece_id!))];
      let piecesMap: Record<string, PieceRow> = {};
      if (pieceIds.length > 0) {
        const { data: piecesData } = await supabase
          .from("pieces")
          .select("*")
          .in("id", pieceIds);
        for (const p of (piecesData ?? []) as PieceRow[]) {
          piecesMap[p.id] = p;
        }
      }

      setGoals(rawGoals.map(g => ({
        ...g,
        piece: g.piece_id ? (piecesMap[g.piece_id] ?? null) : null,
      })));
    } catch (err) {
      console.error("load error:", err);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  const sections = groupGoals(goals);

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%" }}>

      {/* Begin Practice CTA */}
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
        }}>
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "0.005em" }}>
              Begin Practice
            </div>
            <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.2rem", fontFamily: "Inter, sans-serif" }}>
              {goals.length > 0 ? `${goals.length} assignment${goals.length !== 1 ? "s" : ""} this week` : "Log your practice session"}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.7, flexShrink: 0 }}>
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Date + section label */}
      <div style={{ padding: "0.5rem 1.5rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)",
            fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap",
          }}>
            {todayLabel()}
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 1.5rem 3rem" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 4 }} />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: "2rem" }}>
            <div className="empty-state-title">All clear</div>
            <p className="empty-state-desc">No assignments right now. Check back after your next lesson.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {sections.map(section => (
              <div key={section.category}>
                {/* Section header */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  marginBottom: "0.875rem",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: section.color, flexShrink: 0 }} />
                  <span style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    fontSize: "0.6875rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--charcoal)",
                  }}>
                    {section.label}
                  </span>
                </div>

                {/* Groups (by piece) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {section.groups.map((group, gi) => (
                    <div key={gi}>
                      {/* Piece header (if this group has a piece) */}
                      {group.piece && (
                        <div style={{ marginBottom: "0.5rem", paddingLeft: "1rem", borderLeft: `2px solid ${section.color}` }}>
                          <div style={{
                            fontFamily: "Cormorant Garamond, Georgia, serif",
                            fontWeight: 600,
                            fontSize: "1rem",
                            color: "var(--charcoal)",
                            lineHeight: 1.2,
                          }}>
                            {group.piece.title}
                            {group.piece.composer && (
                              <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {group.piece.composer}</span>
                            )}
                          </div>
                          {group.piece.book && (
                            <div style={{
                              fontFamily: "Inter, sans-serif",
                              fontSize: "0.6875rem",
                              color: "var(--muted)",
                              marginTop: "0.125rem",
                              letterSpacing: "0.01em",
                            }}>
                              {group.piece.book}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Goals list */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {group.goals.map(goal => (
                          <Link
                            key={goal.id}
                            href={`/student/goal/${goal.id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                              padding: "0.75rem 1rem",
                              background: "var(--white)",
                              border: "1px solid var(--border)",
                              borderRadius: 4,
                              textDecoration: "none",
                              transition: "border-color 0.12s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                          >
                            {/* Bullet */}
                            <div style={{
                              width: 8, height: 8, borderRadius: "50%",
                              border: `1.5px solid ${section.color}`,
                              flexShrink: 0,
                            }} />

                            {/* Title */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: "Inter, sans-serif",
                                fontWeight: 400,
                                fontSize: "0.875rem",
                                color: "var(--charcoal)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {goal.title}
                              </div>
                              {goal.description && (
                                <div style={{
                                  fontFamily: "Inter, sans-serif",
                                  fontSize: "0.6875rem",
                                  color: "var(--muted)",
                                  marginTop: "0.125rem",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>
                                  {goal.description}
                                </div>
                              )}
                            </div>

                            {/* Points + arrow */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
                              <span style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: "0.6875rem",
                                fontWeight: 500,
                                color: section.color,
                                letterSpacing: "0.02em",
                              }}>
                                {goal.points} pts
                              </span>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
