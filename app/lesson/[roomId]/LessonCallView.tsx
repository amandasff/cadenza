"use client";
import React, { useEffect, useRef, useState } from "react";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { useLesson } from "../../../lib/context/LessonContext";
import { useRouter } from "next/navigation";

// Renders a single participant's video track
function VideoTile({ participant, label }: { participant: DailyParticipant; label: string }) {
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

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", background: "#1c1c1c", minHeight: 200, position: "relative", flex: 1 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.local}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <div style={{ position: "absolute", bottom: 8, left: 10, color: "rgba(255,255,255,0.8)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
        {label}
      </div>
    </div>
  );
}

export default function LessonCallView({ studentName }: { studentName: string | null }) {
  const router = useRouter();
  const { leaveLesson, callObject } = useLesson();
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!callObject) return;
    const update = () => setParticipants({ ...(callObject as DailyCall).participants() });
    const handleLeftMeeting = () => router.push("/");
    callObject.on("participant-joined", update);
    callObject.on("participant-updated", update);
    callObject.on("participant-left", update);
    callObject.on("left-meeting", handleLeftMeeting);
    update();
    return () => {
      callObject.off("participant-joined", update);
      callObject.off("participant-updated", update);
      callObject.off("participant-left", update);
      callObject.off("left-meeting", handleLeftMeeting);
    };
  }, [callObject, router]);

  const handleLeave = async () => { await leaveLesson(); router.push("/"); };
  const toggleMic = () => { callObject?.setLocalAudio(!muted); setMuted((m) => !m); };
  const toggleCam = () => { callObject?.setLocalVideo(!camOff); setCamOff((c) => !c); };
  const toggleScreen = () => {
    if (!sharing) {
      try { callObject?.startScreenShare(); setSharing(true); } catch { /* ignore */ }
    } else {
      callObject?.stopScreenShare();
      setSharing(false);
    }
  };

  const pList = Object.values(participants);
  const local = pList.find((p) => p.local);
  const remotes = pList.filter((p) => !p.local);

  const btn: React.CSSProperties = { padding: "0.625rem 1.125rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500 };
  const activeBtn: React.CSSProperties = { ...btn, background: "rgba(232,93,74,0.3)", border: "1px solid rgba(232,93,74,0.5)" };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#111" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem", background: "rgba(0,0,0,0.4)", flexShrink: 0 }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>Cadenza</span>
        <span style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", fontWeight: 500 }}>
          Lesson{studentName ? ` with ${studentName}` : ""}
        </span>
        <div style={{ width: 60 }} />
      </div>

      {/* Video tiles */}
      <div style={{ flex: 1, display: "flex", gap: 8, padding: 8, alignItems: "stretch" }}>
        {local && <VideoTile participant={local} label="You" />}
        {remotes.map((p) => (
          <VideoTile key={p.session_id} participant={p} label={studentName ?? "Participant"} />
        ))}
        {pList.length === 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
            Waiting for the other participant…
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.5)" }}>
        <button onClick={toggleMic} style={muted ? activeBtn : btn}>{muted ? "🔇 Unmute" : "🎙 Mute"}</button>
        <button onClick={toggleCam} style={camOff ? activeBtn : btn}>{camOff ? "📷 Start video" : "📸 Stop video"}</button>
        <button onClick={toggleScreen} style={sharing ? activeBtn : btn}>{sharing ? "🖥 Stop sharing" : "🖥 Share"}</button>
        <button onClick={handleLeave} style={{ ...btn, background: "#e85d4a", border: "none", marginLeft: "0.5rem" }}>End lesson</button>
      </div>
    </div>
  );
}
