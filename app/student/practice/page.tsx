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

const AREAS: Record<string, { label: string }> = {
  technique:    { label: "Technique" },
  repertoire:   { label: "Repertoire" },
  ear_training: { label: "Ear Training" },
  theory:       { label: "Theory" },
};

type SegmentWithId = PracticeSegment & { id: string };

export default function PracticeRecorder() {
  const router = useRouter();
  const { user } = useAuth();
  const student = user as Student;

  const [recording, setRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentGoal, setCurrentGoal] = useState<GoalRow | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [bpm, setBpm] = useState(72);
  const [metronome, setMetronome] = useState(false);
  const [beats, setBeats] = useState(4);           // beats per bar
  const [accentOn, setAccentOn] = useState(true);  // accent the downbeat
  const [soundMode, setSoundMode] = useState<"click" | "voice">("click");

  const [segments, setSegments] = useState<SegmentWithId[]>([]);
  const [showAddSeg, setShowAddSeg] = useState(false);
  const [newSegTitle, setNewSegTitle] = useState("");
  const [newSegArea, setNewSegArea] = useState("technique");

  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [portfolioSave, setPortfolioSave] = useState(false);
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioDesc, setPortfolioDesc] = useState("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

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

  useEffect(() => {
    if (!metronome) return;
    const intervalMs = Math.round((60 / bpm) * 1000);
    let beat = 0;

    if (soundMode === "click") {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      function playTick(isAccent: boolean) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = isAccent ? 1100 : 800;
        gain.gain.setValueAtTime(isAccent ? 0.8 : 0.45, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      }

      playTick(accentOn); // beat 1
      const id = setInterval(() => {
        beat = (beat + 1) % beats;
        playTick(accentOn && beat === 0);
      }, intervalMs);
      return () => clearInterval(id);

    } else {
      // Voice counting via Web Speech API
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) return;

      function speak(n: number, isAccent: boolean) {
        synth!.cancel();
        const u = new SpeechSynthesisUtterance(String(n));
        u.rate = 3.5;
        u.volume = 1;
        u.pitch = isAccent ? 1.4 : 1.0;
        synth!.speak(u);
      }

      speak(1, accentOn);
      const id = setInterval(() => {
        beat = (beat + 1) % beats;
        speak(beat + 1, accentOn && beat === 0);
      }, intervalMs);
      return () => {
        clearInterval(id);
        synth.cancel();
      };
    }
  }, [metronome, bpm, beats, accentOn, soundMode]);

  function startWaveform(analyser: AnalyserNode) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    cancelAnimationFrame(animFrameRef.current);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
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
        const barH = Math.max(3, val * canvas.height * 0.85);
        const x = i * (barW + gap);
        const y = canvas.height - barH;
        ctx2d.fillStyle = `rgba(44, 40, 36, ${0.3 + val * 0.6})`;
        ctx2d.beginPath();
        ctx2d.roundRect(x, y, barW, barH, 1);
        ctx2d.fill();
      }
    };
    draw();
  }

  async function handleStartRecording() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    setHasStarted(true);
    setRecording(true);
    try {
      // Disable voice-call processing — these destroy musical quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        },
      });
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
        // Pick highest-quality supported codec
        const preferredTypes = [
          "audio/webm;codecs=opus",
          "audio/ogg;codecs=opus",
          "audio/mp4;codecs=aac",
          "audio/webm",
        ];
        const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? "";
        const recorderOpts: MediaRecorderOptions = { audioBitsPerSecond: 128000 };
        if (mimeType) recorderOpts.mimeType = mimeType;

        const recorder = new MediaRecorder(stream, recorderOpts);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
          setRecordingBlob(blob);
          setAudioBlobUrl(URL.createObjectURL(blob));
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      }
    } catch (err) {
      console.error("mic error:", err);
    }
  }

  function handlePause() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.pause();
    cancelAnimationFrame(animFrameRef.current);
    setRecording(false);
  }

  function handleResume() {
    if (mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.resume();
    if (analyserRef.current) startWaveform(analyserRef.current);
    setRecording(true);
  }

  function handleDone() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    cancelAnimationFrame(animFrameRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setDone(true);
  }

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  function handleAddSegment() {
    if (!newSegTitle.trim()) return;
    setSegments((prev) => [
      ...prev,
      { id: Date.now().toString(), title: newSegTitle.trim(), practice_area: newSegArea, start_seconds: elapsed },
    ]);
    setNewSegTitle("");
    setShowAddSeg(false);
  }

  async function handleSubmit() {
    if (!student?.studioId || elapsed < 1) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const practiceService = PracticeService.getInstance(supabase);
      const sessionSegments: PracticeSegment[] = segments.map(({ id: _id, ...s }) => s);

      let recordingUrl: string | undefined;
      if (recordingBlob) {
        const path = `${student.id}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("practice-recordings")
          .upload(path, recordingBlob, { contentType: "audio/webm", upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("practice-recordings").getPublicUrl(path);
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

      if (teacherId) {
        const mins = Math.max(1, Math.round(elapsed / 60));
        const lines: string[] = [
          `Practice session · ${mins} min${segments.length > 0 ? ` · ${segments.length} segment${segments.length !== 1 ? "s" : ""}` : ""}`,
        ];
        if (currentGoal) lines.push(`Goal: ${currentGoal.title}`);
        sessionSegments.forEach((s) =>
          lines.push(`${AREAS[s.practice_area]?.label ?? "Practice"}: ${s.title} · ${fmt(s.start_seconds)}`)
        );
        if (notes.trim()) lines.push(`Notes: "${notes.trim()}"`);
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

  // ── Done screen ──
  if (done) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "2rem", color: "var(--charcoal)", marginBottom: "0.5rem", letterSpacing: "-0.01em" }}>
          Session complete.
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "2rem", fontFamily: "Inter, sans-serif" }}>
          {fmt(elapsed)}{currentGoal ? ` · ${currentGoal.title}` : ""}
        </p>

        {audioBlobUrl && (
          <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1rem 1.25rem", marginBottom: "1rem", textAlign: "left" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>Your recording</div>
            <audio controls src={audioBlobUrl} style={{ width: "100%" }} />
          </div>
        )}

        {segments.length > 0 && (
          <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1rem 1.25rem", marginBottom: "1rem", textAlign: "left" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>Segments ({segments.length})</div>
            {segments.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>{s.title}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{AREAS[s.practice_area]?.label} · {fmt(s.start_seconds)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "1.25rem", textAlign: "left" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>Notes (optional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What went well? What was tricky?"
            style={{ width: "100%", borderRadius: 3, border: "1px solid var(--border)", padding: "0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", resize: "none", minHeight: 80, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {audioBlobUrl && (
          <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "1.25rem", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.125rem" }}>Save to Journey</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>Add this recording to your portfolio</div>
              </div>
              <button
                onClick={() => setPortfolioSave(v => !v)}
                style={{ width: 40, height: 22, borderRadius: 100, border: "none", flexShrink: 0, background: portfolioSave ? "var(--charcoal)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.15s" }}
              >
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: portfolioSave ? 21 : 3, transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
              </button>
            </div>
            {portfolioSave && (
              <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input
                  autoFocus
                  value={portfolioTitle}
                  onChange={e => setPortfolioTitle(e.target.value)}
                  placeholder="Piece name, e.g. Für Elise"
                  style={{ width: "100%", borderRadius: 3, border: "1px solid var(--border-strong)", padding: "0.575rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }}
                />
                <textarea
                  value={portfolioDesc}
                  onChange={e => setPortfolioDesc(e.target.value)}
                  placeholder="Notes about this recording... (optional)"
                  style={{ width: "100%", borderRadius: 3, border: "1px solid var(--border)", padding: "0.575rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box", resize: "none", minHeight: 52 }}
                />
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || (portfolioSave && !portfolioTitle.trim())}
          className="btn btn-primary"
          style={{ width: "100%", maxWidth: 320, padding: "0.875rem", fontSize: "0.9375rem" }}
        >
          {saving ? "Saving…" : portfolioSave ? "Submit & Save to Journey" : "Submit Session"}
        </button>
      </div>
    );
  }

  // ── Recording screen ──
  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem", padding: 0, fontFamily: "Inter, sans-serif" }}>←</button>
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", flex: 1 }}>Practice Session</span>
        {currentGoal && (
          <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", border: "1px solid var(--border)", padding: "0.2rem 0.625rem", borderRadius: 2, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentGoal.title}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center", overflowY: "auto" }}>
        {/* Timer */}
        <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
          <div className="timer-display" style={{ color: recording ? "var(--charcoal)" : "var(--muted)", transition: "color 0.3s" }}>
            {fmt(elapsed)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem", fontFamily: "Inter, sans-serif", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {recording ? "Recording" : hasStarted ? "Paused" : "Ready"}
          </div>
        </div>

        {/* Waveform */}
        <div style={{ width: "100%", height: 64, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
          {recording ? (
            <canvas ref={canvasRef} width={360} height={64} style={{ width: "100%", height: "100%", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 2, padding: "0 1rem", boxSizing: "border-box" }}>
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} style={{ width: 3, borderRadius: 1, flexShrink: 0, height: `${12 + Math.sin(i * 0.45) * 14 + 10}%`, background: hasStarted ? "var(--border-strong)" : "var(--border)" }} />
              ))}
            </div>
          )}
        </div>

        {/* Segments */}
        {hasStarted && (
          <div style={{ width: "100%", background: "var(--white)", borderRadius: 3, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderBottom: segments.length > 0 || showAddSeg ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>Segments {segments.length > 0 && `(${segments.length})`}</span>
              {!showAddSeg && (
                <button onClick={() => setShowAddSeg(true)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.2rem 0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)" }}>
                  + Add
                </button>
              )}
            </div>
            {segments.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 1rem", borderBottom: i < segments.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{AREAS[s.practice_area]?.label} · {fmt(s.start_seconds)}</div>
                </div>
                <button onClick={() => setSegments((prev) => prev.filter((x) => x.id !== s.id))} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", fontFamily: "Inter, sans-serif" }}>×</button>
              </div>
            ))}
            {showAddSeg && (
              <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: segments.length > 0 ? "1px solid var(--border)" : "none" }}>
                <input
                  autoFocus
                  value={newSegTitle}
                  onChange={(e) => setNewSegTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSegment(); if (e.key === "Escape") setShowAddSeg(false); }}
                  placeholder="What are you practicing?"
                  style={{ borderRadius: 3, border: "1px solid var(--border-strong)", padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", width: "100%", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select value={newSegArea} onChange={(e) => setNewSegArea(e.target.value)} style={{ flex: 1, borderRadius: 3, border: "1px solid var(--border)", padding: "0.45rem 0.5rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}>
                    {Object.entries(AREAS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <button onClick={handleAddSegment} style={{ borderRadius: 3, border: "none", background: "var(--charcoal)", color: "white", padding: "0.45rem 0.875rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem" }}>Add</button>
                  <button onClick={() => setShowAddSeg(false)} style={{ borderRadius: 3, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", padding: "0.45rem 0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>✕</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metronome */}
        <div style={{ width: "100%", background: "var(--white)", borderRadius: 3, padding: "1rem 1.25rem", border: "1px solid var(--border)" }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>Metronome</span>
            <button
              onClick={() => { if (!metronome && !audioCtxRef.current) audioCtxRef.current = new AudioContext(); setMetronome((m) => !m); }}
              style={{
                background: metronome ? "var(--charcoal)" : "transparent",
                border: `1px solid ${metronome ? "var(--charcoal)" : "var(--border-strong)"}`,
                borderRadius: 2, padding: "0.2rem 0.75rem", cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem",
                color: metronome ? "white" : "var(--muted)", transition: "all 0.15s",
              }}
            >
              {metronome ? "On" : "Off"}
            </button>
          </div>

          {/* BPM row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
            <button
              onClick={() => setBpm((b) => Math.max(40, b - 5))}
              onDoubleClick={() => setBpm((b) => Math.max(40, b - 1))}
              style={{ width: 32, height: 32, borderRadius: 2, border: "1px solid var(--border)", background: "var(--cream)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "1rem" }}
            >−</button>
            <div style={{ flex: 1, textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.5rem", color: "var(--charcoal)", letterSpacing: "-0.01em" }}>
              {bpm}<span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--muted)", marginLeft: 4, letterSpacing: "0.04em" }}>BPM</span>
            </div>
            <button
              onClick={() => setBpm((b) => Math.min(220, b + 5))}
              onDoubleClick={() => setBpm((b) => Math.min(220, b + 1))}
              style={{ width: 32, height: 32, borderRadius: 2, border: "1px solid var(--border)", background: "var(--cream)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "1rem" }}
            >+</button>
          </div>

          {/* Time signature row */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.375rem" }}>
              Beats per bar
            </div>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setBeats(n)}
                  style={{
                    flex: 1, height: 30, borderRadius: 2, cursor: "pointer",
                    fontFamily: "Inter, sans-serif", fontWeight: beats === n ? 600 : 400,
                    fontSize: "0.8125rem",
                    background: beats === n ? "var(--charcoal)" : "var(--cream)",
                    border: `1px solid ${beats === n ? "var(--charcoal)" : "var(--border)"}`,
                    color: beats === n ? "white" : "var(--muted)",
                    transition: "all 0.12s",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Options row — accent + sound mode */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {/* Accent toggle */}
            <button
              onClick={() => setAccentOn(a => !a)}
              style={{
                flex: 1, height: 30, borderRadius: 2, cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem",
                letterSpacing: "0.02em",
                background: accentOn ? "var(--sage-bg)" : "var(--cream)",
                border: `1px solid ${accentOn ? "var(--sage)" : "var(--border)"}`,
                color: accentOn ? "var(--sage)" : "var(--muted)",
                transition: "all 0.12s",
              }}
            >
              Accent ↓ 1
            </button>

            {/* Sound mode toggle */}
            <div style={{ flex: 1, display: "flex", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
              {(["click", "voice"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSoundMode(mode)}
                  style={{
                    flex: 1, height: 28, cursor: "pointer", border: "none",
                    fontFamily: "Inter, sans-serif", fontWeight: soundMode === mode ? 600 : 400,
                    fontSize: "0.6875rem", letterSpacing: "0.02em",
                    background: soundMode === mode ? "var(--charcoal)" : "transparent",
                    color: soundMode === mode ? "white" : "var(--muted)",
                    transition: "all 0.12s",
                  }}
                >
                  {mode === "click" ? "Click" : "Count"}
                </button>
              ))}
            </div>
          </div>

          {soundMode === "voice" && (
            <div style={{
              marginTop: "0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.6rem",
              color: "var(--muted)", letterSpacing: "0.02em", fontStyle: "italic",
            }}>
              Counting uses your browser&apos;s voice — works best at moderate tempos.
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "1rem 1.25rem 2rem", display: "flex", justifyContent: "center", gap: "1.25rem", alignItems: "center" }}>
        {recording && (
          <button onClick={handlePause} style={{ width: 48, height: 48, borderRadius: 3, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "1rem", color: "var(--charcoal)" }}>
            ⏸
          </button>
        )}
        <button
          onClick={() => { if (recording) handleDone(); else if (!hasStarted) handleStartRecording(); else handleResume(); }}
          style={{ width: 68, height: 68, borderRadius: "50%", background: recording ? "#8A3030" : "var(--charcoal)", border: "none", cursor: "pointer", fontSize: "1.25rem", transition: "background 0.2s", color: "white" }}
        >
          {recording ? "⏹" : "⏺"}
        </button>
      </div>
    </div>
  );
}
