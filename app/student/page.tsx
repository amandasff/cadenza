"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { Student } from "../../lib/models/Student";
import type { GoalRow, PieceRow } from "../../lib/types";

type GoalWithPiece = GoalRow & { piece: PieceRow | null };

// The four always-visible sections
const SECTIONS = [
  { category: "technique",    label: "Technique",          color: "var(--sage)" },
  { category: "etude",        label: "Études",             color: "var(--sky)" },
  { category: "repertoire",   label: "Repertoire",         color: "var(--rose)" },
  { category: "theory",       label: "Theory",             color: "var(--butter)" },
  { category: "ear_training", label: "Ear & Sight Training", color: "var(--lavender)" },
];

// Extra categories that appear only when populated
const EXTRA_CATEGORIES: Record<string, { label: string; color: string }> = {
  sight_reading: { label: "Sight Reading", color: "var(--muted)" },
  free:          { label: "Other",         color: "var(--muted)" },
};

function getSectionCategory(goal: GoalWithPiece): string {
  return goal.piece?.category ?? goal.practice_area ?? "free";
}

// Group goals: section → book (string|null) → piece (PieceRow|null) → goals
type BookGroup = {
  book: string | null;
  pieces: { piece: PieceRow | null; goals: GoalWithPiece[] }[];
};

