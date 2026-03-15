"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

interface ChildInfo {
  studentId: string;
  displayName: string;
  instrument: string | null;
  studioName: string | null;
  streakDays: number;
  totalPoints: number;
  nextLessonAt: string | null;
  lastPracticeAt: string | null;
  practiceMinutesThisWeek: number;
  pendingAssignments: number;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadChildren();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadChildren() {
    setLoading(true);
    try {
      // Get linked children
      const { data: links } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", user!.id);

      if (!links || links.length === 0) { setChildren([]); setLoading(false); return; }

      const studentIds = links.map((l: { student_id: string }) => l.student_id);

      // Fetch all student data in parallel
      const now = new Date().toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [profilesRes, lessonsRes, sessionsRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, instrument, studio_id").in("id", studentIds),
        supabase.from("lessons").select("student_id, scheduled_at").in("student_id", studentIds).eq("status", "scheduled").gte("scheduled_at", now).order("scheduled_at", { ascending: true }),
        supabase.from("practice_sessions").select("student_id, duration_seconds, created_at").in("student_id", studentIds).gte("created_at", weekAgo),
        supabase.from("assignments").select("student_id, status").in("student_id", studentIds).eq("status", "active"),
      ]);

      const profiles = (profilesRes.data ?? []) as { id: string; display_name: string; instrument: string | null; studio_id: string | null }[];

      // Fetch studio names
      const studioIds = [...new Set(profiles.map(p => p.studio_id).filter(Boolean))] as string[];
      const studioMap = new Map<string, string>();
      if (studioIds.length > 0) {
        const { data: studios } = await supabase.from("studios").select("id, name").in("id", studioIds);
        for (const s of studios ?? []) studioMap.set(s.id, s.name);
      }

      const nextLessonMap = new Map<string, string>();
      for (const l of lessonsRes.data ?? []) {
        if (!nextLessonMap.has(l.student_id)) nextLessonMap.set(l.student_id, l.scheduled_at);
      }

      const practiceMap = new Map<string, { minutes: number; lastAt: string | null }>();
      for (const s of sessionsRes.data ?? []) {
        const cur = practiceMap.get(s.student_id) ?? { minutes: 0, lastAt: null };
        cur.minutes += Math.round(s.duration_seconds / 60);
        if (!cur.lastAt || s.created_at > cur.lastAt) cur.lastAt = s.created_at;
        practiceMap.set(s.student_id, cur);
      }

      const assignmentMap = new Map<string, number>();
      for (const a of assignmentsRes.data ?? []) {
        assignmentMap.set(a.student_id, (assignmentMap.get(a.student_id) ?? 0) + 1);
      }

      const childInfos: ChildInfo[] = studentIds.map((sid: string) => {
        const p = profiles.find(pr => pr.id === sid);
        const practice = practiceMap.get(sid);
        return {
          studentId: sid,
          displayName: p?.display_name ?? "Student",
          instrument: p?.instrument ?? null,
          studioName: p?.studio_id ? (studioMap.get(p.studio_id) ?? null) : null,
          streakDays: 0, // could fetch from profiles
          totalPoints: 0,
          nextLessonAt: nextLessonMap.get(sid) ?? null,
          lastPracticeAt: practice?.lastAt ?? null,
          practiceMinutesThisWeek: practice?.minutes ?? 0,
          pendingAssignments: assignmentMap.get(sid) ?? 0,
        };
      });

      setChildren(childInfos);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 200, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.375rem", letterSpacing: "-0.01em" }}>
        My Children
      </h1>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.75rem" }}>
        Track practice and lesson updates from your teacher.
      </p>

      {children.length === 0 ? (
        <div className="card-base" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
            No students linked yet.
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
            Ask your teacher to link your account to your child's profile.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {children.map(child => (
            <button
              key={child.studentId}
              onClick={() => router.push(`/parent/${child.studentId}`)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "1.25rem", borderRadius: 4, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--white)", flexShrink: 0 }}>
                  {child.displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "1rem", color: "var(--charcoal)" }}>{child.displayName}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                    {[child.instrument, child.studioName].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.625rem" }}>
                <div style={{ background: "var(--cream)", borderRadius: 3, padding: "0.625rem 0.75rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "1.125rem", fontWeight: 300, color: "var(--charcoal)", lineHeight: 1 }}>{child.practiceMinutesThisWeek}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Min this week</div>
                </div>
                <div style={{ background: "var(--cream)", borderRadius: 3, padding: "0.625rem 0.75rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "1.125rem", fontWeight: 300, color: "var(--charcoal)", lineHeight: 1 }}>{child.pendingAssignments}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Assignments</div>
                </div>
                <div style={{ background: "var(--cream)", borderRadius: 3, padding: "0.625rem 0.75rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 400, color: "var(--charcoal)", lineHeight: 1.3 }}>
                    {child.nextLessonAt
                      ? new Date(child.nextLessonAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
                      : "—"}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>Next lesson</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
