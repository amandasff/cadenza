"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { LessonService } from "../../../lib/services/LessonService";
import { AssignmentService } from "../../../lib/services/AssignmentService";
import { StudioService } from "../../../lib/services/StudioService";
import { PieceService } from "../../../lib/services/PieceService";
import { Teacher } from "../../../lib/models/Teacher";
import type {
  LessonWithAssignments,
  AssignmentRow,
  AssignmentType,
  ProfileRow,
} from "../../../lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DURATIONS = [30, 45, 60, 90];

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string; color: string; emoji: string }[] = [
  { value: "practice", label: "Practice",  color: "var(--rose)",     emoji: "🎹" },
  { value: "listen",   label: "Listen",    color: "var(--sky)",      emoji: "🎧" },
  { value: "theory",   label: "Theory",    color: "var(--butter)",   emoji: "📖" },
  { value: "memorize", label: "Memorize",  color: "var(--lavender)", emoji: "🧠" },
  { value: "record",   label: "Record",    color: "var(--sage)",     emoji: "🎙" },
];

const RATING_CONFIG = {
  struggling:    { emoji: "😓", label: "Struggling",    color: "#dc2626" },
  getting_there: { emoji: "🙂", label: "Getting there", color: "#d97706" },
  nailed_it:     { emoji: "🎉", label: "Nailed it",     color: "#16a34a" },
};

interface AssignmentDraft {
  id: string;
  title: string;
  pieceId: string;
  focus: string;
  type: AssignmentType;
  targetMins: string;
  dueDate: string;
  audioBlob: Blob | null;
  audioUrl: string | null;   // preview URL (object URL)
}

