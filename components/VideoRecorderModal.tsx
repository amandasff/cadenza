"use client";
import React, { useEffect, useRef, useState } from "react";
import { X, PhoneOff, Minimize2, Maximize2 } from "lucide-react";

type Mode = "preview" | "recording" | "review";

interface Props {
  /** Storage path for the upload, e.g. "{studioId}/{userId}/{ts}.webm" */
  uploadPath: string;
  /** Called with the final public URL after upload succeeds */
  onSend: (publicUrl: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Full-screen video recorder modal.
 * preview  → live camera feed, tap "Record"
 * recording → live feed + timer, tap "Stop"
 * review    → playback of recorded clip, tap "Send" or "Retake"
 */
export default function VideoRecorderModal({ uploadPath, onSend, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("preview");
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);

  // Start camera on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        setError(msg.includes("denied") || msg.includes("Permission")
          ? "Camera/mic access denied — check your browser permissions."
          : `Could not access camera: ${msg}`);
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When switching back to preview from review, re-attach stream to live video
  useEffect(() => {
    if (mode === "preview" && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  }, [mode]);

  // Sync pip video with stream
  useEffect(() => {
    if (minimized && pipVideoRef.current && streamRef.current) {
      pipVideoRef.current.srcObject = streamRef.current;
    }
  }, [minimized]);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (reviewVideoRef.current?.src) URL.revokeObjectURL(reviewVideoRef.current.src);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      if (reviewVideoRef.current) {
        reviewVideoRef.current.src = url;
        reviewVideoRef.current.load();
      }
      setMode("review");
    };
    mr.start(250); // collect data every 250ms
    recorderRef.current = mr;
    setSeconds(0);
    setMode("recording");
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function retake() {
    if (reviewVideoRef.current?.src) {
      URL.revokeObjectURL(reviewVideoRef.current.src);
      reviewVideoRef.current.src = "";
    }
    blobRef.current = null;
    chunksRef.current = [];
    setSeconds(0);
    setMode("preview");
  }

  async function handleSend() {
    if (!blobRef.current) return;
    setSending(true);
    try {
      // Upload via API route (admin client bypasses storage RLS)
      const form = new FormData();
      form.append("file", blobRef.current, uploadPath.split("/").pop() ?? "video.webm");
      form.append("path", uploadPath);
      const res = await fetch("/api/messages/upload-media", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Upload failed");
      }
      const { url } = await res.json() as { url: string };
      await onSend(url);
      onClose();
    } catch (err) {
      setError(`Send failed: ${(err as Error)?.message ?? "unknown error"}`);
      setSending(false);
    }
  }

  function handleClose() {
    cleanup();
    onClose();
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Minimized pip — shown while recording, lets user browse the page
  if (minimized && mode === "recording") {
    return (
      <div style={{
        position: "fixed", bottom: 88, right: 16, zIndex: 9500,
        width: 160, borderRadius: 14,
        background: "#111", boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        overflow: "hidden", fontFamily: "Inter, sans-serif",
      }}>
        {/* Camera thumbnail */}
        <div style={{ position: "relative", aspectRatio: "4/3", background: "#000" }}>
          <video ref={pipVideoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }} />
          {/* REC indicator */}
          <div style={{ position: "absolute", top: 6, left: 6, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", borderRadius: 10, padding: "2px 7px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e74c3c", animation: "rec-pulse 1.2s infinite", display: "inline-block" }} />
            <span style={{ color: "#fff", fontSize: "0.625rem", fontWeight: 700 }}>{fmt(seconds)}</span>
          </div>
        </div>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px" }}>
          <button
            onClick={stopRecording}
            style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: "none", background: "#e74c3c", color: "#fff", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer" }}
          >
            Stop
          </button>
          <button
            onClick={() => setMinimized(false)}
            title="Expand"
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Maximize2 size={12} strokeWidth={1.5} />
          </button>
        </div>
        <style>{`@keyframes rec-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)",
      zIndex: 9500, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, sans-serif",
    }}>
      {/* Top bar: close + minimize */}
      <div style={{ position: "absolute", top: "1.25rem", left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 1.25rem", zIndex: 1 }}>
        <button
          onClick={handleClose}
          style={{
            background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
            borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={18} strokeWidth={1.5} />
        </button>
        {mode === "recording" && (
          <button
            onClick={() => setMinimized(true)}
            title="Minimize — keep recording while browsing"
            style={{
              background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
              borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Minimize2 size={18} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {error ? (
        <div style={{ color: "#fff", textAlign: "center", padding: "2rem", maxWidth: 320 }}>
          <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}><PhoneOff size={32} strokeWidth={1.5} color="rgba(255,255,255,0.7)" /></div>
          <p style={{ fontSize: "0.9375rem", lineHeight: 1.6, opacity: 0.85 }}>{error}</p>
          <button onClick={handleClose} style={{ marginTop: "1.25rem", padding: "0.625rem 1.5rem", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 24, cursor: "pointer", fontSize: "0.875rem" }}>Close</button>
        </div>
      ) : (
        <>
          {/* Video area */}
          <div style={{ position: "relative", width: "100%", maxWidth: 480, aspectRatio: "4/3", background: "#111", borderRadius: 12, overflow: "hidden", margin: "0 1rem" }}>
            {/* Live camera feed */}
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                display: mode === "review" ? "none" : "block",
                transform: "scaleX(-1)", // mirror front camera
              }}
            />
            {/* Review playback */}
            <video
              ref={reviewVideoRef}
              controls
              playsInline
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                display: mode === "review" ? "block" : "none",
              }}
            />

            {/* Recording indicator overlay */}
            {mode === "recording" && (
              <div style={{
                position: "absolute", top: "0.875rem", left: "0.875rem",
                display: "flex", alignItems: "center", gap: "0.5rem",
                background: "rgba(0,0,0,0.55)", borderRadius: 20,
                padding: "0.3rem 0.75rem",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e74c3c", animation: "rec-pulse 1.2s infinite" }} />
                <span style={{ color: "#fff", fontSize: "0.8125rem", fontWeight: 600 }}>{fmt(seconds)}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", marginTop: "1.75rem" }}>
            {mode === "preview" && (
              <button
                onClick={startRecording}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "#e74c3c", border: "4px solid rgba(255,255,255,0.3)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title="Start recording"
              >
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff" }} />
              </button>
            )}

            {mode === "recording" && (
              <button
                onClick={stopRecording}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "#e74c3c", border: "4px solid rgba(255,255,255,0.6)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "rec-pulse 1.2s infinite",
                }}
                title="Stop recording"
              >
                <span style={{ width: 18, height: 18, borderRadius: 3, background: "#fff" }} />
              </button>
            )}

            {mode === "review" && (
              <>
                <button
                  onClick={retake}
                  style={{
                    padding: "0.625rem 1.375rem", borderRadius: 24,
                    background: "rgba(255,255,255,0.15)", border: "none",
                    color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500,
                  }}
                >
                  Retake
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    padding: "0.625rem 1.875rem", borderRadius: 24,
                    background: sending ? "rgba(255,255,255,0.3)" : "#fff",
                    border: "none", color: "#111",
                    cursor: sending ? "default" : "pointer",
                    fontSize: "0.875rem", fontWeight: 600,
                  }}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </>
            )}
          </div>

          {/* Hint text */}
          {mode === "preview" && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", marginTop: "0.875rem" }}>
              Tap the button to start recording
            </p>
          )}
        </>
      )}

      <style>{`@keyframes rec-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
