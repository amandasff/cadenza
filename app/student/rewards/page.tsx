"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PracticeService } from "../../../lib/services/PracticeService";
import { Student } from "../../../lib/models/Student";
import type { PracticeSessionRow } from "../../../lib/types";

const weekDayLabels = ["M", "T", "W", "T", "F", "S", "S"];

const STATIC_BADGES = [
  { emoji: "🎤", label: "First Recording", threshold: 1 },
  { emoji: "🔥", label: "7-Day Streak", streakThreshold: 7 },
  { emoji: "🎵", label: "First Goal", pointsThreshold: 1 },
  { emoji: "⭐", label: "Practitioner", pointsThreshold: 500 },
  { emoji: "🏆", label: "30-Day Streak", streakThreshold: 30 },
  { emoji: "🎸", label: "Performer", pointsThreshold: 2000 },
];

export default function Rewards() {
  const { user } = useAuth();
  const student = user as Student;

  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!student?.id) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const service = PracticeService.getInstance(supabase);
      const data = await service.getStudentSessions(student.id, 30);
      setSessions(data);
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string };
      console.error('loadSessions error:', e?.message, e?.code, e?.details);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!student) return null;

  const totalPoints = student.totalPoints;
  const streakDays = student.streakDays;

  // Build last 7 days practiced array
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return sessions.some(s => s.created_at.slice(0, 10) === dateStr);
  });

  // Determine which badges are earned
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
      <div style={{ background: "var(--white)", borderBottom: "1.5px solid var(--border)", padding: "1rem 1.25rem" }}>
        <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.1rem", color: "var(--charcoal)", margin: 0 }}>
          Streaks & Rewards
        </h1>
      </div>

      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Stars card */}
        <div className="card-base" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <div style={{
            width: 52, height: 52,
            background: "var(--butter-bg)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.6rem", flexShrink: 0,
          }}>
            ⭐
          </div>
          <div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "2rem", color: "var(--charcoal)", lineHeight: 1 }}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>
              Stars earned
            </div>
          </div>
        </div>

        {/* Streak card */}
        <div className="card-base" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "2rem" }}>🔥</span>
            <div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.8rem", color: "var(--peach)", lineHeight: 1 }}>
                {streakDays} days
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                Practice streak
              </div>
            </div>
          </div>
          {/* Last 7 days */}
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {weekDayLabels.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>{d}</div>
                <div style={{
                  width: "100%", aspectRatio: "1", borderRadius: 8,
                  background: last7[i] ? "var(--sage)" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.6rem", color: "white",
                }}>
                  {last7[i] ? "✓" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div className="card-base" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.6rem", color: "var(--sky)" }}>
              {loading ? "..." : sessions.length}
            </div>
            <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
              Practice sessions
            </div>
          </div>
          <div className="card-base" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.6rem", color: "var(--rose)" }}>
              {loading ? "..." : totalMinutes}
            </div>
            <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
              Total minutes
            </div>
          </div>
        </div>

        {/* Badges */}
        <div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            Badges
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {badges.map((b, i) => (
              <div key={i} style={{
                background: "var(--white)",
                borderRadius: "var(--radius-lg)",
                padding: "0.875rem 0.5rem",
                border: `1.5px solid ${b.earned ? "var(--border-strong)" : "var(--border)"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                opacity: b.earned ? 1 : 0.35,
                transition: "opacity 0.2s",
              }}>
                <span style={{ fontSize: "1.6rem" }}>{b.emoji}</span>
                <span style={{ fontSize: "0.65rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "var(--charcoal)", textAlign: "center" }}>
                  {b.label}
                </span>
                {b.earned && (
                  <span style={{ fontSize: "0.6rem", color: "var(--sage)", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>✓ Earned</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
