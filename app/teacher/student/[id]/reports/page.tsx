"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { Teacher } from "../../../../../lib/models/Teacher";
import type { ProgressReportRow } from "../../../../../lib/types";

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();

  const [studentName, setStudentName] = useState("");
  const [reports, setReports] = useState<ProgressReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate form state
  const [showForm, setShowForm] = useState(false);
  const [term, setTerm] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    if (!teacher?.id) return;
    loadData();
  }, [teacher?.id, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [profileRes, reportsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
        supabase.from("progress_reports")
          .select("*")
          .eq("student_id", studentId)
          .eq("teacher_id", teacher.id)
          .order("created_at", { ascending: false }),
      ]);
      setStudentName((profileRes.data as { display_name: string } | null)?.display_name ?? "Student");
      setReports((reportsRes.data ?? []) as ProgressReportRow[]);
    } finally {
      setLoading(false);
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !periodStart || !periodEnd) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, term: term.trim(), periodStart, periodEnd }),
      });
      const json = await res.json();
      if (!res.ok) { setGenError(json.error ?? "Failed to generate"); return; }
      router.push(`/teacher/student/${studentId}/reports/${json.report.id}`);
    } catch {
      setGenError("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const statusColor = (s: string) => s === "sent" ? "var(--sage)" : s === "archived" ? "var(--muted)" : "var(--butter)";
  const statusLabel = (s: string) => s === "sent" ? "Sent" : s === "archived" ? "Archived" : "Draft";

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 300, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}
      >
        ← Back
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
            Progress Reports
          </h1>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>{studentName}</div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ padding: "0.5rem 1rem", borderRadius: 3, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
        >
          + Generate Report
        </button>
      </div>

      {showForm && (
        <form onSubmit={generate} className="card-base" style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Generate AI Report
          </div>
          <input
            required
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Term (e.g. Fall 2025, Spring 2026)"
            style={{ width: "100%", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Period start</label>
              <input type="date" required value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Period end</label>
              <input type="date" required value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          {genError && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--rose)" }}>{genError}</div>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" disabled={generating} style={{ flex: 1, padding: "0.5625rem", borderRadius: 3, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", opacity: generating ? 0.5 : 1 }}>
              {generating ? "Generating…" : "Generate with AI"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "0.5625rem 1rem", borderRadius: 3, border: "1px solid var(--border-strong)", background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {reports.length === 0 ? (
        <div className="card-base" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>
            No reports yet. Generate the first one above.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {reports.map(r => (
            <button
              key={r.id}
              onClick={() => router.push(`/teacher/student/${studentId}/reports/${r.id}`)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "1rem 1.25rem", borderRadius: 4, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", color: "var(--charcoal)", fontWeight: 500 }}>{r.term}</div>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: statusColor(r.status), background: `${statusColor(r.status)}18`, padding: "0.2rem 0.5rem", borderRadius: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {statusLabel(r.status)}
                </span>
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                {new Date(r.period_start).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} – {new Date(r.period_end).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </div>
              {r.overall_summary && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", marginTop: "0.5rem", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.overall_summary}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
