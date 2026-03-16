"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../../lib/supabase/client";
import { LessonService } from "../../../../../../lib/services/LessonService";
import { AssignmentService } from "../../../../../../lib/services/AssignmentService";
import { Teacher } from "../../../../../../lib/models/Teacher";
import type { LessonRow, AssignmentWithContext } from "../../../../../../lib/types";
import { useI18n } from "../../../../../../lib/context/I18nContext";

const TA: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border-strong)", borderRadius: 3,
  padding: "0.625rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
  background: "var(--white)", color: "var(--charcoal)", outline: "none",
  resize: "vertical", minHeight: 80, boxSizing: "border-box", lineHeight: 1.6,
};

const INP: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border-strong)", borderRadius: 3,
  padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
  background: "var(--white)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box",
};

export default function LessonNotesPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { t } = useI18n();
  const { id: studentId, lessonId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const lessonSvc = LessonService.create(supabase);
  const assignmentSvc = AssignmentService.create(supabase);

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [studentName, setStudentName] = useState("");
  const [assignments, setAssignments] = useState<AssignmentWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [covered, setCovered] = useState("");
  const [focus, setFocus] = useState("");
  const [nextLesson, setNextLesson] = useState("");
  const [attendance, setAttendance] = useState<"attended" | "cancelled" | "no_show">("attended");

  // New assignment
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignMins, setAssignMins] = useState("20");
  const [assignTimesPerWeek, setAssignTimesPerWeek] = useState("5");
  const [addingAssign, setAddingAssign] = useState(false);

  useEffect(() => {
    if (!teacher?.id) return;
    loadData();
  }, [teacher?.id, lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [lessons, { data: profile }, assigns] = await Promise.all([
        lessonSvc.getLessonsForStudent(teacher.id, studentId),
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
        assignmentSvc.getAssignmentsForLesson ? assignmentSvc.getAssignmentsForLesson(lessonId, teacher.id) : Promise.resolve([]),
      ]);
      const l = lessons.find(x => x.id === lessonId) ?? null;
      setLesson(l);
      if (l) {
        setCovered(l.covered_notes ?? "");
        setFocus(l.focus_notes ?? "");
        setNextLesson(l.next_lesson_notes ?? "");
        setAttendance(l.attendance ?? "attended");
      }
      setStudentName((profile as { display_name: string } | null)?.display_name ?? "Student");
      setAssignments(assigns as AssignmentWithContext[]);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await lessonSvc.updateStructuredNotes(lessonId, {
        coveredNotes: covered,
        focusNotes: focus,
        nextLessonNotes: nextLesson,
        attendance,
      }, teacher.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher?.studioId || !assignTitle.trim()) return;
    setAddingAssign(true);
    try {
      const monday = getMondayOfCurrentWeek();
      await assignmentSvc.createAssignment({
        studioId: teacher.studioId,
        studentId,
        teacherId: teacher.id,
        lessonId,
        title: assignTitle.trim(),
        instructions: assignInstructions.trim() || undefined,
        type: "practice",
        targetMinutesPerDay: Number(assignMins) || undefined,
        weekStart: monday,
        timesPerWeek: Number(assignTimesPerWeek) || undefined,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      });
      setAssignTitle("");
      setAssignInstructions("");
      setShowAssignForm(false);
      await loadData();
    } finally {
      setAddingAssign(false);
    }
  }

  function getMondayOfCurrentWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 400, borderRadius: 4 }} />
      </div>
    );
  }

  const lessonDate = lesson ? new Date(lesson.scheduled_at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}
      >
        ← Back
      </button>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
          {t.schedule.lessonNotes}
        </h1>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>
          {studentName} · {lessonDate}
        </div>
      </div>

      {/* Attendance */}
      <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.625rem" }}>
          {t.schedule.attendanceLabel}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["attended", "cancelled", "no_show"] as const).map(val => (
            <button
              key={val}
              onClick={() => setAttendance(val)}
              style={{
                padding: "0.375rem 0.875rem", borderRadius: 3, border: "1px solid",
                borderColor: attendance === val ? "var(--charcoal)" : "var(--border)",
                background: attendance === val ? "var(--charcoal)" : "none",
                color: attendance === val ? "var(--white)" : "var(--muted)",
                fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {val === "attended" ? t.schedule.attended : val === "cancelled" ? t.teacher.lessonLogAttendanceCancelled : t.teacher.lessonLogAttendanceNoShow}
            </button>
          ))}
        </div>
      </div>

      {/* Structured notes */}
      <div className="card-base" style={{ padding: "1.25rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.375rem" }}>
            {t.schedule.coveredTodayLabel}
          </label>
          <textarea
            value={covered}
            onChange={e => setCovered(e.target.value)}
            placeholder="Pieces worked on, techniques addressed, breakthroughs…"
            style={TA}
          />
        </div>
        <div>
          <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.375rem" }}>
            {t.schedule.focusLabel}
          </label>
          <textarea
            value={focus}
            onChange={e => setFocus(e.target.value)}
            placeholder="What the student should prioritize in practice…"
            style={TA}
          />
        </div>
        <div>
          <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.375rem" }}>
            {t.schedule.nextLessonLabel}
          </label>
          <textarea
            value={nextLesson}
            onChange={e => setNextLesson(e.target.value)}
            placeholder="What to pick up next time, things to remember…"
            style={{ ...TA, minHeight: 64 }}
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "0.625rem 1.25rem", borderRadius: 3, border: "none",
            background: saved ? "var(--sage)" : "var(--charcoal)",
            color: "var(--white)", fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
            transition: "background 0.2s", opacity: saving ? 0.5 : 1,
            alignSelf: "flex-start",
          }}
        >
          {saving ? t.common.saving : saved ? t.teacher.reportsSaved : t.schedule.saveChanges}
        </button>
      </div>

      {/* Assignments for this lesson */}
      <div className="card-base" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {t.schedule.assignments}
          </div>
          <button
            onClick={() => setShowAssignForm(v => !v)}
            style={{
              padding: "0.25rem 0.75rem", borderRadius: 3, border: "1px solid var(--border-strong)",
              background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
              fontSize: "0.75rem", cursor: "pointer",
            }}
          >
            + Add
          </button>
        </div>

        {showAssignForm && (
          <form onSubmit={addAssignment} style={{ background: "var(--cream)", borderRadius: 3, padding: "0.875rem", marginBottom: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              required
              value={assignTitle}
              onChange={e => setAssignTitle(e.target.value)}
              placeholder="Assignment (e.g. Bars 1–16, RH alone, slow)"
              style={INP}
            />
            <input
              value={assignInstructions}
              onChange={e => setAssignInstructions(e.target.value)}
              placeholder="Instructions (optional)"
              style={INP}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Min/day</label>
                <input type="number" min="1" value={assignMins} onChange={e => setAssignMins(e.target.value)} style={INP} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Times/week</label>
                <input type="number" min="1" max="7" value={assignTimesPerWeek} onChange={e => setAssignTimesPerWeek(e.target.value)} style={INP} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" disabled={addingAssign} style={{
                flex: 1, padding: "0.5rem", borderRadius: 3, border: "none",
                background: "var(--charcoal)", color: "var(--white)",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
                cursor: "pointer", opacity: addingAssign ? 0.5 : 1,
              }}>
                {addingAssign ? t.common.saving : t.schedule.addAssignment}
              </button>
              <button type="button" onClick={() => setShowAssignForm(false)} style={{
                padding: "0.5rem 0.875rem", borderRadius: 3, border: "1px solid var(--border-strong)",
                background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem", cursor: "pointer",
              }}>{t.common.cancel}</button>
            </div>
          </form>
        )}

        {assignments.length === 0 && !showAssignForm ? (
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
            No assignments yet. Add one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {assignments.map(a => (
              <div key={a.id} style={{
                padding: "0.5rem 0.75rem", borderRadius: 3,
                border: "1px solid var(--border)", background: "var(--cream)",
              }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", fontWeight: 400 }}>{a.title}</div>
                {(a.target_minutes_per_day || a.times_per_week) && (
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                    {a.target_minutes_per_day ? `${a.target_minutes_per_day} min/day` : ""}
                    {a.target_minutes_per_day && a.times_per_week ? " · " : ""}
                    {a.times_per_week ? `${a.times_per_week}×/week` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
