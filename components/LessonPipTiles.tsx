"use client";
import React from "react";
import { DailyVideo, useLocalSessionId, useParticipantIds } from "@daily-co/daily-react";

export default function LessonPipTiles() {
  const localId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: "remote" });

  return (
    <div style={{ display: "flex", gap: 4, height: "100%", flex: 1 }}>
      {localId && (
        <DailyVideo
          sessionId={localId}
          type="video"
          style={{ width: "50%", height: "100%", objectFit: "cover", borderRadius: 8, background: "#1a1a1a" }}
        />
      )}
      {remoteIds[0] && (
        <DailyVideo
          sessionId={remoteIds[0]}
          type="video"
          style={{ width: "50%", height: "100%", objectFit: "cover", borderRadius: 8, background: "#1a1a1a" }}
        />
      )}
    </div>
  );
}
