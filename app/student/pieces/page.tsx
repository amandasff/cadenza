"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PieceService } from "../../../lib/services/PieceService";
import type { PieceWithGoals } from "../../../lib/services/PieceService";
import { Student } from "../../../lib/models/Student";

const SECTIONS: { category: string; label: string; color: string }[] = [
  { category: "technique",    label: "Technique",    color: "var(--sage)" },
  { category: "etude",        label: "Études",       color: "var(--sky)" },
  { category: "repertoire",   label: "Repertoire",   color: "var(--rose)" },
  { category: "theory",       label: "Theory",       color: "var(--butter)" },
  { category: "ear_training", label: "Ear Training", color: "var(--peach)" },
  { category: "sight_reading",label: "Sight Reading",color: "var(--muted)" },
  { category: "free",         label: "Other",        color: "var(--muted)" },
];

const STATUS_LABELS: Record<string, string> = {
  learning: "Learning",
  polishing: "Polishing",
  performance_ready: "Performance Ready",
  completed: "Complete",
};

export default function MyPieces() {
  const { user } = useAuth();
  const student = user as Student;

  const [pieces, setPieces] = useState<PieceWithGoals[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const data = await PieceService.getInstance(supabase).getStudentPieces(student.id);
      setPieces(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => { load(); }, [load]);

  // Group by category
  const grouped = SECTIONS
    .map(s => ({ ...s, pieces: pieces.filter(p => p.category === s.category) }))
    .filter(s => s.pieces.length > 0);

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%", padding: "1.5rem 1.5rem 3rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)",
            fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            My Pieces
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 88, borderRadius: 4 }} />
          ))}
        </div>
      ) : pieces.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">No pieces yet</div>
          <p className="empty-state-desc">Your teacher will add pieces and assignments here.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {grouped.map(section => (
            <div key={section.category}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: section.color, flexShrink: 0 }} />
                <span style={{
                  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem",
                  letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)",
                }}>
                  {section.label}
                </span>
              </div>

              {/* Piece cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {section.pieces.map(piece => {
                  const total = piece.goals.length;
                  const done = piece.goals.filter(g => g.status === "completed").length;
                  const current = piece.goals.filter(g => g.status === "current").length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isComplete = piece.status === "completed" || (total > 0 && done === total);

                  return (
                    <div
                      key={piece.id}
                      style={{
                        background: "var(--white)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        padding: "1rem 1.25rem",
                      }}
                    >
                      {/* Title row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: "Cormorant Garamond, Georgia, serif",
                            fontWeight: 600,
                            fontSize: "1.0625rem",
                            color: "var(--charcoal)",
                            lineHeight: 1.25,
                          }}>
                            {piece.title}
                            {piece.composer && (
                              <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {piece.composer}</span>
                            )}
                          </div>
                          {piece.book && (
                            <div style={{
                              fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
                              color: "var(--muted)", marginTop: "0.2rem",
                            }}>
                              {piece.book}
                            </div>
                          )}
                        </div>

                        {/* Status badge */}
                        <div style={{
                          flexShrink: 0,
                          fontFamily: "Inter, sans-serif",
                          fontSize: "0.625rem",
                          fontWeight: 500,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: isComplete ? section.color : "var(--muted)",
                          border: `1px solid ${isComplete ? section.color : "var(--border)"}`,
                          borderRadius: 2,
                          padding: "0.2rem 0.5rem",
                          whiteSpace: "nowrap",
                        }}>
                          {STATUS_LABELS[piece.status] ?? piece.status}
                        </div>
                      </div>

                      {/* Progress */}
                      {total > 0 && (
                        <div style={{ marginTop: "0.875rem" }}>
                          <div style={{
                            height: 3,
                            background: "var(--border)",
                            borderRadius: 2,
                            overflow: "hidden",
                            marginBottom: "0.375rem",
                          }}>
                            <div style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: section.color,
                              borderRadius: 2,
                              transition: "width 0.4s ease",
                            }} />
                          </div>
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontFamily: "Inter, sans-serif",
                            fontSize: "0.625rem",
                            color: "var(--muted)",
                          }}>
                            <span>{done}/{total} goals done{current > 0 ? ` · ${current} assigned` : ""}</span>
                            <span>{pct}%</span>
                          </div>
                        </div>
                      )}

                      {total === 0 && (
                        <div style={{
                          marginTop: "0.625rem",
                          fontFamily: "Inter, sans-serif",
                          fontSize: "0.6875rem",
                          color: "var(--muted)",
                          fontStyle: "italic",
                        }}>
                          No goals assigned yet
                        </div>
                      )}
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
