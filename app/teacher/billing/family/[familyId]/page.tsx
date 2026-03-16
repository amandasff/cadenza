"use client";
import React, { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { BillingService } from "../../../../../lib/services/BillingService";
import { Teacher } from "../../../../../lib/models/Teacher";
import type { BillingConfigRow, TuitionRecordRow, LessonRow, PaymentMethod } from "../../../../../lib/types";

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function periodMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const PAY_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "e-transfer", label: "E-transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 3, border: "1px solid var(--border-strong)",
  padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
  background: "var(--white)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  padding: "0.5625rem 1rem", borderRadius: 3, border: "none",
  background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  padding: "0.5rem 0.875rem", borderRadius: 3, border: "1px solid var(--border-strong)",
  background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
};

interface MemberRow {
  config: BillingConfigRow;
  name: string;
  lessons: LessonRow[];
  invoice: TuitionRecordRow | null;
}

export default function FamilyBillingPage({ params }: { params: Promise<{ familyId: string }> }) {
  const { familyId } = use(params);
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const billing = BillingService.create(supabase);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("e-transfer");

  const load = useCallback(async () => {
    if (!teacher?.id) return;
    setLoading(true);
    setError(null);
    try {
      const configs = await billing.getFamilyConfigs(familyId, teacher.id);
      if (configs.length === 0) {
        setMembers([]);
        return;
      }

      // Resolve names for all members in parallel
      const memberRows: MemberRow[] = await Promise.all(configs.map(async cfg => {
        let name = "Student";
        if (cfg.student_id) {
          const { data } = await supabase
            .from("profiles").select("display_name").eq("id", cfg.student_id).maybeSingle();
          name = (data as { display_name: string } | null)?.display_name ?? "Student";
        } else if (cfg.external_student_id) {
          const { data } = await supabase
            .from("external_students").select("name").eq("id", cfg.external_student_id).maybeSingle();
          name = (data as { name: string } | null)?.name ?? "Student";
        }

        const pm = periodMonth(year, month);
        const [lessons, invoice] = await Promise.all([
          billing.getBillableLessons(
            teacher.id,
            cfg.student_id,
            cfg.external_student_id,
            year, month,
          ),
          billing.getInvoice(teacher.id, cfg.student_id, cfg.external_student_id, pm),
        ]);

        return { config: cfg, name, lessons, invoice };
      }));

      setMembers(memberRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [teacher?.id, familyId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleGenerateAll() {
    setGenerating(true);
    setError(null);
    try {
      await Promise.all(members
        .filter(m => !m.invoice && m.config.billing_type !== "studio")
        .map(m => billing.generateInvoice({
          config: m.config,
          periodMonth: periodMonth(year, month),
          lessonCount: m.lessons.length,
          makeupCreditsApplied: 0,
          extraChargesCents: 0,
        }))
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invoices");
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkAllPaid() {
    setMarkingPaid(true);
    setError(null);
    try {
      await Promise.all(members
        .filter(m => m.invoice && m.invoice.status === "unpaid")
        .map(m => billing.markInvoicePaid(m.invoice!.id, payMethod, teacher.id))
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark paid");
    } finally {
      setMarkingPaid(false);
    }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const cur = new Date(year, month - 1, 1);
    if (cur >= new Date(now.getFullYear(), now.getMonth(), 1)) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const privateMembers = members.filter(m => m.config.billing_type !== "studio");
  const totalCents = privateMembers.reduce((s, m) => {
    if (m.invoice) return s + m.invoice.amount_cents;
    return s + m.lessons.length * m.config.lesson_rate_cents;
  }, 0);
  const paidCents = privateMembers
    .filter(m => m.invoice?.status === "paid")
    .reduce((s, m) => s + (m.invoice?.amount_cents ?? 0), 0);
  const allInvoiced = privateMembers.length > 0 && privateMembers.every(m => !!m.invoice);
  const allPaid = allInvoiced && privateMembers.every(m => m.invoice?.status === "paid");
  const anyUnpaidInvoice = privateMembers.some(m => m.invoice?.status === "unpaid");
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // Derive a family name from parent names
  const parentName = members.find(m => m.config.parent_name)?.config.parent_name ?? null;
  const memberNames = members.map(m => m.name).join(", ");

  if (loading) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: "1.5rem", borderRadius: 3 }} />
        <div className="skeleton" style={{ height: 280, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Back + header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <Link href="/teacher/billing" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none", marginBottom: "0.875rem", display: "inline-block" }}>
          ← Billing
        </Link>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.625rem", color: "var(--charcoal)", margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
          {parentName ? `${parentName} Family` : "Family Billing"}
        </h1>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
          {memberNames}
        </div>
      </div>

      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.125rem", color: "var(--charcoal)" }}>
          {MONTH_NAMES[month - 1]} {year}
        </div>
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <button onClick={prevMonth} style={{ ...ghostBtn, padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}>◀</button>
          <button onClick={nextMonth} disabled={isCurrentMonth} style={{ ...ghostBtn, padding: "0.25rem 0.625rem", fontSize: "0.75rem", opacity: isCurrentMonth ? 0.35 : 1 }}>▶</button>
        </div>
      </div>

      {/* Per-member rows */}
      {members.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
          No family members found.
        </div>
      ) : (
        <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
          {privateMembers.map((m, i) => {
            const amount = m.invoice ? m.invoice.amount_cents : m.lessons.length * m.config.lesson_rate_cents;
            const isPaid = m.invoice?.status === "paid";
            const isStudio = m.config.billing_type === "studio";
            return (
              <div key={m.config.id}>
                {i > 0 && <div style={{ borderTop: "1px solid var(--border)", margin: "0.875rem 0" }} />}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <Link href={`/teacher/billing/${m.config.student_id ?? m.config.external_student_id}`} style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", textDecoration: "none" }}>
                        {m.name}
                      </Link>
                      {isStudio && (
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--sage)", fontWeight: 600, background: "rgba(143,175,116,0.12)", padding: "0.1rem 0.4rem", borderRadius: 2 }}>
                          Studio billing
                        </span>
                      )}
                    </div>
                    {!isStudio && (
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                        {m.lessons.length} lesson{m.lessons.length !== 1 ? "s" : ""}
                        {m.config.lesson_rate_cents > 0 && ` × ${fmt(m.config.lesson_rate_cents)}`}
                        {m.invoice?.makeup_credits_applied ? ` · ${m.invoice.makeup_credits_applied} credit${m.invoice.makeup_credits_applied !== 1 ? "s" : ""} applied` : ""}
                        {m.invoice?.extra_charges_cents ? ` · +${fmt(m.invoice.extra_charges_cents)} extra` : ""}
                      </div>
                    )}
                  </div>
                  {!isStudio && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.25rem", color: isPaid ? "#2d8a4e" : "var(--charcoal)" }}>
                        {fmt(amount)}
                      </div>
                      {isPaid && (
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#2d8a4e" }}>
                          ✓ Paid
                        </div>
                      )}
                      {m.invoice?.status === "unpaid" && (
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#c0392b" }}>
                          Unpaid
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Combined total */}
          {privateMembers.length > 1 && (
            <div style={{ borderTop: "2px solid var(--border-strong)", marginTop: "1rem", paddingTop: "0.875rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                Total
              </div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: allPaid ? "#2d8a4e" : "var(--charcoal)" }}>
                {fmt(totalCents)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {error && (
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b" }}>
                {error}
              </div>
            )}

            {!allInvoiced && (
              <button
                onClick={handleGenerateAll}
                disabled={generating}
                style={{ ...primaryBtn, opacity: generating ? 0.6 : 1 }}
              >
                {generating ? "Generating…" : `Generate ${privateMembers.filter(m => !m.invoice).length > 1 ? "All Invoices" : "Invoice"}`}
              </button>
            )}

            {anyUnpaidInvoice && (
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                  Payment method
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.625rem" }}>
                  {PAY_METHODS.map(pm => (
                    <button
                      key={pm.value}
                      onClick={() => setPayMethod(pm.value)}
                      style={{
                        padding: "0.375rem 0.75rem", borderRadius: 3, fontSize: "0.8125rem",
                        fontFamily: "Inter, sans-serif", cursor: "pointer",
                        border: payMethod === pm.value ? "2px solid var(--charcoal)" : "1px solid var(--border-strong)",
                        background: payMethod === pm.value ? "var(--charcoal)" : "none",
                        color: payMethod === pm.value ? "var(--white)" : "var(--charcoal)",
                        fontWeight: payMethod === pm.value ? 600 : 400,
                      }}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleMarkAllPaid}
                  disabled={markingPaid}
                  style={{ ...primaryBtn, background: "#2d8a4e", opacity: markingPaid ? 0.6 : 1 }}
                >
                  {markingPaid ? "Saving…" : `Mark ${privateMembers.filter(m => m.invoice?.status === "unpaid").length > 1 ? "All" : ""} Paid ✓`}
                </button>
              </div>
            )}

            {allPaid && (
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#2d8a4e", fontWeight: 500 }}>
                ✓ All invoices paid — {fmt(paidCents)} received
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member links */}
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
        Individual billing
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {members.map(m => (
          <Link
            key={m.config.id}
            href={`/teacher/billing/${m.config.student_id ?? m.config.external_student_id}`}
            style={{ textDecoration: "none" }}
          >
            <div className="card-base" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)" }}>{m.name}</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>View →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
