"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { StudioService } from "../../../lib/services/StudioService";
import { GoalService } from "../../../lib/services/GoalService";
import { Teacher } from "../../../lib/models/Teacher";
import type { ProfileRow, GoalRow } from "../../../lib/types";

const AREAS = [
  { value: "technique", label: "Technique", color: "var(--sage)", bg: "var(--sage-bg)", icon: "🌿" },
  { value: "repertoire", label: "Repertoire", color: "var(--rose)", bg: "var(--rose-bg)", icon: "🌸" },
  { value: "ear_training", label: "Ear Training", color: "var(--sky)", bg: "var(--sky-bg)", icon: "🎧" },
  { value: "theory", label: "Theory", color: "var(--butter)", bg: "var(--butter-bg)", icon: "⭐" },
];

export default function GoalBuilder() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentGoals, setStudentGoals] = useState<GoalRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [area, setArea] = useState("repertoire");
  const [points, setPoints] = useState(100);
  const [hasBonus, setHasBonus] = useState(false);
  const [bonusTitle, setBonusTitle] = useState("");
  const [bonusPoints, setBonusPoints] = useState(75);
  const [isBoss, setIsBoss] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const selectedArea = AREAS.find(a => a.value === area)!;

  const loadStudents = useCallback(async () => {
    if (!teacher?.studioId) return;
    setLoadingStudents(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = StudioService.getInstance(supabase);
      const profiles = await service.getStudents(teacher.studioId);
      setStudents(profiles);
      if (profiles.length > 0) setSelectedStudentId(profiles[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStudents(false);
    }
  }, [teacher?.studioId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const loadStudentGoals = useCallback(async () => {
    if (!selectedStudentId || !teacher?.id) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const service = GoalService.getInstance(supabase);
      const goals = await service.getTeacherGoalsByStudent(teacher.id, selectedStudentId);
      setStudentGoals(goals);
    } catch (err) {
      console.error(err);
    }
  }, [selectedStudentId, teacher?.id]);

  useEffect(() => {
    loadStudentGoals();
  }, [loadStudentGoals]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !selectedStudentId || !teacher?.studioId) return;
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const service = GoalService.getInstance(supabase);
      await service.createGoal({
        studioId: teacher.studioId,
        studentId: selectedStudentId,
        teacherId: teacher.id,
        title: title.trim(),
        description: desc.trim() || undefined,
        practiceArea: area,
        points,
        bonusTitle: hasBonus && bonusTitle.trim() ? bonusTitle.trim() : undefined,
        bonusPoints: hasBonus ? bonusPoints : undefined,
        isBoss,
      });
      setSaved(true);
      setTitle("");
      setDesc("");
      setHasBonus(false);
      setBonusTitle("");
      setIsBoss(false);
      setPoints(100);
      await loadStudentGoals();
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
        Goal Builder
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.75rem", fontFamily: "DM Sans, sans-serif" }}>
        Create goals that become nodes on your student's learning path.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>

        {/* Form */}
        <div className="card-base" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

          {/* Student picker */}
          <div>
            <label style={{ display: "block", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Student
            </label>
            {loadingStudents ? (
              <div className="skeleton" style={{ height: 42, borderRadius: "var(--radius-md)" }} />
            ) : students.length === 0 ? (
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
                No students in your studio yet.
              </p>
            ) : (
              <select
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.7rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--border)",
                  fontFamily: "Nunito, sans-serif",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "var(--charcoal)",
                  background: "var(--cream)",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={{ display: "block", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Goal Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Bach Minuet mm. 9–16 at 60 BPM"
              style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)", padding: "0.75rem 1rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.9rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", boxSizing: "border-box" }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Instructions (optional)
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Tips, expectations, or context for the student..."
              rows={3}
              style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)", padding: "0.75rem 1rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.9rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Practice area */}
          <div>
            <label style={{ display: "block", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Practice Area
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {AREAS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setArea(a.value)}
                  style={{
                    padding: "0.4rem 0.9rem",
                    borderRadius: 100,
                    cursor: "pointer",
                    fontFamily: "Nunito, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    background: area === a.value ? a.color : a.bg,
                    color: area === a.value ? "white" : a.color,
                    border: `1.5px solid ${area === a.value ? a.color : "transparent"}`,
                    transition: "all 0.15s",
                  }}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Points + Boss */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Points
              </label>
              <input
                type="number"
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
                min={10}
                max={1000}
                style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)", padding: "0.75rem 1rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "1rem", outline: "none", background: "var(--cream)", color: "var(--butter)", boxSizing: "border-box" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", paddingBottom: "0.65rem" }}>
              <input type="checkbox" checked={isBoss} onChange={e => setIsBoss(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--peach)" }} />
              <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)" }}>⭐ Boss Node</span>
            </label>
          </div>

          {/* Bonus challenge */}
          <div style={{ borderRadius: "var(--radius-md)", border: "1.5px solid var(--butter-light)", background: "var(--butter-bg)", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setHasBonus(b => !b)}
              style={{ width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--charcoal)" }}
            >
              <span>⭐ Bonus Challenge</span>
              <span style={{ color: "var(--butter)" }}>{hasBonus ? "▲" : "▼"}</span>
            </button>
            {hasBonus && (
              <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <input
                  value={bonusTitle}
                  onChange={e => setBonusTitle(e.target.value)}
                  placeholder="Bonus description"
                  style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1.5px solid var(--butter-light)", padding: "0.6rem 0.875rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem", outline: "none", background: "var(--white)", boxSizing: "border-box" }}
                />
                <input
                  type="number"
                  value={bonusPoints}
                  onChange={e => setBonusPoints(Number(e.target.value))}
                  style={{ width: 100, borderRadius: "var(--radius-md)", border: "1.5px solid var(--butter-light)", padding: "0.6rem 0.875rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.9rem", outline: "none", background: "var(--white)", color: "var(--butter)" }}
                />
              </div>
            )}
          </div>

          {error && (
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem", color: "var(--error)", background: "#fff1f0", padding: "0.6rem 0.875rem", borderRadius: "var(--radius-md)", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !selectedStudentId}
            className="btn btn-primary"
            style={{ padding: "0.9rem", fontSize: "0.95rem", opacity: (saving || !title.trim() || !selectedStudentId) ? 0.65 : 1, background: saved ? "var(--sage)" : undefined }}
          >
            {saved ? "✓ Goal Added!" : saving ? "Saving..." : "Add to Path"}
          </button>
        </div>

        {/* Path preview */}
        <div className="card-base" style={{ padding: "1.25rem" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
            {students.find(s => s.id === selectedStudentId)?.display_name || "Student"}'s Path
          </div>
          {studentGoals.length === 0 && !title ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🗺</div>
              <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>No goals yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {studentGoals.map((g, i) => {
                const a = AREAS.find(x => x.value === g.practice_area) ?? AREAS[0];
                const statusColor = g.status === "completed" ? "var(--sage)" : g.status === "current" ? a.color : "var(--border)";
                return (
                  <div key={g.id} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: i % 2 === 0 ? "flex-end" : "flex-start" }}>
                    {i > 0 && <div style={{ width: 2, height: 18, background: statusColor, opacity: 0.5, marginRight: i % 2 === 0 ? 23 : undefined, marginLeft: i % 2 === 0 ? undefined : 23 }} />}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{
                        width: 28, height: 28,
                        borderRadius: g.is_boss ? 8 : 100,
                        background: g.status === "completed" ? "var(--sage-bg)" : a.bg,
                        border: `2px solid ${statusColor}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.75rem", flexShrink: 0,
                      }}>
                        {g.status === "completed" ? "✓" : a.icon}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--charcoal)", fontFamily: "Nunito, sans-serif", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                    </div>
                  </div>
                );
              })}
              {title && (
                <>
                  <div style={{ width: 2, height: 18, background: "var(--border)", opacity: 0.5 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.7 }}>
                    <div style={{ width: 28, height: 28, borderRadius: isBoss ? 8 : 100, background: selectedArea.bg, border: `2px dashed ${selectedArea.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem" }}>
                      {selectedArea.icon}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "var(--charcoal)", fontFamily: "Nunito, sans-serif", fontStyle: "italic", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
