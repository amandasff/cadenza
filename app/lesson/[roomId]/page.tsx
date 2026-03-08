"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useLesson } from "../../../lib/context/LessonContext";
import {
  DailyVideo,
  useLocalSessionId,
  useParticipantIds,
  useDailyEvent,
} from "@daily-co/daily-react";

// ── Controls ─────────────────────────────────────────────────

function LessonControls({ onLeave }: { onLeave: () => void }) {
  const { callObject } = useLesson();
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);

  const toggleMic = () => {
    callObject?.setLocalAudio(!muted);
    setMuted((m) => !m);
  };
  const toggleCam = () => {
    callObject?.setLocalVideo(!camOff);
    setCamOff((c) => !c);
  };
  const toggleScreen = async () => {
    if (!sharing) {
      try { callObject?.startScreenShare(); } catch { /* ignore */ }
      setSharing(true);
    } else {
      callObject?.stopScreenShare();
      setSharing(false);
    }
  };

  const btnStyle: React.CSSProperties = {
    padding: "0.625rem 1.125rem",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.875rem",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    transition: "background 0.15s",
  };

  const activeBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: "rgba(232,93,74,0.3)",
    border: "1px solid rgba(232,93,74,0.5)",
  };

  return (
    <div style={{
      display: "flex",
      gap: "0.75rem",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem",
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(8px)",
    }}>
      <button onClick={toggleMic} style={muted ? activeBtnStyle : btnStyle}>
        {muted ? "🔇" : "🎙"} {muted ? "Unmute" : "Mute"}
      </button>
      <button onClick={toggleCam} style={camOff ? activeBtnStyle : btnStyle}>
        {camOff ? "📷" : "📸"} {camOff ? "Start video" : "Stop video"}
      </button>
      <button onClick={toggleScreen} style={sharing ? activeBtnStyle : btnStyle}>
        🖥 {sharing ? "Stop sharing" : "Share screen"}
      </button>
      <button
        onClick={onLeave}
        style={{
          ...btnStyle,
          background: "#e85d4a",
          border: "none",
          marginLeft: "0.5rem",
        }}
      >
        End lesson
      </button>
    </div>
  );
}

// ── Main lesson page ──────────────────────────────────────────

export default function LessonPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const { status, joinLesson, leaveLesson, callObject, studentName } = useLesson();
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const localId = useLocalSessionId();
  const participantIds = useParticipantIds({ filter: "remote" });

  // Track call events
  useDailyEvent("left-meeting", () => {
    router.push("/");
  });

  useDailyEvent("error", (ev) => {
    console.error("Daily error:", ev);
    setError("A connection error occurred.");
  });

  useEffect(() => {
    // Already in this lesson — don't re-join
    if (status === "live" && callObject) return;
    if (joining) return;

    setJoining(true);

    fetch("/api/lesson/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    })
      .then((r) => r.json())
      .then(async (data: { token?: string; roomUrl?: string; error?: string; studentId?: string; teacherId?: string }) => {
        if (data.error || !data.token || !data.roomUrl) {
          setError(data.error ?? "Could not join lesson");
          setJoining(false);
          return;
        }
        // Determine other participant's name
        const otherName = "participant";
        await joinLesson({
          roomId,
          roomUrl: data.roomUrl,
          token: data.token,
          studentName: studentName ?? otherName,
        });
        setJoining(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not connect to lesson");
        setJoining(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handleLeave = async () => {
    await leaveLesson();
    router.push("/");
  };

  if (error) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#111", flexDirection: "column", gap: "1rem",
      }}>
        <p style={{ color: "#fff", fontFamily: "Inter, sans-serif" }}>{error}</p>
        <button
          onClick={() => router.back()}
          style={{
            padding: "0.5rem 1rem", borderRadius: 8, border: "none",
            background: "rgba(255,255,255,0.1)", color: "#fff",
            cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}
        >
          Go back
        </button>
      </div>
    );
  }

  if (joining || status === "joining") {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#111",
      }}>
        <p style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter, sans-serif" }}>
          Connecting…
        </p>
      </div>
    );
  }

  const allIds = [localId, ...participantIds].filter(Boolean) as string[];
  const isOneOnOne = allIds.length === 2;

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "#111",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
          Cadenza
        </span>
        <span style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", fontWeight: 500 }}>
          Lesson {studentName ? `with ${studentName}` : ""}
        </span>
        <div style={{ width: 60 }} />
      </div>

      {/* Video tiles */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: isOneOnOne ? "1fr 1fr" : "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 8,
        padding: 8,
        alignItems: "stretch",
      }}>
        {allIds.map((id) => (
          <div key={id} style={{
            borderRadius: 12,
            overflow: "hidden",
            background: "#1c1c1c",
            minHeight: 200,
            position: "relative",
          }}>
            <DailyVideo
              sessionId={id}
              type="video"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {id === localId && (
              <div style={{
                position: "absolute", bottom: 8, left: 10,
                color: "rgba(255,255,255,0.8)", fontSize: "0.75rem",
                fontFamily: "Inter, sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}>
                You
              </div>
            )}
          </div>
        ))}

        {allIds.length === 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem", minHeight: 200,
          }}>
            Waiting for the other participant…
          </div>
        )}
      </div>

      {/* Controls */}
      <LessonControls onLeave={handleLeave} />
    </div>
  );
}
