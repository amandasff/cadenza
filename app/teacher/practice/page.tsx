"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { Teacher } from "../../../lib/models/Teacher";

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function TeacherPracticePage() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const baseElapsedRef = useRef<number>(0);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function startTimer() {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(baseElapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    setRunning(true);
  }

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    baseElapsedRef.current = elapsed;
    setRunning(false);
  }

  function resetTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(0);
    baseElapsedRef.current = 0;
    setNotes("");
    setSaved(false);
    setError("");
  }

  async function handleSave() {
    if (!teacher?.id || !teacher?.studioId || elapsed < 10 || saving) return;
    setSaving(true);
    setError("");
    try {
      if (running) stopTimer();
      const logRes = await fetch("/api/practice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId: teacher.studioId,
          durationSeconds: elapsed,
          notes: notes.trim() || undefined,
        }),
      });
      if (!logRes.ok) throw new Error("Failed to save session");
      setSaved(true);
    } catch (err) {
      console.error("save practice error:", err);
      setError("Failed to save session. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "var(--charcoal)", margin: "0 0 0.25rem" }}>
        Practice Session
      </h1>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.75rem" }}>
        Log your own practice time.
      </p>

      {/* Timer display */}
      <div style={{
        background: "var(--white)", borderRadius: 24, padding: "2rem",
        border: "1.5px solid var(--border)", textAlign: "center", marginBottom: "1rem",
      }}>
        <div style={{
          fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "3.5rem",
          color: running ? "var(--charcoal)" : "var(--muted)",
          letterSpacing: "-0.02em", marginBottom: "1.5rem",
          transition: "color 0.2s",
        }}>
          {fmt(elapsed)}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          {!saved && (
            <button
              onClick={running ? stopTimer : startTimer}
              style={{
                padding: "0.75rem 2rem", borderRadius: 100,
                background: running ? "var(--rose-bg)" : "var(--charcoal)",
                color: running ? "var(--rose)" : "white",
                fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem",
                cursor: "pointer", transition: "all 0.15s",
                border: running ? "2px solid var(--rose)" : "2px solid transparent",
              } as React.CSSProperties}
            >
              {running ? "⏸ Pause" : elapsed > 0 ? "▶ Resume" : "▶ Start"}
            </button>
          )}
          {elapsed > 0 && !running && !saved && (
            <button
              onClick={resetTimer}
              style={{
                padding: "0.75rem 1.25rem", borderRadius: 100,
                border: "1.5px solid var(--border)", background: "var(--cream)",
                color: "var(--muted)", fontFamily: "Nunito, sans-serif", fontWeight: 700,
                fontSize: "0.875rem", cursor: "pointer",
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      {(elapsed > 0 || notes) && !saved && (
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)", marginBottom: "1rem" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
            Notes (optional)
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What did you work on today?"
            style={{
              width: "100%", borderRadius: 10, border: "1.5px solid var(--border)",
              padding: "0.75rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem",
              background: "var(--cream)", color: "var(--charcoal)", resize: "none",
              minHeight: 100, outline: "none", boxSizing: "border-box", lineHeight: 1.5,
            }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "0.625rem 0.875rem", borderRadius: 10, background: "var(--rose-bg)", border: "1px solid var(--rose)", fontSize: "0.8125rem", color: "var(--rose)", fontFamily: "Nunito, sans-serif", fontWeight: 600, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Save or success */}
      {saved ? (
        <div style={{ background: "var(--sage-bg)", borderRadius: 20, padding: "1.5rem", border: "1.5px solid var(--sage)", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1rem", color: "var(--sage)", marginBottom: "0.25rem" }}>
            Session saved!
          </div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1rem" }}>
            {fmt(elapsed)} logged
          </div>
          <button
            onClick={resetTimer}
            style={{
              padding: "0.65rem 1.5rem", borderRadius: 100, border: "none",
              background: "var(--charcoal)", color: "white",
              fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Start another session
          </button>
        </div>
      ) : (
        elapsed >= 10 && !running && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%", padding: "0.85rem", borderRadius: 100, border: "none",
              background: "var(--sky)", color: "white",
              fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem",
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {saving ? "Saving…" : "Save Session"}
          </button>
        )
      )}
    </div>
  );
}
