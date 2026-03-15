"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useI18n } from "../../../lib/context/I18nContext";
import type { LessonRow, AssignmentRow, ProgressReportRow, PracticeSessionRow } from "../../../lib/types";

export default function ParentChildPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const { t } = useI18n();

  const [studentName, setStudentName] = useState("");
  const [recentLessons, setRecentLessons] = useState<LessonRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [reports, setReports] = useState<ProgressReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id, childId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      // Verify parent is linked to this child
      const { data: link } = await supabase
        .from("parent_student_links")
        .select("id")
        .eq("parent_id", user!.id)
        .eq("student_id", childId)
        .maybeSingle();

      if (!link) { setAuthorized(false); setLoading(false); return; }

      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();

      const [profileRes, lessonsRes, assignmentsRes, sessionsRes, reportsRes] = await Promise.all([
        supabase.from("profiles").select("display_name, instrument").eq("id", childId).single(),
        supabase.from("lessons").select("*").eq("student_id", childId).order("scheduled_at", { ascending: false }).limit(10),
        supabase.from("assignments").select("*").eq("student_id", childId).eq("status", "active").order("created_at", { ascending: false }),
        supabase.from("practice_sessions").select("*").eq("student_id", childId).gte("created_at", twoWeeksAgo).order("created_at", { ascending: false }),
        supabase.from("progress_reports").select("*").eq("student_id", childId).eq("status", "sent").order("created_at", { ascending: false }).limit(5),
      ]);

      setStudentName((profileRes.data as { display_name: string } | null)?.display_name ?? "Student");
      setRecentLessons((lessonsRes.data ?? []) as LessonRow[]);
      setAssignments((assignmentsRes.data ?? []) as AssignmentRow[]);
      setSessions((sessionsRes.data ?? []) as PracticeSessionRow[]);
      setReports((reportsRes.data ?? []) as ProgressReportRow[]);
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

  if (!authorized) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.875rem" }}>{t.parent.noAccess}</p>
      </div>
    );
  }

  const practiceMinutes = sessions.reduce((s, x) => s + Math.round((x.duration_seconds ?? 0) / 60), 0);
  const upcomingLessons = recentLessons.filter(l => new Date(l.scheduled_at) > new Date() && l.status === "scheduled");
  const completedLessons = recentLessons.filter(l => l.status === "completed");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}
      >
        ← {t.common.back}
      </button>

      <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 1.5rem", letterSpacing: "-0.01em" }}>
        {studentName}
      </h1>

      {/* Practice summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { value: practiceMinutes, label: t.parent.practiceMin },
          { value: sessions.length, label: t.parent.sessions },
          { value: assignments.length, label: t.parent.activeAssignments },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.75rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: "0.5625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming lessons */}
      {upcomingLessons.length > 0 && (
        <div className="card-base" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            {t.parent.upcomingLessons}
          </div>
          {upcomingLessons.slice(0, 3).map(l => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)" }}>
              <span>{new Date(l.scheduled_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
              <span style={{ color: "var(--muted)" }}>{new Date(l.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {l.duration_minutes} min</span>
            </div>
          ))}
        </div>
      )}

      {/* Current assignments */}
      {assignments.length > 0 && (
        <div className="card-base" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            {t.parent.currentAssignments}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {assignments.map(a => (
              <div key={a.id} style={{ padding: "0.5rem 0.75rem", borderRadius: 3, border: "1px solid var(--border)", background: "var(--cream)" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)" }}>{a.title}</div>
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
        </div>
      )}

      {/* Recent lesson notes */}
      {completedLessons.filter(l => l.covered_notes).length > 0 && (
        <div className="card-base" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            {t.parent.recentLessonNotes}
          </div>
          {completedLessons.filter(l => l.covered_notes).slice(0, 3).map(l => (
            <div key={l.id} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.375rem" }}>
                {new Date(l.scheduled_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
              </div>
              {l.covered_notes && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0 0 0.25rem", lineHeight: 1.55 }}>
                  <strong style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{t.parent.covered} </strong>
                  {l.covered_notes}
                </p>
              )}
              {l.focus_notes && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0", lineHeight: 1.55 }}>
                  <strong style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{t.parent.focus} </strong>
                  {l.focus_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress reports */}
      {reports.length > 0 && (
        <div className="card-base" style={{ padding: "1.25rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            {t.parent.progressReports}
          </div>
          {reports.map(r => (
            <div key={r.id} style={{ marginBottom: "1.25rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.25rem" }}>{r.term}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.625rem" }}>
                {new Date(r.period_start).toLocaleDateString([], { month: "short", day: "numeric" })} – {new Date(r.period_end).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </div>
              {r.overall_summary && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", margin: "0 0 0.5rem", lineHeight: 1.6 }}>{r.overall_summary}</p>}
              {r.strengths && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.parent.strengths}</div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.125rem 0 0", lineHeight: 1.55 }}>{r.strengths}</p>
                </div>
              )}
              {r.areas_for_growth && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.parent.areasForGrowth}</div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.125rem 0 0", lineHeight: 1.55 }}>{r.areas_for_growth}</p>
                </div>
              )}
              {r.teacher_comments && (
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.parent.teacherNote}</div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.125rem 0 0", lineHeight: 1.55, fontStyle: "italic" }}>{r.teacher_comments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
