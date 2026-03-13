"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PracticeService } from "../../../lib/services/PracticeService";
import { StudioService } from "../../../lib/services/StudioService";
import { Teacher } from "../../../lib/models/Teacher";
import type { PracticeSessionRow, ProfileRow } from "../../../lib/types";

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ReviewQueue() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!teacher?.studioId) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const [rawSessions, students] = await Promise.all([
        PracticeService.create(supabase).getStudioSessions(teacher.studioId, 50),
        StudioService.create(supabase).getStudents(teacher.studioId),
      ]);
      setSessions(rawSessions);
      const map: Record<string, ProfileRow> = {};
      for (const s of students) map[s.id] = s;
      setStudentMap(map);
    } catch (err) {
      console.error("review load error:", err);
    } finally {
      setLoading(false);
    }
  }, [teacher?.studioId]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div>
      <h1 style={{ fontWeight: 800, fontSize: "1.4rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
        Review Queue
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        {loading ? "Loading…" : `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
      </p>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 680 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 112, borderRadius: 4 }} />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state" style={{ padding: "3rem 0" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎵</div>
          <p style={{ fontWeight: 700, color: "var(--charcoal)", margin: 0 }}>No sessions yet</p>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Sessions will appear here when students practice
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 680 }}>
          {sessions.map(s => {
            const profile = studentMap[s.student_id];
            const initials = profile
              ? profile.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
              : "?";
            const mins = Math.max(1, Math.round(s.duration_seconds / 60));
            const segCount = Array.isArray(s.segments_json) ? s.segments_json.length : 0;

            return (
              <Link
                key={s.id}
                href={`/teacher/review/${s.id}`}
                style={{ background: "var(--white)", borderRadius: 4, padding: "1.25rem", border: "1px solid var(--border)", textDecoration: "none", display: "block" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <div style={{
                      width: 36, height: 36, background: "var(--peach)", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: "0.75rem", color: "var(--white)", flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--charcoal)" }}>
                        {profile?.display_name ?? "Unknown Student"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {timeAgo(s.created_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--peach)" }}>
                      {mins} min
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                      {segCount > 0 ? `${segCount} segment${segCount !== 1 ? "s" : ""}` : "No segments"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {s.recording_url && (
                    <span style={{ background: "var(--sky-bg)", color: "var(--sky)", padding: "0.2rem 0.6rem", borderRadius: 100, fontSize: "0.7rem", fontWeight: 700 }}>
                      🎙 Recording
                    </span>
                  )}
                  {s.notes && (
                    <span style={{ background: "var(--cream-deep)", color: "var(--muted)", padding: "0.2rem 0.6rem", borderRadius: 100, fontSize: "0.7rem", fontWeight: 700 }}>
                      💬 Notes
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", color: "var(--sky)", fontWeight: 700, fontSize: "0.8rem" }}>
                    Review →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
