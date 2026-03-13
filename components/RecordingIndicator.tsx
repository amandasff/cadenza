"use client";
import React from "react";
import { useRecording } from "../lib/context/RecordingContext";

/**
 * Floating pill that stays visible across page navigations while a voice
 * note is being recorded or uploaded. Rendered inside RecordingProvider
 * in both teacher and student layouts.
 */
export default function RecordingIndicator() {
  const { isRecording, recordingSeconds, uploadingAudio, audioError, stopRecording, clearError } = useRecording();

  if (!isRecording && !uploadingAudio && !audioError) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "1.5rem",
      right: "1.5rem",
      zIndex: 8000,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "0.5rem",
      pointerEvents: "none",
    }}>
      {audioError && (
        <div style={{
          background: "#c0392b",
          color: "#fff",
          borderRadius: 8,
          padding: "0.5rem 0.875rem",
          fontSize: "0.8125rem",
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          maxWidth: 280,
          pointerEvents: "auto",
        }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{audioError}</span>
          <button
            onClick={clearError}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, fontSize: "1rem", flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {(isRecording || uploadingAudio) && (
        <div style={{
          background: isRecording ? "#c0392b" : "var(--charcoal, #2d2d2d)",
          color: "#fff",
          borderRadius: 24,
          padding: "0.5rem 1rem 0.5rem 0.75rem",
          fontSize: "0.8125rem",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          pointerEvents: "auto",
        }}>
          {isRecording ? (
            <>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: "#fff", flexShrink: 0,
                animation: "rec-pulse 1.2s ease-in-out infinite",
              }} />
              <span>Recording {recordingSeconds}s</span>
              <button
                onClick={stopRecording}
                style={{
                  background: "rgba(255,255,255,0.25)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "0.2rem 0.625rem",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                Stop & send
              </button>
            </>
          ) : (
            <>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span>Sending…</span>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes rec-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
