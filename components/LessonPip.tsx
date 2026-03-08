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

// We lazy-import DailyVideo to avoid SSR issues
let DailyVideo: React.ComponentType<{ sessionId: string; type: "video"; style?: React.CSSProperties }> | null = null;
let useParticipantIds: (() => string[]) | null = null;
let useLocalSessionId: (() => string) | null = null;

if (typeof window !== "undefined") {
  import("@daily-co/daily-react").then((mod) => {
    DailyVideo = mod.DailyVideo as typeof DailyVideo;
    useParticipantIds = mod.useParticipantIds as typeof useParticipantIds;
    useLocalSessionId = mod.useLocalSessionId as typeof useLocalSessionId;
  });
}

function VideoTiles() {
  const localId = useLocalSessionId?.() ?? "";
  const remoteIds = useParticipantIds?.() ?? [];
  const others = remoteIds.filter((id) => id !== localId);

  if (!DailyVideo) return null;

  return (
    <div style={{ display: "flex", gap: 4, height: "100%", flex: 1 }}>
      {localId && DailyVideo && (
        <DailyVideo
          sessionId={localId}
          type="video"
          style={{ width: "50%", height: "100%", objectFit: "cover", borderRadius: 8, background: "#1a1a1a" }}
        />
      )}
      {others[0] && DailyVideo && (
        <DailyVideo
          sessionId={others[0]}
          type="video"
          style={{ width: "50%", height: "100%", objectFit: "cover", borderRadius: 8, background: "#1a1a1a" }}
        />
      )}
    </div>
  );
}

export default function LessonPip() {
  const { status, roomId, studentName, leaveLesson, callObject } = useLesson();
  const pathname = usePathname();
  const router = useRouter();
  const elapsed = useElapsedTime(status === "live");
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Only show when live AND not on the lesson page
  const isOnLessonPage = pathname?.startsWith("/lesson/");
  if (status !== "live" || isOnLessonPage || !callObject) return null;

  const handleEndLesson = async () => {
    await leaveLesson();
    setConfirmEnd(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        right: 16,
        width: 300,
        borderRadius: 16,
        overflow: "hidden",
        background: "#111",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        zIndex: 200,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 0.75rem",
          background: "rgba(255,255,255,0.06)",
          cursor: "pointer",
        }}
        onClick={() => roomId && router.push(`/lesson/${roomId}`)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: "#e85d4a",
            boxShadow: "0 0 6px #e85d4a", flexShrink: 0,
          }} />
          <span style={{ color: "#fff", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
            Lesson with {studentName ?? "student"}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6875rem", fontFamily: "Inter, sans-serif" }}>
            {elapsed}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmEnd(true); }}
            style={{
              background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4,
              color: "#fff", cursor: "pointer", padding: "0.125rem 0.375rem",
              fontSize: "0.6875rem", fontFamily: "Inter, sans-serif",
            }}
          >
            End
          </button>
        </span>
      </div>

      {/* Video area */}
      <div
        style={{ height: 160, display: "flex", padding: 4, cursor: "pointer" }}
        onClick={() => roomId && router.push(`/lesson/${roomId}`)}
      >
        <VideoTiles />
      </div>

      {/* Confirm end overlay */}
      {confirmEnd && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "0.75rem", padding: "1rem",
        }}>
          <p style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", textAlign: "center", margin: 0 }}>
            End this lesson?
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleEndLesson}
              style={{
                padding: "0.375rem 0.875rem", borderRadius: 6, border: "none",
                background: "#e85d4a", color: "#fff", cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
              }}
            >
              End lesson
            </button>
            <button
              onClick={() => setConfirmEnd(false)}
              style={{
                padding: "0.375rem 0.875rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)",
                background: "none", color: "#fff", cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
              }}
            >
              Stay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
