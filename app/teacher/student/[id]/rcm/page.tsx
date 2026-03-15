"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { RcmService, RCM_GRADE_LEVELS } from "../../../../../lib/services/RcmService";
import { Teacher } from "../../../../../lib/models/Teacher";
import { useI18n } from "../../../../../lib/context/I18nContext";
import type { RcmExamRow, RcmChecklistItemRow, RcmCategory } from "../../../../../lib/types";

const CATEGORY_ORDER: RcmCategory[] = ["list_a", "list_b", "list_c", "etudes", "technical", "theory", "ear_training", "sight_reading"];

function daysUntil(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return diff;
}

const INP: React.CSSProperties = {
  border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem",
  fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)",
  color: "var(--charcoal)", outline: "none", width: "100%", boxSizing: "border-box",
};

export default function RcmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const rcm = RcmService.create(supabase);
  const { t } = useI18n();

  const CATEGORY_LABELS: Record<RcmCategory, string> = {
    list_a: "List A",
    list_b: "List B",
    list_c: "List C",
    etudes: t.teacher.rcmCategoryEtudes,
    technical: t.teacher.rcmCategoryTechnical,
    theory: t.teacher.rcmCategoryTheory,
    ear_training: t.teacher.rcmCategoryEarTraining,
    sight_reading: t.teacher.rcmCategorySightReading,
  };

  const [studentName, setStudentName] = useState("");
  const [exam, setExam] = useState<RcmExamRow | null>(null);
  const [checklist, setChecklist] = useState<RcmChecklistItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Setup form
  const [grade, setGrade] = useState("Grade 1");
  const [examDate, setExamDate] = useState("");
  const [creating, setCreating] = useState(false);

  // Add item form
  const [addingCategory, setAddingCategory] = useState<RcmCategory | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newComposer, setNewComposer] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Edit exam date
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    if (!teacher?.id) return;
    loadData();
  }, [teacher?.id, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: profile }, activeExam] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
        rcm.getActiveExam(studentId),
      ]);
      setStudentName((profile as { display_name: string } | null)?.display_name ?? "Student");
      setExam(activeExam);
      if (activeExam) {
        const items = await rcm.getChecklist(activeExam.id);
        setChecklist(items);
        setNewDate(activeExam.exam_date ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  async function createExam(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher?.studioId) return;
    setCreating(true);
    try {
      const newExam = await rcm.createExam({
        studioId: teacher.studioId,
        studentId,
        teacherId: teacher.id,
        gradeLevel: grade,
        examDate: examDate || undefined,
      });
      await rcm.seedDefaultChecklist(newExam.id, grade);
      await loadData();
    } finally {
      setCreating(false);
    }
  }

  async function toggleItem(item: RcmChecklistItemRow) {
    await rcm.toggleItem(item.id, !item.completed);
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, completed: !i.completed, completed_at: !i.completed ? new Date().toISOString() : null } : i));
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!exam || !addingCategory || !newTitle.trim()) return;
    setAddingItem(true);
    try {
      const item = await rcm.addChecklistItem({ examId: exam.id, category: addingCategory, title: newTitle.trim(), composer: newComposer.trim() || undefined });
      setChecklist(prev => [...prev, item]);
      setNewTitle(""); setNewComposer(""); setAddingCategory(null);
    } finally {
      setAddingItem(false);
    }
  }

  async function deleteItem(itemId: string) {
    await rcm.deleteItem(itemId);
    setChecklist(prev => prev.filter(i => i.id !== itemId));
  }

  async function saveDate(e: React.FormEvent) {
    e.preventDefault();
    if (!exam) return;
    setSavingDate(true);
    try {
      await rcm.updateExam(exam.id, { examDate: newDate || undefined }, teacher.id);
      setExam(prev => prev ? { ...prev, exam_date: newDate || null } : prev);
      setEditingDate(false);
    } finally {
      setSavingDate(false);
    }
  }

  async function markExamComplete() {
    if (!exam) return;
    const result = prompt("Exam result (e.g. First Class Honours, Honours, Pass):");
    if (result === null) return;
    await rcm.updateExam(exam.id, { status: "completed", examResult: result }, teacher.id);
    await loadData();
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 400, borderRadius: 4 }} />
      </div>
    );
  }

  const completedCount = checklist.filter(i => i.completed).length;
  const totalCount = checklist.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const days = exam?.exam_date ? daysUntil(exam.exam_date) : null;

  const grouped = CATEGORY_ORDER.reduce<Record<RcmCategory, RcmChecklistItemRow[]>>((acc, cat) => {
    acc[cat] = checklist.filter(i => i.category === cat);
    return acc;
  }, {} as Record<RcmCategory, RcmChecklistItemRow[]>);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}>
        ← {t.common.back}
      </button>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
          {t.teacher.rcmPageTitle}
        </h1>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>{studentName}</div>
      </div>

      {!exam ? (
        /* Setup form */
        <div className="card-base" style={{ padding: "1.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
            {t.teacher.rcmPageSetup.replace("{name}", studentName)}
          </div>
          <form onSubmit={createExam} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>{t.teacher.rcmGradeLevel}</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} style={INP}>
                {RCM_GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>{t.teacher.rcmExamDate}</label>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={INP} />
            </div>
            <button type="submit" disabled={creating} style={{
              padding: "0.625rem 1.25rem", borderRadius: 3, border: "none",
              background: "var(--charcoal)", color: "var(--white)",
              fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500,
              cursor: "pointer", opacity: creating ? 0.5 : 1, alignSelf: "flex-start",
            }}>
              {creating ? t.teacher.rcmSettingUp : t.teacher.rcmSetupExam}
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Exam header */}
          <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)" }}>
                  {exam.grade_level} · {exam.instrument}
                </div>
                {exam.exam_date ? (
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: days !== null && days < 14 ? "#c0392b" : "var(--muted)", marginTop: "0.25rem" }}>
                    {days !== null && days > 0
                      ? `${days} ${t.teacher.rcmDaysUntil}`
                      : days === 0
                        ? t.teacher.rcmExamToday
                        : t.teacher.rcmExamPassed}
                    {" · "}
                    {new Date(exam.exam_date + "T12:00:00").toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                ) : (
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.25rem" }}>{t.teacher.rcmNoExamDate}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => setEditingDate(v => !v)} style={{
                  padding: "0.25rem 0.75rem", borderRadius: 3, border: "1px solid var(--border-strong)",
                  background: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", cursor: "pointer",
                }}>
                  {t.teacher.rcmEditDate}
                </button>
                <button onClick={markExamComplete} style={{
                  padding: "0.25rem 0.75rem", borderRadius: 3, border: "1px solid var(--sage)",
                  background: "none", color: "var(--sage)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", cursor: "pointer",
                }}>
                  {t.teacher.rcmMarkDone}
                </button>
              </div>
            </div>

            {editingDate && (
              <form onSubmit={saveDate} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...INP, flex: 1 }} />
                <button type="submit" disabled={savingDate} style={{
                  padding: "0.5rem 0.875rem", borderRadius: 3, border: "none",
                  background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif",
                  fontSize: "0.8125rem", cursor: "pointer", opacity: savingDate ? 0.5 : 1, whiteSpace: "nowrap",
                }}>
                  {savingDate ? t.teacher.rcmSaving : t.common.save}
                </button>
              </form>
            )}

            {/* Progress bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>{t.teacher.rcmOverallProgress}</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal)" }}>{completedCount}/{totalCount} · {pct}%</span>
              </div>
              <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--sage)" : "var(--charcoal)", borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>
          </div>

          {/* Checklist grouped by category */}
          {CATEGORY_ORDER.map(cat => {
            const items = grouped[cat];
            if (items.length === 0 && addingCategory !== cat) return null;
            const catCompleted = items.filter(i => i.completed).length;
            return (
              <div key={cat} className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {CATEGORY_LABELS[cat]}
                    </div>
                    {items.length > 0 && (
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: catCompleted === items.length ? "var(--sage)" : "var(--muted)" }}>
                        {catCompleted}/{items.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setAddingCategory(v => v === cat ? null : cat); setNewTitle(""); setNewComposer(""); }}
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "1rem", cursor: "pointer", padding: "0 0.25rem" }}
                  >
                    +
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      <button
                        onClick={() => toggleItem(item)}
                        style={{
                          width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                          border: item.completed ? "none" : "1px solid var(--border-strong)",
                          background: item.completed ? "var(--sage)" : "transparent",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          color: "white", fontSize: "0.625rem", fontWeight: 700,
                        }}
                      >
                        {item.completed ? "✓" : ""}
                      </button>
                      <div style={{ flex: 1 }}>
                        <span style={{
                          fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                          color: item.completed ? "var(--muted)" : "var(--charcoal)",
                          textDecoration: item.completed ? "line-through" : "none",
                        }}>
                          {item.title}
                        </span>
                        {item.composer && (
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.375rem" }}>
                            — {item.composer}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.75rem", padding: "0 0.25rem", opacity: 0.5 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {addingCategory === cat && (
                  <form onSubmit={addItem} style={{ marginTop: "0.625rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <input required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t.teacher.rcmTitleLabel} style={INP} />
                    <input value={newComposer} onChange={e => setNewComposer(e.target.value)} placeholder={t.teacher.rcmComposer} style={INP} />
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button type="submit" disabled={addingItem} style={{
                        flex: 1, padding: "0.375rem", borderRadius: 3, border: "none",
                        background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif",
                        fontSize: "0.75rem", cursor: "pointer", opacity: addingItem ? 0.5 : 1,
                      }}>
                        {addingItem ? t.teacher.rcmAdding : t.common.add}
                      </button>
                      <button type="button" onClick={() => setAddingCategory(null)} style={{
                        padding: "0.375rem 0.75rem", borderRadius: 3, border: "1px solid var(--border)",
                        background: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", cursor: "pointer",
                      }}>
                        {t.common.cancel}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
