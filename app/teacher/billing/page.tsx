"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Teacher } from "../../../lib/models/Teacher";
import type { InvoiceWithStudent, ProfileRow, AttendanceStatus } from "../../../lib/types";

// ── Helpers ──────────────────────────────────────────────────

function formatCents(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8",
  sent: "#2563eb",
  paid: "#16a34a",
  overdue: "#dc2626",
  void: "#94a3b8",
};

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present",   label: "Present",   color: "#16a34a" },
  { value: "late",      label: "Late",      color: "#d97706" },
  { value: "absent",    label: "Absent",    color: "#dc2626" },
  { value: "cancelled", label: "Cancelled", color: "#94a3b8" },
  { value: "makeup",    label: "Makeup",    color: "#7c3aed" },
];

interface LineItemDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function newLineItem(): LineItemDraft {
  return { id: Math.random().toString(36).slice(2), description: "", quantity: "1", unitPrice: "" };
}

interface LessonRow {
  id: string;
  student_id: string;
  student_name?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  attendance_status: string | null;
}

// ── Styles ───────────────────────────────────────────────────

const s = { fontFamily: "Inter, sans-serif" } as const;
const card: React.CSSProperties = {
  background: "var(--white)", border: "1px solid var(--border)",
  borderRadius: 4, padding: "1.5rem", marginBottom: "1.5rem",
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem",
  letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)",
  margin: "0 0 1.25rem",
};
const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border-strong)", borderRadius: 3,
  padding: "0.5rem 0.75rem", fontSize: "0.875rem", fontFamily: "Inter, sans-serif",
  background: "var(--cream)", color: "var(--charcoal)", outline: "none", width: "100%",
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 3, border: "none",
  background: "var(--charcoal)", color: "#fff",
  fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 3,
  border: "1px solid var(--border-strong)", background: "none",
  color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", cursor: "pointer",
};

// ── Page ─────────────────────────────────────────────────────

