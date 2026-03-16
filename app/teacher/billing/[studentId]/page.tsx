"use client";
import React, { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { BillingService } from "../../../../lib/services/BillingService";
import { Teacher } from "../../../../lib/models/Teacher";
import type { BillingConfigRow, TuitionRecordRow, LessonRow, PaymentMethod, LessonType, BillingType } from "../../../../lib/types";

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function periodMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
function monthLabel(pm: string) {
  const d = new Date(pm + "T12:00:00");
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
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
const labelStyle: React.CSSProperties = {
  fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600,
  color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em",
  display: "block", marginBottom: "0.25rem",
};
const primaryBtn: React.CSSProperties = {
  padding: "0.5625rem 1rem", borderRadius: 3, border: "none",
  background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer", letterSpacing: "0.01em",
};
const ghostBtn: React.CSSProperties = {
  padding: "0.5rem 0.875rem", borderRadius: 3, border: "1px solid var(--border-strong)",
  background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
};

export default function StudentBillingPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const billing = BillingService.create(supabase);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [studentName, setStudentName] = useState("");
  const [studentInstrument, setStudentInstrument] = useState<string | null>(null);
  const [isExternal, setIsExternal] = useState(false);
  const [config, setConfig] = useState<BillingConfigRow | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [invoice, setInvoice] = useState<TuitionRecordRow | null>(null);
  const [invoiceHistory, setInvoiceHistory] = useState<TuitionRecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Contact form
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [rate, setRate] = useState("");
  const [lessonType, setLessonType] = useState<LessonType>("in_person");
  const [billingType, setBillingType] = useState<BillingType>("private");
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  // Invoice editing
  const [creditsToApply, setCreditsToApply] = useState(0);
  const [extraDesc, setExtraDesc] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("e-transfer");
  const [markingPaid, setMarkingPaid] = useState(false);

  const load = useCallback(async () => {
    if (!teacher?.id) return;
    setLoading(true);
    try {
      // Try registered student first, then external
      const [profileRes, extRes] = await Promise.all([
        supabase.from("profiles").select("display_name,instrument").eq("id", studentId).maybeSingle(),
        supabase.from("external_students").select("name,instrument").eq("id", studentId).maybeSingle(),
      ]);

      let cfg: BillingConfigRow | null = null;
      if (profileRes.data) {
        setStudentName(profileRes.data.display_name);
        setStudentInstrument(profileRes.data.instrument ?? null);
        setIsExternal(false);
        cfg = await billing.getConfig(studentId, teacher.id);
      } else if (extRes.data) {
        setStudentName(extRes.data.name);
        setStudentInstrument(extRes.data.instrument ?? null);
        setIsExternal(true);
        cfg = await billing.getConfigByExternal(studentId, teacher.id);
      }

      setConfig(cfg);
      if (cfg) {
        setParentName(cfg.parent_name ?? "");
        setParentEmail(cfg.parent_email ?? "");
        setParentPhone(cfg.parent_phone ?? "");
        setRate(cfg.lesson_rate_cents > 0 ? String(cfg.lesson_rate_cents / 100) : "");
        setLessonType(cfg.lesson_type ?? "in_person");
        setBillingType(cfg.billing_type ?? "private");
      }

      const pm = periodMonth(year, month);
      const [lsns, inv, hist] = await Promise.all([
        billing.getBillableLessons(teacher.id, isExternal ? null : studentId, isExternal ? studentId : null, year, month),
        cfg ? billing.getInvoice(teacher.id, isExternal ? null : studentId, isExternal ? studentId : null, pm) : Promise.resolve(null),
        cfg ? billing.getInvoices(teacher.id, isExternal ? null : studentId, isExternal ? studentId : null) : Promise.resolve([]),
      ]);

      setLessons(lsns);
      setInvoice(inv);
      setInvoiceHistory(hist);
    } finally {
      setLoading(false);
    }
  }, [teacher?.id, studentId, year, month, isExternal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher?.studioId) return;
    setSavingContact(true);
    try {
      const rateCents = rate ? Math.round(parseFloat(rate) * 100) : 0;
      await billing.upsertConfig({
        studioId: teacher.studioId,
        studentId: isExternal ? null : studentId,
        externalStudentId: isExternal ? studentId : null,
        teacherId: teacher.id,
        parentName: parentName || undefined,
        parentEmail: parentEmail || undefined,
        parentPhone: parentPhone || undefined,
        lessonRateCents: rateCents,
        lessonType,
        billingType,
      });
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2000);
      await load();
    } finally {
      setSavingContact(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!config) return;
    setGeneratingInvoice(true);
    try {
      const extraCents = extraAmount ? Math.round(parseFloat(extraAmount) * 100) : 0;
      await billing.generateInvoice({
        config,
        periodMonth: periodMonth(year, month),
        lessonCount: lessons.length,
        makeupCreditsApplied: creditsToApply,
        extraChargesCents: extraCents,
        extraChargesDesc: extraDesc || undefined,
      });
      setShowExtraForm(false);
      setExtraDesc("");
      setExtraAmount("");
      await load();
    } finally {
      setGeneratingInvoice(false);
    }
  }

  async function handleMarkPaid() {
    if (!invoice) return;
    setMarkingPaid(true);
    try {
      await billing.markInvoicePaid(invoice.id, payMethod, teacher.id);
      await load();
    } finally {
      setMarkingPaid(false);
    }
  }

  async function handleMarkUnpaid() {
    if (!invoice) return;
    setMarkingPaid(true);
    try {
      await billing.markInvoiceUnpaid(invoice.id, teacher.id);
      await load();
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
    const cur2 = new Date(now.getFullYear(), now.getMonth(), 1);
    if (cur >= cur2) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const rateCents = config?.lesson_rate_cents ?? 0;
  const makeupCredits = config?.makeup_credits ?? 0;
  const billableCount = Math.max(0, lessons.length - creditsToApply);
  const extraCents = extraAmount ? Math.round(parseFloat(extraAmount) * 100) : 0;
  const estimatedTotal = billableCount * rateCents + extraCents;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isStudio = billingType === "studio";

  if (loading) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 24, width: 180, marginBottom: "1.5rem", borderRadius: 3 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Back + header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <Link href="/teacher/billing" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.875rem" }}>
          ← Billing
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.625rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
            {studentName}
          </h1>
          {studentInstrument && (
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
              · {studentInstrument}
            </span>
          )}
        </div>
      </div>

      {/* ── Contact + Settings ── */}
      <form onSubmit={saveContact}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "0.875rem" }}>

          {/* Parent contact */}
          <div className="card-base" style={{ padding: "1.125rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 700, color: "var(--charcoal)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Parent / Guardian
            </div>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Parent name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} placeholder="email@example.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="Phone number" style={inputStyle} />
            </div>
          </div>

          {/* Billing settings */}
          <div className="card-base" style={{ padding: "1.125rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 700, color: "var(--charcoal)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Billing Settings
            </div>
            <div>
              <label style={labelStyle}>Rate per lesson</label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>$</span>
                <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="0.00" style={{ ...inputStyle, width: 90 }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>/ lesson</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Lesson type</label>
              <select value={lessonType} onChange={e => setLessonType(e.target.value as LessonType)} style={inputStyle}>
                <option value="in_person">🏠 In-person</option>
                <option value="online">💻 Online</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Billing handled by</label>
              <select value={billingType} onChange={e => setBillingType(e.target.value as BillingType)} style={inputStyle}>
                <option value="private">Me (private)</option>
                <option value="studio">Studio</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.75rem" }}>
          <button type="submit" disabled={savingContact} style={{ ...primaryBtn, opacity: savingContact ? 0.6 : 1, background: contactSaved ? "#2d8a4e" : "var(--charcoal)" }}>
            {contactSaved ? "✓ Saved" : savingContact ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {/* ── Studio billing notice ── */}
      {isStudio && (
        <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem", background: "var(--cream-deep)", textAlign: "center" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>
            Studio billing — the studio manages invoicing for this student.
          </div>
        </div>
      )}

      {/* ── Monthly Invoice (only for private billing) ── */}
      {!isStudio && config && (
        <>
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

          <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>

            {/* Lesson count */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.875rem" }}>
              <div>
                <span style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.875rem", fontWeight: 600, color: "var(--charcoal)" }}>
                  {lessons.length}
                </span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", marginLeft: "0.375rem" }}>
                  lesson{lessons.length !== 1 ? "s" : ""}
                  {rateCents > 0 && ` × ${fmt(rateCents)}`}
                </span>
              </div>
              {rateCents > 0 && lessons.length > 0 && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>
                  = {fmt(lessons.length * rateCents)}
                </div>
              )}
            </div>

            {/* Makeup credits */}
            {makeupCredits > 0 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.625rem 0.875rem", background: "var(--cream-deep)", borderRadius: 3,
                marginBottom: "0.875rem",
              }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)" }}>
                  🔄 {makeupCredits} makeup credit{makeupCredits !== 1 ? "s" : ""} available
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    onClick={() => setCreditsToApply(c => Math.max(0, c - 1))}
                    disabled={creditsToApply === 0}
                    style={{ ...ghostBtn, padding: "0.125rem 0.5rem", fontSize: "0.875rem", opacity: creditsToApply === 0 ? 0.3 : 1 }}
                  >−</button>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", minWidth: 16, textAlign: "center" }}>
                    {creditsToApply}
                  </span>
                  <button
                    onClick={() => setCreditsToApply(c => Math.min(makeupCredits, lessons.length, c + 1))}
                    disabled={creditsToApply >= Math.min(makeupCredits, lessons.length)}
                    style={{ ...ghostBtn, padding: "0.125rem 0.5rem", fontSize: "0.875rem", opacity: creditsToApply >= Math.min(makeupCredits, lessons.length) ? 0.3 : 1 }}
                  >+</button>
                  {creditsToApply > 0 && (
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#2d8a4e" }}>
                      −{fmt(creditsToApply * rateCents)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Extra charges */}
            {showExtraForm ? (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.875rem" }}>
                <input
                  value={extraDesc}
                  onChange={e => setExtraDesc(e.target.value)}
                  placeholder="Description (e.g. Travel)"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={extraAmount}
                    onChange={e => setExtraAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ ...inputStyle, width: 80 }}
                  />
                </div>
                <button onClick={() => { setShowExtraForm(false); setExtraDesc(""); setExtraAmount(""); }} style={{ ...ghostBtn, padding: "0.5rem 0.625rem", color: "var(--muted)" }}>×</button>
              </div>
            ) : (
              <button onClick={() => setShowExtraForm(true)} style={{ ...ghostBtn, fontSize: "0.8125rem", marginBottom: "0.875rem", width: "100%", textAlign: "left", color: "var(--muted)" }}>
                + Add extra charge (travel, materials…)
              </button>
            )}

            {/* Total */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.875rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                Total
              </div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: "var(--charcoal)" }}>
                {invoice ? fmt(invoice.amount_cents) : (rateCents > 0 ? fmt(estimatedTotal) : "—")}
              </div>
            </div>

            {/* Invoice status */}
            {invoice ? (
              <div style={{ marginTop: "1rem" }}>
                {invoice.status === "paid" ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#2d8a4e", fontWeight: 500 }}>
                      ✓ Paid
                      {invoice.payment_method && ` · ${invoice.payment_method}`}
                      {invoice.paid_at && ` · ${new Date(invoice.paid_at).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                    </div>
                    <button onClick={handleMarkUnpaid} disabled={markingPaid} style={{ ...ghostBtn, fontSize: "0.75rem", color: "var(--muted)" }}>
                      Undo
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b", fontWeight: 500, marginBottom: "0.75rem" }}>
                      Invoice sent — payment pending
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      {PAY_METHODS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => setPayMethod(m.value)}
                          style={{
                            padding: "0.375rem 0.75rem", borderRadius: 3, fontSize: "0.8125rem",
                            fontFamily: "Inter, sans-serif", cursor: "pointer",
                            border: payMethod === m.value ? "2px solid var(--charcoal)" : "1px solid var(--border-strong)",
                            background: payMethod === m.value ? "var(--charcoal)" : "none",
                            color: payMethod === m.value ? "var(--white)" : "var(--charcoal)",
                            fontWeight: payMethod === m.value ? 600 : 400,
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                      <button onClick={handleMarkPaid} disabled={markingPaid} style={{ ...primaryBtn, background: "#2d8a4e", marginLeft: "auto", opacity: markingPaid ? 0.6 : 1 }}>
                        {markingPaid ? "Saving…" : "Mark Paid ✓"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.625rem" }}>
                <button
                  onClick={handleGenerateInvoice}
                  disabled={generatingInvoice || rateCents === 0}
                  style={{ ...primaryBtn, flex: 1, opacity: generatingInvoice || rateCents === 0 ? 0.5 : 1, textAlign: "center" }}
                  title={rateCents === 0 ? "Set a rate to generate an invoice" : undefined}
                >
                  {generatingInvoice ? "Generating…" : "Generate Invoice"}
                </button>
                {parentEmail && (
                  <button
                    onClick={async () => {
                      await handleGenerateInvoice();
                    }}
                    style={{ ...ghostBtn }}
                    title="Copy invoice to share with parent"
                  >
                    Share
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Invoice history ── */}
      {!isStudio && invoiceHistory.filter(h => h.period_month !== periodMonth(year, month)).length > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.625rem" }}>
            Past Invoices
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {invoiceHistory
              .filter(h => h.period_month !== periodMonth(year, month))
              .slice(0, 12)
              .map(h => (
                <div key={h.id} className="card-base" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", fontWeight: 500 }}>
                      {monthLabel(h.period_month)}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      {h.lesson_count > 0 ? `${h.lesson_count} lesson${h.lesson_count !== 1 ? "s" : ""}` : ""}
                      {h.makeup_credits_applied > 0 ? ` · ${h.makeup_credits_applied} credit${h.makeup_credits_applied !== 1 ? "s" : ""} applied` : ""}
                      {h.extra_charges_cents > 0 ? ` · +${fmt(h.extra_charges_cents)} extra` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: h.status === "paid" ? "#2d8a4e" : "#c0392b" }}>
                      {fmt(h.amount_cents)}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      {h.status === "paid"
                        ? `✓ ${h.payment_method ?? "paid"}${h.paid_at ? ` · ${new Date(h.paid_at).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}`
                        : "Unpaid"
                      }
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
