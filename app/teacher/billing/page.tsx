"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { BillingService } from "../../../lib/services/BillingService";
import { Teacher } from "../../../lib/models/Teacher";
import type { TuitionRecordRow, BillingChargeRow } from "../../../lib/types";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface StudentSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  unpaidTuition: number;
  unpaidCharges: number;
  total: number;
}

export default function BillingPage() {
  const { user } = useAuth();
  const teacher = user as Teacher;
  const supabase = getSupabaseBrowserClient();
  const billing = BillingService.create(supabase);

  const [students, setStudents] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);
  const [summaries, setSummaries] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacher?.studioId) return;
    loadData();
  }, [teacher?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      // Get all students in the studio
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("studio_id", teacher.studioId!)
        .eq("role", "student");

      setStudents(profiles ?? []);

      // Get all unpaid tuition and charges for this teacher
      const [allTuition, allCharges] = await Promise.all([
        billing.getAllRecords(teacher.id),
        supabase.from("billing_charges").select().eq("teacher_id", teacher.id).eq("status", "unpaid").then(r => (r.data ?? []) as BillingChargeRow[]),
      ]);

      const unpaidTuition = allTuition.filter((r: TuitionRecordRow) => r.status === "unpaid");

      const map: Record<string, StudentSummary> = {};
      for (const p of profiles ?? []) {
        map[p.id] = { id: p.id, name: p.display_name, avatarUrl: p.avatar_url, unpaidTuition: 0, unpaidCharges: 0, total: 0 };
      }
      for (const r of unpaidTuition) {
        if (r.student_id && map[r.student_id]) {
          map[r.student_id].unpaidTuition += r.amount_cents;
          map[r.student_id].total += r.amount_cents;
        }
      }
      for (const c of allCharges) {
        if (c.student_id && map[c.student_id]) {
          map[c.student_id].unpaidCharges += c.amount_cents;
          map[c.student_id].total += c.amount_cents;
        }
      }

      setSummaries(Object.values(map).sort((a, b) => b.total - a.total));
    } finally {
      setLoading(false);
    }
  }

  const totalOutstanding = summaries.reduce((s, x) => s + x.total, 0);
  const studentsWithBalance = summaries.filter(s => s.total > 0);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.25rem", letterSpacing: "-0.01em" }}>
          Billing
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
          Track tuition and payments across your studio.
        </p>
      </div>

      {/* Summary card */}
      <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem", display: "flex", gap: "2rem" }}>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.25rem" }}>
            Outstanding Balance
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, color: totalOutstanding > 0 ? "#c0392b" : "var(--charcoal)" }}>
            {fmt(totalOutstanding)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.25rem" }}>
            Students with Balance
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, color: "var(--charcoal)" }}>
            {studentsWithBalance.length}
          </div>
        </div>
      </div>

      {/* Student list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 4 }} />)}
        </div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
          No students yet. Add students to your studio first.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {summaries.map(s => (
            <Link key={s.id} href={`/teacher/billing/${s.id}`} style={{ textDecoration: "none" }}>
              <div className="card-base" style={{
                padding: "0.875rem 1.125rem",
                display: "flex", alignItems: "center", gap: "0.875rem",
                cursor: "pointer", transition: "box-shadow 0.15s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--white)",
                  overflow: "hidden",
                }}>
                  {s.avatarUrl
                    ? <img src={s.avatarUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                    {s.name}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                    {s.total > 0
                      ? `${s.unpaidTuition > 0 ? `${fmt(s.unpaidTuition)} tuition` : ""}${s.unpaidTuition > 0 && s.unpaidCharges > 0 ? " + " : ""}${s.unpaidCharges > 0 ? `${fmt(s.unpaidCharges)} other` : ""}`
                      : "All paid up"
                    }
                  </div>
                </div>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem",
                  color: s.total > 0 ? "#c0392b" : "var(--sage)",
                  flexShrink: 0,
                }}>
                  {s.total > 0 ? fmt(s.total) : "✓"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
