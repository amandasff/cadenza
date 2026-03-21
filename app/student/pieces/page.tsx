"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PieceService } from "../../../lib/services/PieceService";
import type { PieceWithGoals } from "../../../lib/services/PieceService";
import { Student } from "../../../lib/models/Student";
import { usePlayer } from "../../../lib/context/PlayerContext";
import Link from "next/link";
import YouTubeSearch from "../../../components/YouTubeSearch";
import type { YouTubeResult, PieceRecording } from "../../../lib/types";
import { useI18n } from "../../../lib/context/I18nContext";
import { Sparkles, Music2, Play, Star, X } from "lucide-react";

export default function MyPieces() {
  const { t } = useI18n();
  const { user } = useAuth();
  const student = user as Student;
  const player = usePlayer();

  const SECTIONS: { category: string; label: string; color: string }[] = [
    { category: "technique",     label: t.student.sectionTechnique,     color: "var(--sage)" },
    { category: "etude",         label: t.student.sectionEtude,         color: "var(--sky)" },
    { category: "repertoire",    label: t.student.sectionRepertoire,    color: "var(--rose)" },
    { category: "theory",        label: t.student.sectionTheory,        color: "var(--butter)" },
    { category: "ear_training",  label: t.student.sectionEarTraining,   color: "var(--peach)" },
    { category: "sight_reading", label: t.student.sectionSightReading,  color: "var(--muted)" },
    { category: "free",          label: t.student.sectionOther,         color: "var(--muted)" },
  ];

  const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    learning:          { label: t.student.statusLearning,          icon: <Sparkles size={12} strokeWidth={1.5} />, color: "var(--butter)", bg: "rgba(230,168,23,0.12)" },
    polishing:         { label: t.student.statusPolishing,         icon: <Sparkles size={12} strokeWidth={1.5} />, color: "var(--sky)", bg: "rgba(74,123,196,0.12)" },
    performance_ready: { label: t.student.statusPerformanceReady,  icon: <Music2 size={12} strokeWidth={1.5} />, color: "var(--sage)", bg: "rgba(91,158,121,0.14)" },
    completed:         { label: t.student.statusCompleted,         icon: <Star size={12} strokeWidth={1.5} />, color: "#7A6A5A", bg: "rgba(138,122,106,0.1)" },
  };

  const isTeacher = user?.role === "teacher";

  const CATEGORIES = [
    { value: "technique",     label: "Technique" },
    { value: "etude",         label: "Etude" },
    { value: "repertoire",    label: "Repertoire" },
    { value: "theory",        label: "Theory" },
    { value: "ear_training",  label: "Ear Training" },
    { value: "sight_reading", label: "Sight Reading" },
    { value: "free",          label: "Other" },
  ];

  const [pieces, setPieces]               = useState<PieceWithGoals[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showAddPiece, setShowAddPiece]   = useState(false);
  const [addingPiece, setAddingPiece]     = useState(false);
  const [pieceForm, setPieceForm]         = useState({ title: "", composer: "", category: "repertoire" });
  const [searchOpenFor, setSearchOpenFor] = useState<string | null>(null);
  const [managingPieceId, setManagingPieceId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor]   = useState<string | null>(null);
  const [uploadingScoreFor, setUploadingScoreFor] = useState<string | null>(null);
  const [aiConvertingFor, setAiConvertingFor]     = useState<string | null>(null);
  const [pasteModeFor, setPasteModeFor]   = useState<string | null>(null);
  const [pendingPastes, setPendingPastes] = useState<File[]>([]);
  const [uploadError, setUploadError]     = useState<string | null>(null);

  // Keep upload handler stable for paste effect closure
  const uploadHandlerRef = useRef(handleUploadSheetMusic);
  useEffect(() => { uploadHandlerRef.current = handleUploadSheetMusic; }); // eslint-disable-line react-hooks/exhaustive-deps

  const supabase = getSupabaseBrowserClient();

  const load = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const data = await PieceService.create(supabase).getStudentPieces(student.id);
      setPieces(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Paste mode clipboard listener ──
  useEffect(() => {
    if (!pasteModeFor) return;
    function onPaste(e: ClipboardEvent) {
      const imageItem = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) setPendingPastes(prev => [...prev, file]);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pasteModeFor]);

  function startPasteMode(pieceId: string) {
    setPendingPastes([]);
    setPasteModeFor(pieceId);
  }

  function cancelPasteMode() {
    setPasteModeFor(null);
    setPendingPastes([]);
  }

  function uploadPastes(pieceId: string) {
    if (pendingPastes.length > 0) void uploadHandlerRef.current(pieceId, pendingPastes);
    setPasteModeFor(null);
    setPendingPastes([]);
  }

  // ── Sheet music upload ──
  async function handleUploadSheetMusic(pieceId: string, files: File[]) {
    if (!files.length) return;
    setUploadingFor(pieceId);
    setUploadError(null);
    try {
      const imageExtRe = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;
      const isImages = files.every(f => f.type.startsWith("image/") || imageExtRe.test(f.name));
      let sheetUrl: string;

      if (!isImages && files.length === 1) {
        const file = files[0];
        const path = `${pieceId}.pdf`;
        await supabase.storage.from("sheet-music").upload(path, file, { contentType: "application/pdf", upsert: true });
        const { data } = supabase.storage.from("sheet-music").getPublicUrl(path);
        sheetUrl = data.publicUrl;
      } else if (files.length === 1) {
        const file = files[0];
        const ext = file.name.split(".").pop() ?? "png";
        const path = `${pieceId}_img.${ext}`;
        await supabase.storage.from("sheet-music").upload(path, file, { contentType: file.type, upsert: true });
        const { data } = supabase.storage.from("sheet-music").getPublicUrl(path);
        sheetUrl = data.publicUrl;
      } else {
        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const ext = file.name.split(".").pop() ?? "png";
          const path = `${pieceId}/img_${i}.${ext}`;
          await supabase.storage.from("sheet-music").upload(path, file, { contentType: file.type, upsert: true });
          const { data } = supabase.storage.from("sheet-music").getPublicUrl(path);
          urls.push(data.publicUrl);
        }
        sheetUrl = JSON.stringify(urls);
      }

      await PieceService.create(supabase).updatePiece(pieceId, { sheet_music_url: sheetUrl });
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, sheet_music_url: sheetUrl } : p));
    } catch (err) {
      console.error("upload error:", err);
      setUploadError("Upload failed — please try again.");
      toast.error("Upload failed — please try again.");
    } finally {
      setUploadingFor(null);
    }
  }

  // Programmatic file picker
  function openFilePicker(pieceId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf,image/*";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length) void handleUploadSheetMusic(pieceId, files);
    };
    input.click();
  }

  // ── Score file upload (MusicXML / Guitar Pro) ──
  async function handleUploadScore(pieceId: string, file: File) {
    setUploadingScoreFor(pieceId);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() ?? "gp";
      const path = `${pieceId}_score.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("score-files").upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (uploadErr) { setUploadError(`Score upload failed: ${uploadErr.message}`); return; }
      const { data: urlData } = supabase.storage.from("score-files").getPublicUrl(path);
      await PieceService.create(supabase).updatePiece(pieceId, { score_url: urlData.publicUrl });
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, score_url: urlData.publicUrl } : p));
    } catch (err) {
      setUploadError(`Score upload error: ${(err as Error).message}`);
    } finally {
      setUploadingScoreFor(null);
    }
  }

  function openScorePicker(pieceId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".gp,.gpx,.gp3,.gp4,.gp5,.xml,.musicxml,application/xml,text/xml";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handleUploadScore(pieceId, file);
    };
    input.click();
  }

  // ── AI image → MusicXML ──
  async function handleAiConvertScore(pieceId: string, file: File) {
    setAiConvertingFor(pieceId);
    setUploadError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = file.type || "image/png";
      const res = await fetch("/api/score-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setUploadError(`AI conversion failed: ${json.error ?? "Unknown error"}`); return; }
      const xmlBlob = new Blob([json.musicxml], { type: "application/xml" });
      const path = `${pieceId}_score.xml`;
      const { error: uploadErr } = await supabase.storage
        .from("score-files").upload(path, xmlBlob, { upsert: true, contentType: "application/xml" });
      if (uploadErr) { setUploadError(`Upload failed: ${uploadErr.message}`); return; }
      const { data: urlData } = supabase.storage.from("score-files").getPublicUrl(path);
      await PieceService.create(supabase).updatePiece(pieceId, { score_url: urlData.publicUrl });
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, score_url: urlData.publicUrl } : p));
    } catch (err) {
      setUploadError(`AI conversion error: ${(err as Error).message}`);
    } finally {
      setAiConvertingFor(null);
    }
  }

  function openAiConvertPicker(pieceId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handleAiConvertScore(pieceId, file);
    };
    input.click();
  }

  // ── Recordings ──
  async function handleAddRecording(pieceId: string, video: YouTubeResult) {
    const piece = pieces.find(p => p.id === pieceId);
    const isPrimary = !piece || piece.recordings.length === 0;
    try {
      const rec = await PieceService.create(supabase).addRecording(pieceId, video, student.id, isPrimary);
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, recordings: [...p.recordings, rec] } : p));
    } catch (err) { console.error(err); }
  }

  async function handleRemoveRecording(pieceId: string, recordingId: string) {
    try {
      await PieceService.create(supabase).removeRecording(recordingId);
      setPieces(prev => prev.map(p =>
        p.id === pieceId ? { ...p, recordings: p.recordings.filter(r => r.id !== recordingId) } : p
      ));
      if (player.current) {
        const piece = pieces.find(p => p.id === pieceId);
        const rec = piece?.recordings.find(r => r.id === recordingId);
        if (rec && player.current.id === rec.youtube_id) player.stop();
      }
    } catch (err) { console.error(err); }
  }

  async function handleSetPrimary(pieceId: string, recordingId: string) {
    try {
      await PieceService.create(supabase).setPrimaryRecording(pieceId, recordingId);
      setPieces(prev => prev.map(p =>
        p.id === pieceId
          ? { ...p, recordings: p.recordings.map((r: PieceRecording) => ({ ...r, is_primary: r.id === recordingId })) }
          : p
      ));
    } catch (err) { console.error(err); }
  }

  async function handleAddPiece(e: React.FormEvent) {
    e.preventDefault();
    if (!pieceForm.title.trim() || !student?.id || !student?.studioId) return;
    setAddingPiece(true);
    try {
      const newPiece = await PieceService.create(supabase).createPiece({
        studentId: student.id,
        teacherId: student.id,
        studioId: student.studioId,
        title: pieceForm.title.trim(),
        composer: pieceForm.composer.trim() || undefined,
        category: pieceForm.category,
      });
      setPieces(prev => [...prev, { ...newPiece, goals: [], recordings: [] }]);
      setPieceForm({ title: "", composer: "", category: "repertoire" });
      setShowAddPiece(false);
      toast.success("Piece added");
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "Could not add piece.";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setAddingPiece(false);
    }
  }

  function handlePlayPiece(piece: PieceWithGoals) {
    if (!piece.recordings.length) return;
    const tracks = piece.recordings.map(r => ({ id: r.youtube_id, title: r.title, thumbnail: r.thumbnail_url ?? undefined }));
    const primaryIdx = piece.recordings.findIndex(r => r.is_primary);
    player.play(tracks[primaryIdx >= 0 ? primaryIdx : 0], tracks);
  }

  function handleSearchPlay(video: YouTubeResult) {
    setSearchOpenFor(null);
    player.play({ id: video.id, title: video.title, thumbnail: video.thumbnail });
  }

  const isPlaying = (piece: PieceWithGoals) =>
    player.current !== null && piece.recordings.some(r => r.youtube_id === player.current?.id);

  const grouped = SECTIONS
    .map(s => ({ ...s, pieces: pieces.filter(p => p.category === s.category) }))
    .filter(s => s.pieces.length > 0);

  // ── Shared button styles ──
  const btnPrimary: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.5rem 1rem", borderRadius: 8, border: "none",
    background: "var(--charcoal)", color: "var(--white)",
    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem",
    cursor: "pointer", whiteSpace: "nowrap", transition: "opacity 0.15s",
  };
  const btnOutline: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "0.375rem",
    padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid var(--border-strong)",
    background: "transparent", color: "var(--charcoal)",
    fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem",
    cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
  };
  const btnGhost: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "0.25rem",
    padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)",
    background: "transparent", color: "var(--muted)",
    fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "0.8125rem",
    cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%", padding: "1.5rem 1.25rem 6rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.25rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.student.myPieces}</span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", margin: "0.5rem 0 0", lineHeight: 1.5 }}>
          {t.student.myPiecesDesc}
        </p>
        {isTeacher && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
            <button
              onClick={() => setShowAddPiece(v => !v)}
              style={{ ...btnPrimary, fontSize: "0.8125rem", padding: "0.5rem 1.25rem" }}
            >
              {showAddPiece ? "Cancel" : "+ Add Piece"}
            </button>
          </div>
        )}
      </div>

      {/* Add piece form (teachers only) */}
      {isTeacher && showAddPiece && (
        <form onSubmit={handleAddPiece} style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <input
            required
            value={pieceForm.title}
            onChange={e => setPieceForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Title (e.g. Waltz in A minor)"
            style={{ padding: "0.625rem 0.875rem", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", width: "100%", boxSizing: "border-box" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <input
              value={pieceForm.composer}
              onChange={e => setPieceForm(f => ({ ...f, composer: e.target.value }))}
              placeholder="Composer (optional)"
              style={{ padding: "0.625rem 0.875rem", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}
            />
            <select
              value={pieceForm.category}
              onChange={e => setPieceForm(f => ({ ...f, category: e.target.value }))}
              style={{ padding: "0.625rem 0.875rem", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={addingPiece || !pieceForm.title.trim()}
            style={{ ...btnPrimary, opacity: addingPiece || !pieceForm.title.trim() ? 0.5 : 1, justifyContent: "center" }}
          >
            {addingPiece ? "Adding…" : "Add Piece"}
          </button>
        </form>
      )}

      {/* Global error */}
      {uploadError && (
        <div style={{ background: "var(--error-bg)", border: "1px solid rgba(192,80,80,0.3)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--error)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", padding: 0, display: "flex", alignItems: "center" }}><X size={16} strokeWidth={1.5} /></button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
        </div>
      ) : pieces.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">{t.student.noPiecesTitle}</div>
          <p className="empty-state-desc">{t.student.noPiecesDesc}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {grouped.map(section => (
            <div key={section.category}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: section.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--charcoal)" }}>
                  {section.label}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {section.pieces.map(piece => {
                  const total   = piece.goals.length;
                  const done    = piece.goals.filter(g => g.status === "completed").length;
                  const current = piece.goals.filter(g => g.status === "current").length;
                  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
                  const playing  = isPlaying(piece);
                  const hasRecs  = piece.recordings.length > 0;
                  const managing = managingPieceId === piece.id;
                  const isPasting = pasteModeFor === piece.id;
                  const statusCfg = STATUS_CONFIG[piece.status] ?? { label: piece.status, icon: null, color: "var(--muted)", bg: "rgba(0,0,0,0.04)" };
                  const scoreUrl = (piece as PieceWithGoals & { score_url?: string }).score_url;

                  return (
                    <div key={piece.id} style={{
                      background: "var(--white)",
                      border: playing ? "2px solid var(--charcoal)" : "1px solid var(--border)",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "var(--shadow-xs)",
                    }}>
                      {/* Card body */}
                      <div style={{ padding: "1rem 1.25rem 0.875rem" }}>

                        {/* Status badge */}
                        <div style={{ marginBottom: "0.5rem" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "0.3rem",
                            padding: "0.2rem 0.625rem", borderRadius: 99,
                            background: statusCfg.bg, color: statusCfg.color,
                            fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem",
                          }}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                        </div>

                        {/* Title */}
                        <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.125rem", color: "var(--charcoal)", lineHeight: 1.25, marginBottom: piece.composer || piece.book ? "0.2rem" : "0" }}>
                          {piece.title}
                        </div>
                        {piece.composer && (
                          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.125rem" }}>
                            {piece.composer}
                          </div>
                        )}
                        {piece.book && (
                          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
                            {piece.book}
                          </div>
                        )}

                        {/* Goals progress */}
                        {total > 0 && (
                          <div style={{ marginTop: "0.875rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", marginBottom: "0.35rem" }}>
                              <span style={{ color: "var(--charcoal)", fontWeight: 500 }}>
                                {done === total ? t.student.allGoalsDone : t.student.goalsProgress.replace("{done}", String(done)).replace("{total}", String(total))}
                                {current > 0 && done < total && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {t.student.goalsInProgress.replace("{n}", String(current))}</span>}
                              </span>
                              <span style={{ color: "var(--muted)", fontWeight: 500 }}>{pct}%</span>
                            </div>
                            <div style={{ height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#5B9E79" : section.color, borderRadius: 99, transition: "width 0.4s ease" }} />
                            </div>
                          </div>
                        )}
                        {total === 0 && (
                          <div style={{ marginTop: "0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic" }}>
                            {t.student.noGoalsYet}
                          </div>
                        )}
                      </div>

                      {/* Action row */}
                      <div style={{ padding: "0 1.25rem 1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        {/* Listen / Find */}
                        {hasRecs ? (
                          <button
                            onClick={() => playing ? player.stop() : handlePlayPiece(piece)}
                            style={playing ? { ...btnPrimary, background: "#3A6B55" } : btnPrimary}
                          >
                            {playing ? t.student.pause : t.student.listen}
                            {piece.recordings.length > 1 && !playing && (
                              <span style={{ opacity: 0.6, fontWeight: 400 }}>({piece.recordings.length})</span>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => setSearchOpenFor(searchOpenFor === piece.id ? null : piece.id)}
                            style={btnOutline}
                          >
                            {t.student.findOnYouTube}
                          </button>
                        )}

                        {/* Sheet music → annotate page */}
                        {piece.sheet_music_url ? (
                          <Link
                            href={`/student/perform/${piece.id}`}
                            style={{ ...btnOutline, textDecoration: "none" }}
                          >
                            {t.student.annotate}
                          </Link>
                        ) : (
                          <button
                            onClick={() => openFilePicker(piece.id)}
                            disabled={uploadingFor === piece.id}
                            style={btnGhost}
                          >
                            {uploadingFor === piece.id ? t.student.uploadingLabel : t.student.uploadSheetMusicBtn}
                          </button>
                        )}

                        {/* Perform */}
                        <Link
                          href={`/student/perform/${piece.id}`}
                          style={{ ...btnOutline, textDecoration: "none" }}
                        >
                          {t.student.perform}
                        </Link>

                        {/* More toggle */}
                        <button
                          onClick={() => setManagingPieceId(managing ? null : piece.id)}
                          style={{
                            ...btnGhost,
                            marginLeft: "auto",
                            background: managing ? "var(--cream-deep, #f0ede8)" : "transparent",
                            color: managing ? "var(--charcoal)" : "var(--muted)",
                          }}
                        >
                          {managing ? <><X size={12} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{t.common.close}</> : `··· ${t.student.more}`}
                        </button>
                      </div>

                      {/* Quick YouTube search (no recordings yet) */}
                      {searchOpenFor === piece.id && (
                        <div style={{ padding: "0 1.25rem 1rem" }}>
                          <div style={{ background: "var(--cream)", borderRadius: 8, border: "1px solid var(--border)", padding: "0.875rem" }}>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.25rem" }}>
                              {t.student.searchYouTubeTitle}
                            </div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.625rem" }}>
                              {t.student.searchYouTubeDesc}
                            </div>
                            <YouTubeSearch
                              placeholder={`${piece.title}${piece.composer ? ` ${piece.composer}` : ""}…`}
                              onSelect={(v: YouTubeResult) => {
                                void handleAddRecording(piece.id, v);
                                setSearchOpenFor(null);
                                player.play({ id: v.id, title: v.title, thumbnail: v.thumbnail });
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* ── Manage panel ── */}
                      {managing && (
                        <div style={{
                          borderTop: "1px solid var(--border)",
                          background: "var(--cream)",
                          padding: "1.25rem",
                          display: "flex", flexDirection: "column", gap: "1.5rem",
                        }}>

                          {/* ── Sheet Music ── */}
                          <div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.375rem" }}>
                              {t.pieces.sheetMusicTitle}
                            </div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.625rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                              {t.student.sheetMusicAnnotateNote}
                            </div>

                            {piece.sheet_music_url && (
                              <div style={{ marginBottom: "0.625rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <Link
                                  href={`/student/perform/${piece.id}`}
                                  style={{ ...btnOutline, textDecoration: "none", fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
                                >
                                  {t.student.openAnnotate}
                                </Link>
                                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--sage)" }}>{t.student.uploadedCheck}</span>
                              </div>
                            )}

                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                              <button
                                onClick={() => openFilePicker(piece.id)}
                                disabled={uploadingFor === piece.id}
                                style={{ ...btnGhost, fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
                              >
                                {uploadingFor === piece.id ? t.student.uploadingLabel : piece.sheet_music_url ? t.student.replaceFile : t.student.uploadPdfOrImage}
                              </button>
                              <button
                                onClick={() => isPasting ? cancelPasteMode() : startPasteMode(piece.id)}
                                style={{
                                  ...btnGhost, fontSize: "0.75rem", padding: "0.375rem 0.75rem",
                                  background: isPasting ? "var(--charcoal)" : "transparent",
                                  color: isPasting ? "var(--white)" : "var(--muted)",
                                  borderColor: isPasting ? "var(--charcoal)" : undefined,
                                }}
                                title="Paste a screenshot from your clipboard (Ctrl+V / ⌘V)"
                              >
                                {t.student.pasteImage}
                              </button>
                            </div>

                            {/* Paste mode banner */}
                            {isPasting && (
                              <div style={{
                                marginTop: "0.625rem",
                                padding: "0.625rem 0.875rem",
                                background: "var(--charcoal)",
                                borderRadius: 8,
                                display: "flex", alignItems: "center", gap: "0.75rem",
                              }}>
                                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--white)", flex: 1 }}>
                                  {pendingPastes.length === 0
                                    ? t.student.pasteHint
                                    : t.student.imagesReadyUpload.replace("{n}", String(pendingPastes.length))}
                                </span>
                                {pendingPastes.length > 0 && (
                                  <button
                                    onClick={() => uploadPastes(piece.id)}
                                    style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 6, cursor: "pointer", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, padding: "0.25rem 0.625rem", whiteSpace: "nowrap" }}
                                  >
                                    {t.student.uploadCount.replace("{n}", String(pendingPastes.length))}
                                  </button>
                                )}
                                <button onClick={cancelPasteMode} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", lineHeight: 1, padding: 0, display: "flex", alignItems: "center" }}><X size={16} strokeWidth={1.5} /></button>
                              </div>
                            )}
                          </div>

                          {/* ── Playable Score (MusicXML / Guitar Pro) ── */}
                          <div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.375rem" }}>
                              {t.student.playableScoreTitle}
                            </div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.625rem" }}>
                              {t.student.playableScoreDesc}
                            </div>

                            {scoreUrl && (
                              <div style={{ marginBottom: "0.625rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <a href={scoreUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnOutline, textDecoration: "none", fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
                                  {t.student.openScore}
                                </a>
                                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--sage)" }}>{t.student.uploadedCheck}</span>
                              </div>
                            )}

                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              <button
                                onClick={() => openScorePicker(piece.id)}
                                disabled={uploadingScoreFor === piece.id}
                                style={{ ...btnGhost, fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
                              >
                                {uploadingScoreFor === piece.id ? t.student.uploadingLabel : scoreUrl ? t.student.replaceScore : t.student.uploadScoreFile}
                              </button>
                              <button
                                onClick={() => openAiConvertPicker(piece.id)}
                                disabled={aiConvertingFor === piece.id}
                                style={{ ...btnGhost, fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
                                title="Take a photo or screenshot of your sheet music and convert it to a playable score with AI"
                              >
                                {aiConvertingFor === piece.id ? t.student.convertingLabel : t.student.aiConvertPhoto}
                              </button>
                            </div>
                          </div>

                          {/* ── YouTube Recordings ── */}
                          <div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.375rem" }}>
                              {t.student.youtubeRecordingsTitle}
                            </div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.625rem" }}>
                              {t.student.youtubeRecordingsDesc}
                            </div>

                            {piece.recordings.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.875rem" }}>
                                {piece.recordings.map(rec => (
                                  <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.625rem 0.75rem" }}>
                                    {rec.thumbnail_url && (
                                      <img src={rec.thumbnail_url} alt="" style={{ width: 48, height: 27, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {rec.title}
                                      </div>
                                      {rec.is_primary && (
                                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--butter)", marginTop: "0.125rem" }}>{t.student.mainRecording}</div>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                                      <button
                                        onClick={() => {
                                          const tracks = piece.recordings.map(r => ({ id: r.youtube_id, title: r.title, thumbnail: r.thumbnail_url ?? undefined }));
                                          const idx = piece.recordings.findIndex(r => r.id === rec.id);
                                          player.play(tracks[idx], tracks);
                                        }}
                                        style={{ ...btnGhost, padding: "0.25rem 0.5rem", display: "flex", alignItems: "center" }}
                                      ><Play size={12} strokeWidth={1.5} /></button>
                                      {!rec.is_primary && (
                                        <button onClick={() => handleSetPrimary(piece.id, rec.id)} title="Set as main" style={{ ...btnGhost, padding: "0.25rem 0.5rem", display: "flex", alignItems: "center" }}><Star size={12} strokeWidth={1.5} /></button>
                                      )}
                                      <button onClick={() => handleRemoveRecording(piece.id, rec.id)} title="Remove" style={{ ...btnGhost, color: "var(--error)", padding: "0.25rem 0.5rem", display: "flex", alignItems: "center" }}><X size={12} strokeWidth={1.5} /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                              {piece.recordings.length === 0 ? t.student.searchToAddRecording : t.student.addAnotherRecording}
                            </div>
                            <YouTubeSearch
                              placeholder={`Search YouTube for "${piece.title}"…`}
                              onSelect={(v: YouTubeResult) => handleAddRecording(piece.id, v)}
                            />
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