function groupGoals(goals: GoalWithPiece[]): Map<string, BookGroup[]> {
  // category → book → pieceId → { piece, goals }
  const catMap = new Map<string, Map<string | null, Map<string | null, { piece: PieceRow | null; goals: GoalWithPiece[] }>>>();

  for (const goal of goals) {
    const cat = getSectionCategory(goal);
    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const bookMap = catMap.get(cat)!;

    const book = goal.piece?.book ?? null;
    if (!bookMap.has(book)) bookMap.set(book, new Map());
    const pieceMap = bookMap.get(book)!;

    const pieceKey = goal.piece_id;
    if (!pieceMap.has(pieceKey)) pieceMap.set(pieceKey, { piece: goal.piece, goals: [] });
    pieceMap.get(pieceKey)!.goals.push(goal);
  }

  // Convert to sorted BookGroup arrays per category
  const result = new Map<string, BookGroup[]>();
  for (const [cat, bookMap] of catMap.entries()) {
    const bookGroups: BookGroup[] = [];
    for (const [book, pieceMap] of bookMap.entries()) {
      bookGroups.push({
        book,
        pieces: Array.from(pieceMap.values()),
      });
    }
    // Sort: named books first (alphabetically), then null (standalone goals)
    bookGroups.sort((a, b) => {
      if (a.book === null && b.book !== null) return 1;
      if (a.book !== null && b.book === null) return -1;
      return (a.book ?? "").localeCompare(b.book ?? "");
    });
    result.set(cat, bookGroups);
  }
  return result;
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

      const { data: goalsData } = await supabase
        .from("goals")
        .select("*")
        .eq("student_id", student.id)
        .eq("status", "current")
        .order("path_order", { ascending: true });

      const rawGoals = (goalsData ?? []) as GoalRow[];

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

  const grouped = groupGoals(goals);

  // Collect extra categories (non-standard) that have goals
  const extraCategories = Object.keys(EXTRA_CATEGORIES).filter(cat => grouped.has(cat));

  const totalAssignments = goals.length;

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
              {totalAssignments > 0
                ? `${totalAssignments} assignment${totalAssignments !== 1 ? "s" : ""} this week`
                : "Log your practice session"}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.7, flexShrink: 0 }}>
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Date divider */}
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

      {/* Notebook sections */}
      <div style={{ padding: "0 1.5rem 3rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {loading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 4 }} />
            ))}
          </>
        ) : (
          <>
            {/* Always-visible sections */}
            {SECTIONS.map(section => {
              const bookGroups = grouped.get(section.category) ?? [];
              const isEmpty = bookGroups.length === 0;

              return (
                <div key={section.category}>
                  {/* Section header */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    marginBottom: isEmpty ? "0.5rem" : "0.875rem",
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: section.color, flexShrink: 0,
                    }} />
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

                  {isEmpty ? (
                    /* Empty section placeholder — notebook-style */
                    <div style={{
                      borderLeft: `2px solid var(--border)`,
                      marginLeft: "0.1875rem",
                      paddingLeft: "1rem",
                      paddingTop: "0.25rem",
                      paddingBottom: "0.25rem",
                    }}>
                      <span style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "0.75rem",
                        color: "var(--border-strong)",
                        fontStyle: "italic",
                        letterSpacing: "0.01em",
                      }}>
                        No assignments this week
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                      {bookGroups.map((bookGroup, bi) => (
                        <div key={bi}>
                          {/* Book header — only if this group has a named book */}
                          {bookGroup.book && (
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              marginBottom: "0.625rem",
                            }}>
                              <div style={{
                                height: "1px",
                                width: "0.75rem",
                                background: section.color,
                                opacity: 0.5,
                                flexShrink: 0,
                              }} />
                              <span style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: "0.625rem",
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: section.color,
                                opacity: 0.8,
                              }}>
                                {bookGroup.book}
                              </span>
                            </div>
                          )}

                          {/* Pieces in this book */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                            {bookGroup.pieces.map((group, gi) => (
                              <div key={gi}>
                                {/* Piece title — only if there's a named piece */}
                                {group.piece && (
                                  <div style={{
                                    marginBottom: "0.375rem",
                                    paddingLeft: "1rem",
                                    borderLeft: `2px solid ${section.color}`,
                                  }}>
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
                                  </div>
                                )}

                                {/* Goals */}
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
                                      <div style={{
                                        width: 8, height: 8, borderRadius: "50%",
                                        border: `1.5px solid ${section.color}`,
                                        flexShrink: 0,
                                      }} />

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
              );
            })}

            {/* Extra categories (Sight Reading, Other) — only if populated */}
            {extraCategories.map(cat => {
              const meta = EXTRA_CATEGORIES[cat];
              const bookGroups = grouped.get(cat) ?? [];
              return (
                <div key={cat}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                    <span style={{
                      fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem",
                      letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)",
                    }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {bookGroups.map((bookGroup, bi) => (
                      <div key={bi}>
                        {bookGroup.book && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                            <div style={{ height: "1px", width: "0.75rem", background: meta.color, opacity: 0.5, flexShrink: 0 }} />
                            <span style={{
                              fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600,
                              letterSpacing: "0.08em", textTransform: "uppercase", color: meta.color, opacity: 0.8,
                            }}>
                              {bookGroup.book}
                            </span>
                          </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                          {bookGroup.pieces.map((group, gi) => (
                            <div key={gi}>
                              {group.piece && (
                                <div style={{ marginBottom: "0.375rem", paddingLeft: "1rem", borderLeft: `2px solid ${meta.color}` }}>
                                  <div style={{
                                    fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
                                    fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.2,
                                  }}>
                                    {group.piece.title}
                                    {group.piece.composer && (
                                      <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {group.piece.composer}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                {group.goals.map(goal => (
                                  <Link
                                    key={goal.id}
                                    href={`/student/goal/${goal.id}`}
                                    style={{
                                      display: "flex", alignItems: "center", gap: "0.75rem",
                                      padding: "0.75rem 1rem", background: "var(--white)",
                                      border: "1px solid var(--border)", borderRadius: 4,
                                      textDecoration: "none", transition: "border-color 0.12s",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                                  >
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${meta.color}`, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{
                                        fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "0.875rem",
                                        color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                      }}>
                                        {goal.title}
                                      </div>
                                      {goal.description && (
                                        <div style={{
                                          fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)",
                                          marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>
                                          {goal.description}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
                                      <span style={{
                                        fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 500,
                                        color: meta.color, letterSpacing: "0.02em",
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
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
