"use client";
import React, { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLesson } from "../../../lib/context/LessonContext";

// Load the call view (uses daily-react hooks) only client-side
const LessonCallView = dynamic(() => import("./LessonCallView"), { ssr: false });

export default function LessonPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const { status, joinLesson, callObject, studentName } = useLesson();
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

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
      .then(async (data: { token?: string; roomUrl?: string; error?: string }) => {
        if (data.error || !data.token || !data.roomUrl) {
          setError(data.error ?? "Could not join lesson");
          setJoining(false);
          return;
        }
        await joinLesson({
          roomId,
          roomUrl: data.roomUrl,
          token: data.token,
          studentName: studentName ?? "participant",
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

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", flexDirection: "column", gap: "1rem" }}>
        <p style={{ color: "#fff", fontFamily: "Inter, sans-serif" }}>{error}</p>
        <button onClick={() => router.back()} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
          Go back
        </button>
      </div>
    );
  }

  if (joining || status === "joining" || (status !== "live")) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
        <p style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter, sans-serif" }}>
          {joining || status === "joining" ? "Connecting…" : "Loading…"}
        </p>
      </div>
    );
  }

  return <LessonCallView studentName={studentName} />;
}
