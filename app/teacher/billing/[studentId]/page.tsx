"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { BillingService } from "../../../../lib/services/BillingService";
import { Teacher } from "../../../../lib/models/Teacher";
import type { BillingConfigRow, TuitionRecordRow, BillingChargeRow, PaymentMethod } from "../../../../lib/types";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function monthLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PAY_METHODS: PaymentMethod[] = ["cash", "e-transfer", "cheque", "other"];

export default function StudentBillingPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const billing = BillingService.create(supabase);

  const [studentName, setStudentName] = useState("");
  const [config, setConfig] = useState<BillingConfigRow | null>(null);
  const [records, setRecords] = useState<TuitionRecordRow[]>([]);
  const [charges, setCharges] = useState<BillingChargeRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Config form
  const [rateInput, setRateInput] = useState("");
  const [billingDay, setBillingDay] = useState(1);
  const [configNotes, setConfigNotes] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // New charge form
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeDesc, setChargeDesc] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [addingCharge, setAddingCharge] = useState(false);

  // Mark paid
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("e-transfer");

  // New tuition record
  const [addingMonth, setAddingMonth] = useState(false);

  useEffect(() => {
    if (!teacher?.id) return;
    loadAll();
  }, [teacher?.id, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: profile }, cfg, recs, chgs] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
        billing.getConfig(studentId, teacher.id),
        billing.getRecords(studentId, teacher.id, 24),
        billing.getCharges(studentId, teacher.id),
      ]);
      setStudentName((profile as { display_name: string } | null)?.display_name ?? "Student");
      setConfig(cfg);
      if (cfg) {
        setRateInput(String(cfg.monthly_rate_cents / 100));
        setBillingDay(cfg.billing_day);
        setConfigNotes(cfg.notes ?? "");
      }
      setRecords(recs);
      setCharges(chgs);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const rateCents = Math.round(parseFloat(rateInput) * 100);
      await billing.upsertConfig({
        studioId: teacher.studioId!,
        studentId,
        teacherId: teacher.id,
        monthlyRateCents: rateCents,
        billingDay,
        notes: configNotes || undefined,
      });
      await loadAll();
    } finally {
      setSavingConfig(false);
    }
  }

  async function addThisMonth() {
    if (!config) return;
    setAddingMonth(true);
    try {
      await billing.generateCurrentMonthRecord(config);
      await loadAll();
    } finally {
      setAddingMonth(false);
    }
  }

  async function handleMarkPaid(recordId: string) {
    setMarkingPaid(recordId);
    try {
      await billing.markTuitionPaid(recordId, payMethod, teacher.id);
      await loadAll();
    } finally {
      setMarkingPaid(null);
    }
  }

  async function handleMarkUnpaid(recordId: string) {
    setMarkingPaid(recordId);
    try {
      await billing.markTuitionUnpaid(recordId, teacher.id);
      await loadAll();
    } finally {
      setMarkingPaid(null);
    }
  }

  async function addCharge(e: React.FormEvent) {
    e.preventDefault();
    setAddingCharge(true);
    try {
      await billing.addCharge({
        studioId: teacher.studioId!,
        studentId,
        teacherId: teacher.id,
        description: chargeDesc.trim(),
        amountCents: Math.round(parseFloat(chargeAmount) * 100),
      });
      setChargeDesc("");
      setChargeAmount("");
      setShowChargeForm(false);
      await loadAll();
    } finally {
      setAddingCharge(false);
    }
  }

  async function markChargePaid(chargeId: string) {
    await billing.markChargePaid(chargeId, teacher.id);
    await loadAll();
  }

  const outstanding = records.filter(r => r.status === "unpaid").reduce((s, r) => s + r.amount_cents, 0)
    + charges.filter(c => c.status === "unpaid").reduce((s, c) => s + c.amount_cents, 0);

  const inp: React.CSSProperties = {
    border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem",
    fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)",
    color: "var(--charcoal)", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}
      >
        ← Back
      </button>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
          {studentName}
        </h1>
        <div style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", fontWeight: 600,
          color: outstanding > 0 ? "#c0392b" : "var(--sage)",
        }}>
          {outstanding > 0 ? `${fmt(outstanding)} outstanding` : "All paid up ✓"}
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 4 }} />
      ) : (
        <>
          {/* Billing config */}
          <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.875rem" }}>
              Monthly Rate
            </div>
            <form onSubmit={saveConfig} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 120px" }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Rate ($/month)</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>$</span>
                  <input value={rateInput} onChange={e => setRateInput(e.target.value)} type="number" min="0" step="0.01" required style={{ ...inp, paddingLeft: "1.5rem" }} />
                </div>
              </div>
              <div style={{ flex: "0 0 100px" }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Due on day</label>
                <input value={billingDay} onChange={e => setBillingDay(Number(e.target.value))} type="number" min="1" max="28" style={inp} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Notes</label>
                <input value={configNotes} onChange={e => setConfigNotes(e.target.value)} placeholder="Optional" style={inp} />
              </div>
              <button type="submit" disabled={savingConfig} style={{
                padding: "0.5rem 1rem", borderRadius: 3, border: "none",
                background: "var(--charcoal)", color: "var(--white)",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                whiteSpace: "nowrap", opacity: savingConfig ? 0.5 : 1,
              }}>
                {savingConfig ? "Saving…" : config ? "Update" : "Set rate"}
              </button>
            </form>
          </div>

          {/* Tuition records */}
          <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Tuition
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                  style={{ ...inp, width: "auto", fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                  {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {config && (
                  <button onClick={addThisMonth} disabled={addingMonth} style={{
                    padding: "0.25rem 0.75rem", borderRadius: 3, border: "1px solid var(--border-strong)",
                    background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
                    fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap", opacity: addingMonth ? 0.5 : 1,
                  }}>
                    + This month
                  </button>
                )}
              </div>
            </div>

            {records.length === 0 ? (
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", padding: "0.5rem 0" }}>
                No tuition records yet. {config ? "Click \"+ This month\" to add one." : "Set a monthly rate first."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {records.map(r => (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.5rem 0.75rem", borderRadius: 3,
                    background: r.status === "paid" ? "transparent" : "var(--cream)",
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", fontWeight: 400 }}>
                        {monthLabel(r.period_month)}
                      </div>
                      {r.status === "paid" && r.paid_at && (
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                          Paid {new Date(r.paid_at).toLocaleDateString([], { month: "short", day: "numeric" })} · {r.payment_method}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
                      {fmt(r.amount_cents)}
                    </div>
                    <div>
                      {r.status === "unpaid" ? (
                        <button
                          onClick={() => handleMarkPaid(r.id)}
                          disabled={markingPaid === r.id}
                          style={{
                            padding: "0.25rem 0.625rem", borderRadius: 3, border: "none",
                            background: "var(--sage)", color: "var(--white)", fontFamily: "Inter, sans-serif",
                            fontSize: "0.6875rem", fontWeight: 500, cursor: "pointer", opacity: markingPaid === r.id ? 0.5 : 1,
                          }}
                        >
                          Mark paid
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkUnpaid(r.id)}
                          disabled={markingPaid === r.id}
                          style={{
                            padding: "0.25rem 0.625rem", borderRadius: 3, border: "1px solid var(--border)",
                            background: "none", color: "var(--muted)", fontFamily: "Inter, sans-serif",
                            fontSize: "0.6875rem", cursor: "pointer", opacity: markingPaid === r.id ? 0.5 : 1,
                          }}
                        >
                          Unpaid
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* One-off charges */}
          <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Additional Charges
              </div>
              <button onClick={() => setShowChargeForm(v => !v)} style={{
                padding: "0.25rem 0.75rem", borderRadius: 3, border: "1px solid var(--border-strong)",
                background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
                fontSize: "0.75rem", cursor: "pointer",
              }}>
                + Add charge
              </button>
            </div>

            {showChargeForm && (
              <form onSubmit={addCharge} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", marginBottom: "0.875rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <input value={chargeDesc} onChange={e => setChargeDesc(e.target.value)} required placeholder="Description (e.g. RCM exam fee)" style={inp} />
                </div>
                <div style={{ flex: "0 0 110px" }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>$</span>
                    <input value={chargeAmount} onChange={e => setChargeAmount(e.target.value)} type="number" min="0" step="0.01" required placeholder="0.00" style={{ ...inp, paddingLeft: "1.5rem" }} />
                  </div>
                </div>
                <button type="submit" disabled={addingCharge} style={{
                  padding: "0.5rem 1rem", borderRadius: 3, border: "none",
                  background: "var(--charcoal)", color: "var(--white)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                  opacity: addingCharge ? 0.5 : 1, whiteSpace: "nowrap",
                }}>
                  {addingCharge ? "Adding…" : "Add"}
                </button>
              </form>
            )}

            {charges.length === 0 ? (
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", padding: "0.25rem 0" }}>
                No additional charges.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {charges.map(c => (
                  <div key={c.id} style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.5rem 0.75rem", borderRadius: 3,
                    background: c.status === "paid" ? "transparent" : "var(--cream)",
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)" }}>{c.description}</div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                        {new Date(c.charge_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        {c.status === "paid" && c.paid_at ? ` · Paid ${new Date(c.paid_at).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}
                      </div>
                    </div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
                      {fmt(c.amount_cents)}
                    </div>
                    {c.status === "unpaid" && (
                      <button
                        onClick={() => markChargePaid(c.id)}
                        style={{
                          padding: "0.25rem 0.625rem", borderRadius: 3, border: "none",
                          background: "var(--sage)", color: "var(--white)", fontFamily: "Inter, sans-serif",
                          fontSize: "0.6875rem", fontWeight: 500, cursor: "pointer",
                        }}
                      >
                        Mark paid
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Print invoice link */}
          <a
            href={`/teacher/billing/${studentId}/invoice`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block", padding: "0.625rem 1.25rem", borderRadius: 3,
              border: "1px solid var(--border-strong)", background: "none",
              color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
              fontSize: "0.8125rem", fontWeight: 500, textDecoration: "none",
              cursor: "pointer",
            }}
          >
            Print / view invoice →
          </a>
        </>
      )}

      {/* Parent / guardian linking */}
      <ParentLinkSection studentId={studentId} teacherId={teacher?.id ?? ""} supabase={supabase} />
    </div>
  );
}

function ParentLinkSection({ studentId, teacherId: _teacherId, supabase }: { studentId: string; teacherId: string; supabase: ReturnType<typeof import("../../../../lib/supabase/client").getSupabaseBrowserClient> }) {
  const [links, setLinks] = React.useState<{ id: string; parent_id: string; parent_name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [linking, setLinking] = React.useState(false);
  const [linkError, setLinkError] = React.useState("");

  React.useEffect(() => { loadLinks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLinks() {
    setLoading(true);
    const { data } = await supabase
      .from("parent_student_links")
      .select("id, parent_id, profiles!parent_id(display_name)")
      .eq("student_id", studentId);
    const rows = (data ?? []).map((r: { id: string; parent_id: string; profiles: { display_name: string } | null }) => ({
      id: r.id,
      parent_id: r.parent_id,
      parent_name: r.profiles?.display_name ?? "Parent",
    }));
    setLinks(rows);
    setLoading(false);
  }

  async function linkParent(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLinking(true);
    setLinkError("");
    try {
      const res = await fetch("/api/parent/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), studentId }),
      });
      const json = await res.json();
      if (!res.ok) { setLinkError(json.error ?? "Failed to link"); return; }
      setEmail("");
      await loadLinks();
    } finally {
      setLinking(false);
    }
  }

  async function unlink(linkId: string) {
    await supabase.from("parent_student_links").delete().eq("id", linkId);
    await loadLinks();
  }

  const inp: React.CSSProperties = {
    border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem",
    fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)",
    color: "var(--charcoal)", outline: "none", boxSizing: "border-box",
  };

  return (
    <div className="card-base" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.875rem" }}>
        Parent / Guardian Access
      </div>
      {loading ? null : links.length === 0 ? (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.875rem" }}>No parents linked yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.875rem" }}>
          {links.map(l => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.375rem 0.75rem", background: "var(--cream)", borderRadius: 3, border: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)" }}>
                {l.parent_name}
              </span>
              <button onClick={() => unlink(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", padding: 0 }}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={linkParent} style={{ display: "flex", gap: "0.5rem" }}>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Parent's email address" style={{ ...inp, flex: 1 }} />
        <button type="submit" disabled={linking} style={{ padding: "0.5rem 0.875rem", borderRadius: 3, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", opacity: linking ? 0.5 : 1, whiteSpace: "nowrap" }}>
          {linking ? "Linking…" : "Link parent"}
        </button>
      </form>
      {linkError && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--rose)", marginTop: "0.5rem" }}>{linkError}</div>}
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
        The parent must first create an account at cadenza with the "Parent" role, then you can link them here.
      </div>
    </div>
  );
}
