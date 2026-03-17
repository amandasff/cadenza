"use client";
import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLesson } from "../lib/context/LessonContext";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { Music, ChevronUp, ChevronDown } from "lucide-react";

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

function PipVideoTile({ participant, small }: { participant: DailyParticipant; small?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const track = participant.tracks?.video?.persistentTrack ?? null;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (track) {
      el.srcObject = new MediaStream([track]);
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [track]);

  const size = small ? 72 : "100%";
  return (
    <div style={{
      width: small ? size : "100%",
      height: small ? size : "100%",
      borderRadius: small ? 6 : 0,
      overflow: "hidden",
      background: "#1c1c1c",
      flexShrink: 0,
      position: "relative",
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.local}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {!track && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Music size={small ? 20 : 28} strokeWidth={1.5} color="rgba(255,255,255,0.4)" />
        </div>
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
  const [collapsed, setCollapsed] = useState(false);
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});

  const isOnLessonPage = pathname?.startsWith("/lesson/");

  useEffect(() => {
    if (!callObject) return;
    const co = callObject as DailyCall;
    const update = () => setParticipants({ ...co.participants() });
    co.on("participant-joined", update);
    co.on("participant-updated", update);
    co.on("participant-left", update);
    update();
    return () => {
      co.off("participant-joined", update);
      co.off("participant-updated", update);
      co.off("participant-left", update);
    };
  }, [callObject]);

  if (status !== "live" || isOnLessonPage) return null;

  const pList = Object.values(participants);
  const local = pList.find((p) => p.local);
  const remote = pList.find((p) => !p.local);

  const handleEndLesson = async () => { await leaveLesson(); setConfirmEnd(false); };

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16,
      width: collapsed ? 240 : 280,
      borderRadius: 12,
      background: "#111",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      zIndex: 200,
      border: "1px solid rgba(255,255,255,0.12)",
      overflow: "hidden",
    }}>
      {/* Header bar */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", cursor: "pointer", background: "rgba(0,0,0,0.4)" }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e85d4a", boxShadow: "0 0 6px #e85d4a", flexShrink: 0 }} />
          <span style={{ color: "#fff", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
            {studentName ?? "Lesson"}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6875rem", fontFamily: "Inter, sans-serif" }}>{elapsed}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmEnd(true); }}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", padding: "0.125rem 0.45rem", fontSize: "0.6875rem", fontFamily: "Inter, sans-serif" }}
          >
            End
          </button>
          <span style={{ color: "rgba(255,255,255,0.4)" }}>{collapsed ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}</span>
        </span>
      </div>

      {/* Video area */}
      {!collapsed && (
        <div
          style={{ position: "relative", width: "100%", aspectRatio: "4/3", cursor: "pointer", background: "#0a0a0a" }}
          onClick={() => roomId && router.push(`/lesson/${roomId}`)}
        >
          {/* Remote (main) */}
          {remote ? (
            <PipVideoTile participant={remote} />
          ) : local ? (
            <PipVideoTile participant={local} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif" }}>Waiting…</span>
            </div>
          )}

          {/* Local (picture-in-picture within PiP) */}
          {remote && local && (
            <div style={{ position: "absolute", bottom: 6, right: 6, borderRadius: 6, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.2)", width: 72, height: 72 }}>
              <PipVideoTile participant={local} small />
            </div>
          )}

          {/* Tap to expand hint */}
          <div style={{ position: "absolute", top: 6, left: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 6px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6rem", fontFamily: "Inter, sans-serif" }}>tap to expand</span>
          </div>
        </div>
      )}

      {/* Confirm end */}
      {confirmEnd && (
        <div style={{ padding: "0.625rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <p style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", margin: 0 }}>End this lesson?</p>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button onClick={handleEndLesson} style={{ padding: "0.3rem 0.625rem", borderRadius: 6, border: "none", background: "#e85d4a", color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 500 }}>
              End lesson
            </button>
            <button onClick={() => setConfirmEnd(false)} style={{ padding: "0.3rem 0.625rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem" }}>
              Stay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
