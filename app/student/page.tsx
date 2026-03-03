"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { Student } from "../../lib/models/Student";
import { LessonService } from "../../lib/services/LessonService";
import { AssignmentService } from "../../lib/services/AssignmentService";
import type { GoalRow, PieceRow, LessonRow, AssignmentWithContext, SelfRating } from "../../lib/types";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const [goals, setGoals] = useState<GoalWithPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextLesson, setNextLesson] = useState<LessonRow | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithContext[]>([]);
  // Self-rating modal
  const [ratingAssignment, setRatingAssignment] = useState<AssignmentWithContext | null>(null);
  const [ratingValue, setRatingValue] = useState<SelfRating | null>(null);
  const [ratingNote, setRatingNote] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);

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

    // Load lessons + assignments separately — requires lessons SQL to be run in Supabase
    try {
      const supabase = getSupabaseBrowserClient();
      const lessonService = LessonService.getInstance(supabase);
      const assignmentService = AssignmentService.getInstance(supabase);
      const [lesson, activeAssignments] = await Promise.all([
        lessonService.getStudentNextLesson(student.id),
        assignmentService.getActiveAssignments(student.id),
      ]);
      setNextLesson(lesson);
      setAssignments(activeAssignments);
    } catch {
      // Silently ignore — lessons table may not exist yet
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleCompleteAssignment() {
    if (!ratingAssignment || !ratingValue) return;
    setRatingSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await AssignmentService.getInstance(supabase).completeAssignment(
        ratingAssignment.id, student.id, ratingValue, ratingNote || undefined
      );
      setAssignments(prev => prev.filter(a => a.id !== ratingAssignment.id));
      setRatingAssignment(null);
      setRatingValue(null);
      setRatingNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setRatingSaving(false);
    }
  }

  const grouped = groupGoals(goals);

  // Collect extra categories (non-standard) that have goals
  const extraCategories = Object.keys(EXTRA_CATEGORIES).filter(cat => grouped.has(cat));

  const totalAssignments = goals.length;

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%" }}>

      {/* ── Practice hero button ── */}
      <div style={{ padding: "1.5rem 1.5rem 1.125rem" }}>
        <Link href="/student/practice" style={{
          display: "block",
          background: "linear-gradient(135deg, #3D6B55 0%, #2C5242 100%)",
          borderRadius: 10,
          padding: "1.625rem 1.5rem",
          textDecoration: "none",
          color: "#FDFCFA",
          boxShadow: "0 4px 24px rgba(44,82,66,0.28)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Background accent */}
          <div style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: 20, bottom: -30, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
            <div>
              <div style={{ fontSize: "0.6875rem", fontFamily: "Inter, sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: "0.375rem" }}>
                Ready to play?
              </div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.875rem", lineHeight: 1, marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>
                Start practicing
              </div>
              <div style={{ fontSize: "0.8125rem", opacity: 0.55, fontFamily: "Inter, sans-serif" }}>
                {totalAssignments > 0
                  ? `${totalAssignments} goal${totalAssignments !== 1 ? "s" : ""} to work on`
                  : "Tap to open the timer"}
              </div>
            </div>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backdropFilter: "blur(4px)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Next Lesson widget */}
      {nextLesson && (
        <div style={{ padding: "0 1.5rem 0.75rem" }}>
          <div style={{
            background: "var(--white)", border: "1px solid var(--border)",
            borderRadius: 4, padding: "0.875rem 1.125rem",
            display: "flex", alignItems: "center", gap: "0.875rem",
          }}>
            <span style={{ fontSize: "1.125rem", flexShrink: 0 }}>🎵</span>
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                Next lesson
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                {new Date(nextLesson.scheduled_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                {" at "}
                {new Date(nextLesson.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {(() => {
                  const diffMs = new Date(nextLesson.scheduled_at).getTime() - Date.now();
                  const diffDays = Math.ceil(diffMs / 86400000);
                  if (diffDays <= 0) return "Today";
                  if (diffDays === 1) return "Tomorrow";
                  return `in ${diffDays} days`;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Assignments this week */}
      {assignments.length > 0 && (
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--rose)", flexShrink: 0 }} />
            <span style={{
              fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem",
              letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)",
            }}>
              Assignments this week
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {assignments.map(a => {
              const TYPE_COLORS: Record<string, string> = {
                practice: "var(--rose)", listen: "var(--sky)", theory: "var(--butter)",
                memorize: "var(--lavender)", record: "var(--sage)",
              };
              const TYPE_EMOJI: Record<string, string> = {
                practice: "🎹", listen: "🎧", theory: "📖", memorize: "🧠", record: "🎙",
              };
              const color = TYPE_COLORS[a.type] ?? "var(--muted)";

              return (
                <div key={a.id} style={{
                  background: "var(--white)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "0.875rem 1rem",
                  display: "flex", alignItems: "flex-start", gap: "0.875rem",
                }}>
                  {/* Type badge */}
                  <span style={{
                    fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.04em",
                    textTransform: "uppercase", padding: "0.2rem 0.4rem", borderRadius: 2,
                    background: color, color: "var(--white)", fontFamily: "Inter, sans-serif",
                    flexShrink: 0, marginTop: "0.125rem",
                  }}>
                    {TYPE_EMOJI[a.type]} {a.type}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9rem", color: "var(--charcoal)" }}>
                      {a.title}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      {[
                        a.piece_title,
                        a.focus,
                        a.target_minutes_per_day ? `${a.target_minutes_per_day} min/day` : null,
                        a.due_date ? `Due ${new Date(a.due_date + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}` : null,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    {a.instructions && (
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", fontStyle: "italic" }}>
                        {a.instructions}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flexShrink: 0, alignItems: "flex-end" }}>
                    {a.reference_audio_url && (
                      <audio src={a.reference_audio_url} controls style={{ height: 28, maxWidth: 140 }} />
                    )}
                    <button
                      onClick={() => { setRatingAssignment(a); setRatingValue(null); setRatingNote(""); }}
                      style={{
                        padding: "0.375rem 0.75rem", borderRadius: 3, border: "none",
                        background: "var(--charcoal)", color: "var(--white)",
                        fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Mark Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "0.5rem",
                                  }}>
                                    <div style={{
                                      fontFamily: "Cormorant Garamond, Georgia, serif",
                                      fontWeight: 600,
                                      fontSize: "1rem",
                                      color: "var(--charcoal)",
                                      lineHeight: 1.2,
                                      minWidth: 0,
                                    }}>
                                      {group.piece.title}
                                      {group.piece.composer && (
                                        <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {group.piece.composer}</span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => router.push(`/student/practice?pieceId=${group.piece!.id}`)}
                                      style={{
                                        flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                                        fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 500,
                                        color: section.color, letterSpacing: "0.06em", textTransform: "uppercase",
                                        padding: "0.125rem 0", whiteSpace: "nowrap",
                                      }}
                                    >
                                      Practice →
                                    </button>
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
                                <div style={{ marginBottom: "0.375rem", paddingLeft: "1rem", borderLeft: `2px solid ${meta.color}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                                  <div style={{
                                    fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
                                    fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.2, minWidth: 0,
                                  }}>
                                    {group.piece.title}
                                    {group.piece.composer && (
                                      <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {group.piece.composer}</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => router.push(`/student/practice?pieceId=${group.piece!.id}`)}
                                    style={{
                                      flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                                      fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 500,
                                      color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase",
                                      padding: "0.125rem 0", whiteSpace: "nowrap",
                                    }}
                                  >
                                    Practice →
                                  </button>
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

      {/* Self-rating modal */}
      {ratingAssignment && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, padding: "1rem",
        }}>
          <div style={{
            background: "var(--white)", borderRadius: 8, width: "100%", maxWidth: 400,
            padding: "1.75rem", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.25rem", fontWeight: 600, color: "var(--charcoal)", margin: "0 0 0.25rem" }}>
              How did it go?
            </h3>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>
              {ratingAssignment.title}
            </p>

            <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1.25rem" }}>
              {(["struggling", "getting_there", "nailed_it"] as SelfRating[]).map(r => {
                const config = { struggling: { emoji: "😓", label: "Still struggling" }, getting_there: { emoji: "🙂", label: "Getting there" }, nailed_it: { emoji: "🎉", label: "Nailed it!" } }[r];
                const selected = ratingValue === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRatingValue(r)}
                    style={{
                      flex: 1, padding: "0.75rem 0.5rem", borderRadius: 4, cursor: "pointer",
                      border: selected ? "2px solid var(--charcoal)" : "1px solid var(--border-strong)",
                      background: selected ? "var(--cream)" : "var(--white)",
                      fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: selected ? 600 : 400,
                      color: "var(--charcoal)", textAlign: "center", transition: "all 0.12s",
                    }}
                  >
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{config.emoji}</div>
                    {config.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={ratingNote}
              onChange={e => setRatingNote(e.target.value)}
              placeholder="Optional note for your teacher…"
              rows={2}
              style={{
                width: "100%", borderRadius: 3, border: "1px solid var(--border-strong)",
                padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                background: "var(--white)", color: "var(--charcoal)", outline: "none",
                boxSizing: "border-box", resize: "none", marginBottom: "1rem",
              }}
            />

            <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setRatingAssignment(null)}
                style={{
                  padding: "0.5rem 0.875rem", borderRadius: 3,
                  border: "1px solid var(--border-strong)", background: "transparent",
                  color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteAssignment}
                disabled={!ratingValue || ratingSaving}
                style={{
                  padding: "0.5rem 0.875rem", borderRadius: 3, border: "none",
                  background: ratingValue ? "var(--charcoal)" : "var(--border)",
                  color: "var(--white)", fontFamily: "Inter, sans-serif",
                  fontWeight: 500, fontSize: "0.8125rem",
                  cursor: ratingValue ? "pointer" : "not-allowed",
                }}
              >
                {ratingSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
