"use client";
import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PracticeService } from "../../../lib/services/PracticeService";
import { PieceService } from "../../../lib/services/PieceService";
import { ChatService } from "../../../lib/services/ChatService";
import { PortfolioService } from "../../../lib/services/PortfolioService";
import { Student } from "../../../lib/models/Student";
import type { PracticeSegment } from "../../../lib/types";
import AudioPlayer from "../../../components/AudioPlayer";
import type { PieceWithGoals } from "../../../lib/services/PieceService";

type PracticeStep = "practice" | "reflect";
type SegmentWithId = PracticeSegment & { id: string };

const AREAS: Record<string, { label: string }> = {
  technique:    { label: "Technique" },
  repertoire:   { label: "Repertoire" },
  ear_training: { label: "Ear Training" },
  theory:       { label: "Theory" },
};

const MOODS = [
  { key: "hard",  emoji: "😓", label: "Hard" },
  { key: "okay",  emoji: "😐", label: "Okay" },
  { key: "good",  emoji: "😊", label: "Good" },
  { key: "great", emoji: "🌟", label: "Great" },
];

const CATEGORY_ORDER = ["technique", "etude", "repertoire", "theory", "ear_training", "sight_reading", "free"];
const CATEGORY_LABELS: Record<string, string> = {
  technique: "Technique", etude: "Études", repertoire: "Repertoire",
  theory: "Theory", ear_training: "Ear Training", sight_reading: "Sight Reading", free: "Other",
};

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function PracticeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const student = user as Student;

  const [step, setStep] = useState<PracticeStep>("practice");
  const [pieces, setPieces] = useState<PieceWithGoals[]>([]);
  const [loadingPieces, setLoadingPieces] = useState(true);
  const [selectedPieceId, setSelectedPieceId] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // "Working on" bottom sheet
  const [showWorkingOn, setShowWorkingOn] = useState(false);
  const [practiceYouTubeId, setPracticeYouTubeId] = useState<string | null>(null);
  // Metronome panel open
  const [showMetronome, setShowMetronome] = useState(false);

  // Practice state
  const [recording, setRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [bpm, setBpm] = useState(72);
  const [metronome, setMetronome] = useState(false);
  const [beats, setBeats] = useState(4);
  const [accentOn, setAccentOn] = useState(true);
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

  // Reflect state
  const [mood, setMood] = useState<string>("");
  const [wentWell, setWentWell] = useState("");
  const [focusNext, setFocusNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Load pieces + teacher id ──
  const load = useCallback(async () => {
    if (!student?.id || !student?.studioId) return;
    setLoadingPieces(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const [data, studioRes] = await Promise.all([
        PieceService.getInstance(supabase).getStudentPieces(student.id),
        supabase.from("studios").select("owner_id").eq("id", student.studioId).single(),
      ]);
      setPieces(data);
      setTeacherId(studioRes.data?.owner_id ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPieces(false);
    }
  }, [student?.id, student?.studioId]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-select piece from ?pieceId= query param ──
  useEffect(() => {
    const pid = searchParams.get("pieceId");
    if (pid && pieces.length > 0) {
      const found = pieces.find(p => p.id === pid);
      if (found) {
        setSelectedPieceId(pid);
        const primary = found.recordings.find(r => r.is_primary) ?? found.recordings[0];
        setPracticeYouTubeId(primary?.youtube_id ?? null);
      }
    }
  }, [searchParams, pieces]);

  // ── Timer ──
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // ── Metronome ──
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
      playTick(accentOn);
      const id = setInterval(() => {
        beat = (beat + 1) % beats;
        playTick(accentOn && beat === 0);
      }, intervalMs);
      return () => clearInterval(id);
    } else {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) return;
      function speak(n: number, isAccent: boolean) {
        synth!.cancel();
        const u = new SpeechSynthesisUtterance(String(n));
        u.rate = 3.5; u.volume = 1; u.pitch = isAccent ? 1.4 : 1.0;
        synth!.speak(u);
      }
      speak(1, accentOn);
      const id = setInterval(() => {
        beat = (beat + 1) % beats;
        speak(beat + 1, accentOn && beat === 0);
      }, intervalMs);
      return () => { clearInterval(id); synth.cancel(); };
    }
  }, [metronome, bpm, beats, accentOn, soundMode]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // ── Waveform ──
  function startWaveform(analyser: AnalyserNode) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    cancelAnimationFrame(animFrameRef.current);
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

  // ── Recording controls ──
  async function handleStartRecording() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    setHasStarted(true);
    setRecording(true);
    try {
      // Keep constraints minimal — iOS Safari rejects sampleRate and other advanced hints
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
        const preferredTypes = ["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4;codecs=aac","audio/webm"];
        const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? "";
        const recorderOpts: MediaRecorderOptions = { audioBitsPerSecond: 128000 };
        if (mimeType) recorderOpts.mimeType = mimeType;
        const recorder = new MediaRecorder(stream, recorderOpts);
        chunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
          setRecordingBlob(blob);
          const url = URL.createObjectURL(blob);
          // WebM blobs from MediaRecorder lack duration metadata — the browser
          // guesses wrong, making the seek bar appear sped up. Seeking to a huge
          // timestamp forces it to scan the file and compute the real duration.
          const audio = document.createElement("audio");
          audio.src = url;
          audio.addEventListener("loadedmetadata", () => {
            if (audio.duration === Infinity) {
              audio.currentTime = 1e101;
              audio.addEventListener("timeupdate", () => {
                audio.currentTime = 0;
                setAudioBlobUrl(url);
              }, { once: true });
            } else {
              setAudioBlobUrl(url);
            }
          });
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      }
    } catch (err) { console.error("mic error:", err); }
  }

  function handlePause() {
    // MediaRecorder.pause() is not supported on iOS Safari — skip gracefully
    try { if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.pause(); } catch {}
    cancelAnimationFrame(animFrameRef.current);
    setRecording(false);
  }

  function handleResume() {
    // MediaRecorder.resume() is not supported on iOS Safari — skip gracefully
    try { if (mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.resume(); } catch {}
    if (analyserRef.current) startWaveform(analyserRef.current);
    setRecording(true);
  }

  function handleStopPractice() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    cancelAnimationFrame(animFrameRef.current);
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
    setStep("reflect");
  }

  function handleAddSegment() {
    if (!newSegTitle.trim()) return;
    setSegments(prev => [...prev, { id: Date.now().toString(), title: newSegTitle.trim(), practice_area: newSegArea, start_seconds: elapsed }]);
    setNewSegTitle("");
    setShowAddSeg(false);
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!student?.studioId) {
      setSaveError("You're not connected to a studio. Please sign out and rejoin.");
      return;
    }
    setSaving(true);
    setSaveError(null);
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

      const moodData = MOODS.find(m => m.key === mood);
      const notesParts: string[] = [];
      if (moodData) notesParts.push(`[mood:${mood}]`);
      if (wentWell.trim()) notesParts.push(`Well: ${wentWell.trim()}`);
      if (focusNext.trim()) notesParts.push(`Focus: ${focusNext.trim()}`);
      const notesStr = notesParts.join(" | ") || undefined;

      const sessionData = await practiceService.logSession({
        studentId: student.id,
        studioId: student.studioId,
        pieceId: selectedPieceId || undefined,
        durationSeconds: elapsed,
        notes: notesStr,
        segments: sessionSegments.length > 0 ? sessionSegments : undefined,
        recordingUrl,
      });

      // Fire AI analysis in background — don't block submit flow
      if (recordingUrl && sessionData?.id) {
        fetch("/api/practice/analyze-recording", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionData.id }),
        }).catch(() => {});
      }

      const selectedPiece = pieces.find(p => p.id === selectedPieceId);

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
        const lines: string[] = [];
        if (selectedPiece) lines.push(`🎵 Practiced: ${selectedPiece.title}${selectedPiece.composer ? ` — ${selectedPiece.composer}` : ""}`);
        lines.push(`⏱ ${mins} min${moodData ? `  |  Mood: ${moodData.emoji} ${moodData.label}` : ""}${sessionSegments.length > 0 ? `  |  ${sessionSegments.length} segment${sessionSegments.length !== 1 ? "s" : ""}` : ""}`);
        if (wentWell.trim()) lines.push(`✅ Went well: ${wentWell.trim()}`);
        if (focusNext.trim()) lines.push(`🎯 Focus next: ${focusNext.trim()}`);
        sessionSegments.forEach(s =>
          lines.push(`${AREAS[s.practice_area]?.label ?? "Practice"}: ${s.title} · ${fmt(s.start_seconds)}`)
        );
        if (recordingUrl) lines.push(`AUDIO:${recordingUrl}`);
        if (sessionData?.id) lines.push(`SESSION:${sessionData.id}`);

        try {
          await ChatService.getInstance(supabase).postSystemMessage(
            student.studioId, student.id, teacherId, lines.join("\n")
          );
        } catch (chatErr) {
          console.error("system message error:", chatErr);
        }
      }

      router.replace("/student");
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? JSON.stringify(err);
      console.error("handleSubmit error:", err);
      setSaveError(msg);
      setSaving(false);
    }
  }

  const selectedPiece = pieces.find(p => p.id === selectedPieceId) ?? null;
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, label: CATEGORY_LABELS[cat], items: pieces.filter(p => p.category === cat) }))
    .filter(g => g.items.length > 0);

  // ──────────────────────────────────────────────────────────────────
  // PRACTICE
  // ──────────────────────────────────────────────────────────────────
  if (step === "practice") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedPiece ? selectedPiece.title : "Practice Session"}
          </span>
          {selectedPiece?.sheet_music_url && (
            <button
              onClick={() => window.open(selectedPiece.sheet_music_url!, "_blank")}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.2rem 0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              📄 Sheet
            </button>
          )}
        </div>

        {/* Main practice area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.25rem 1.5rem", gap: "1.5rem" }}>

          {/* Timer */}
          <div style={{ textAlign: "center" }}>
            <div className="timer-display" style={{ color: recording ? "var(--charcoal)" : "var(--muted)", transition: "color 0.3s", fontSize: "clamp(3.5rem, 14vw, 5rem)", fontWeight: 200, letterSpacing: "-0.03em", fontFamily: "Inter, sans-serif" }}>
              {fmt(elapsed)}
            </div>
            <div style={{ fontSize: "0.75rem", color: recording ? "#3D6B55" : "var(--muted)", marginTop: "0.5rem", fontFamily: "Inter, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>
              {recording ? "● Recording" : hasStarted ? "Paused" : "Ready to play"}
            </div>
          </div>

          {/* Waveform */}
          <div style={{ width: "100%", maxWidth: 360, height: 56, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            {recording ? (
              <canvas ref={canvasRef} width={360} height={56} style={{ width: "100%", height: "100%", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 2, padding: "0 1rem", boxSizing: "border-box" }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} style={{ width: 3, borderRadius: 1, flexShrink: 0, height: `${12 + Math.sin(i * 0.45) * 14 + 10}%`, background: hasStarted ? "var(--border-strong)" : "var(--border)" }} />
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", alignItems: "center" }}>
            {/* Pause (only while recording) */}
            {recording && (
              <button onClick={handlePause} style={{ width: 52, height: 52, borderRadius: "50%", border: "1.5px solid var(--border-strong)", background: "var(--white)", cursor: "pointer", fontSize: "1.125rem", color: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ⏸
              </button>
            )}

            {/* Main record / resume button */}
            <button
              onClick={() => {
                if (recording) handleStopPractice();
                else if (!hasStarted) handleStartRecording();
                else handleResume();
              }}
              style={{
                width: 80, height: 80, borderRadius: "50%",
                background: recording ? "#8A3030" : "var(--charcoal)",
                border: "none", cursor: "pointer",
                fontSize: "1.5rem", transition: "background 0.2s",
                color: "var(--white)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: recording ? "0 0 0 6px rgba(138,48,48,0.15)" : "0 4px 16px rgba(44,40,36,0.2)",
              }}
            >
              {recording ? "⏹" : "⏺"}
            </button>

            {/* End session (only when paused after starting) */}
            {hasStarted && !recording && (
              <button
                onClick={handleStopPractice}
                style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: "var(--charcoal)", color: "var(--white)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.04em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                Done
              </button>
            )}
          </div>
        </div>

        {/* "What I'm working on" tap strip */}
        <div style={{ padding: "0 1.25rem 0.75rem" }}>
          <button
            onClick={() => setShowWorkingOn(true)}
            style={{
              width: "100%", background: "var(--white)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "0.875rem 1.125rem",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <span style={{ fontSize: "1rem" }}>🎵</span>
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                  {selectedPiece ? selectedPiece.title : "What are you working on?"}
                </div>
                {segments.length > 0 && (
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                    {segments.length} segment{segments.length !== 1 ? "s" : ""} logged
                  </div>
                )}
                {!selectedPiece && segments.length === 0 && (
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                    Tap to add a piece or notes
                  </div>
                )}
              </div>
            </div>
            <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>›</span>
          </button>
        </div>

        {/* Metronome toggle strip */}
        <div style={{ padding: "0 1.25rem 2rem" }}>
          <div style={{ background: "var(--white)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
            <button
              onClick={() => setShowMetronome(m => !m)}
              style={{ width: "100%", background: "none", border: "none", padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span style={{ fontSize: "1rem" }}>🎚</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                  Metronome {metronome && <span style={{ color: "#3D6B55", fontSize: "0.75rem" }}>● {bpm} BPM</span>}
                </span>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "0.875rem", transition: "transform 0.2s", display: "inline-block", transform: showMetronome ? "rotate(90deg)" : "none" }}>›</span>
            </button>

            {showMetronome && (
              <div style={{ padding: "0 1.125rem 1rem", borderTop: "1px solid var(--border)" }}>
                {/* On/off + BPM row */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.875rem", marginBottom: "0.875rem" }}>
                  <button
                    onClick={() => { if (!metronome && !audioCtxRef.current) audioCtxRef.current = new AudioContext(); setMetronome(m => !m); }}
                    style={{ background: metronome ? "var(--charcoal)" : "transparent", border: `1px solid ${metronome ? "var(--charcoal)" : "var(--border-strong)"}`, borderRadius: 2, padding: "0.25rem 0.75rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: metronome ? "var(--white)" : "var(--muted)", transition: "all 0.15s", flexShrink: 0 }}
                  >
                    {metronome ? "On" : "Off"}
                  </button>
                  <button onClick={() => setBpm(b => Math.max(40, b - 5))} style={{ width: 30, height: 30, borderRadius: 2, border: "1px solid var(--border)", background: "var(--cream)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "1rem" }}>−</button>
                  <div style={{ flex: 1, textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.375rem", color: "var(--charcoal)", letterSpacing: "-0.01em" }}>
                    {bpm}<span style={{ fontSize: "0.6875rem", fontWeight: 400, color: "var(--muted)", marginLeft: 3, letterSpacing: "0.04em" }}>BPM</span>
                  </div>
                  <button onClick={() => setBpm(b => Math.min(220, b + 5))} style={{ width: 30, height: 30, borderRadius: 2, border: "1px solid var(--border)", background: "var(--cream)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "1rem" }}>+</button>
                </div>
                {/* Beats */}
                <div style={{ marginBottom: "0.625rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.375rem" }}>Beats per bar</div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {[2, 3, 4, 5, 6].map(n => (
                      <button key={n} onClick={() => setBeats(n)} style={{ flex: 1, height: 28, borderRadius: 2, cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: beats === n ? 600 : 400, fontSize: "0.8125rem", background: beats === n ? "var(--charcoal)" : "var(--cream)", border: `1px solid ${beats === n ? "var(--charcoal)" : "var(--border)"}`, color: beats === n ? "var(--white)" : "var(--muted)", transition: "all 0.12s" }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Accent + sound mode */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => setAccentOn(a => !a)} style={{ flex: 1, height: 28, borderRadius: 2, cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.02em", background: accentOn ? "var(--sage-bg)" : "var(--cream)", border: `1px solid ${accentOn ? "var(--sage)" : "var(--border)"}`, color: accentOn ? "var(--sage)" : "var(--muted)", transition: "all 0.12s" }}>
                    Accent ↓ 1
                  </button>
                  <div style={{ flex: 1, display: "flex", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
                    {(["click", "voice"] as const).map(mode => (
                      <button key={mode} onClick={() => setSoundMode(mode)} style={{ flex: 1, height: 26, cursor: "pointer", border: "none", fontFamily: "Inter, sans-serif", fontWeight: soundMode === mode ? 600 : 400, fontSize: "0.6875rem", letterSpacing: "0.02em", background: soundMode === mode ? "var(--charcoal)" : "transparent", color: soundMode === mode ? "var(--white)" : "var(--muted)", transition: "all 0.12s" }}>
                        {mode === "click" ? "Click" : "Count"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── "Working on" bottom sheet ── */}
        {showWorkingOn && (
          <div
            onClick={() => setShowWorkingOn(false)}
            style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(44,40,36,0.45)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "var(--white)", borderRadius: "14px 14px 0 0", padding: "1.5rem 1.25rem 2.5rem", maxHeight: "80vh", overflowY: "auto" }}
            >
              {/* Sheet handle */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)", margin: "0 auto 1.25rem" }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)" }}>What I&apos;m working on</span>
                <button onClick={() => setShowWorkingOn(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.25rem", padding: "0 0.25rem" }}>×</button>
              </div>

              {/* Piece selector */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>
                  Piece
                </label>
                {loadingPieces ? (
                  <div className="skeleton" style={{ height: 40, borderRadius: 3 }} />
                ) : (
                  <select
                    value={selectedPieceId}
                    onChange={e => {
                      const pid = e.target.value;
                      setSelectedPieceId(pid);
                      if (pid) {
                        const p = pieces.find(x => x.id === pid);
                        const primary = p?.recordings.find(r => r.is_primary) ?? p?.recordings[0];
                        setPracticeYouTubeId(primary?.youtube_id ?? null);
                      } else {
                        setPracticeYouTubeId(null);
                      }
                    }}
                    style={{ width: "100%", borderRadius: 6, border: "1.5px solid var(--border-strong)", padding: "0.75rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}
                  >
                    <option value="">— no piece selected —</option>
                    {grouped.map(g => (
                      <optgroup key={g.cat} label={g.label}>
                        {g.items.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.title}{p.composer ? ` — ${p.composer}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>

              {/* Reference recording (if piece has one) */}
              {selectedPiece && selectedPiece.recordings.length > 0 && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>Reference</div>
                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: practiceYouTubeId ? "0.625rem" : 0 }}>
                    {selectedPiece.recordings.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setPracticeYouTubeId(practiceYouTubeId === r.youtube_id ? null : r.youtube_id)}
                        style={{ padding: "0.3rem 0.625rem", borderRadius: 3, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500, background: practiceYouTubeId === r.youtube_id ? "var(--charcoal)" : "var(--cream)", color: practiceYouTubeId === r.youtube_id ? "var(--white)" : "var(--charcoal)", border: `1px solid ${practiceYouTubeId === r.youtube_id ? "var(--charcoal)" : "var(--border)"}`, transition: "all 0.15s" }}
                      >
                        {practiceYouTubeId === r.youtube_id ? "▶ Playing" : (r.is_primary ? "★ Listen" : "▶ " + r.title.slice(0, 20))}
                      </button>
                    ))}
                  </div>
                  {practiceYouTubeId && (
                    <div style={{ borderRadius: 6, overflow: "hidden", aspectRatio: "16/9" }}>
                      <iframe key={practiceYouTubeId} src={`https://www.youtube.com/embed/${practiceYouTubeId}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
                    </div>
                  )}
                </div>
              )}

              {/* Segments */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Segments {segments.length > 0 && `(${segments.length})`}
                  </span>
                  {!showAddSeg && (
                    <button onClick={() => setShowAddSeg(true)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)" }}>
                      + Add
                    </button>
                  )}
                </div>

                {segments.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0", borderTop: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{AREAS[s.practice_area]?.label} · {fmt(s.start_seconds)}</div>
                    </div>
                    <button onClick={() => setSegments(prev => prev.filter(x => x.id !== s.id))} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.125rem", padding: "0 0.25rem", lineHeight: 1 }}>×</button>
                  </div>
                ))}

                {showAddSeg && (
                  <div style={{ paddingTop: "0.75rem", borderTop: segments.length > 0 ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <input
                      autoFocus
                      value={newSegTitle}
                      onChange={e => setNewSegTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAddSegment(); if (e.key === "Escape") setShowAddSeg(false); }}
                      placeholder={`What are you working on? (${fmt(elapsed)})`}
                      style={{ borderRadius: 6, border: "1.5px solid var(--border-strong)", padding: "0.625rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", width: "100%", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <select value={newSegArea} onChange={e => setNewSegArea(e.target.value)} style={{ flex: 1, borderRadius: 6, border: "1px solid var(--border)", padding: "0.5rem 0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}>
                        {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={handleAddSegment} style={{ borderRadius: 6, border: "none", background: "var(--charcoal)", color: "var(--white)", padding: "0.5rem 1rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem" }}>Add</button>
                      <button onClick={() => setShowAddSeg(false)} style={{ borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", padding: "0.5rem 0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowWorkingOn(false)}
                style={{ marginTop: "1.5rem", width: "100%", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 8, padding: "0.875rem", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer" }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // REFLECT
  // ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "2rem", color: "var(--charcoal)", marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>
        Session complete.
      </h2>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.75rem", fontFamily: "Inter, sans-serif" }}>
        {fmt(elapsed)}{selectedPiece ? ` · ${selectedPiece.title}` : ""}
      </p>

      {/* Mood picker */}
      <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "1rem", textAlign: "left" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>How did it feel?</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {MOODS.map(m => (
            <button
              key={m.key}
              onClick={() => setMood(m.key)}
              style={{ flex: 1, padding: "0.5rem 0.25rem", borderRadius: 3, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", background: mood === m.key ? "var(--charcoal)" : "var(--cream)", border: `1.5px solid ${mood === m.key ? "var(--charcoal)" : "var(--border)"}`, transition: "all 0.15s" }}
            >
              <span style={{ fontSize: "1.375rem", lineHeight: 1 }}>{m.emoji}</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 500, letterSpacing: "0.04em", color: mood === m.key ? "var(--white)" : "var(--muted)", textTransform: "uppercase" }}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reflection textareas */}
      <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "1rem", textAlign: "left" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>What went well?</div>
        <textarea value={wentWell} onChange={e => setWentWell(e.target.value)} placeholder="e.g. The tricky passage in bar 8 is clicking…" style={{ width: "100%", borderRadius: 3, border: "1px solid var(--border)", padding: "0.625rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", resize: "none", minHeight: 60, outline: "none", boxSizing: "border-box" }} />
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0.75rem 0 0.5rem" }}>Focus next time</div>
        <textarea value={focusNext} onChange={e => setFocusNext(e.target.value)} placeholder="e.g. Work on the dynamics in the second section…" style={{ width: "100%", borderRadius: 3, border: "1px solid var(--border)", padding: "0.625rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", resize: "none", minHeight: 60, outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Audio recording review */}
      {audioBlobUrl && (
        <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1rem 1.25rem", marginBottom: "1rem", textAlign: "left" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>Your recording</div>
          <AudioPlayer src={audioBlobUrl} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.875rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.125rem" }}>Save to Journey</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>Add to your portfolio</div>
            </div>
            <button onClick={() => setPortfolioSave(v => !v)} style={{ width: 40, height: 22, borderRadius: 100, border: "none", flexShrink: 0, background: portfolioSave ? "var(--charcoal)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: portfolioSave ? 21 : 3, transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
            </button>
          </div>
          {portfolioSave && (
            <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input autoFocus value={portfolioTitle} onChange={e => setPortfolioTitle(e.target.value)} placeholder="Piece name, e.g. Für Elise" style={{ width: "100%", borderRadius: 3, border: "1px solid var(--border-strong)", padding: "0.575rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }} />
              <textarea value={portfolioDesc} onChange={e => setPortfolioDesc(e.target.value)} placeholder="Notes about this recording… (optional)" style={{ width: "100%", borderRadius: 3, border: "1px solid var(--border)", padding: "0.575rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box", resize: "none", minHeight: 52 }} />
            </div>
          )}
        </div>
      )}

      {saveError && (
        <div style={{ width: "100%", maxWidth: 320, marginBottom: "0.75rem", background: "#fff1f0", border: "1px solid #ffccc7", borderRadius: 6, padding: "0.75rem 1rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b", textAlign: "left", lineHeight: 1.5 }}>
          <strong>Could not save:</strong> {saveError}
        </div>
      )}

      <button onClick={handleSubmit} disabled={saving || (portfolioSave && !portfolioTitle.trim())} className="btn btn-primary" style={{ width: "100%", maxWidth: 320, padding: "0.875rem", fontSize: "0.9375rem" }}>
        {saving ? "Saving…" : "Save & Send Report"}
      </button>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--cream)" }} />}>
      <PracticeInner />
    </Suspense>
  );
}
