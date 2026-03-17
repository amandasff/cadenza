"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Users } from "lucide-react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { BillingService } from "../../../lib/services/BillingService";
import { Teacher } from "../../../lib/models/Teacher";
import type { BillingConfigRow, TuitionRecordRow, LessonRow } from "../../../lib/types";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function periodMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

interface StudentInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  instrument: string | null;
  isExternal: boolean;
}

interface Row {
  config: BillingConfigRow;
  student: StudentInfo;
  lessonCount: number;
  invoice: TuitionRecordRow | null;
  amountDue: number;
}

export default function BillingPage() {
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const billing = BillingService.create(supabase);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!teacher?.id || !teacher?.studioId) return;
    setLoading(true);
    try {
      const [configs, allProfiles, allExternal] = await Promise.all([
        billing.getAllConfigs(teacher.id),
        supabase.from("profiles").select("id,display_name,avatar_url,instrument").eq("studio_id", teacher.studioId!).eq("role","student"),
        supabase.from("external_students").select("id,name,instrument").eq("teacher_id", teacher.id),
      ]);

      const profileMap: Record<string, StudentInfo> = {};
      for (const p of (allProfiles.data ?? [])) {
        profileMap[p.id] = { id: p.id, name: p.display_name, avatarUrl: p.avatar_url ?? null, instrument: p.instrument ?? null, isExternal: false };
      }
      for (const e of (allExternal.data ?? [])) {
        profileMap[`ext_${e.id}`] = { id: e.id, name: e.name, avatarUrl: null, instrument: e.instrument ?? null, isExternal: true };
      }

      const pm = periodMonth(year, month);
      const invoices = await billing.getAllInvoicesForMonth(teacher.id, pm);
      const invoiceMap: Record<string, TuitionRecordRow> = {};
      for (const inv of invoices) {
        const k = inv.student_id ?? `ext_${inv.external_student_id}`;
        invoiceMap[k] = inv;
      }

      const result: Row[] = [];
      for (const cfg of configs) {
        const sKey = cfg.student_id ?? `ext_${cfg.external_student_id}`;
        const student = profileMap[sKey];
        if (!student) continue;

        const lessons: LessonRow[] = await billing.getBillableLessons(
          teacher.id, cfg.student_id, cfg.external_student_id, year, month
        );
        const invoice = invoiceMap[sKey] ?? null;
        const amountDue = invoice
          ? invoice.amount_cents
          : Math.max(0, lessons.length - 0) * cfg.lesson_rate_cents;

        result.push({ config: cfg, student, lessonCount: lessons.length, invoice, amountDue });
      }

      result.sort((a, b) => a.student.name.localeCompare(b.student.name));
      setRows(result);
    } finally {
      setLoading(false);
    }
  }, [teacher?.id, teacher?.studioId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const n = new Date(); n.setHours(0,0,0,0);
    const cur = new Date(year, month - 1, 1);
    if (cur >= new Date(n.getFullYear(), n.getMonth(), 1)) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const privateRows = rows.filter(r => r.config.billing_type !== "studio");
  const totalExpected = privateRows.reduce((s, r) => s + r.amountDue, 0);
  const totalPaid = privateRows.filter(r => r.invoice?.status === "paid").reduce((s, r) => s + r.amountDue, 0);
  const totalOwed = totalExpected - totalPaid;

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isFutureMonth = new Date(year, month - 1, 1) > new Date(now.getFullYear(), now.getMonth(), 1);

  const inputStyle: React.CSSProperties = {
    borderRadius: 3, border: "1px solid var(--border-strong)",
    padding: "0.375rem 0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
    background: "var(--white)", color: "var(--charcoal)", outline: "none",
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.125rem", letterSpacing: "-0.01em" }}>
            Billing
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Track payments and generate invoices
          </p>
        </div>

        {/* Month picker */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <button onClick={prevMonth} style={{ ...inputStyle, cursor: "pointer", padding: "0.375rem 0.625rem" }}>◀</button>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", minWidth: 130, textAlign: "center" }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} style={{ ...inputStyle, cursor: isCurrentMonth ? "default" : "pointer", opacity: isCurrentMonth ? 0.35 : 1, padding: "0.375rem 0.625rem" }}>▶</button>
        </div>
      </div>

      {/* Summary bar */}
      {!loading && privateRows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: isCurrentMonth ? "Expected this month" : "Total invoiced", value: fmt(totalExpected), color: "var(--charcoal)" },
            { label: "Collected", value: fmt(totalPaid), color: "#2d8a4e" },
            { label: "Outstanding", value: fmt(totalOwed), color: totalOwed > 0 ? "#c0392b" : "#2d8a4e" },
          ].map(stat => (
            <div key={stat.label} className="card-base" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.375rem" }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.625rem", fontWeight: 600, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student rows */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 4 }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
          No students with billing set up yet.{" "}
          <span style={{ color: "var(--charcoal)" }}>Open a student profile to configure billing.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {rows.map(row => {
            const isStudio = row.config.billing_type === "studio";
            const isPaid = row.invoice?.status === "paid";
            const hasInvoice = !!row.invoice;

            return (
              <Link key={row.config.id} href={`/teacher/billing/${row.config.student_id ?? row.config.external_student_id}`} style={{ textDecoration: "none" }}>
                <div className="card-base" style={{
                  padding: "0.875rem 1.125rem",
                  display: "flex", alignItems: "center", gap: "0.875rem",
                  opacity: isStudio ? 0.7 : 1,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--white)",
                    overflow: "hidden",
                  }}>
                    {row.student.avatarUrl
                      ? <img src={row.student.avatarUrl} alt={row.student.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : row.student.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                    }
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                      {row.student.name}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      {row.student.instrument && <span>{row.student.instrument}</span>}
                      {row.student.instrument && <span>·</span>}
                      <span>{row.config.lesson_type === "online" ? "💻 Online" : "🏠 In-person"}</span>
                      {isStudio && <><span>·</span><span style={{ color: "var(--sage)", fontWeight: 500 }}>Studio billing</span></>}
                      {row.config.family_id && (
                        <><span>·</span>
                        <Link
                          href={`/teacher/billing/family/${row.config.family_id}`}
                          onClick={e => e.stopPropagation()}
                          style={{ color: "var(--charcoal)", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                        >
                          <Users size={12} strokeWidth={1.5} /> Family
                        </Link></>
                      )}
                      {row.config.makeup_credits > 0 && !isStudio && (
                        <><span>·</span><span style={{ color: "#e09b3d", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}><RefreshCw size={12} strokeWidth={1.5} /> {row.config.makeup_credits} makeup{row.config.makeup_credits !== 1 ? "s" : ""}</span></>
                      )}
                    </div>
                  </div>

                  {/* Lesson count */}
                  {!isStudio && (
                    <div style={{ textAlign: "center", minWidth: 64 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                        {row.lessonCount} lesson{row.lessonCount !== 1 ? "s" : ""}
                      </div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
                        {row.config.lesson_rate_cents > 0 ? `${fmt(row.config.lesson_rate_cents)}/lesson` : "rate not set"}
                      </div>
                    </div>
                  )}

                  {/* Status badge */}
                  <div style={{
                    flexShrink: 0,
                    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem",
                    minWidth: 80, textAlign: "right",
                  }}>
                    {isStudio ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--sage)", fontWeight: 500 }}>Studio</span>
                    ) : isPaid ? (
                      <span style={{ color: "#2d8a4e" }}>✓ Paid</span>
                    ) : row.amountDue > 0 ? (
                      <span style={{ color: "#c0392b" }}>Owes {fmt(row.amountDue)}</span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}>—</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
