"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { LessonService } from "../../../lib/services/LessonService";
import { AssignmentService } from "../../../lib/services/AssignmentService";
import { StudioService } from "../../../lib/services/StudioService";
import { PieceService } from "../../../lib/services/PieceService";
import { PracticeService } from "../../../lib/services/PracticeService";
import { GoalService } from "../../../lib/services/GoalService";
import { Teacher } from "../../../lib/models/Teacher";
import type {
  LessonWithAssignments,
  AssignmentRow,
  AssignmentType,
  ProfileRow,
  PracticeSessionRow,
  GoalRow,
  ExternalStudentRow,
} from "../../../lib/types";
import { useI18n } from "../../../lib/context/I18nContext";
import { Piano, Mic, Frown, Smile, PartyPopper, ChevronUp, ChevronDown, X } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DURATIONS = [30, 45, 60, 90];

const ASSIGNMENT_TYPES_BASE: { value: AssignmentType; color: string; emoji: string }[] = [
  { value: "practice", color: "var(--rose)",     emoji: "♪" },
  { value: "listen",   color: "var(--sky)",      emoji: "🎧" },
  { value: "theory",   color: "var(--butter)",   emoji: "📖" },
  { value: "memorize", color: "var(--lavender)", emoji: "🧠" },
  { value: "record",   color: "var(--sage)",     emoji: "◉" },
];

