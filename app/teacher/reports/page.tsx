"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Teacher } from "../../../lib/models/Teacher";
import type { InvoiceWithStudent } from "../../../lib/types";

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

const s = { fontFamily: "Inter, sans-serif" } as const;

const statCard = (value: string | number, label: string, color = "var(--charcoal)"): React.ReactNode => (
  <div style={{
    background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4,
    padding: "1.25rem 1.5rem", flex: 1, minWidth: 140,
  }}>
    <p style={{ ...s, fontWeight: 700, fontSize: "1.75rem", color, margin: "0 0 0.25rem", lineHeight: 1 }}>{value}</p>
    <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
  </div>
);

interface MonthBucket {
  label: string;
  revenue: number;
  lessons: number;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const teacher = user as Teacher | null;
  const studioId = teacher?.studioId;

  const [loading, setLoading] = useState(true);
  const [activeStudents, setActiveStudents] = useState(0);
  const [lessonsThisMonth, setLessonsThisMonth] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [pendingRevenue, setPendingRevenue] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceWithStudent[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthBucket[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!studioId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Active students
      const { count: studentCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("studio_id", studioId)
        .eq("role", "student");
      setActiveStudents(studentCount ?? 0);

      // Lessons this calendar month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: monthLessons } = await supabase
        .from("lessons")
        .select("id, attendance_status, scheduled_at")
        .eq("studio_id", studioId)
        .gte("scheduled_at", monthStart)
        .lte("scheduled_at", monthEnd);

      setLessonsThisMonth(monthLessons?.length ?? 0);

      // Attendance summary (last 90 days)
      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const { data: attendanceLessons } = await supabase
        .from("lessons")
        .select("attendance_status")
        .eq("studio_id", studioId)
        .gte("scheduled_at", since90.toISOString())
        .not("attendance_status", "is", null);

      const attSummary: Record<string, number> = {};
      for (const l of attendanceLessons ?? []) {
        const status = (l as { attendance_status: string }).attendance_status;
        attSummary[status] = (attSummary[status] ?? 0) + 1;
      }
      setAttendanceSummary(attSummary);

      // Invoices
      const invRes = await fetch(`/api/invoices?studioId=${studioId}`);
      if (invRes.ok) {
        const { invoices } = await invRes.json() as { invoices: InvoiceWithStudent[] };
        setRecentInvoices(invoices.slice(0, 10));

        const thisMonthPaid = invoices
          .filter((i: InvoiceWithStudent) => i.status === "paid" && i.paid_at && i.paid_at >= monthStart)
          .reduce((sum: number, i: InvoiceWithStudent) => sum + i.amount_cents, 0);
        setRevenueThisMonth(thisMonthPaid);

        const pending = invoices
          .filter((i: InvoiceWithStudent) => i.status === "sent")
          .reduce((sum: number, i: InvoiceWithStudent) => sum + i.amount_cents, 0);
        setPendingRevenue(pending);

        setOverdueCount(invoices.filter((i: InvoiceWithStudent) => i.status === "overdue").length);

        // Monthly revenue for last 6 months
        const buckets: MonthBucket[] = [];
        for (let m = 5; m >= 0; m--) {
          const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
          const label = d.toLocaleDateString([], { month: "short", year: "2-digit" });
          const start = d.toISOString();
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();

          const rev = invoices
            .filter((i: InvoiceWithStudent) => i.status === "paid" && i.paid_at && i.paid_at >= start && i.paid_at <= end)
            .reduce((sum: number, i: InvoiceWithStudent) => sum + i.amount_cents, 0);

          const lessonCount = monthLessons?.filter((l: { scheduled_at: string }) => {
            const at = new Date(l.scheduled_at);
            return at >= new Date(start) && at <= new Date(end);
          }).length ?? 0;

          buckets.push({ label, revenue: rev, lessons: lessonCount });
        }
        setMonthlyData(buckets);
      }
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem" }}>Loading…</p>
    </div>
  );

  const maxRevenue = Math.max(...monthlyData.map(b => b.revenue), 1);

  const STATUS_COLOR: Record<string, string> = {
    draft: "#94a3b8", sent: "#2563eb", paid: "#16a34a", overdue: "#dc2626", void: "#94a3b8",
  };

  const ATT_COLORS: Record<string, string> = {
    present: "#16a34a", late: "#d97706", absent: "#dc2626", cancelled: "#94a3b8", makeup: "#7c3aed",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <h1 style={{ ...s, fontWeight: 700, fontSize: "1.375rem", color: "var(--charcoal)", margin: "0 0 2rem" }}>Reports</h1>

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        {statCard(activeStudents, "Active students")}
        {statCard(lessonsThisMonth, "Lessons this month")}
        {statCard(formatCents(revenueThisMonth), "Revenue collected", "#16a34a")}
        {statCard(formatCents(pendingRevenue), "Pending payment", "#2563eb")}
        {overdueCount > 0 && statCard(overdueCount, "Overdue invoices", "#dc2626")}
      </div>

      {/* ── Revenue chart ────────────────────────────────────── */}
      {monthlyData.some(b => b.revenue > 0) && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.5rem", marginBottom: "2rem" }}>
          <p style={{ ...s, fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 1.25rem" }}>
            Revenue — last 6 months
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.625rem", height: 120 }}>
            {monthlyData.map(b => (
              <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <p style={{ ...s, fontSize: "0.6875rem", color: "var(--charcoal)", margin: 0, fontWeight: 500 }}>
                  {b.revenue > 0 ? formatCents(b.revenue).replace(/\.00$/, "") : ""}
                </p>
                <div style={{
                  width: "100%", background: "var(--sage)",
                  borderRadius: "3px 3px 0 0",
                  height: `${Math.max((b.revenue / maxRevenue) * 80, b.revenue > 0 ? 4 : 0)}px`,
                  minHeight: b.revenue > 0 ? 4 : 0,
                  transition: "height 0.3s ease",
                }} />
                <p style={{ ...s, fontSize: "0.6875rem", color: "var(--muted)", margin: 0 }}>{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Attendance summary ───────────────────────────────── */}
      {Object.keys(attendanceSummary).length > 0 && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.5rem", marginBottom: "2rem" }}>
          <p style={{ ...s, fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 1rem" }}>
            Attendance — last 90 days
          </p>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {Object.entries(attendanceSummary).map(([status, count]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: ATT_COLORS[status] ?? "#888", flexShrink: 0 }} />
                <span style={{ ...s, fontSize: "0.875rem", color: "var(--charcoal)", textTransform: "capitalize" }}>{status}</span>
                <span style={{ ...s, fontSize: "0.875rem", fontWeight: 600, color: ATT_COLORS[status] ?? "#888" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent invoices ──────────────────────────────────── */}
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.5rem" }}>
        <p style={{ ...s, fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 1rem" }}>
          Recent Invoices
        </p>
        {recentInvoices.length === 0 ? (
          <p style={{ ...s, fontSize: "0.875rem", color: "var(--muted)" }}>No invoices yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Invoice", "Student", "Amount", "Due", "Status"].map(h => (
                  <th key={h} style={{ ...s, fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", textAlign: "left", padding: "0 0 0.625rem", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", padding: "0.625rem 0.5rem 0.625rem 0", borderBottom: "1px solid var(--border)" }}>{inv.invoice_number}</td>
                  <td style={{ ...s, fontSize: "0.875rem", color: "var(--charcoal)", fontWeight: 500, padding: "0.625rem 0.5rem", borderBottom: "1px solid var(--border)" }}>{inv.student_name}</td>
                  <td style={{ ...s, fontSize: "0.875rem", color: "var(--charcoal)", padding: "0.625rem 0.5rem", borderBottom: "1px solid var(--border)" }}>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency.toUpperCase() }).format(inv.amount_cents / 100)}
                  </td>
                  <td style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", padding: "0.625rem 0.5rem", borderBottom: "1px solid var(--border)" }}>{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
                  <td style={{ padding: "0.625rem 0 0.625rem 0.5rem", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ ...s, fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: STATUS_COLOR[inv.status] }}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
