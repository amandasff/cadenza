"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PracticeService } from "../../../lib/services/PracticeService";
import { GoalService } from "../../../lib/services/GoalService";
import { ChatService } from "../../../lib/services/ChatService";
import { PortfolioService } from "../../../lib/services/PortfolioService";
import { Student } from "../../../lib/models/Student";
import type { GoalRow, PracticeSegment } from "../../../lib/types";

const AREAS: Record<string, { label: string; icon: string }> = {
  technique:    { label: "Technique",    icon: "🌿" },
  repertoire:   { label: "Repertoire",   icon: "🌸" },
  ear_training: { label: "Ear Training", icon: "🎧" },
  theory:       { label: "Theory",       icon: "⭐" },
};

type SegmentWithId = PracticeSegment & { id: string };

export default function PracticeRecorder() {
  const router = useRouter();
  const { user } = useAuth();
  const student = user as Student;

  // Timer & session state
  const [recording, setRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentGoal, setCurrentGoal] = useState<GoalRow | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // Metronome
  const [bpm, setBpm] = useState(72);
  const [metronome, setMetronome] = useState(false);

  // Segments
  const [segments, setSegments] = useState<SegmentWithId[]>([]);
  const [showAddSeg, setShowAddSeg] = useState(false);
  const [newSegTitle, setNewSegTitle] = useState("");
  const [newSegArea, setNewSegArea] = useState("technique");

  // Recording
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  // Portfolio / Journey
  const [portfolioSave, setPortfolioSave] = useState(false);
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioDesc, setPortfolioDesc] = useState("");

  // Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Timer
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // Load current goal + teacher ID
  const loadData = useCallback(async () => {
    if (!student?.id || !student?.studioId) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const [goals, studioRes] = await Promise.all([
        GoalService.getInstance(supabase).getStudentGoals(student.id),
        supabase.from("studios").select("owner_id").eq("id", student.studioId).single(),
      ]);
      setCurrentGoal(goals.find((g) => g.status === "current") ?? null);
      setTeacherId(studioRes.data?.owner_id ?? null);
    } catch (err) {
      const e = err as { message?: string };
      console.error("loadData error:", e?.message);
    }
  }, [student?.id, student?.studioId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Metronome via Web Audio API
  useEffect(() => {
    if (!metronome) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    function playTick(accent: boolean) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = accent ? 1000 : 800;
      gain.gain.setValueAtTime(accent ? 0.7 : 0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }

    let beat = 0;
    playTick(true);
    const intervalMs = Math.round((60 / bpm) * 1000);
    const id = setInterval(() => {
      beat = (beat + 1) % 4;
      playTick(beat === 0);
    }, intervalMs);

    return () => clearInterval(id);
  }, [metronome, bpm]);

  // Canvas frequency bar-chart waveform
  function startWaveform(analyser: AnalyserNode) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    cancelAnimationFrame(animFrameRef.current);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount; // 128
    const dataArray = new Uint8Array(bufferLength);
    const BAR_COUNT = 48;
    const step = Math.floor(bufferLength / BAR_COUNT);
    const gap = 2;
    const barW = (canvas.width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = dataArray[i * step] / 255;
        const barH = Math.max(4, val * canvas.height * 0.9);
        const x = i * (barW + gap);
        const y = canvas.height - barH;
        ctx2d.fillStyle = `rgba(196, 122, 96, ${0.45 + val * 0.55})`;
        ctx2d.beginPath();
        ctx2d.roundRect(x, y, barW, barH, 2);
        ctx2d.fill();
      }
    };
    draw();
  }

  // ── Recording controls ──────────────────────────────────────────

  async function handleStartRecording() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    setHasStarted(true);
    setRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      startWaveform(analyser);

      if (typeof MediaRecorder !== "undefined") {
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          setRecordingBlob(blob);
          setAudioBlobUrl(URL.createObjectURL(blob));
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      }
    } catch (err) {
      console.error("mic error:", err);
      // recording continues without waveform if mic denied
    }
  }

  function handlePause() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    cancelAnimationFrame(animFrameRef.current);
    setRecording(false);
  }

  function handleResume() {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    if (analyserRef.current) startWaveform(analyserRef.current);
    setRecording(true);
  }

  function handleDone() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(animFrameRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setDone(true);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // ── Segments ────────────────────────────────────────────────────

  function handleAddSegment() {
    if (!newSegTitle.trim()) return;
    setSegments((prev) => [
      ...prev,
      { id: Date.now().toString(), title: newSegTitle.trim(), practice_area: newSegArea, start_seconds: elapsed },
    ]);
    setNewSegTitle("");
    setShowAddSeg(false);
  }

  // ── Submit ──────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!student?.studioId || elapsed < 1) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const practiceService = PracticeService.getInstance(supabase);
      const sessionSegments: PracticeSegment[] = segments.map(({ id: _id, ...s }) => s);

      // Upload recording to Supabase Storage if available
      let recordingUrl: string | undefined;
      if (recordingBlob) {
        const path = `${student.id}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("practice-recordings")
          .upload(path, recordingBlob, { contentType: "audio/webm", upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("practice-recordings")
            .getPublicUrl(path);
          recordingUrl = urlData.publicUrl;
        } else {
          console.error("upload error:", uploadError.message);
        }
      }

      const sessionData = await practiceService.logSession({
        studentId: student.id,
        studioId: student.studioId,
        goalId: currentGoal?.id,
        durationSeconds: elapsed,
        notes: notes.trim() || undefined,
        segments: sessionSegments.length > 0 ? sessionSegments : undefined,
        recordingUrl,
      });

      // Save to Journey/Portfolio if requested
      if (portfolioSave && portfolioTitle.trim()) {
        await PortfolioService.getInstance(supabase).addItem({
          studentId: student.id,
          studioId: student.studioId ?? undefined,
          title: portfolioTitle.trim(),
          description: portfolioDesc.trim() || undefined,
          recordingUrl,
          sessionId: sessionData.id,
        }).catch(() => {});
      }

      // Post system message to the private DM with the teacher
      if (teacherId) {
        const mins = Math.max(1, Math.round(elapsed / 60));
        const lines: string[] = [
          `🎵 Practice session · ${mins} min${segments.length > 0 ? ` · ${segments.length} segment${segments.length !== 1 ? "s" : ""}` : ""}`,
        ];
        if (currentGoal) lines.push(`📌 ${currentGoal.title}`);
        sessionSegments.forEach((s) =>
          lines.push(`${AREAS[s.practice_area]?.icon ?? "🎵"} ${s.title} · ${fmt(s.start_seconds)}`)
        );
        if (notes.trim()) lines.push(`💬 "${notes.trim()}"`);
        if (recordingUrl) lines.push(`AUDIO:${recordingUrl}`);

        try {
          await ChatService.getInstance(supabase).postSystemMessage(
            student.studioId, student.id, teacherId, lines.join("\n")
          );
        } catch (chatErr) {
          const e = chatErr as { message?: string };
          console.error("system message error:", e?.message);
        }
      }

      router.replace("/student");
    } catch (err) {
      const e = err as { message?: string };
      console.error("handleSubmit error:", e?.message);
      setSaving(false);
    }
  }

  // ── Done screen ─────────────────────────────────────────────────

  if (done) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
        <h2 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
          Great Practice!
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1.5rem", fontFamily: "DM Sans, sans-serif" }}>
          {fmt(elapsed)} session{currentGoal ? ` · ${currentGoal.title}` : ""}
        </p>

        {/* Audio playback */}
        {audioBlobUrl && (
          <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1rem 1.25rem", marginBottom: "1rem", textAlign: "left" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
              Your recording
            </div>
            <audio controls src={audioBlobUrl} style={{ width: "100%" }} />
          </div>
        )}

        {/* Segments summary */}
        {segments.length > 0 && (
          <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1rem 1.25rem", marginBottom: "1rem", textAlign: "left" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
              Segments ({segments.length})
            </div>
            {segments.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "1rem" }}>{AREAS[s.practice_area]?.icon ?? "🎵"}</span>
                <div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)" }}>{s.title}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                    {AREAS[s.practice_area]?.label} · {fmt(s.start_seconds)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "1.25rem", textAlign: "left" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
            Add notes (optional)
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What went well? What was tricky?"
            style={{
              width: "100%", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)",
              padding: "0.75rem 1rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem",
              background: "var(--cream-deep)", color: "var(--charcoal)",
              resize: "none", minHeight: 80, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Save to Journey */}
        {audioBlobUrl && (
          <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "0.25rem", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--charcoal)", marginBottom: 2 }}>
                  🎼 Save to My Journey
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                  Add this recording to your portfolio
                </div>
              </div>
              {/* Toggle switch */}
              <button
                onClick={() => setPortfolioSave(v => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 100, border: "none", flexShrink: 0,
                  background: portfolioSave ? "var(--peach)" : "var(--border)",
                  position: "relative", cursor: "pointer", transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "white",
                  position: "absolute", top: 3,
                  left: portfolioSave ? 23 : 3,
                  transition: "left 0.15s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }} />
              </button>
            </div>

            {portfolioSave && (
              <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input
                  autoFocus
                  value={portfolioTitle}
                  onChange={e => setPortfolioTitle(e.target.value)}
                  placeholder="Piece name, e.g. Für Elise"
                  style={{
                    width: "100%", borderRadius: 8, border: "1.5px solid var(--border)",
                    padding: "0.6rem 0.875rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem",
                    background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <textarea
                  value={portfolioDesc}
                  onChange={e => setPortfolioDesc(e.target.value)}
                  placeholder="Notes about this recording... (optional)"
                  style={{
                    width: "100%", borderRadius: 8, border: "1.5px solid var(--border)",
                    padding: "0.6rem 0.875rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem",
                    background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none",
                    boxSizing: "border-box", resize: "none", minHeight: 56,
                  }}
                />
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || (portfolioSave && !portfolioTitle.trim())}
          className="btn btn-primary"
          style={{ width: "100%", maxWidth: 320, padding: "0.875rem", fontSize: "0.95rem", opacity: (saving || (portfolioSave && !portfolioTitle.trim())) ? 0.65 : 1 }}
        >
          {saving ? "Saving..." : portfolioSave ? "Submit & Save to Journey ✓" : "Submit Session ✓"}
        </button>
      </div>
    );
  }

  // ── Recording screen ────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1.5px solid var(--border)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "var(--charcoal)", flex: 1, margin: 0 }}>
          Practice Session
        </h1>
        {currentGoal && (
          <div style={{ fontSize: "0.7rem", color: "var(--rose)", fontFamily: "Nunito, sans-serif", fontWeight: 700, background: "var(--rose-bg)", padding: "0.2rem 0.6rem", borderRadius: 100, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            🌸 {currentGoal.title}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center", overflowY: "auto" }}>
        {/* Timer */}
        <div style={{ textAlign: "center", paddingTop: "0.25rem" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "3.5rem", color: recording ? "var(--peach)" : "var(--charcoal)", letterSpacing: "-1px", lineHeight: 1, transition: "color 0.3s" }}>
            {fmt(elapsed)}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 4, fontFamily: "DM Sans, sans-serif" }}>
            {recording ? "Recording…" : hasStarted ? "Paused" : "Ready to record"}
          </div>
        </div>

        {/* Waveform */}
        <div style={{ width: "100%", height: 72, background: "var(--white)", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          {recording ? (
            <canvas
              ref={canvasRef}
              width={360}
              height={72}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 2, padding: "0 1rem", boxSizing: "border-box" }}>
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} style={{ width: 4, borderRadius: 2, flexShrink: 0, height: `${15 + Math.sin(i * 0.45) * 18 + 12}%`, background: hasStarted ? "var(--peach-bg)" : "var(--border)" }} />
              ))}
            </div>
          )}
        </div>

        {/* Segments */}
        {hasStarted && (
          <div style={{ width: "100%", background: "var(--white)", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderBottom: segments.length > 0 || showAddSeg ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                Segments {segments.length > 0 && `(${segments.length})`}
              </span>
              {!showAddSeg && (
                <button
                  onClick={() => setShowAddSeg(true)}
                  style={{ background: "var(--cream)", border: "1.5px solid var(--border)", borderRadius: 100, padding: "0.2rem 0.625rem", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--muted)" }}
                >
                  + Add
                </button>
              )}
            </div>

            {segments.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 1rem", borderBottom: i < segments.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: "1rem" }}>{AREAS[s.practice_area]?.icon ?? "🎵"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                    {AREAS[s.practice_area]?.label} · Started {fmt(s.start_seconds)}
                  </div>
                </div>
                <button
                  onClick={() => setSegments((prev) => prev.filter((x) => x.id !== s.id))}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}

            {showAddSeg && (
              <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: segments.length > 0 ? "1px solid var(--border)" : "none" }}>
                <input
                  autoFocus
                  value={newSegTitle}
                  onChange={(e) => setNewSegTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSegment();
                    if (e.key === "Escape") setShowAddSeg(false);
                  }}
                  placeholder="What are you practicing?"
                  style={{ borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)", padding: "0.5rem 0.75rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", width: "100%", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    value={newSegArea}
                    onChange={(e) => setNewSegArea(e.target.value)}
                    style={{ flex: 1, borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)", padding: "0.45rem 0.5rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}
                  >
                    {Object.entries(AREAS).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddSegment}
                    style={{ borderRadius: "var(--radius-md)", border: "none", background: "var(--peach)", color: "white", padding: "0.45rem 0.875rem", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem" }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddSeg(false)}
                    style={{ borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)", background: "transparent", color: "var(--muted)", padding: "0.45rem 0.625rem", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metronome */}
        <div style={{ width: "100%", background: "var(--white)", borderRadius: "var(--radius-lg)", padding: "1rem 1.25rem", border: "1.5px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", color: "var(--charcoal)" }}>Metronome</span>
            <button
              onClick={() => {
                if (!metronome && !audioCtxRef.current) {
                  audioCtxRef.current = new AudioContext();
                }
                setMetronome((m) => !m);
              }}
              style={{
                background: metronome ? "var(--peach)" : "transparent",
                border: `1.5px solid ${metronome ? "var(--peach)" : "var(--border)"}`,
                borderRadius: 100, padding: "0.2rem 0.75rem", cursor: "pointer",
                fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem",
                color: metronome ? "white" : "var(--muted)", transition: "all 0.15s",
              }}
            >
              {metronome ? "On" : "Off"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button onClick={() => setBpm((b) => Math.max(40, b - 1))} style={{ width: 32, height: 32, borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--cream)", cursor: "pointer", fontWeight: 700, fontSize: "1.1rem" }}>−</button>
            <div style={{ flex: 1, textAlign: "center", fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "var(--charcoal)" }}>
              {bpm}<span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--muted)", marginLeft: 4 }}>BPM</span>
            </div>
            <button onClick={() => setBpm((b) => Math.min(220, b + 1))} style={{ width: 32, height: 32, borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--cream)", cursor: "pointer", fontWeight: 700, fontSize: "1.1rem" }}>+</button>
          </div>
          {metronome && (
            <div style={{ marginTop: "0.5rem", textAlign: "center", fontSize: "0.72rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
              Beat 1 accented · 4/4 time
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "1rem 1.25rem 2rem", display: "flex", justifyContent: "center", gap: "1.5rem", alignItems: "center" }}>
        {recording && (
          <button
            onClick={handlePause}
            style={{ width: 52, height: 52, borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--white)", cursor: "pointer", fontSize: "1.2rem" }}
          >
            ⏸
          </button>
        )}
        <button
          onClick={() => {
            if (recording) {
              handleDone();
            } else if (!hasStarted) {
              handleStartRecording();
            } else {
              handleResume();
            }
          }}
          style={{
            width: 72, height: 72, borderRadius: 100,
            background: recording ? "#E05050" : "var(--peach)",
            border: "none", cursor: "pointer", fontSize: "1.5rem",
            boxShadow: "0 4px 16px rgba(196,122,96,0.3)",
            transition: "background 0.2s",
          }}
        >
          {recording ? "⏹" : "⏺"}
        </button>
      </div>
    </div>
  );
}
