"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PracticeService } from "../../../lib/services/PracticeService";
import { Student } from "../../../lib/models/Student";
import type { PracticeSessionRow } from "../../../lib/types";

const weekDayLabels = ["M", "T", "W", "T", "F", "S", "S"];

const STATIC_BADGES = [
  { label: "First Recording", threshold: 1 },
  { label: "7-Day Streak",    streakThreshold: 7 },
  { label: "First Goal",      pointsThreshold: 1 },
  { label: "Practitioner",    pointsThreshold: 500 },
  { label: "30-Day Streak",   streakThreshold: 30 },
  { label: "Performer",       pointsThreshold: 2000 },
];

export default function Rewards() {
  const { user } = useAuth();
  const student = user as Student;

  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePoints, setLivePoints] = useState<number | null>(null);
  const [liveStreak, setLiveStreak] = useState<number | null>(null);

  const loadSessions = useCallback(async () => {
    if (!student?.id) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const service = PracticeService.getInstance(supabase);
      const data = await service.getStudentSessions(student.id, 30);
      setSessions(data);
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string };
      console.error("loadSessions error:", e?.message, e?.code, e?.details);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  // Fetch live points/streak from DB (context values are a login-time snapshot)
  useEffect(() => {
    if (!student?.id) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("total_points, streak_days")
      .eq("id", student.id)
      .single()
      .then(({ data }: { data: { total_points: number; streak_days: number } | null }) => {
        if (data) {
          setLivePoints(data.total_points);
          setLiveStreak(data.streak_days);
        }
      });
  }, [student?.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  if (!student) return null;

  const totalPoints = livePoints ?? student.totalPoints;
  const streakDays = liveStreak ?? student.streakDays;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return sessions.some(s => s.created_at.slice(0, 10) === dateStr);
  });

  const badges = STATIC_BADGES.map(b => {
    let earned = false;
    if (b.threshold !== undefined) earned = sessions.length >= b.threshold;
    if (b.streakThreshold !== undefined) earned = streakDays >= b.streakThreshold;
    if (b.pointsThreshold !== undefined) earned = totalPoints >= b.pointsThreshold;
    return { ...b, earned };
  });

  const totalMinutes = sessions.reduce((sum, s) => sum + Math.round(s.duration_seconds / 60), 0);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)" }}>

      {/* Page header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem" }}>
        <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.005em" }}>
          Progress & Awards
        </h1>
      </div>

      <div style={{ padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Points */}
        <div className="card-base" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "2.5rem", color: "var(--charcoal)", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Points earned
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="card-base" style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.625rem", marginBottom: "1rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "2.25rem", color: "var(--charcoal)", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {streakDays}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Day streak
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {weekDayLabels.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                <div style={{ fontSize: "0.5625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.02em" }}>{d}</div>
                <div style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: 2,
                  background: last7[i] ? "var(--sage)" : "var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.5rem",
                  color: "white",
                  fontFamily: "Inter, sans-serif",
                }}>
                  {last7[i] ? "✓" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div className="card-base" style={{ padding: "1.25rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "2rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {loading ? "—" : sessions.length}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Sessions
            </div>
          </div>
          <div className="card-base" style={{ padding: "1.25rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "2rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {loading ? "—" : totalMinutes}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Minutes
            </div>
          </div>
        </div>

        {/* Badges */}
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>
            Badges
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
            {badges.map((b, i) => (
              <div key={i} style={{
                background: "var(--white)",
                borderRadius: 4,
                padding: "1rem 0.5rem",
                border: `1px solid ${b.earned ? "var(--border-strong)" : "var(--border)"}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.375rem",
                opacity: b.earned ? 1 : 0.35,
                transition: "opacity 0.2s",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.earned ? "var(--charcoal)" : "var(--border)" }} />
                <span style={{ fontSize: "0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--charcoal)", textAlign: "center", letterSpacing: "0.01em", lineHeight: 1.4 }}>
                  {b.label}
                </span>
                {b.earned && (
                  <span style={{ fontSize: "0.5625rem", color: "var(--sage)", fontFamily: "Inter, sans-serif", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Earned
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