function newDraft(): AssignmentDraft {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return {
    id: Math.random().toString(36).slice(2),
    title: "",
    pieceId: "",
    focus: "",
    type: "practice",
    targetMins: "",
    dueDate: nextWeek.toISOString().split("T")[0],
    audioBlob: null,
    audioUrl: null,
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function groupByDay(lessons: LessonWithAssignments[]) {
  const groups: { label: string; date: Date; lessons: LessonWithAssignments[] }[] = [];
  for (const lesson of lessons) {
    const d = new Date(lesson.scheduled_at);
    const dayStr = d.toDateString();
    const existing = groups.find(g => g.date.toDateString() === dayStr);
    if (existing) {
      existing.lessons.push(lesson);
    } else {
      groups.push({ label: formatDayGroup(lesson.scheduled_at), date: d, lessons: [lesson] });
    }
  }
  return groups;
}

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 3, border: "1px solid var(--border-strong)",
  padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
  background: "var(--white)", color: "var(--charcoal)", outline: "none",
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "0.5rem 0.875rem", borderRadius: 3, border: "none",
  background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "0.5rem 0.875rem", borderRadius: 3,
  border: "1px solid var(--border-strong)", background: "transparent",
  color: "var(--muted)", fontFamily: "Inter, sans-serif",
  fontWeight: 400, fontSize: "0.8125rem", cursor: "pointer",
};

export default function SchedulePage() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [lessons, setLessons] = useState<LessonWithAssignments[]>([]);
  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [pieces, setPieces] = useState<{ id: string; title: string; student_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded lesson (show notes + assignments inline)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Auto-save notes
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // Complete lesson modal
  const [completingLesson, setCompletingLesson] = useState<LessonWithAssignments | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [assignmentDrafts, setAssignmentDrafts] = useState<AssignmentDraft[]>([newDraft()]);
  const [saving, setSaving] = useState(false);

  // Schedule new lesson modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    studentId: "",
    scheduledAt: "",
    durationMinutes: 45,
    recurring: false,
  });
  const [scheduling, setScheduling] = useState(false);

  // Voice note recording (tracks which draft index is recording)
  const [recordingDraftId, setRecordingDraftId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!teacher?.studioId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const lessonService = LessonService.getInstance(supabase);
      const studioService = StudioService.getInstance(supabase);

      const [lessonData, studentData] = await Promise.all([
        lessonService.getUpcomingLessonsWithContext(teacher.id),
        studioService.getStudents(teacher.studioId),
      ]);

      setLessons(lessonData);
      setStudents(studentData);

      // Load all pieces for all students
      const pieceService = PieceService.getInstance(supabase);
      const allPieces: typeof pieces = [];
      for (const s of studentData) {
        const sp = await pieceService.getStudentPieces(s.id);
        for (const p of sp) allPieces.push({ id: p.id, title: p.title, student_id: p.student_id });
      }
      setPieces(allPieces);

      // Init note drafts from existing lesson notes
      const noteDraftInit: Record<string, string> = {};
      for (const l of lessonData) {
        if (l.lesson_notes) noteDraftInit[l.id] = l.lesson_notes;
      }
      setNoteDrafts(noteDraftInit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teacher?.studioId, teacher?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-save lesson notes on blur
  async function saveNote(lessonId: string) {
    const notes = noteDrafts[lessonId] ?? "";
    try {
      const supabase = getSupabaseBrowserClient();
      await LessonService.getInstance(supabase).updateNotes(lessonId, notes, teacher.id);
    } catch (err) {
      console.error(err);
    }
  }

  // Cancel lesson
  async function handleCancel(lesson: LessonWithAssignments) {
    if (!confirm(`Cancel ${lesson.student_name}'s lesson on ${formatDayGroup(lesson.scheduled_at)}?`)) return;
    try {
      const supabase = getSupabaseBrowserClient();
      await LessonService.getInstance(supabase).cancelLesson(lesson.id, teacher.id);
      setLessons(prev => prev.filter(l => l.id !== lesson.id));
    } catch (err) {
      console.error(err);
    }
  }

  // Open complete lesson modal
  function openComplete(lesson: LessonWithAssignments) {
    setCompletingLesson(lesson);
    setCompleteNotes(noteDrafts[lesson.id] ?? "");
    // Auto-fill next lesson due date
    const nextLesson = lessons.find(l => l.student_id === lesson.student_id && l.id !== lesson.id);
    const dueDate = nextLesson
      ? new Date(nextLesson.scheduled_at).toISOString().split("T")[0]
      : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; })();
    setAssignmentDrafts([{ ...newDraft(), dueDate }]);
  }

  // Save completed lesson + create assignments
  async function handleCompleteLesson() {
    if (!completingLesson) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const lessonService = LessonService.getInstance(supabase);
      const assignmentService = AssignmentService.getInstance(supabase);

      await lessonService.completeLesson(completingLesson.id, completeNotes, teacher.id);

      for (const draft of assignmentDrafts) {
        if (!draft.title.trim()) continue;

        let audioUrl: string | null = null;
        if (draft.audioBlob) {
          audioUrl = await assignmentService.uploadVoiceNote(draft.audioBlob, completingLesson.id + "_" + draft.id);
        }

        await assignmentService.createAssignment({
          studioId: teacher.studioId!,
          studentId: completingLesson.student_id,
          teacherId: teacher.id,
          lessonId: completingLesson.id,
          pieceId: draft.pieceId || undefined,
          title: draft.title.trim(),
          focus: draft.focus || undefined,
          type: draft.type,
          targetMinutesPerDay: draft.targetMins ? parseInt(draft.targetMins) : undefined,
          dueDate: draft.dueDate || undefined,
          referenceAudioUrl: audioUrl || undefined,
        });
      }

      setLessons(prev => prev.filter(l => l.id !== completingLesson.id));
      setCompletingLesson(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Schedule new lesson
  async function handleScheduleLesson() {
    if (!scheduleForm.studentId || !scheduleForm.scheduledAt) return;
    setScheduling(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const lessonService = LessonService.getInstance(supabase);

      if (scheduleForm.recurring) {
        const d = new Date(scheduleForm.scheduledAt);
        await lessonService.createRecurrence({
          studioId: teacher.studioId!,
          studentId: scheduleForm.studentId,
          teacherId: teacher.id,
          dayOfWeek: d.getDay(),
          timeOfDay: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
          durationMinutes: scheduleForm.durationMinutes,
        });
      } else {
        await lessonService.createLesson({
          studioId: teacher.studioId!,
          studentId: scheduleForm.studentId,
          teacherId: teacher.id,
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
          durationMinutes: scheduleForm.durationMinutes,
        });
      }

      setShowScheduleModal(false);
      setScheduleForm({ studentId: "", scheduledAt: "", durationMinutes: 45, recurring: false });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setScheduling(false);
    }
  }

  // Voice note recording
  async function startRecording(draftId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAssignmentDrafts(prev => prev.map(d => d.id === draftId ? { ...d, audioBlob: blob, audioUrl: url } : d));
        setRecordingDraftId(null);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingSeconds(0);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecordingDraftId(draftId);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function updateDraft(id: string, patch: Partial<AssignmentDraft>) {
    setAssignmentDrafts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  const groups = groupByDay(lessons);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: 0 }}>
            Schedule
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
            Upcoming lessons · next 14 days
          </p>
        </div>
        <button onClick={() => setShowScheduleModal(true)} style={btnPrimary}>
          + Schedule Lesson
        </button>
      </div>

      {/* Lesson list */}
      {loading ? (
        <div style={{ color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "3rem", background: "var(--white)",
          borderRadius: 6, border: "1px solid var(--border)",
        }}>
          <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            No lessons scheduled in the next 14 days.
          </p>
          <button onClick={() => setShowScheduleModal(true)} style={{ ...btnPrimary, marginTop: "1rem" }}>
            Schedule your first lesson
          </button>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.date.toDateString()} style={{ marginBottom: "2rem" }}>
            <p style={{
              fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600,
              color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase",
              margin: "0 0 0.75rem",
            }}>
              {group.label}
            </p>

            {group.lessons.map(lesson => {
              const isExpanded = expandedId === lesson.id;
              const studentPieces = pieces.filter(p => p.student_id === lesson.student_id);

              return (
                <div key={lesson.id} style={{
                  background: "var(--white)", border: "1px solid var(--border)",
                  borderRadius: 6, marginBottom: "0.75rem", overflow: "hidden",
                }}>
                  {/* Lesson card header */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : lesson.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "1rem",
                      padding: "1rem 1.25rem", cursor: "pointer",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: lesson.student_avatar ? "transparent" : "var(--charcoal)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.6875rem", color: "var(--white)", fontWeight: 600, fontFamily: "Inter, sans-serif",
                      overflow: "hidden",
                    }}>
                      {lesson.student_avatar
                        ? <img src={lesson.student_avatar} alt={lesson.student_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (lesson.student_name ?? "?").split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase()
                      }
                    </div>

                    {/* Name + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
                        {lesson.student_name}
                      </p>
                      <p style={{ margin: "0.125rem 0 0", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                        {formatTime(lesson.scheduled_at)} · {lesson.duration_minutes} min
                        {lesson.assignments.length > 0 && (
                          <span style={{ marginLeft: "0.75rem" }}>
                            {lesson.completion_count}/{lesson.assignments.length} assignments done
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openComplete(lesson)}
                        style={{ ...btnPrimary, padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => handleCancel(lesson)}
                        style={{ ...btnSecondary, padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                      >
                        Cancel
                      </button>
                    </div>

                    <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {/* Expanded: notes + assignments */}
                  {isExpanded && (
                    <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid var(--border)" }}>
                      {/* Lesson notes */}
                      <div style={{ marginTop: "1rem" }}>
                        <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.375rem" }}>
                          Lesson notes
                        </label>
                        <textarea
                          value={noteDrafts[lesson.id] ?? ""}
                          onChange={e => setNoteDrafts(prev => ({ ...prev, [lesson.id]: e.target.value }))}
                          onBlur={() => saveNote(lesson.id)}
                          placeholder="What did you cover in this lesson?"
                          rows={3}
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                      </div>

                      {/* Existing assignments */}
                      {lesson.assignments.length > 0 && (
                        <div style={{ marginTop: "1rem" }}>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
                            Assignments for this lesson
                          </p>
                          {lesson.assignments.map((a: AssignmentRow) => {
                            const typeInfo = ASSIGNMENT_TYPES.find(t => t.value === a.type);
                            return (
                              <div key={a.id} style={{
                                display: "flex", alignItems: "center", gap: "0.75rem",
                                padding: "0.5rem 0.75rem", borderRadius: 4,
                                background: "var(--cream)", marginBottom: "0.375rem",
                              }}>
                                <span style={{
                                  fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.04em",
                                  textTransform: "uppercase", color: "var(--white)",
                                  background: typeInfo?.color ?? "var(--muted)",
                                  padding: "0.125rem 0.375rem", borderRadius: 2,
                                  fontFamily: "Inter, sans-serif",
                                }}>
                                  {typeInfo?.emoji} {typeInfo?.label}
                                </span>
                                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", flex: 1 }}>
                                  {a.title}
                                </span>
                                {a.focus && (
                                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                                    {a.focus}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* ── Complete Lesson Modal ─────────────────────────────── */}
      {completingLesson && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          zIndex: 200, overflowY: "auto", padding: "2rem 1rem",
        }}>
          <div style={{
            background: "var(--white)", borderRadius: 8, width: "100%", maxWidth: 640,
            padding: "1.75rem", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.375rem", fontWeight: 600, color: "var(--charcoal)", margin: "0 0 0.25rem" }}>
              Complete Lesson
            </h2>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.5rem" }}>
              {completingLesson.student_name} · {formatDayGroup(completingLesson.scheduled_at)} at {formatTime(completingLesson.scheduled_at)}
            </p>

            {/* Lesson notes */}
            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              What did you cover today?
            </label>
            <textarea
              value={completeNotes}
              onChange={e => setCompleteNotes(e.target.value)}
              placeholder="e.g. Worked on Moonlight Sonata bars 1–32, fixed fingering in left hand, discussed dynamics…"
              rows={4}
              style={{ ...inputStyle, resize: "vertical", marginBottom: "1.5rem" }}
            />

            {/* Assignments */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", margin: 0 }}>
                Assignments for next lesson
              </p>
              <button
                onClick={() => setAssignmentDrafts(prev => [...prev, newDraft()])}
                style={{ ...btnSecondary, padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
              >
                + Add
              </button>
            </div>

            {assignmentDrafts.map((draft, idx) => {
              const isRecording = recordingDraftId === draft.id;
              const studentPieces = pieces.filter(p => p.student_id === completingLesson.student_id);

              return (
                <div key={draft.id} style={{
                  border: "1px solid var(--border)", borderRadius: 6,
                  padding: "1rem", marginBottom: "0.75rem",
                  background: "var(--cream)",
                }}>
                  {/* Title */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      value={draft.title}
                      onChange={e => updateDraft(draft.id, { title: e.target.value })}
                      placeholder={`Assignment ${idx + 1} title *`}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    {assignmentDrafts.length > 1 && (
                      <button
                        onClick={() => setAssignmentDrafts(prev => prev.filter(d => d.id !== draft.id))}
                        style={{ ...btnSecondary, padding: "0.5rem 0.625rem", flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Row 2: piece + focus */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <select
                      value={draft.pieceId}
                      onChange={e => updateDraft(draft.id, { pieceId: e.target.value })}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      <option value="">No piece</option>
                      {studentPieces.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <input
                      value={draft.focus}
                      onChange={e => updateDraft(draft.id, { focus: e.target.value })}
                      placeholder="Focus (e.g. bars 15–22)"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>

                  {/* Row 3: type + mins + due */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <select
                      value={draft.type}
                      onChange={e => updateDraft(draft.id, { type: e.target.value as AssignmentType })}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      {ASSIGNMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={draft.targetMins}
                      onChange={e => updateDraft(draft.id, { targetMins: e.target.value })}
                      placeholder="Min/day"
                      min={1}
                      style={{ ...inputStyle, width: 90, flex: "none" }}
                    />
                    <input
                      type="date"
                      value={draft.dueDate}
                      onChange={e => updateDraft(draft.id, { dueDate: e.target.value })}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>

                  {/* Voice note row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {!draft.audioUrl ? (
                      <button
                        onClick={() => isRecording ? stopRecording() : startRecording(draft.id)}
                        style={{
                          ...btnSecondary,
                          padding: "0.375rem 0.75rem", fontSize: "0.75rem",
                          background: isRecording ? "#fee2e2" : undefined,
                          borderColor: isRecording ? "#dc2626" : undefined,
                          color: isRecording ? "#dc2626" : undefined,
                        }}
                      >
                        {isRecording ? `⏹ Stop (${recordingSeconds}s)` : "🎙 Record voice note"}
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <audio src={draft.audioUrl} controls style={{ height: 32 }} />
                        <button
                          onClick={() => updateDraft(draft.id, { audioBlob: null, audioUrl: null })}
                          style={{ ...btnSecondary, padding: "0.25rem 0.5rem", fontSize: "0.6875rem" }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    )}
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                      Optional — record yourself playing the passage
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Modal actions */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button onClick={() => setCompletingLesson(null)} style={btnSecondary} disabled={saving}>
                Cancel
              </button>
              <button onClick={handleCompleteLesson} style={btnPrimary} disabled={saving}>
                {saving ? "Saving…" : "Save & Complete Lesson"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule New Lesson Modal ─────────────────────────── */}
      {showScheduleModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, padding: "1rem",
        }}>
          <div style={{
            background: "var(--white)", borderRadius: 8, width: "100%", maxWidth: 440,
            padding: "1.75rem", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.375rem", fontWeight: 600, color: "var(--charcoal)", margin: "0 0 1.5rem" }}>
              Schedule a Lesson
            </h2>

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              Student
            </label>
            <select
              value={scheduleForm.studentId}
              onChange={e => setScheduleForm(f => ({ ...f, studentId: e.target.value }))}
              style={{ ...inputStyle, marginBottom: "1rem" }}
            >
              <option value="">Select student…</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.display_name}</option>
              ))}
            </select>

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              Date & time
            </label>
            <input
              type="datetime-local"
              value={scheduleForm.scheduledAt}
              onChange={e => setScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
              style={{ ...inputStyle, marginBottom: "1rem" }}
            />

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              Duration
            </label>
            <select
              value={scheduleForm.durationMinutes}
              onChange={e => setScheduleForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
              style={{ ...inputStyle, marginBottom: "1.25rem" }}
            >
              {DURATIONS.map(d => (
                <option key={d} value={d}>{d} minutes</option>
              ))}
            </select>

            {/* Recurring toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "1.5rem" }}>
              <input
                type="checkbox"
                checked={scheduleForm.recurring}
                onChange={e => setScheduleForm(f => ({ ...f, recurring: e.target.checked }))}
              />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)" }}>
                Make this a recurring lesson
              </span>
            </label>
            {scheduleForm.recurring && scheduleForm.scheduledAt && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "-1rem 0 1.25rem", padding: "0.625rem", background: "var(--cream)", borderRadius: 4 }}>
                Every {FULL_DAYS[new Date(scheduleForm.scheduledAt).getDay()]} at {new Date(scheduleForm.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — will generate the next 8 weeks of lessons
              </p>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowScheduleModal(false)} style={btnSecondary} disabled={scheduling}>
                Cancel
              </button>
              <button
                onClick={handleScheduleLesson}
                style={btnPrimary}
                disabled={scheduling || !scheduleForm.studentId || !scheduleForm.scheduledAt}
              >
                {scheduling ? "Scheduling…" : scheduleForm.recurring ? "Schedule + Repeat" : "Schedule Lesson"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
