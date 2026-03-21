"use client";
import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PieceService } from "../../../lib/services/PieceService";
import { ChatService } from "../../../lib/services/ChatService";
import { PortfolioService } from "../../../lib/services/PortfolioService";
import { Student } from "../../../lib/models/Student";
import type { PracticeSegment } from "../../../lib/types";
import AudioPlayer from "../../../components/AudioPlayer";
import { usePractice } from "../../../lib/context/PracticeContext";
import type { PieceWithGoals } from "../../../lib/services/PieceService";
import Metronome from "../../../components/Metronome";
import { useI18n } from "../../../lib/context/I18nContext";
import { Frown, Smile, PartyPopper, FileText, Circle, Square, Pause, Music, Play, Star, X, Lock, Scissors } from "lucide-react";
import { loadDraft, clearDraft, type PracticeDraft } from "../../../lib/practiceDb";
import type { ClipResult } from "../../../lib/context/PracticeContext";

type PracticeStep = "practice" | "reflect";
type SegmentWithId = PracticeSegment & { id: string };

const CATEGORY_ORDER = ["technique", "etude", "repertoire", "theory", "ear_training", "sight_reading", "free"];

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function PracticeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useAuth();
  const student = user as Student;
  const practice = usePractice();
  const { t } = useI18n();
  const { isActive, recording, elapsed, analyserNode, clipping, clipCount, clipElapsed } = practice;
  const hasStarted = isActive;

  const AREAS: Record<string, { label: string }> = {
    technique:    { label: t.teacher.categoryTechnique },
    repertoire:   { label: t.teacher.categoryRepertoire },
    ear_training: { label: t.teacher.categoryEarTraining },
    theory:       { label: t.teacher.categoryTheory },
  };

  const MOODS = [
    { key: "hard",  icon: <Frown size={22} strokeWidth={1.5} />, label: t.student.moodHard },
    { key: "okay",  icon: <Smile size={22} strokeWidth={1.5} />, label: t.student.moodOkay },
    { key: "good",  icon: <Smile size={22} strokeWidth={1.5} />, label: t.student.moodGood },
    { key: "great", icon: <PartyPopper size={22} strokeWidth={1.5} />, label: t.student.moodGreat },
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    technique:    t.teacher.categoryTechnique,
    etude:        t.teacher.categoryEtude,
    repertoire:   t.teacher.categoryRepertoire,
    theory:       t.teacher.categoryTheory,
    ear_training: t.teacher.categoryEarTraining,
    sight_reading:t.teacher.categorySightReading,
    free:         t.teacher.categoryOther,
  };

  const [step, setStep] = useState<PracticeStep>("practice");
  const [recoveryDraft, setRecoveryDraft] = useState<PracticeDraft | null>(null);
  const [pieces, setPieces] = useState<PieceWithGoals[]>([]);
  const [loadingPieces, setLoadingPieces] = useState(true);
  const [selectedPieceId, setSelectedPieceId] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // "Working on" bottom sheet
  const [showWorkingOn, setShowWorkingOn] = useState(false);
  const [practiceYouTubeId, setPracticeYouTubeId] = useState<string | null>(null);
  // Metronome panel open
  const [showMetronome, setShowMetronome] = useState(false);

  const [segments, setSegments] = useState<SegmentWithId[]>([]);
  const [showAddSeg, setShowAddSeg] = useState(false);
  const [newSegTitle, setNewSegTitle] = useState("");
  const [newSegArea, setNewSegArea] = useState("technique");

  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [clipBlobs, setClipBlobs] = useState<ClipResult[]>([]);
  const [finalElapsed, setFinalElapsed] = useState(0);
  const [portfolioSave, setPortfolioSave] = useState(false);
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioDesc, setPortfolioDesc] = useState("");
  const [portfolioDisplayAs, setPortfolioDisplayAs] = useState<"real" | "alias" | "anonymous">("real");
  const [artistName, setArtistName] = useState<string | null>(null);

  // Reflect state
  const [mood, setMood] = useState<string>("");
  const [wentWell, setWentWell] = useState("");
  const [focusNext, setFocusNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Load pieces + teacher id ──
  const load = useCallback(async () => {
    if (!student?.id || !student?.studioId) return;
    setLoadingPieces(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const [data, studioRes] = await Promise.all([
        PieceService.create(supabase).getStudentPieces(student.id),
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

  // ── Load artist name for privacy picker ──
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await getSupabaseBrowserClient().from("profiles").select("artist_name").eq("id", user.id).single();
      setArtistName((data as { artist_name?: string | null } | null)?.artist_name ?? null);
    })();
  }, [user?.id]);

  // ── Check for a crash-recovery draft ──
  useEffect(() => {
    if (isActive) return; // session already running, no need to recover
    loadDraft().then(draft => {
      if (draft && draft.chunks.length > 0) setRecoveryDraft(draft);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

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

  // ── Waveform from context analyser ──
  useEffect(() => {
    if (!recording || !analyserNode) { cancelAnimationFrame(animFrameRef.current); return; }
    startWaveform(analyserNode);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [recording, analyserNode]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
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

  // ── Recording controls (delegated to PracticeContext) ──
  async function handleStartRecording() {
    try {
      await practice.startPractice();
    } catch (err) { console.error("mic error:", err); }
  }

  function handlePause() {
    practice.pausePractice();
    cancelAnimationFrame(animFrameRef.current);
  }

  function handleResume() {
    practice.resumePractice();
  }

  function handleStartClip() {
    practice.startClip();
  }

  async function handleStopClip() {
    const clip = await practice.stopClip();
    if (clip) setClipBlobs(prev => [...prev, clip]);
  }

  async function handleStopPractice() {
    cancelAnimationFrame(animFrameRef.current);
    const { blob, elapsed: finalElapsed } = await practice.finishPractice();
    if (blob) {
      setRecordingBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioBlobUrl(url);
    }
    setFinalElapsed(finalElapsed);
    setStep("reflect");
  }

  function handleRecoverDraft() {
    if (!recoveryDraft) return;
    const blob = new Blob(recoveryDraft.chunks, { type: recoveryDraft.mimeType || "audio/webm" });
    setRecordingBlob(blob);
    setAudioBlobUrl(URL.createObjectURL(blob));
    setFinalElapsed(recoveryDraft.elapsed);
    setRecoveryDraft(null);
    void clearDraft();
    setStep("reflect");
  }

  function handleDiscardDraft() {
    setRecoveryDraft(null);
    void clearDraft();
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
      const sessionSegments: PracticeSegment[] = segments.map(({ id: _id, ...s }) => s);

      // Upload private session blob
      let recordingUrl: string | undefined;
      if (recordingBlob) {
        const ext = recordingBlob.type.includes("ogg") ? "ogg" : recordingBlob.type.includes("mp4") ? "mp4" : "webm";
        const path = `${student.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("practice-recordings")
          .upload(path, recordingBlob, { contentType: recordingBlob.type || "audio/webm", upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("practice-recordings").getPublicUrl(path);
          recordingUrl = urlData.publicUrl;
        } else {
          console.error("upload error:", uploadError.message);
        }
      }

      // Upload teacher clips
      const clipUrls: string[] = [];
      for (const clip of clipBlobs) {
        const ext = clip.blob.type.includes("ogg") ? "ogg" : clip.blob.type.includes("mp4") ? "mp4" : "webm";
        const path = `${student.id}/clip_${Date.now()}_${clip.index}.${ext}`;
        const { error } = await supabase.storage
          .from("practice-recordings")
          .upload(path, clip.blob, { contentType: clip.blob.type || "audio/webm", upsert: false });
        if (!error) {
          const { data: urlData } = supabase.storage.from("practice-recordings").getPublicUrl(path);
          clipUrls.push(urlData.publicUrl);
        }
      }

      const moodData = MOODS.find(m => m.key === mood);
      const notesParts: string[] = [];
      if (moodData) notesParts.push(`[mood:${mood}]`);
      if (wentWell.trim()) notesParts.push(`Well: ${wentWell.trim()}`);
      if (focusNext.trim()) notesParts.push(`Focus: ${focusNext.trim()}`);
      const notesStr = notesParts.join(" | ") || undefined;

      const logRes = await fetch("/api/practice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId: student.studioId,
          pieceId: selectedPieceId || undefined,
          durationSeconds: finalElapsed,
          notes: notesStr,
          segments: sessionSegments.length > 0 ? sessionSegments : undefined,
          recordingUrl,
          isPrivate: true,
        }),
      });
      if (!logRes.ok) throw new Error("Failed to save session");
      const { session: sessionData } = await logRes.json() as { session: { id: string } };

      // Save clips to practice_clips table
      if (clipUrls.length > 0 && sessionData?.id) {
        const clipRows = clipUrls.map((url, i) => ({
          session_id: sessionData.id,
          student_id: student.id,
          recording_url: url,
          duration_seconds: Math.round((clipBlobs[i].endElapsed - clipBlobs[i].startElapsed)),
          clip_index: i,
        }));
        await supabase.from("practice_clips").insert(clipRows);
      }

      // Refresh auth context so streak/points update immediately on home screen
      await refresh();

      // Fire AI analysis in background — only if clips were sent to teacher
      if (clipUrls.length > 0 && sessionData?.id) {
        fetch("/api/practice/analyze-recording", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionData.id }),
        }).catch(() => {});
      }

      const selectedPiece = pieces.find(p => p.id === selectedPieceId);

      if (portfolioSave && portfolioTitle.trim()) {
        await PortfolioService.create(supabase).addItem({
          studentId: student.id,
          studioId: student.studioId ?? undefined,
          title: portfolioTitle.trim(),
          description: portfolioDesc.trim() || undefined,
          recordingUrl,
          sessionId: sessionData.id,
          displayAs: portfolioDisplayAs,
        }).catch((err) => { console.error("Portfolio save failed:", err); });
      }

      if (teacherId) {
        const mins = Math.max(1, Math.round(finalElapsed / 60));
        const lines: string[] = [];
        if (selectedPiece) lines.push(`🎵 Practiced: ${selectedPiece.title}${selectedPiece.composer ? ` — ${selectedPiece.composer}` : ""}`);
        lines.push(`⏱ ${mins} min${moodData ? `  |  Mood: ${moodData.label}` : ""}${sessionSegments.length > 0 ? `  |  ${sessionSegments.length} segment${sessionSegments.length !== 1 ? "s" : ""}` : ""}`);
        if (wentWell.trim()) lines.push(`✅ Went well: ${wentWell.trim()}`);
        if (focusNext.trim()) lines.push(`🎯 Focus next: ${focusNext.trim()}`);
        sessionSegments.forEach(s =>
          lines.push(`${AREAS[s.practice_area]?.label ?? "Practice"}: ${s.title} · ${fmt(s.start_seconds)}`)
        );
        clipUrls.forEach((url, i) => lines.push(`CLIP_${i + 1}:${url}`));
        if (sessionData?.id) lines.push(`SESSION:${sessionData.id}`);

        try {
          await ChatService.create(supabase).postSystemMessage(
            student.studioId, student.id, teacherId, lines.join("\n")
          );
        } catch (chatErr) {
          console.error("system message error:", chatErr);
        }
      }

      router.replace(`/student/practice/recap/${sessionData.id}`);
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

        {/* Draft recovery banner */}
        {recoveryDraft && (
          <div style={{ background: "#FFF8E1", borderBottom: "1px solid #FFE082", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1rem" }}>💾</span>
            <div style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#5D4037" }}>
              <strong>Unsaved recording found</strong> — {fmt(recoveryDraft.elapsed)} from earlier
            </div>
            <button
              onClick={handleRecoverDraft}
              style={{ padding: "0.3rem 0.75rem", borderRadius: 6, border: "none", background: "#3D6B55", color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", flexShrink: 0 }}
            >
              Recover
            </button>
            <button
              onClick={handleDiscardDraft}
              style={{ padding: "0.3rem 0.5rem", borderRadius: 6, border: "1px solid #FFE082", background: "transparent", color: "#8D6E63", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", flexShrink: 0 }}
            >
              Discard
            </button>
          </div>
        )}

        {/* Header */}
        <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => router.push("/student")} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedPiece ? selectedPiece.title : t.student.practiceSession}
          </span>
          {selectedPiece?.sheet_music_url && (
            <button
              onClick={() => window.open(selectedPiece.sheet_music_url!, "_blank")}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.2rem 0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
            >
              <FileText size={10} strokeWidth={1.5} /> {t.student.sheet}
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
              {recording ? <><Circle size={8} fill="currentColor" strokeWidth={0} /> {t.student.recording}</> : hasStarted ? t.student.paused : t.student.readyToPlay}
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
          {!hasStarted ? (
            /* ── Not started: big "Just me" lock button ── */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem" }}>
              <button
                onClick={handleStartRecording}
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: "var(--charcoal)", border: "none", cursor: "pointer",
                  color: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <Lock size={28} strokeWidth={1.5} />
              </button>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500 }}>
                Just me · private
              </div>
            </div>
          ) : (
            /* ── Session running ── */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", width: "100%" }}>

              {/* Clip status */}
              {clipping && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(138,42,56,0.08)", border: "1px solid rgba(138,42,56,0.15)", borderRadius: 100, padding: "0.375rem 0.875rem" }}>
                  <Circle size={7} fill="#8A2A38" strokeWidth={0} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "#8A2A38", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Clip recording · {fmt(clipElapsed)}
                  </span>
                </div>
              )}

              {/* Button row */}
              <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", alignItems: "center" }}>
                {/* Pause (only while recording, not clipping) */}
                {recording && !clipping && (
                  <button onClick={handlePause} style={{ width: 52, height: 52, borderRadius: "50%", border: "1px solid var(--border-strong)", background: "var(--white)", cursor: "pointer", color: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Pause size={20} strokeWidth={1.5} />
                  </button>
                )}

                {/* Clip button — record a segment for teacher */}
                {!clipping ? (
                  <button
                    onClick={handleStartClip}
                    disabled={!recording}
                    style={{
                      width: 72, height: 72, borderRadius: "50%",
                      background: recording ? "var(--sage)" : "var(--border)",
                      border: "none", cursor: recording ? "pointer" : "default",
                      color: "var(--white)", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: "0.2rem",
                      boxShadow: recording ? "var(--shadow-sage)" : "none",
                      transition: "background 0.2s",
                    }}
                  >
                    <Scissors size={20} strokeWidth={1.5} />
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {clipCount > 0 ? `${clipCount} clip${clipCount !== 1 ? "s" : ""}` : "Clip"}
                    </span>
                  </button>
                ) : (
                  /* Stop clip button */
                  <button
                    onClick={handleStopClip}
                    style={{
                      width: 72, height: 72, borderRadius: "50%",
                      background: "var(--error)", border: "none", cursor: "pointer",
                      color: "var(--white)", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: "0.2rem",
                      boxShadow: "0 0 0 6px rgba(138,42,56,0.12)",
                    }}
                  >
                    <Square size={20} strokeWidth={1.5} />
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Stop</span>
                  </button>
                )}

                {/* Resume (only when paused) */}
                {!recording && !clipping && (
                  <button onClick={handleResume} style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: "var(--charcoal)", color: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Circle size={22} fill="currentColor" strokeWidth={0} />
                  </button>
                )}
              </div>

              {/* End session link */}
              <button
                onClick={clipping ? undefined : handleStopPractice}
                disabled={clipping}
                style={{ background: "none", border: "none", cursor: clipping ? "default" : "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: clipping ? "var(--border-strong)" : "var(--muted)", letterSpacing: "0.04em", padding: "0.25rem 0.5rem" }}
              >
                {clipping ? "Finish clip first to end session" : "End session"}
              </button>
            </div>
          )}
        </div>

        {/* "What I'm working on" tap strip */}
        <div style={{ padding: "0 1.25rem 0.75rem" }}>
          <button
            onClick={() => setShowWorkingOn(true)}
            style={{
              width: "100%", background: "var(--white)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "0.875rem 1.125rem",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <Music size={16} strokeWidth={1.5} color="var(--muted)" />
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                  {selectedPiece ? selectedPiece.title : t.student.whatWorkingOn}
                </div>
                {segments.length > 0 && (
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                    {segments.length} {t.student.segmentsLogged}
                  </div>
                )}
                {!selectedPiece && segments.length === 0 && (
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                    {t.student.tapToAddPiece}
                  </div>
                )}
              </div>
            </div>
            <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>›</span>
          </button>
        </div>

        {/* Metronome toggle strip */}
        <div style={{ padding: "0 1.25rem 2rem" }}>
          <div style={{ background: "var(--white)", borderRadius: 6, border: "1px solid var(--border)", overflow: "hidden" }}>
            <button
              onClick={() => setShowMetronome(m => !m)}
              style={{ width: "100%", background: "none", border: "none", padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span style={{ fontSize: "1rem" }}>🎚</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                  {t.student.metronome}
                </span>
              </div>
              <span style={{ color: "var(--muted)", fontSize: "0.875rem", transition: "transform 0.2s", display: "inline-block", transform: showMetronome ? "rotate(90deg)" : "none" }}>›</span>
            </button>

            {showMetronome && (
              <div style={{ padding: "0 0.5rem 1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
                <Metronome />
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
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)" }}>{t.student.whatsWorkingOn}</span>
                <button onClick={() => setShowWorkingOn(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0 0.25rem" }}><X size={18} strokeWidth={1.5} /></button>
              </div>

              {/* Piece selector */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>
                  {t.student.piece}
                </label>
                {loadingPieces ? (
                  <div className="skeleton" style={{ height: 40, borderRadius: 4 }} />
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
                    style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border-strong)", padding: "0.75rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}
                  >
                    <option value="">{t.student.noPieceSelected}</option>
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
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>{t.student.reference}</div>
                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: practiceYouTubeId ? "0.625rem" : 0 }}>
                    {selectedPiece.recordings.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setPracticeYouTubeId(practiceYouTubeId === r.youtube_id ? null : r.youtube_id)}
                        style={{ padding: "0.3rem 0.625rem", borderRadius: 4, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500, background: practiceYouTubeId === r.youtube_id ? "var(--charcoal)" : "var(--cream)", color: practiceYouTubeId === r.youtube_id ? "var(--white)" : "var(--charcoal)", border: `1px solid ${practiceYouTubeId === r.youtube_id ? "var(--charcoal)" : "var(--border)"}`, transition: "all 0.15s" }}
                      >
                        {practiceYouTubeId === r.youtube_id ? <><Play size={12} strokeWidth={1.5} fill="currentColor" /> Playing</> : (r.is_primary ? <><Star size={12} strokeWidth={0} fill="currentColor" /> Listen</> : <><Play size={12} strokeWidth={1.5} fill="currentColor" /> {r.title.slice(0, 20)}</>)}
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
                    {t.student.segments} {segments.length > 0 && `(${segments.length})`}
                  </span>
                  {!showAddSeg && (
                    <button onClick={() => setShowAddSeg(true)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--muted)" }}>
                      + {t.common.add}
                    </button>
                  )}
                </div>

                {segments.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0", borderTop: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{AREAS[s.practice_area]?.label} · {fmt(s.start_seconds)}</div>
                    </div>
                    <button onClick={() => setSegments(prev => prev.filter(x => x.id !== s.id))} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "0 0.25rem", lineHeight: 1 }}><X size={14} strokeWidth={1.5} /></button>
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
                      style={{ borderRadius: 6, border: "1px solid var(--border-strong)", padding: "0.625rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.9375rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", width: "100%", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <select value={newSegArea} onChange={e => setNewSegArea(e.target.value)} style={{ flex: 1, borderRadius: 6, border: "1px solid var(--border)", padding: "0.5rem 0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}>
                        {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={handleAddSegment} style={{ borderRadius: 6, border: "none", background: "var(--charcoal)", color: "var(--white)", padding: "0.5rem 1rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem" }}>{t.common.add}</button>
                      <button onClick={() => setShowAddSeg(false)} style={{ borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", padding: "0.5rem 0.625rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} strokeWidth={1.5} /></button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowWorkingOn(false)}
                style={{ marginTop: "1.5rem", width: "100%", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 6, padding: "0.875rem", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer" }}
              >
                {t.common.done}
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
        {t.student.sessionComplete}
      </h2>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.75rem", fontFamily: "Inter, sans-serif" }}>
        {fmt(finalElapsed)}{selectedPiece ? ` · ${selectedPiece.title}` : ""}
      </p>

      {/* Mood picker */}
      <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "1rem", textAlign: "left" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>{t.student.howDidItFeel}</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {MOODS.map(m => (
            <button
              key={m.key}
              onClick={() => setMood(m.key)}
              style={{ flex: 1, padding: "0.5rem 0.25rem", borderRadius: 4, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", background: mood === m.key ? "var(--charcoal)" : "var(--cream)", border: `1px solid ${mood === m.key ? "var(--charcoal)" : "var(--border)"}`, transition: "all 0.15s" }}
            >
              <span style={{ lineHeight: 1 }}>{m.icon}</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 500, letterSpacing: "0.04em", color: mood === m.key ? "var(--white)" : "var(--muted)", textTransform: "uppercase" }}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reflection textareas */}
      <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1.25rem", marginBottom: "1rem", textAlign: "left" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>{t.student.wentWell}</div>
        <textarea value={wentWell} onChange={e => setWentWell(e.target.value)} placeholder="e.g. The tricky passage in bar 8 is clicking…" style={{ width: "100%", borderRadius: 4, border: "1px solid var(--border)", padding: "0.625rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", resize: "none", minHeight: 60, outline: "none", boxSizing: "border-box" }} />
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0.75rem 0 0.5rem" }}>{t.student.focusNext}</div>
        <textarea value={focusNext} onChange={e => setFocusNext(e.target.value)} placeholder="e.g. Work on the dynamics in the second section…" style={{ width: "100%", borderRadius: 4, border: "1px solid var(--border)", padding: "0.625rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", resize: "none", minHeight: 60, outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Audio recording review */}
      {audioBlobUrl && (
        <div className="card-base" style={{ width: "100%", maxWidth: 320, padding: "1rem 1.25rem", marginBottom: "1rem", textAlign: "left" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>{t.student.yourRecording}</div>
          <AudioPlayer src={audioBlobUrl} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.875rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.125rem" }}>{t.student.saveToJourney}</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{t.student.addToPortfolio}</div>
            </div>
            <button onClick={() => setPortfolioSave(v => !v)} style={{ width: 40, height: 22, borderRadius: 100, border: "none", flexShrink: 0, background: portfolioSave ? "var(--charcoal)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: portfolioSave ? 21 : 3, transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
            </button>
          </div>
          {portfolioSave && (
            <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input autoFocus value={portfolioTitle} onChange={e => setPortfolioTitle(e.target.value)} placeholder="Piece name, e.g. Für Elise" style={{ width: "100%", borderRadius: 4, border: "1px solid var(--border-strong)", padding: "0.575rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }} />
              <textarea value={portfolioDesc} onChange={e => setPortfolioDesc(e.target.value)} placeholder="Notes about this recording… (optional)" style={{ width: "100%", borderRadius: 4, border: "1px solid var(--border)", padding: "0.575rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream-deep)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box", resize: "none", minHeight: 52 }} />
              {/* Privacy picker */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", paddingTop: "0.25rem" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginBottom: "0.125rem" }}>Post as</div>
                {(["real", "alias", "anonymous"] as const).map(opt => {
                  const labels = {
                    real:      { icon: "🎵", label: "Your name", sub: null },
                    alias:     { icon: "🎭", label: artistName ?? "Stage name", sub: artistName ? null : "Set one in your Studio" },
                    anonymous: { icon: "👻", label: "Anonymous", sub: "No one will know it's you" },
                  };
                  const { icon, label, sub } = labels[opt];
                  const active = portfolioDisplayAs === opt;
                  return (
                    <button key={opt} onClick={() => setPortfolioDisplayAs(opt)}
                      style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0.75rem", borderRadius: 6, border: `1.5px solid ${active ? "var(--charcoal)" : "var(--border)"}`, background: active ? "var(--charcoal)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }}>
                      <span style={{ fontSize: "1rem" }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: "0.8125rem", fontWeight: active ? 600 : 400, color: active ? "var(--white)" : "var(--charcoal)" }}>{label}</div>
                        {sub && <div style={{ fontSize: "0.6875rem", color: active ? "rgba(255,255,255,0.6)" : "var(--muted)" }}>{sub}</div>}
                      </div>
                      {active && <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {saveError && (
        <div style={{ width: "100%", maxWidth: 320, marginBottom: "0.75rem", background: "#fff1f0", border: "1px solid #ffccc7", borderRadius: 6, padding: "0.75rem 1rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b", textAlign: "left", lineHeight: 1.5 }}>
          <strong>{t.student.couldNotSave}</strong> {saveError}
        </div>
      )}

      <button onClick={handleSubmit} disabled={saving || (portfolioSave && !portfolioTitle.trim())} className="btn btn-primary" style={{ width: "100%", maxWidth: 320, padding: "0.875rem", fontSize: "0.9375rem" }}>
        {saving ? t.common.saving : t.student.saveAndSend}
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
