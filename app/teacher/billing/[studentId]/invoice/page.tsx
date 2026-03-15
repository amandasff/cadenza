"use client";
import React, { useEffect, useState, use } from "react";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { BillingService } from "../../../../../lib/services/BillingService";
import type { BillingConfigRow, TuitionRecordRow, BillingChargeRow } from "../../../../../lib/types";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function monthLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

export default function InvoicePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const supabase = getSupabaseBrowserClient();
  const billing = BillingService.create(supabase);

  const [studentName, setStudentName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [config, setConfig] = useState<BillingConfigRow | null>(null);
  const [records, setRecords] = useState<TuitionRecordRow[]>([]);
  const [charges, setCharges] = useState<BillingChargeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("studio_id").eq("id", user.id).single();
      const studioId = (profile as { studio_id: string | null } | null)?.studio_id;

      const [{ data: studentProfile }, { data: studio }, cfg, recs, chgs] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
        studioId ? supabase.from("studios").select("name").eq("id", studioId).single() : Promise.resolve({ data: null }),
        billing.getConfig(studentId, user.id),
        billing.getRecords(studentId, user.id, 24),
        billing.getCharges(studentId, user.id),
      ]);

      setStudentName((studentProfile as { display_name: string } | null)?.display_name ?? "Student");
      setStudioName((studio as { name: string } | null)?.name ?? "Studio");
      setConfig(cfg);
      setRecords(recs);
      setCharges(chgs);
      setLoading(false);
    }
    load();
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const unpaidTuition = records.filter(r => r.status === "unpaid");
  const unpaidCharges = charges.filter(c => c.status === "unpaid");
  const total = [...unpaidTuition.map(r => r.amount_cents), ...unpaidCharges.map(c => c.amount_cents)].reduce((s, x) => s + x, 0);

  if (loading) {
    return <div style={{ padding: "3rem", fontFamily: "Inter, sans-serif", color: "#666" }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 680, margin: "3rem auto", padding: "3rem", fontFamily: "Inter, sans-serif", color: "#1a1a1a" }}>
      <style>{`@media print { body { margin: 0; } button { display: none !important; } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Invoice</h1>
          <div style={{ fontSize: "0.875rem", color: "#666" }}>{new Date().toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, fontSize: "1rem" }}>{studioName}</div>
        </div>
      </div>

      <div style={{ marginBottom: "2rem", padding: "1rem 1.25rem", background: "#f5f5f0", borderRadius: 4 }}>
        <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>Bill to</div>
        <div style={{ fontWeight: 600, fontSize: "1rem" }}>{studentName}</div>
        {config?.notes && <div style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>{config.notes}</div>}
      </div>

      {/* Unpaid tuition */}
      {unpaidTuition.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: "0.5rem" }}>Tuition</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {unpaidTuition.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #e8e8e0" }}>
                  <td style={{ padding: "0.625rem 0", fontSize: "0.9375rem" }}>{monthLabel(r.period_month)}</td>
                  <td style={{ padding: "0.625rem 0", textAlign: "right", fontWeight: 500, fontSize: "0.9375rem" }}>{fmt(r.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unpaid charges */}
      {unpaidCharges.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", marginBottom: "0.5rem" }}>Additional Charges</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {unpaidCharges.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid #e8e8e0" }}>
                  <td style={{ padding: "0.625rem 0", fontSize: "0.9375rem" }}>
                    {c.description}
                    <span style={{ fontSize: "0.75rem", color: "#999", marginLeft: "0.5rem" }}>
                      {new Date(c.charge_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </td>
                  <td style={{ padding: "0.625rem 0", textAlign: "right", fontWeight: 500, fontSize: "0.9375rem" }}>{fmt(c.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Total */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "1rem", borderTop: "2px solid #1a1a1a" }}>
        <div style={{ display: "flex", gap: "3rem", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: "1rem" }}>Total due</div>
          <div style={{ fontWeight: 700, fontSize: "1.5rem" }}>{fmt(total)}</div>
        </div>
      </div>

      <div style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid #e8e8e0", fontSize: "0.8125rem", color: "#999" }}>
        Thank you for your business.
      </div>

      <button
        onClick={() => window.print()}
        style={{
          marginTop: "2rem", padding: "0.625rem 1.5rem", borderRadius: 3,
          border: "1px solid #ccc", background: "#1a1a1a", color: "#fff",
          fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