const RATING_CONFIG_BASE = {
  struggling:    { emoji: "😓", color: "var(--error)" },
  getting_there: { emoji: "🙂", color: "var(--warning)" },
  nailed_it:     { emoji: "🎉", color: "var(--success)" },
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

function formatDayGroup(iso: string, todayLabel: string, tomorrowLabel: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return todayLabel;
  if (d.toDateString() === tomorrow.toDateString()) return tomorrowLabel;
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function groupByDay(lessons: LessonWithAssignments[], todayLabel: string, tomorrowLabel: string) {
  const groups: { label: string; date: Date; lessons: LessonWithAssignments[] }[] = [];
  for (const lesson of lessons) {
    const d = new Date(lesson.scheduled_at);
    const dayStr = d.toDateString();
    const existing = groups.find(g => g.date.toDateString() === dayStr);
    if (existing) {
      existing.lessons.push(lesson);
    } else {
      groups.push({ label: formatDayGroup(lesson.scheduled_at, todayLabel, tomorrowLabel), date: d, lessons: [lesson] });
    }
  }
  return groups;
}

// ── Lesson Prep Card data ──────────────────────────────────────────
interface PrepData {
  totalMinutes: number;
  sessionCount: number;
  practiceAreas: { area: string; minutes: number }[];
  moodTrend: string[];  // last 3 moods
  goalsTotal: number;
  goalsCurrent: number;
  goalsCompleted: number;
  lastLessonNotes: string | null;
  lastLessonDate: string | null;
}

const PRACTICE_AREA_COLORS: Record<string, string> = {
  Technique: "var(--rose)",
  Repertoire: "var(--sage)",
  "Ear Training": "var(--sky)",
  Theory: "var(--butter)",
  "Sight Reading": "var(--lavender)",
  Improvisation: "var(--peach)",
};

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
  const { t } = useI18n();

  const ASSIGNMENT_TYPES = ASSIGNMENT_TYPES_BASE.map(a => ({
    ...a,
    label: a.value === "practice" ? t.schedule.practiceType
      : a.value === "listen" ? t.schedule.listenType
      : a.value === "theory" ? t.schedule.theoryType
      : a.value === "memorize" ? t.schedule.memorizeType
      : t.schedule.recordType,
  }));

  const RATING_CONFIG = {
    struggling:    { ...RATING_CONFIG_BASE.struggling,    label: t.student.stillStruggling },
    getting_there: { ...RATING_CONFIG_BASE.getting_there, label: t.student.gettingThere },
    nailed_it:     { ...RATING_CONFIG_BASE.nailed_it,     label: t.student.nailedIt },
  };

  const [lessons, setLessons] = useState<LessonWithAssignments[]>([]);
  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [externalStudents, setExternalStudents] = useState<ExternalStudentRow[]>([]);
  const [pieces, setPieces] = useState<{ id: string; title: string; student_id: string }[]>([]);
  const [prepData, setPrepData] = useState<Record<string, PrepData>>({});
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
  const [scheduleStudentType, setScheduleStudentType] = useState<"app" | "ext_existing" | "ext_new">("app");
  const [scheduleForm, setScheduleForm] = useState({
    studentId: "",
    scheduledAt: "",
    durationMinutes: 45,
    recurring: false,
  });
  const [scheduleExtId, setScheduleExtId] = useState("");
  const [scheduleExtName, setScheduleExtName] = useState("");
  const [scheduleExtEmail, setScheduleExtEmail] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit lesson modal
  const [editingLesson, setEditingLesson] = useState<LessonWithAssignments | null>(null);
  const [editForm, setEditForm] = useState({ scheduledAt: "", durationMinutes: 45 });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Voice note recording (tracks which draft index is recording)
  const [recordingDraftId, setRecordingDraftId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!teacher?.studioId) return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    // Load students + pieces independently — works even if lessons table doesn't exist yet
    try {
      const studioService = StudioService.create(supabase);
      const lessonSvc = LessonService.create(supabase);
      const [studentData, extData] = await Promise.all([
        studioService.getStudents(teacher.studioId!),
        lessonSvc.getExternalStudents(teacher.id).catch(() => [] as ExternalStudentRow[]),
      ]);
      setStudents(studentData);
      setExternalStudents(extData);

      const pieceService = PieceService.create(supabase);
      const allPieces: typeof pieces = [];
      for (const s of studentData) {
        const sp = await pieceService.getStudentPieces(s.id);
        for (const p of sp) allPieces.push({ id: p.id, title: p.title, student_id: p.student_id });
      }
      setPieces(allPieces);
    } catch (err) {
      console.error("Failed to load students:", err);
    }

    // Load lessons separately — requires lessons table to exist in Supabase
    try {
      const lessonService = LessonService.create(supabase);
      const lessonData = await lessonService.getUpcomingLessonsWithContext(teacher.id);
      setLessons(lessonData);

      const noteDraftInit: Record<string, string> = {};
      for (const l of lessonData) {
        if (l.lesson_notes) noteDraftInit[l.id] = l.lesson_notes;
      }
      setNoteDrafts(noteDraftInit);

      // ── Load prep data for each unique student ──────────────────────
      const uniqueStudentIds = [...new Set(lessonData.map(l => l.student_id).filter((id): id is string => !!id))];
      const practiceService = PracticeService.create(supabase);
      const goalService = GoalService.create(supabase);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const prepMap: Record<string, PrepData> = {};
      await Promise.all(uniqueStudentIds.map(async (studentId) => {
        try {
          const [sessions, goals] = await Promise.all([
            practiceService.getStudentSessions(studentId, 50),
            goalService.getStudentGoals(studentId),
          ]);

          // Filter sessions to last 7 days
          const recentSessions = sessions.filter(s => s.created_at >= oneWeekAgo);
          const totalMinutes = Math.round(recentSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);

          // Practice area breakdown
          const areaMap: Record<string, number> = {};
          for (const s of recentSessions) {
            if (s.segments_json) {
              for (let i = 0; i < s.segments_json.length; i++) {
                const seg = s.segments_json[i];
                const nextSeg = s.segments_json[i + 1];
                const segDuration = nextSeg
                  ? (nextSeg.start_seconds - seg.start_seconds)
                  : (s.duration_seconds - seg.start_seconds);
                areaMap[seg.practice_area] = (areaMap[seg.practice_area] || 0) + segDuration / 60;
              }
            }
          }
          const practiceAreas = Object.entries(areaMap)
            .map(([area, minutes]) => ({ area, minutes: Math.round(minutes) }))
            .sort((a, b) => b.minutes - a.minutes);

          // Mood trend (last 3 sessions with notes containing mood indicators)
          const moodTrend = recentSessions
            .slice(0, 5)
            .map(s => {
              const notes = (s.notes ?? "").toLowerCase();
              if (notes.includes("frustrated") || notes.includes("hard") || notes.includes("difficult")) return ":(";
              if (notes.includes("good") || notes.includes("great") || notes.includes("fun")) return ":)";
              if (notes.includes("ok") || notes.includes("fine") || notes.includes("alright")) return ":)";
              return "";
            })
            .filter(Boolean)
            .slice(0, 3);

          // Goals summary
          const goalsTotal = goals.length;
          const goalsCurrent = goals.filter(g => g.status === "current").length;
          const goalsCompleted = goals.filter(g => g.status === "completed").length;

          // Last completed lesson notes
          const { data: lastLessons } = await supabase
            .from("lessons")
            .select("lesson_notes, scheduled_at")
            .eq("student_id", studentId)
            .eq("status", "completed")
            .not("lesson_notes", "is", null)
            .order("scheduled_at", { ascending: false })
            .limit(1);

          const lastLesson = lastLessons?.[0] as { lesson_notes: string | null; scheduled_at: string } | undefined;

          prepMap[studentId] = {
            totalMinutes,
            sessionCount: recentSessions.length,
            practiceAreas,
            moodTrend,
            goalsTotal,
            goalsCurrent,
            goalsCompleted,
            lastLessonNotes: lastLesson?.lesson_notes ?? null,
            lastLessonDate: lastLesson?.scheduled_at ?? null,
          };
        } catch (err) {
          console.error(`Failed to load prep data for student ${studentId}:`, err);
        }
      }));
      setPrepData(prepMap);
    } catch (err) {
      console.error("Failed to load lessons — run supabase/lessons.sql in your Supabase dashboard:", err);
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
      await LessonService.create(supabase).updateNotes(lessonId, notes, teacher.id);
    } catch (err) {
      console.error(err);
    }
  }

  // Cancel lesson
  async function handleCancel(lesson: LessonWithAssignments) {
    if (!confirm(`Cancel ${lesson.student_name}'s lesson on ${formatDayGroup(lesson.scheduled_at, t.schedule.today, t.schedule.tomorrow)}?`)) return;
    try {
      const supabase = getSupabaseBrowserClient();
      await LessonService.create(supabase).cancelLesson(lesson.id, teacher.id);
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
    const nextLesson = lessons.find(l => lesson.student_id && l.student_id === lesson.student_id && l.id !== lesson.id);
    const dueDate = nextLesson
      ? new Date(nextLesson.scheduled_at).toISOString().split("T")[0]
      : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; })();
    setAssignmentDrafts([{ ...newDraft(), dueDate }]);
  }

  // Save completed lesson + create assignments
  async function handleCompleteLesson() {
    if (!completingLesson) return;
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const lessonService = LessonService.create(supabase);
      const assignmentService = AssignmentService.create(supabase);

      await lessonService.completeLesson(completingLesson.id, completeNotes, teacher.id);

      if (completingLesson.student_id) {
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
      }

      setLessons(prev => prev.filter(l => l.id !== completingLesson.id));
      setCompletingLesson(null);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      setSaveError(msg.includes("does not exist")
        ? "Database tables not set up yet. Run supabase/lessons.sql in your Supabase dashboard first."
        : `Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // Schedule new lesson
  async function handleScheduleLesson() {
    const isExtNew = scheduleStudentType === "ext_new";
    const isExtExisting = scheduleStudentType === "ext_existing";
    const isApp = scheduleStudentType === "app";

    if (isApp && !scheduleForm.studentId) return;
    if (isExtNew && !scheduleExtName.trim()) return;
    if (isExtExisting && !scheduleExtId) return;
    if (!scheduleForm.scheduledAt) return;

    setScheduling(true);
    setScheduleError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const lessonService = LessonService.create(supabase);

      // Create external student record if needed
      let externalStudentId: string | undefined;
      if (isExtNew) {
        const ext = await lessonService.createExternalStudent({
          studioId: teacher.studioId!,
          teacherId: teacher.id,
          name: scheduleExtName.trim(),
          email: scheduleExtEmail.trim() || undefined,
        });
        externalStudentId = ext.id;
      } else if (isExtExisting) {
        externalStudentId = scheduleExtId;
      }

      const studentId = isApp ? scheduleForm.studentId : undefined;

      if (scheduleForm.recurring) {
        const d = new Date(scheduleForm.scheduledAt);
        await lessonService.createRecurrence({
          studioId: teacher.studioId!,
          studentId,
          externalStudentId,
          teacherId: teacher.id,
          dayOfWeek: d.getDay(),
          timeOfDay: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
          durationMinutes: scheduleForm.durationMinutes,
        });
      } else {
        await lessonService.createLesson({
          studioId: teacher.studioId!,
          studentId,
          externalStudentId,
          teacherId: teacher.id,
          scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
          durationMinutes: scheduleForm.durationMinutes,
        });
      }

      setShowScheduleModal(false);
      setScheduleStudentType("app");
      setScheduleForm({ studentId: "", scheduledAt: "", durationMinutes: 45, recurring: false });
      setScheduleExtId("");
      setScheduleExtName("");
      setScheduleExtEmail("");
      await loadData();
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      setScheduleError(msg.includes("does not exist")
        ? "Database tables not set up yet. Run supabase/lessons.sql and supabase/external_students.sql in your Supabase dashboard first."
        : `Error: ${msg}`);
    } finally {
      setScheduling(false);
    }
  }

  // Edit lesson time/duration
  function openEdit(lesson: LessonWithAssignments) {
    const local = new Date(lesson.scheduled_at);
    // datetime-local format: "YYYY-MM-DDTHH:MM"
    const pad = (n: number) => String(n).padStart(2, "0");
    const localStr = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
    setEditingLesson(lesson);
    setEditForm({ scheduledAt: localStr, durationMinutes: lesson.duration_minutes });
    setEditError(null);
  }

  async function handleEditLesson() {
    if (!editingLesson) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      await LessonService.create(supabase).updateLesson(
        editingLesson.id,
        {
          scheduledAt: new Date(editForm.scheduledAt).toISOString(),
          durationMinutes: editForm.durationMinutes,
        },
        teacher.id
      );
      setLessons(prev => prev.map(l =>
        l.id === editingLesson.id
          ? { ...l, scheduled_at: new Date(editForm.scheduledAt).toISOString(), duration_minutes: editForm.durationMinutes }
          : l
      ));
      setEditingLesson(null);
    } catch (err) {
      setEditError((err as { message?: string })?.message ?? String(err));
    } finally {
      setEditSaving(false);
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

  const groups = groupByDay(lessons, t.schedule.today, t.schedule.tomorrow);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: 0 }}>
            {t.nav.schedule}
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
            {t.schedule.upcomingLessons}
          </p>
        </div>
        <button onClick={() => setShowScheduleModal(true)} style={btnPrimary}>
          + {t.schedule.scheduleLesson}
        </button>
      </div>

      {/* Lesson list */}
      {loading ? (
        <div style={{ color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "3rem", background: "var(--white)",
          borderRadius: 4, border: "1px solid var(--border)",
        }}>
          <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            {t.schedule.noLessonsNext14Days}
          </p>
          <button onClick={() => setShowScheduleModal(true)} style={{ ...btnPrimary, marginTop: "1rem" }}>
            {t.schedule.scheduleFirstLesson}
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
              const prep = lesson.student_id ? prepData[lesson.student_id] : undefined;

              return (
                <div key={lesson.id} style={{
                  background: "var(--white)", border: "1px solid var(--border)",
                  borderRadius: 4, marginBottom: "0.75rem", overflow: "hidden",
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
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
                          {lesson.student_name}
                        </p>
                        {lesson.is_external && (
                          <span style={{
                            fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.04em",
                            textTransform: "uppercase", color: "var(--muted)",
                            border: "1px solid var(--border-strong)", padding: "0.125rem 0.375rem",
                            borderRadius: 2, fontFamily: "Inter, sans-serif",
                          }}>
                            {t.schedule.notOnApp}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "0.125rem 0 0", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                        {formatTime(lesson.scheduled_at)} · {lesson.duration_minutes} {t.schedule.min}
                        {prep && prep.totalMinutes > 0 && (
                          <span style={{ marginLeft: "0.75rem", color: prep.totalMinutes >= 60 ? "var(--sage)" : "var(--warning)" }}>
                            {prep.totalMinutes} {t.schedule.minThisWeek}
                          </span>
                        )}
                        {prep && prep.totalMinutes === 0 && (
                          <span style={{ marginLeft: "0.75rem", color: "var(--error)" }}>
                            {t.schedule.noPracticeThisWeek}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {!lesson.is_external && (
                        <button
                          onClick={() => openComplete(lesson)}
                          style={{ ...btnPrimary, padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                        >
                          {t.schedule.complete}
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(lesson)}
                        style={{ ...btnSecondary, padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                      >
                        {t.common.edit}
                      </button>
                      <button
                        onClick={() => handleCancel(lesson)}
                        style={{ ...btnSecondary, padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                      >
                        {t.common.cancel}
                      </button>
                    </div>

                    <span style={{ color: "var(--muted)", fontSize: "0.75rem", flexShrink: 0 }}>
                      {isExpanded ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
                    </span>
                  </div>

                  {/* ── Lesson Prep Card ──────────────────────────── */}
                  {isExpanded && prep && (
                    <div style={{
                      margin: "0 1.25rem", padding: "0.875rem 1rem",
                      background: "var(--cream)", borderRadius: 4,
                      border: "1px solid var(--border)",
                    }}>
                      <p style={{
                        fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600,
                        color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase",
                        margin: "0 0 0.625rem",
                      }}>
                        {t.schedule.lessonPrep}
                      </p>

                      {/* Stats row */}
                      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                        {/* Practice this week */}
                        <div>
                          <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "1.25rem", fontWeight: 600, color: "var(--charcoal)" }}>
                            {prep.totalMinutes}<span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--muted)" }}> {t.schedule.min}</span>
                          </p>
                          <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
                            {prep.sessionCount} {t.schedule.sessionsThisWeek}
                          </p>
                        </div>

                        {/* Goals */}
                        <div>
                          <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "1.25rem", fontWeight: 600, color: "var(--charcoal)" }}>
                            {prep.goalsCompleted}<span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--muted)" }}> / {prep.goalsTotal}</span>
                          </p>
                          <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
                            {t.schedule.goalsCompletedActive.replace("{n}", String(prep.goalsCurrent))}
                          </p>
                        </div>

                        {/* Mood trend */}
                        {prep.moodTrend.length > 0 && (
                          <div>
                            <p style={{ margin: 0, fontSize: "1.25rem" }}>
                              {prep.moodTrend.join(" ")}
                            </p>
                            <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
                              {t.schedule.recentMood}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Practice area breakdown */}
                      {prep.practiceAreas.length > 0 && (
                        <div style={{ marginBottom: "0.625rem" }}>
                          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                            {prep.practiceAreas.map(({ area, minutes }) => (
                              <span key={area} style={{
                                display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                padding: "0.1875rem 0.5rem", borderRadius: 3,
                                background: "var(--white)", border: "1px solid var(--border)",
                                fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)",
                              }}>
                                <span style={{
                                  width: 6, height: 6, borderRadius: "50%",
                                  background: PRACTICE_AREA_COLORS[area] ?? "var(--muted)",
                                  flexShrink: 0,
                                }} />
                                {area} · {minutes}m
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Last lesson notes */}
                      {prep.lastLessonNotes && (
                        <div style={{
                          padding: "0.5rem 0.75rem", borderRadius: 3,
                          background: "var(--white)", border: "1px solid var(--border)",
                        }}>
                          <p style={{
                            margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
                            color: "var(--muted)", marginBottom: "0.25rem",
                          }}>
                            {t.schedule.lastLesson}{prep.lastLessonDate ? ` · ${new Date(prep.lastLessonDate).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}
                          </p>
                          <p style={{
                            margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                            color: "var(--charcoal)", lineHeight: 1.5,
                          }}>
                            {prep.lastLessonNotes}
                          </p>
                        </div>
                      )}

                      {/* No data state */}
                      {prep.totalMinutes === 0 && prep.goalsTotal === 0 && !prep.lastLessonNotes && (
                        <p style={{
                          margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                          color: "var(--muted)", fontStyle: "italic",
                        }}>
                          {t.schedule.noPracticeDataYet}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Expanded: notes + assignments */}
                  {isExpanded && (
                    <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid var(--border)" }}>
                      {/* Lesson notes */}
                      <div style={{ marginTop: "1rem" }}>
                        <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.375rem" }}>
                          {t.schedule.lessonNotes}
                        </label>
                        <textarea
                          value={noteDrafts[lesson.id] ?? ""}
                          onChange={e => setNoteDrafts(prev => ({ ...prev, [lesson.id]: e.target.value }))}
                          onBlur={() => saveNote(lesson.id)}
                          placeholder={t.schedule.coveredPlaceholder}
                          rows={3}
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                      </div>

                      {/* Existing assignments */}
                      {lesson.assignments.length > 0 && (
                        <div style={{ marginTop: "1rem" }}>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
                            {t.schedule.assignmentsForLesson}
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
              {t.schedule.completeLesson}
            </h2>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.5rem" }}>
              {completingLesson.student_name} · {formatDayGroup(completingLesson.scheduled_at, t.schedule.today, t.schedule.tomorrow)} at {formatTime(completingLesson.scheduled_at)}
            </p>

            {/* Lesson notes */}
            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              {t.schedule.coveredTodayLabel}
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
                {t.schedule.assignmentsForNextLesson}
              </p>
              <button
                onClick={() => setAssignmentDrafts(prev => [...prev, newDraft()])}
                style={{ ...btnSecondary, padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
              >
                + {t.schedule.addAssignment}
              </button>
            </div>

            {assignmentDrafts.map((draft, idx) => {
              const isRecording = recordingDraftId === draft.id;
              const studentPieces = pieces.filter(p => p.student_id === completingLesson.student_id);

              return (
                <div key={draft.id} style={{
                  border: "1px solid var(--border)", borderRadius: 4,
                  padding: "1rem", marginBottom: "0.75rem",
                  background: "var(--cream)",
                }}>
                  {/* Title */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      value={draft.title}
                      onChange={e => updateDraft(draft.id, { title: e.target.value })}
                      placeholder={t.schedule.assignmentTitlePlaceholder.replace("{n}", String(idx + 1))}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    {assignmentDrafts.length > 1 && (
                      <button
                        onClick={() => setAssignmentDrafts(prev => prev.filter(d => d.id !== draft.id))}
                        style={{ ...btnSecondary, padding: "0.5rem 0.625rem", flexShrink: 0, display: "flex", alignItems: "center" }}
                      >
                        <X size={14} strokeWidth={1.5} />
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
                      <option value="">{t.schedule.noPiece}</option>
                      {studentPieces.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <input
                      value={draft.focus}
                      onChange={e => updateDraft(draft.id, { focus: e.target.value })}
                      placeholder={t.schedule.focusPlaceholder}
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
                      placeholder={t.schedule.minPerDay}
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
                          borderColor: isRecording ? "var(--error)" : undefined,
                          color: isRecording ? "var(--error)" : undefined,
                        }}
                      >
                        {isRecording ? t.schedule.stopRecording.replace("{n}", String(recordingSeconds)) : t.schedule.recordVoiceNote}
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <audio src={draft.audioUrl} controls style={{ height: 32 }} />
                        <button
                          onClick={() => updateDraft(draft.id, { audioBlob: null, audioUrl: null })}
                          style={{ ...btnSecondary, padding: "0.25rem 0.5rem", fontSize: "0.6875rem" }}
                        >
                          <X size={12} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} /> {t.common.remove}
                        </button>
                      </div>
                    )}
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                      {t.schedule.voiceNoteHint}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Modal actions */}
            {saveError && (
              <div style={{
                marginTop: "1rem", padding: "0.75rem 1rem", borderRadius: 4,
                background: "#fff0f0", border: "1px solid #fca5a5",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--error)",
              }}>
                {saveError}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button onClick={() => { setCompletingLesson(null); setSaveError(null); }} style={btnSecondary} disabled={saving}>
                {t.common.cancel}
              </button>
              <button onClick={handleCompleteLesson} style={btnPrimary} disabled={saving}>
                {saving ? t.common.saving : t.schedule.saveComplete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Lesson Modal ────────────────────────────────── */}
      {editingLesson && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, padding: "1rem",
        }}>
          <div style={{
            background: "var(--white)", borderRadius: 8, width: "100%", maxWidth: 400,
            padding: "1.75rem", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.375rem", fontWeight: 600, color: "var(--charcoal)", margin: "0 0 0.25rem" }}>
              {t.schedule.editLesson}
            </h2>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.5rem" }}>
              {editingLesson.student_name}
            </p>

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              {t.schedule.dateAndTime}
            </label>
            <input
              type="datetime-local"
              value={editForm.scheduledAt}
              onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))}
              style={{ ...inputStyle, marginBottom: "1rem" }}
            />

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              {t.schedule.duration}
            </label>
            <select
              value={editForm.durationMinutes}
              onChange={e => setEditForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
              style={{ ...inputStyle, marginBottom: "1.5rem" }}
            >
              {DURATIONS.map(d => (
                <option key={d} value={d}>{t.schedule.minutes.replace("{d}", String(d))}</option>
              ))}
            </select>

            {editError && (
              <div style={{
                marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: 4,
                background: "#fff0f0", border: "1px solid #fca5a5",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--error)",
              }}>
                {editError}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setEditingLesson(null)} style={btnSecondary} disabled={editSaving}>
                {t.common.cancel}
              </button>
              <button onClick={handleEditLesson} style={btnPrimary} disabled={editSaving || !editForm.scheduledAt}>
                {editSaving ? t.common.saving : t.schedule.saveChanges}
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
              {t.schedule.scheduleALesson}
            </h2>

            {/* Student type toggle */}
            <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1rem" }}>
              {(["app", "ext_existing", "ext_new"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setScheduleStudentType(type)}
                  style={{
                    ...btnSecondary,
                    flex: 1, fontSize: "0.75rem", padding: "0.375rem 0.5rem",
                    background: scheduleStudentType === type ? "var(--charcoal)" : "transparent",
                    color: scheduleStudentType === type ? "var(--white)" : "var(--muted)",
                    border: scheduleStudentType === type ? "1px solid var(--charcoal)" : "1px solid var(--border-strong)",
                  }}
                >
                  {type === "app" ? t.schedule.onCadenza : type === "ext_existing" ? t.schedule.existingExternal : t.schedule.newExternal}
                </button>
              ))}
            </div>

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              {t.schedule.studentLabel}
            </label>

            {scheduleStudentType === "app" && (
              <select
                value={scheduleForm.studentId}
                onChange={e => setScheduleForm(f => ({ ...f, studentId: e.target.value }))}
                style={{ ...inputStyle, marginBottom: "1rem" }}
              >
                <option value="">{t.schedule.selectStudentPlaceholder}</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
            )}

            {scheduleStudentType === "ext_existing" && (
              <select
                value={scheduleExtId}
                onChange={e => setScheduleExtId(e.target.value)}
                style={{ ...inputStyle, marginBottom: "1rem" }}
              >
                <option value="">{t.schedule.selectExternalStudent}</option>
                {externalStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.instrument ? ` (${s.instrument})` : ""}</option>
                ))}
              </select>
            )}

            {scheduleStudentType === "ext_new" && (
              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="text"
                  placeholder={t.schedule.studentNamePlaceholder}
                  value={scheduleExtName}
                  onChange={e => setScheduleExtName(e.target.value)}
                  style={{ ...inputStyle, marginBottom: "0.5rem" }}
                />
                <input
                  type="email"
                  placeholder={t.schedule.emailOptional}
                  value={scheduleExtEmail}
                  onChange={e => setScheduleExtEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              {t.schedule.dateAndTime}
            </label>
            <input
              type="datetime-local"
              value={scheduleForm.scheduledAt}
              onChange={e => setScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
              style={{ ...inputStyle, marginBottom: "1rem" }}
            />

            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>
              {t.schedule.duration}
            </label>
            <select
              value={scheduleForm.durationMinutes}
              onChange={e => setScheduleForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
              style={{ ...inputStyle, marginBottom: "1.25rem" }}
            >
              {DURATIONS.map(d => (
                <option key={d} value={d}>{t.schedule.minutes.replace("{d}", String(d))}</option>
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
                {t.schedule.makeRecurring}
              </span>
            </label>
            {scheduleForm.recurring && scheduleForm.scheduledAt && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "-1rem 0 1.25rem", padding: "0.625rem", background: "var(--cream)", borderRadius: 4 }}>
                {t.schedule.recurringDesc
                  .replace("{day}", FULL_DAYS[new Date(scheduleForm.scheduledAt).getDay()])
                  .replace("{time}", new Date(scheduleForm.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}
              </p>
            )}

            {scheduleError && (
              <div style={{
                marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: 4,
                background: "#fff0f0", border: "1px solid #fca5a5",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--error)",
              }}>
                {scheduleError}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => { setShowScheduleModal(false); setScheduleError(null); }} style={btnSecondary} disabled={scheduling}>
                {t.common.cancel}
              </button>
              <button
                onClick={handleScheduleLesson}
                style={{
                  ...btnPrimary,
                  opacity: (() => {
                    if (scheduling || !scheduleForm.scheduledAt) return 0.45;
                    if (scheduleStudentType === "app" && !scheduleForm.studentId) return 0.45;
                    if (scheduleStudentType === "ext_existing" && !scheduleExtId) return 0.45;
                    if (scheduleStudentType === "ext_new" && !scheduleExtName.trim()) return 0.45;
                    return 1;
                  })(),
                  cursor: "pointer",
                }}
                disabled={
                  scheduling || !scheduleForm.scheduledAt ||
                  (scheduleStudentType === "app" && !scheduleForm.studentId) ||
                  (scheduleStudentType === "ext_existing" && !scheduleExtId) ||
                  (scheduleStudentType === "ext_new" && !scheduleExtName.trim())
                }
              >
                {scheduling ? t.schedule.scheduling : scheduleForm.recurring ? t.schedule.scheduleAndRepeat : t.schedule.scheduleLesson}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