export default function BillingPage() {
  const { user } = useAuth();
  const teacher = user as Teacher | null;
  const studioId = teacher?.studioId;

  const [invoices, setInvoices] = useState<InvoiceWithStudent[]>([]);
  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [recentLessons, setRecentLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"invoices" | "attendance">("invoices");

  // Create invoice modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    studentId: "", dueDate: "", description: "", notes: "",
  });
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([newLineItem()]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Invoice detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithStudent | null>(null);

  const load = useCallback(async () => {
    if (!studioId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Students for dropdown
      const { data: studentData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("studio_id", studioId)
        .eq("role", "student")
        .order("display_name");
      setStudents((studentData ?? []) as ProfileRow[]);

      // Invoices
      const invRes = await fetch(`/api/invoices?studioId=${studioId}`);
      if (invRes.ok) {
        const { invoices: invData } = await invRes.json() as { invoices: InvoiceWithStudent[] };
        setInvoices(invData);
      }

      // Recent lessons (last 60 days) for attendance
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, student_id, scheduled_at, duration_minutes, status, attendance_status")
        .eq("studio_id", studioId)
        .gte("scheduled_at", since.toISOString())
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: false })
        .limit(100);

      if (lessons?.length) {
        const sIds = [...new Set(lessons.map((l: { student_id: string }) => l.student_id))];
        const { data: profiles } = await supabase
          .from("profiles").select("id, display_name").in("id", sIds);
        const nameMap: Record<string, string> = {};
        for (const p of profiles ?? []) nameMap[(p as { id: string }).id] = (p as { display_name: string }).display_name;
        setRecentLessons(lessons.map((l: LessonRow) => ({ ...l, student_name: nameMap[l.student_id] ?? "Unknown" })));
      }
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => { load(); }, [load]);

  // ── Create invoice ──────────────────────────────────────────

  function lineItemTotal() {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = Math.round((parseFloat(item.unitPrice) || 0) * 100);
      return sum + qty * price;
    }, 0);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!studioId) return;
    const validItems = lineItems.filter(i => i.description.trim() && parseFloat(i.unitPrice) > 0);
    if (!validItems.length) { setCreateError("Add at least one line item with a price."); return; }
    setCreating(true); setCreateError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId,
          studentId: createForm.studentId,
          dueDate: createForm.dueDate || undefined,
          description: createForm.description || undefined,
          notes: createForm.notes || undefined,
          lineItems: validItems.map(i => ({
            description: i.description,
            quantity: parseFloat(i.quantity) || 1,
            unitPriceCents: Math.round((parseFloat(i.unitPrice) || 0) * 100),
          })),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      setShowCreate(false);
      setCreateForm({ studentId: "", dueDate: "", description: "", notes: "" });
      setLineItems([newLineItem()]);
      load();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // ── Mark invoice paid / void ────────────────────────────────

  async function updateInvoiceStatus(id: string, status: string) {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSelectedInvoice(null);
    load();
  }

  // ── Attendance ──────────────────────────────────────────────

  async function setAttendance(lessonId: string, attendanceStatus: string) {
    await fetch(`/api/lessons/${lessonId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceStatus }),
    });
    setRecentLessons(prev => prev.map(l =>
      l.id === lessonId ? { ...l, attendance_status: attendanceStatus } : l
    ));
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem" }}>Loading…</p>
    </div>
  );

  const unpaidTotal = invoices
    .filter(i => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount_cents, 0);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ ...s, fontWeight: 700, fontSize: "1.375rem", color: "var(--charcoal)", margin: "0 0 0.25rem" }}>Billing</h1>
          {unpaidTotal > 0 && (
            <p style={{ ...s, fontSize: "0.875rem", color: "#dc2626", margin: 0 }}>
              {formatCents(unpaidTotal)} outstanding
            </p>
          )}
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ New Invoice</button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        {(["invoices", "attendance"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...s, padding: "0.625rem 1rem", border: "none", background: "none",
              fontSize: "0.875rem", fontWeight: tab === t ? 500 : 400,
              color: tab === t ? "var(--charcoal)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid var(--charcoal)" : "2px solid transparent",
              cursor: "pointer", marginBottom: -1, textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── INVOICES TAB ─────────────────────────────────────── */}
      {tab === "invoices" && (
        <>
          {invoices.filter(i => i.status !== "void").length === 0 ? (
            <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem" }}>No invoices yet. Create one to get started.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {invoices.filter(i => i.status !== "void").map(inv => (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  style={{
                    ...card, marginBottom: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <p style={{ ...s, fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", margin: 0 }}>
                      {inv.student_name}
                    </p>
                    <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                      {inv.invoice_number} · {inv.description ?? "Invoice"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ ...s, fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", margin: 0 }}>
                      {formatCents(inv.amount_cents, inv.currency)}
                    </p>
                    <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                      Due {formatDate(inv.due_date)}
                    </p>
                  </div>
                  <span style={{
                    ...s, fontSize: "0.75rem", fontWeight: 500, textTransform: "uppercase",
                    letterSpacing: "0.04em", color: STATUS_COLOR[inv.status] ?? "#888",
                    minWidth: 60, textAlign: "right", flexShrink: 0,
                  }}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ATTENDANCE TAB ───────────────────────────────────── */}
      {tab === "attendance" && (
        <>
          <p style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
            Mark attendance for recent lessons. Useful for tracking makeups and billing adjustments.
          </p>
          {recentLessons.length === 0 ? (
            <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem" }}>No recent lessons found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentLessons.map(lesson => {
                const current = lesson.attendance_status;
                const option = ATTENDANCE_OPTIONS.find(o => o.value === current);
                return (
                  <div key={lesson.id} style={{ ...card, marginBottom: 0, display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <p style={{ ...s, fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", margin: 0 }}>
                        {lesson.student_name}
                      </p>
                      <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                        {new Date(lesson.scheduled_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}{lesson.duration_minutes} min
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                      {ATTENDANCE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setAttendance(lesson.id, opt.value)}
                          style={{
                            ...s, padding: "0.25rem 0.625rem", borderRadius: 20, fontSize: "0.75rem",
                            fontWeight: current === opt.value ? 600 : 400,
                            border: `1px solid ${current === opt.value ? opt.color : "var(--border-strong)"}`,
                            background: current === opt.value ? opt.color : "transparent",
                            color: current === opt.value ? "#fff" : "var(--muted)",
                            cursor: "pointer", transition: "all 0.1s",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {option && (
                      <span style={{ ...s, fontSize: "0.75rem", color: option.color, fontWeight: 500, flexShrink: 0 }}>
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── CREATE INVOICE MODAL ─────────────────────────────── */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{ background: "var(--white)", borderRadius: 4, padding: "2rem", width: "100%", maxWidth: 560, maxHeight: "90dvh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <h2 style={{ ...s, fontWeight: 600, fontSize: "1.0625rem", color: "var(--charcoal)", margin: "0 0 1.5rem" }}>New Invoice</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>Student *</label>
                <select
                  required
                  style={inputStyle}
                  value={createForm.studentId}
                  onChange={e => setCreateForm(f => ({ ...f, studentId: e.target.value }))}
                >
                  <option value="">Select student…</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>Due date</label>
                  <input type="date" style={inputStyle} value={createForm.dueDate} onChange={e => setCreateForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>Description</label>
                  <input style={inputStyle} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. April lessons" />
                </div>
              </div>

              {/* Line items */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", display: "block", marginBottom: "0.5rem" }}>Line items *</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {lineItems.map((item, idx) => (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 72px 96px 28px", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        style={inputStyle}
                        placeholder="Description"
                        value={item.description}
                        onChange={e => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, description: e.target.value } : li))}
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        min="0.5"
                        step="0.5"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, quantity: e.target.value } : li))}
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price $"
                        value={item.unitPrice}
                        onChange={e => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, unitPrice: e.target.value } : li))}
                      />
                      <button type="button" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1rem", padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setLineItems(prev => [...prev, newLineItem()])} style={{ ...s, marginTop: "0.5rem", background: "none", border: "none", color: "var(--muted)", fontSize: "0.8125rem", cursor: "pointer", padding: 0 }}>
                  + Add line item
                </button>
                {lineItemTotal() > 0 && (
                  <p style={{ ...s, fontSize: "0.9375rem", fontWeight: 600, color: "var(--charcoal)", margin: "0.75rem 0 0", textAlign: "right" }}>
                    Total: {formatCents(lineItemTotal())}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", display: "block", marginBottom: "0.375rem" }}>Notes (optional)</label>
                <textarea rows={2} style={{ ...inputStyle, resize: "vertical" }} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes for the family…" />
              </div>

              {createError && <p style={{ ...s, color: "#dc2626", fontSize: "0.8125rem", margin: "0 0 0.75rem" }}>{createError}</p>}

              <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
                <button type="button" style={btnSecondary} onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }} disabled={creating}>
                  {creating ? "Creating…" : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── INVOICE DETAIL MODAL ─────────────────────────────── */}
      {selectedInvoice && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedInvoice(null); }}
        >
          <div style={{ background: "var(--white)", borderRadius: 4, padding: "2rem", width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{selectedInvoice.invoice_number}</p>
                <h2 style={{ ...s, fontWeight: 600, fontSize: "1.0625rem", color: "var(--charcoal)", margin: 0 }}>{selectedInvoice.student_name}</h2>
              </div>
              <span style={{ ...s, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: STATUS_COLOR[selectedInvoice.status] }}>
                {selectedInvoice.status}
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "1rem 0", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                <span style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)" }}>Amount</span>
                <span style={{ ...s, fontSize: "0.8125rem", fontWeight: 600, color: "var(--charcoal)" }}>{formatCents(selectedInvoice.amount_cents, selectedInvoice.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                <span style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)" }}>Due date</span>
                <span style={{ ...s, fontSize: "0.8125rem", color: "var(--charcoal)" }}>{formatDate(selectedInvoice.due_date)}</span>
              </div>
              {selectedInvoice.paid_at && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)" }}>Paid on</span>
                  <span style={{ ...s, fontSize: "0.8125rem", color: "#16a34a" }}>{formatDate(selectedInvoice.paid_at)}</span>
                </div>
              )}
            </div>

            {selectedInvoice.description && (
              <p style={{ ...s, fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1rem" }}>{selectedInvoice.description}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {selectedInvoice.status === "draft" && (
                <button onClick={() => updateInvoiceStatus(selectedInvoice.id, "sent")} style={{ ...btnSecondary, fontSize: "0.8125rem" }}>Mark as Sent</button>
              )}
              {(selectedInvoice.status === "sent" || selectedInvoice.status === "draft" || selectedInvoice.status === "overdue") && (
                <button onClick={() => updateInvoiceStatus(selectedInvoice.id, "paid")} style={{ ...btnPrimary, background: "#16a34a" }}>Mark as Paid</button>
              )}
              {selectedInvoice.status !== "overdue" && selectedInvoice.status !== "paid" && selectedInvoice.status !== "void" && (
                <button onClick={() => updateInvoiceStatus(selectedInvoice.id, "overdue")} style={{ ...btnSecondary, color: "#dc2626", borderColor: "#fca5a5", fontSize: "0.8125rem" }}>Mark Overdue</button>
              )}
              {selectedInvoice.status !== "void" && (
                <button onClick={() => updateInvoiceStatus(selectedInvoice.id, "void")} style={{ ...btnSecondary, fontSize: "0.8125rem" }}>Void</button>
              )}
              <button onClick={() => setSelectedInvoice(null)} style={{ ...btnSecondary, marginLeft: "auto", fontSize: "0.8125rem" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
