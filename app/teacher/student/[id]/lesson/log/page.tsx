"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../../lib/supabase/client";
import { LessonService } from "../../../../../../lib/services/LessonService";
import { Teacher } from "../../../../../../lib/models/Teacher";
import { useI18n } from "../../../../../../lib/context/I18nContext";
import type { LessonRow } from "../../../../../../lib/types";

export default function LessonLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const { t } = useI18n();

  const ATTENDANCE_LABEL: Record<string, string> = {
    attended: t.teacher.lessonLogAttendanceAttended,
    cancelled: t.teacher.lessonLogAttendanceCancelled,
    no_show: t.teacher.lessonLogAttendanceNoShow,
  };
  const ATTENDANCE_COLOR: Record<string, string> = {
    attended: "var(--sage)",
    cancelled: "var(--muted)",
    no_show: "var(--rose)",
  };

  const [studentName, setStudentName] = useState("");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacher?.id) return;
    loadData();
  }, [teacher?.id, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const lessonSvc = LessonService.create(supabase);
      const [profileRes, allLessons] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
        lessonSvc.getCompletedLessonsForStudent(teacher.id, studentId),
      ]);
      setStudentName((profileRes.data as { display_name: string } | null)?.display_name ?? "Student");
      setLessons(allLessons);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 400, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}
      >
        ← {t.common.back}
      </button>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
          {t.teacher.lessonLogTitle}
        </h1>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>{studentName}</div>
      </div>

      {lessons.length === 0 ? (
        <div className="card-base" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>{t.teacher.lessonLogNoLessons}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {lessons.map(lesson => {
            const att = lesson.attendance ?? "attended";
            const dateStr = new Date(lesson.scheduled_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            const timeStr = new Date(lesson.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return (
              <div
                key={lesson.id}
                className="card-base"
                style={{ padding: "1rem 1.25rem", cursor: "pointer" }}
                onClick={() => router.push(`/teacher/student/${studentId}/lesson/${lesson.id}`)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: lesson.covered_notes || lesson.focus_notes ? "0.625rem" : 0 }}>
                  <div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)" }}>{dateStr}</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      {timeStr} · {lesson.duration_minutes} min
                    </div>
                  </div>
                  <span style={{
                    fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600,
                    color: ATTENDANCE_COLOR[att],
                    background: `${ATTENDANCE_COLOR[att]}18`,
                    padding: "0.2rem 0.5rem", borderRadius: 2,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {ATTENDANCE_LABEL[att] ?? att}
                  </span>
                </div>

                {lesson.covered_notes && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.teacher.lessonLogCovered}</span>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.2rem 0 0", lineHeight: 1.55 }}>{lesson.covered_notes}</p>
                  </div>
                )}
                {lesson.focus_notes && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.teacher.lessonLogFocus}</span>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.2rem 0 0", lineHeight: 1.55 }}>{lesson.focus_notes}</p>
                  </div>
                )}
                {lesson.next_lesson_notes && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.teacher.lessonLogNextLesson}</span>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.2rem 0 0", lineHeight: 1.55 }}>{lesson.next_lesson_notes}</p>
                  </div>
                )}
                {!lesson.covered_notes && !lesson.focus_notes && !lesson.next_lesson_notes && (
                  <div style={{ marginTop: "0.375rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic" }}>
                    {t.teacher.lessonLogNoNotes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
