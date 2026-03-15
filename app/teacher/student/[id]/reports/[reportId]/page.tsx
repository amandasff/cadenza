"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../../lib/supabase/client";
import { Teacher } from "../../../../../../lib/models/Teacher";
import { useI18n } from "../../../../../../lib/context/I18nContext";
import type { ProgressReportRow } from "../../../../../../lib/types";

const TA: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border-strong)", borderRadius: 3,
  padding: "0.625rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
  background: "var(--white)", color: "var(--charcoal)", outline: "none",
  resize: "vertical", minHeight: 80, boxSizing: "border-box", lineHeight: 1.6,
};

export default function ReportDetailPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const { id: studentId, reportId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const { t } = useI18n();

  const FIELDS: { key: keyof ProgressReportRow; label: string; hint: string }[] = [
    { key: "overall_summary",    label: t.teacher.reportsFieldOverallSummaryLabel,    hint: t.teacher.reportsFieldOverallSummaryHint },
    { key: "strengths",          label: t.teacher.reportsFieldStrengthsLabel,          hint: t.teacher.reportsFieldStrengthsHint },
    { key: "areas_for_growth",   label: t.teacher.reportsFieldAreasForGrowthLabel,     hint: t.teacher.reportsFieldAreasForGrowthHint },
    { key: "practice_summary",   label: t.teacher.reportsFieldPracticeSummaryLabel,    hint: t.teacher.reportsFieldPracticeSummaryHint },
    { key: "repertoire_summary", label: t.teacher.reportsFieldRepertoireSummaryLabel,  hint: t.teacher.reportsFieldRepertoireSummaryHint },
    { key: "goals_summary",      label: t.teacher.reportsFieldGoalsSummaryLabel,       hint: t.teacher.reportsFieldGoalsSummaryHint },
    { key: "teacher_comments",   label: t.teacher.reportsFieldTeacherCommentsLabel,    hint: t.teacher.reportsFieldTeacherCommentsHint },
  ];

  const [report, setReport] = useState<ProgressReportRow | null>(null);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  // Editable fields
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!teacher?.id) return;
    loadData();
  }, [teacher?.id, reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [profileRes, reportRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", studentId).maybeSingle(),
        supabase.from("progress_reports").select("*").eq("id", reportId).eq("teacher_id", teacher.id).single(),
      ]);
      const r = reportRes.data as ProgressReportRow | null;
      setReport(r);
      if (r) {
        const init: Record<string, string> = {};
        for (const f of FIELDS) init[f.key as string] = (r[f.key] as string | null) ?? "";
        setFields(init);
      }
      const profile = profileRes.data as { display_name: string } | null;
      setStudentName(profile?.display_name ?? "Student");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!report) return;
    setSaving(true);
    setSaved(false);
    const { error } = await supabase.from("progress_reports").update({
      ...fields,
      updated_at: new Date().toISOString(),
    }).eq("id", reportId).eq("teacher_id", teacher.id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  async function markSent() {
    if (!report) return;
    setSending(true);
    setSendError("");
    // Save current edits first
    await supabase.from("progress_reports").update({
      ...fields,
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_to_email: sendEmail || null,
      updated_at: new Date().toISOString(),
    }).eq("id", reportId).eq("teacher_id", teacher.id);
    setSending(false);
    setSendSuccess(true);
    setReport(prev => prev ? { ...prev, status: "sent" } : prev);
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 500, borderRadius: 4 }} />
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)" }}>{t.teacher.reportsNotFound}</p>
      </div>
    );
  }

  const periodLabel = `${new Date(report.period_start).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })} – ${new Date(report.period_end).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}`;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}
      >
        ← {t.common.back}
      </button>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
            {report.term}
          </h1>
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600,
            color: report.status === "sent" ? "var(--sage)" : report.status === "archived" ? "var(--muted)" : "var(--butter)",
            background: report.status === "sent" ? "var(--sage-light, #e8f5ef)" : report.status === "archived" ? "#f4f4f4" : "#fefbe6",
            padding: "0.2rem 0.5rem", borderRadius: 2, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {report.status}
          </span>
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>
          {studentName} · {periodLabel}
        </div>
      </div>

      {/* Editable fields */}
      <div className="card-base" style={{ padding: "1.5rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {FIELDS.map(f => (
          <div key={f.key as string}>
            <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.375rem" }}>
              {f.label}
            </label>
            <textarea
              value={fields[f.key as string] ?? ""}
              onChange={e => setFields(prev => ({ ...prev, [f.key as string]: e.target.value }))}
              placeholder={f.hint}
              style={{ ...TA, minHeight: f.key === "overall_summary" || f.key === "teacher_comments" ? 100 : 80 }}
            />
          </div>
        ))}

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
          {saving ? t.teacher.reportsSaving : saved ? t.teacher.reportsSaved : t.teacher.reportsSaveChanges}
        </button>
      </div>

      {/* Send / mark as sent */}
      {report.status !== "sent" && (
        <div className="card-base" style={{ padding: "1.25rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            {t.teacher.reportsShareReport}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.625rem" }}>
            <input
              type="email"
              value={sendEmail}
              onChange={e => setSendEmail(e.target.value)}
              placeholder={t.teacher.reportsEmailOptional}
              style={{ flex: 1, border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)", color: "var(--charcoal)", outline: "none" }}
            />
            <button
              onClick={markSent}
              disabled={sending || sendSuccess}
              style={{ padding: "0.5rem 1rem", borderRadius: 3, border: "none", background: sendSuccess ? "var(--sage)" : "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", opacity: sending ? 0.5 : 1, whiteSpace: "nowrap" }}
            >
              {sendSuccess ? t.teacher.reportsMarkedSent : sending ? t.teacher.reportsSaving : t.teacher.reportsMarkSent}
            </button>
          </div>
          {sendError && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--rose)" }}>{sendError}</div>}
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
            {t.teacher.reportsEmailNote}
          </div>
        </div>
      )}

      {report.status === "sent" && report.sent_at && (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", padding: "0.75rem" }}>
          {t.teacher.reportsSentOn.replace("{date}", new Date(report.sent_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }))}
          {report.sent_to_email ? ` · ${report.sent_to_email}` : ""}
        </div>
      )}
    </div>
  );
}
