"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLesson } from "../lib/context/LessonContext";

function useElapsedTime(active: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) { setSecs(0); return; }
    const interval = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LessonPip() {
  const { status, roomId, studentName, leaveLesson } = useLesson();
  const pathname = usePathname();
  const router = useRouter();
  const elapsed = useElapsedTime(status === "live");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const isOnLessonPage = pathname?.startsWith("/lesson/");
  if (status !== "live" || isOnLessonPage) return null;

  const handleEndLesson = async () => { await leaveLesson(); setConfirmEnd(false); };

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16, borderRadius: 12,
      background: "#111", boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      zIndex: 200, border: "1px solid rgba(255,255,255,0.1)",
      overflow: "hidden", minWidth: 240,
    }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.625rem 0.875rem", cursor: "pointer" }}
        onClick={() => roomId && router.push(`/lesson/${roomId}`)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e85d4a", boxShadow: "0 0 6px #e85d4a", flexShrink: 0 }} />
          <span style={{ color: "#fff", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
            Lesson with {studentName ?? "student"}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "1rem" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6875rem", fontFamily: "Inter, sans-serif" }}>{elapsed}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmEnd(true); }}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", padding: "0.125rem 0.5rem", fontSize: "0.6875rem", fontFamily: "Inter, sans-serif" }}
          >
            End
          </button>
        </span>
      </div>

      {confirmEnd && (
        <div style={{ padding: "0.75rem 0.875rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", margin: 0 }}>End this lesson?</p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleEndLesson} style={{ padding: "0.375rem 0.75rem", borderRadius: 6, border: "none", background: "#e85d4a", color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500 }}>
              End lesson
            </button>
            <button onClick={() => setConfirmEnd(false)} style={{ padding: "0.375rem 0.75rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem" }}>
              Stay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
