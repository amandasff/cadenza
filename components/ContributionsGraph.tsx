"use client";
import React, { useEffect, useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface DayData {
  date: string; // YYYY-MM-DD
  sessions: number;
  clips: number;
}

interface DayDetail {
  date: string;
  sessions: number;
  clips: number;
}

function getIntensity(sessions: number, clips: number): 0 | 1 | 2 | 3 | 4 {
  const signals = sessions + clips * 2; // clips weighted more — they mean active sharing
  if (signals === 0) return 0;
  if (signals <= 1) return 1;
  if (signals <= 3) return 2;
  if (signals <= 6) return 3;
  return 4;
}

const INTENSITY_COLORS = {
  light: {
    0: "var(--border)",
    1: "var(--sage-light)",
    2: "var(--sage-mid)",
    3: "var(--sage)",
    4: "#2D5A42",
  },
  dark: {
    0: "#1C1916",
    1: "#1E3329",
    2: "#2A4D3C",
    3: "#3D6B55",
    4: "#4D8A6E",
  },
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["","M","","W","","F",""];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function friendlyDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

interface Props {
  studentId: string;
  /** Whether to use dark palette (for the dark studio background) */
  dark?: boolean;
}

export default function ContributionsGraph({ studentId, dark = false }: Props) {
  const [dayMap, setDayMap] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DayDetail | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 364);
    const cutoffStr = formatDate(cutoff);

    const [sessionsRes, clipsRes] = await Promise.all([
      sb.from("practice_sessions")
        .select("created_at")
        .eq("student_id", studentId)
        .gte("created_at", cutoffStr),
      sb.from("practice_clips")
        .select("created_at")
        .eq("student_id", studentId)
        .gte("created_at", cutoffStr),
    ]);

    const map = new Map<string, DayData>();
    for (const row of sessionsRes.data ?? []) {
      const d = formatDate(new Date(row.created_at));
      const existing = map.get(d) ?? { date: d, sessions: 0, clips: 0 };
      map.set(d, { ...existing, sessions: existing.sessions + 1 });
    }
    for (const row of clipsRes.data ?? []) {
      const d = formatDate(new Date(row.created_at));
      const existing = map.get(d) ?? { date: d, sessions: 0, clips: 0 };
      map.set(d, { ...existing, clips: existing.clips + 1 });
    }
    setDayMap(map);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // Build 52-week grid (Sunday-first columns)
  const today = new Date();
  // Align to Sunday
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() + (6 - today.getDay()));
  endSunday.setHours(0,0,0,0);

  const weeks: Date[][] = [];
  for (let w = 51; w >= 0; w--) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(endSunday);
      day.setDate(endSunday.getDate() - w * 7 - (6 - d));
      week.push(day);
    }
    weeks.push(week);
  }

  // Month label positions
  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = week[0].getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: MONTH_LABELS[m], colIndex: i });
      lastMonth = m;
    }
  });

  const colors = dark ? INTENSITY_COLORS.dark : INTENSITY_COLORS.light;
  const cellSize = 11;
  const gap = 2;
  const col = cellSize + gap;

  if (loading) {
    return (
      <div style={{ padding: "1rem 0" }}>
        <div className="skeleton" style={{ height: 90, borderRadius: 6 }} />
      </div>
    );
  }

  const totalSessions = Array.from(dayMap.values()).reduce((s, d) => s + d.sessions, 0);
  const totalClips = Array.from(dayMap.values()).reduce((s, d) => s + d.clips, 0);

  return (
    <div style={{ width: "100%" }}>
      {/* Graph */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: 52 * col + 24, paddingBottom: 4 }}>
          {/* Month labels */}
          <div style={{ display: "flex", marginLeft: 18, marginBottom: 4, position: "relative", height: 14 }}>
            {monthLabels.map(({ label, colIndex }) => (
              <div
                key={`${label}-${colIndex}`}
                style={{
                  position: "absolute",
                  left: colIndex * col,
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.5625rem",
                  color: dark ? "rgba(255,255,255,0.3)" : "var(--muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day labels + grid */}
          <div style={{ display: "flex", gap: 0 }}>
            {/* Day-of-week labels */}
            <div style={{ display: "flex", flexDirection: "column", gap, marginRight: 4, marginTop: 1 }}>
              {DAY_LABELS.map((label, i) => (
                <div key={i} style={{ height: cellSize, fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: dark ? "rgba(255,255,255,0.25)" : "var(--muted)", display: "flex", alignItems: "center", lineHeight: 1 }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div style={{ display: "flex", gap }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap }}>
                  {week.map((day, di) => {
                    const dateStr = formatDate(day);
                    const data = dayMap.get(dateStr);
                    const intensity = getIntensity(data?.sessions ?? 0, data?.clips ?? 0);
                    const isFuture = day > today;
                    const isSelected = selected?.date === dateStr;

                    return (
                      <div
                        key={di}
                        onClick={() => {
                          if (isFuture) return;
                          setSelected(isSelected ? null : {
                            date: dateStr,
                            sessions: data?.sessions ?? 0,
                            clips: data?.clips ?? 0,
                          });
                        }}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 2,
                          background: isFuture ? "transparent" : colors[intensity],
                          cursor: isFuture ? "default" : "pointer",
                          outline: isSelected ? `2px solid ${dark ? "rgba(255,255,255,0.5)" : "var(--charcoal)"}` : "none",
                          outlineOffset: 1,
                          transition: "opacity 0.1s",
                          opacity: isFuture ? 0 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      {selected && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.625rem 0.875rem",
          background: dark ? "rgba(255,255,255,0.06)" : "var(--cream-deep)",
          borderRadius: 6,
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          animation: "fade-in 0.15s ease",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: dark ? "rgba(255,255,255,0.8)" : "var(--charcoal)", marginBottom: "0.2rem" }}>
              {friendlyDate(selected.date)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: dark ? "rgba(255,255,255,0.4)" : "var(--muted)" }}>
              {selected.sessions === 0 && selected.clips === 0
                ? "No practice recorded"
                : [
                    selected.sessions > 0 && `${selected.sessions} session${selected.sessions !== 1 ? "s" : ""}`,
                    selected.clips > 0 && `${selected.clips} clip${selected.clips !== 1 ? "s" : ""} sent`,
                  ].filter(Boolean).join(" · ")
              }
            </div>
          </div>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: dark ? "rgba(255,255,255,0.3)" : "var(--muted)", fontSize: "1rem", lineHeight: 1, padding: "0.2rem" }}>×</button>
        </div>
      )}

      {/* Summary line */}
      <div style={{ marginTop: "0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: dark ? "rgba(255,255,255,0.3)" : "var(--muted)", display: "flex", gap: "1rem" }}>
        <span>{totalSessions} session{totalSessions !== 1 ? "s" : ""} in the past year</span>
        {totalClips > 0 && <span>{totalClips} clip{totalClips !== 1 ? "s" : ""} sent</span>}
      </div>
    </div>
  );
}
