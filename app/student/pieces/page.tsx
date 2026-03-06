"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PieceService } from "../../../lib/services/PieceService";
import type { PieceWithGoals } from "../../../lib/services/PieceService";
import { Student } from "../../../lib/models/Student";
import { usePlayer } from "../../../lib/context/PlayerContext";
import YouTubeSearch from "../../../components/YouTubeSearch";
import type { YouTubeResult, PieceRecording } from "../../../lib/types";

const SECTIONS: { category: string; label: string; color: string }[] = [
  { category: "technique",    label: "Technique",    color: "var(--sage)" },
  { category: "etude",        label: "Études",       color: "var(--sky)" },
  { category: "repertoire",   label: "Repertoire",   color: "var(--rose)" },
  { category: "theory",       label: "Theory",       color: "var(--butter)" },
  { category: "ear_training", label: "Ear Training", color: "var(--peach)" },
  { category: "sight_reading",label: "Sight Reading",color: "var(--muted)" },
  { category: "free",         label: "Other",        color: "var(--muted)" },
];

const STATUS_LABELS: Record<string, string> = {
  learning: "Learning",
  polishing: "Polishing",
  performance_ready: "Performance Ready",
  completed: "Complete",
};

export default function MyPieces() {
  const { user } = useAuth();
  const student = user as Student;
  const player = usePlayer();

  const [pieces, setPieces] = useState<PieceWithGoals[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpenFor, setSearchOpenFor] = useState<string | null>(null);

  // Manage panel state
  const [managingPieceId, setManagingPieceId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState<string | null>(null); // pieceId when paste mode active
  const [pendingPastes, setPendingPastes] = useState<File[]>([]);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<((pieceId: string, files: File[]) => Promise<void>) | undefined>(undefined);

  const supabase = getSupabaseBrowserClient();

  const load = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const data = await PieceService.getInstance(supabase).getStudentPieces(student.id);
      setPieces(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Sheet music upload ──
  async function handleUploadSheetMusic(pieceId: string, files: File[]) {
    if (!files.length) return;
    setUploadingFor(pieceId);
    try {
      const imageExtRe = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;
      const isImages = files.every(f => f.type.startsWith("image/") || imageExtRe.test(f.name));

      let sheetUrl: string;

      if (!isImages && files.length === 1) {
        // Single PDF
        const file = files[0];
        const path = `${pieceId}.pdf`;
        await supabase.storage.from("sheet-music").upload(path, file, { contentType: "application/pdf", upsert: true });
        const { data } = supabase.storage.from("sheet-music").getPublicUrl(path);
        sheetUrl = data.publicUrl;
      } else if (files.length === 1) {
        // Single image
        const file = files[0];
        const ext = file.name.split(".").pop() ?? "png";
        const path = `${pieceId}_img.${ext}`;
        await supabase.storage.from("sheet-music").upload(path, file, { contentType: file.type, upsert: true });
        const { data } = supabase.storage.from("sheet-music").getPublicUrl(path);
        sheetUrl = data.publicUrl;
      } else {
        // Multiple images
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

      await PieceService.getInstance(supabase).updatePiece(pieceId, { sheet_music_url: sheetUrl });
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, sheet_music_url: sheetUrl } : p));
    } catch (err) {
      console.error("upload error:", err);
    } finally {
      setUploadingFor(null);
      setPendingPastes([]);
      setPasteMode(null);
    }
  }

  uploadRef.current = handleUploadSheetMusic;

  // ── Paste listener ──
  useEffect(() => {
    if (!pasteMode) return;
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter(it => it.type.startsWith("image/"));
      if (!imageItems.length) return;
      const files = imageItems.map(it => it.getAsFile()).filter(Boolean) as File[];
      setPendingPastes(prev => [...prev, ...files]);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pasteMode]);

  // ── Recordings ──
  async function handleAddRecording(pieceId: string, video: YouTubeResult) {
    const piece = pieces.find(p => p.id === pieceId);
    const isPrimary = !piece || piece.recordings.length === 0;
    try {
      const rec = await PieceService.getInstance(supabase).addRecording(pieceId, video, student.id, isPrimary);
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, recordings: [...p.recordings, rec] } : p));
    } catch (err) {
      console.error("add recording error:", err);
    }
  }

  async function handleRemoveRecording(pieceId: string, recordingId: string) {
    try {
      await PieceService.getInstance(supabase).removeRecording(recordingId);
      setPieces(prev => prev.map(p =>
        p.id === pieceId ? { ...p, recordings: p.recordings.filter(r => r.id !== recordingId) } : p
      ));
      if (player.current) {
        const piece = pieces.find(p => p.id === pieceId);
        const rec = piece?.recordings.find(r => r.id === recordingId);
        if (rec && player.current.id === rec.youtube_id) player.stop();
      }
    } catch (err) {
      console.error("remove recording error:", err);
    }
  }

  async function handleSetPrimary(pieceId: string, recordingId: string) {
    try {
      await PieceService.getInstance(supabase).setPrimaryRecording(pieceId, recordingId);
      setPieces(prev => prev.map(p =>
        p.id === pieceId
          ? { ...p, recordings: p.recordings.map((r: PieceRecording) => ({ ...r, is_primary: r.id === recordingId })) }
          : p
      ));
    } catch (err) {
      console.error("set primary error:", err);
    }
  }

  // ── Player helpers ──
  function handlePlayPiece(piece: PieceWithGoals) {
    if (piece.recordings.length === 0) return;
    const tracks = piece.recordings.map(r => ({ id: r.youtube_id, title: r.title, thumbnail: r.thumbnail_url ?? undefined }));
    const primaryIdx = piece.recordings.findIndex(r => r.is_primary);
    const primary = tracks[primaryIdx >= 0 ? primaryIdx : 0];
    player.play(primary, tracks);
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

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%", padding: "1.5rem 1.5rem 5rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            My Pieces
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 4 }} />)}
        </div>
      ) : pieces.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">No pieces yet</div>
          <p className="empty-state-desc">Your teacher will add pieces and assignments here.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {grouped.map(section => (
            <div key={section.category}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: section.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)" }}>
                  {section.label}
                </span>
              </div>

              {/* Piece cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {section.pieces.map(piece => {
                  const total = piece.goals.length;
                  const done = piece.goals.filter(g => g.status === "completed").length;
                  const current = piece.goals.filter(g => g.status === "current").length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isComplete = piece.status === "completed" || (total > 0 && done === total);
                  const playing = isPlaying(piece);
                  const hasRecordings = piece.recordings.length > 0;
                  const managing = managingPieceId === piece.id;

                  return (
                    <div key={piece.id}>
                      {/* Main card */}
                      <div
                        style={{
                          background: "var(--white)",
                          border: playing ? "1.5px solid var(--charcoal)" : "1px solid var(--border)",
                          borderRadius: managing ? "4px 4px 0 0" : 4,
                          padding: "1rem 1.25rem",
                        }}
                      >
                        {/* Title row */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.0625rem", color: "var(--charcoal)", lineHeight: 1.25 }}>
                              {piece.title}
                              {piece.composer && (
                                <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {piece.composer}</span>
                              )}
                            </div>
                            {piece.book && (
                              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                                {piece.book}
                              </div>
                            )}
                          </div>

                          {/* Right actions */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                            {hasRecordings ? (
                              <button
                                onClick={() => playing ? player.stop() : handlePlayPiece(piece)}
                                style={{
                                  fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500,
                                  letterSpacing: "0.04em", textTransform: "uppercase",
                                  background: playing ? "var(--charcoal)" : "none",
                                  color: playing ? "var(--white)" : "var(--charcoal)",
                                  border: "1px solid var(--charcoal)",
                                  borderRadius: 2, padding: "0.25rem 0.625rem",
                                  cursor: "pointer", whiteSpace: "nowrap",
                                }}
                              >
                                {playing ? "▶ Playing" : `▶ Listen${piece.recordings.length > 1 ? ` (${piece.recordings.length})` : ""}`}
                              </button>
                            ) : (
                              <button
                                onClick={() => setSearchOpenFor(searchOpenFor === piece.id ? null : piece.id)}
                                title="Search for music to play"
                                style={{
                                  fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500,
                                  letterSpacing: "0.04em", textTransform: "uppercase",
                                  background: "none", color: "var(--muted)",
                                  border: "1px solid var(--border)", borderRadius: 2,
                                  padding: "0.25rem 0.5rem", cursor: "pointer", whiteSpace: "nowrap",
                                }}
                              >
                                🔍 Play
                              </button>
                            )}
                            {piece.score_url && (
                              <Link
                                href={`/student/pieces/${piece.id}/score`}
                                style={{
                                  fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500,
                                  letterSpacing: "0.04em", textTransform: "uppercase",
                                  background: "#3D6B55", color: "var(--white)",
                                  borderRadius: 2, padding: "0.25rem 0.625rem",
                                  textDecoration: "none", whiteSpace: "nowrap",
                                }}
                              >
                                🎵 Score
                              </Link>
                            )}
                            {piece.sheet_music_url && (
                              <Link
                                href={`/student/perform/${piece.id}`}
                                style={{
                                  fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500,
                                  letterSpacing: "0.04em", textTransform: "uppercase",
                                  background: "var(--charcoal)", color: "var(--white)",
                                  borderRadius: 2, padding: "0.25rem 0.625rem",
                                  textDecoration: "none", whiteSpace: "nowrap",
                                }}
                              >
                                Perform
                              </Link>
                            )}
                            <div style={{
                              fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500,
                              letterSpacing: "0.05em", textTransform: "uppercase",
                              color: isComplete ? section.color : "var(--muted)",
                              border: `1px solid ${isComplete ? section.color : "var(--border)"}`,
                              borderRadius: 2, padding: "0.2rem 0.5rem", whiteSpace: "nowrap",
                            }}>
                              {STATUS_LABELS[piece.status] ?? piece.status}
                            </div>
                            <button
                              onClick={() => setManagingPieceId(managing ? null : piece.id)}
                              title="Manage sheet music & recordings"
                              style={{
                                background: managing ? "var(--charcoal)" : "none",
                                color: managing ? "var(--white)" : "var(--muted)",
                                border: `1px solid ${managing ? "var(--charcoal)" : "var(--border)"}`,
                                borderRadius: 2, padding: "0.2rem 0.4rem",
                                cursor: "pointer", fontSize: "0.75rem", lineHeight: 1,
                                transition: "all 0.12s",
                              }}
                            >
                              ⚙
                            </button>
                          </div>
                        </div>

                        {/* Per-piece search (no recordings) */}
                        {searchOpenFor === piece.id && (
                          <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--cream)", borderRadius: 3, border: "1px solid var(--border)" }}>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Search for a recording to play
                            </div>
                            <YouTubeSearch
                              placeholder={`${piece.title}${piece.composer ? ` ${piece.composer}` : ""}…`}
                              onSelect={(v: YouTubeResult) => handleSearchPlay(v)}
                            />
                          </div>
                        )}

                        {/* Progress */}
                        {total > 0 && (
                          <div style={{ marginTop: "0.875rem" }}>
                            <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: "0.375rem" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: section.color, borderRadius: 2, transition: "width 0.4s ease" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)" }}>
                              <span>{done}/{total} goals done{current > 0 ? ` · ${current} assigned` : ""}</span>
                              <span>{pct}%</span>
                            </div>
                          </div>
                        )}
                        {total === 0 && (
                          <div style={{ marginTop: "0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", fontStyle: "italic" }}>
                            No goals assigned yet
                          </div>
                        )}
                      </div>

                      {/* ── Manage panel ── */}
                      {managing && (
                        <div style={{
                          background: "var(--cream-deep, #f5f3ef)",
                          border: "1px solid var(--border)",
                          borderTop: "none",
                          borderRadius: "0 0 4px 4px",
                          padding: "1rem 1.25rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1.25rem",
                        }}>

                          {/* ── Sheet music ── */}
                          <div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>
                              Sheet Music
                            </div>
                            {piece.sheet_music_url && (
                              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                                ✓ Uploaded
                                {piece.sheet_music_url.startsWith("[") && (
                                  <span style={{ color: "var(--muted)", marginLeft: "0.375rem" }}>({JSON.parse(piece.sheet_music_url).length} pages)</span>
                                )}
                              </div>
                            )}

                            {/* Paste mode banner */}
                            {pasteMode === piece.id ? (
                              <div style={{ background: "var(--charcoal)", borderRadius: 3, padding: "0.75rem 1rem", marginBottom: "0.5rem" }}>
                                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--white)", marginBottom: "0.375rem" }}>
                                  {pendingPastes.length === 0
                                    ? "Ready — paste a screenshot (Ctrl+V / Cmd+V)"
                                    : `${pendingPastes.length} image${pendingPastes.length !== 1 ? "s" : ""} ready`}
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                  {pendingPastes.length > 0 && (
                                    <button
                                      onClick={() => uploadRef.current?.(piece.id, pendingPastes)}
                                      disabled={uploadingFor === piece.id}
                                      style={{
                                        borderRadius: 2, border: "none", background: "var(--white)", color: "var(--charcoal)",
                                        padding: "0.35rem 0.75rem", cursor: "pointer",
                                        fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem",
                                      }}
                                    >
                                      {uploadingFor === piece.id ? "Uploading…" : `Upload ${pendingPastes.length}`}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setPasteMode(null); setPendingPastes([]); }}
                                    style={{
                                      borderRadius: 2, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "rgba(255,255,255,0.7)",
                                      padding: "0.35rem 0.75rem", cursor: "pointer",
                                      fontFamily: "Inter, sans-serif", fontSize: "0.75rem",
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                <button
                                  onClick={() => sheetInputRef.current?.click()}
                                  disabled={uploadingFor === piece.id}
                                  style={{
                                    borderRadius: 2, border: "1px solid var(--border)", background: "var(--white)",
                                    padding: "0.375rem 0.75rem", cursor: "pointer",
                                    fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)",
                                  }}
                                >
                                  {uploadingFor === piece.id ? "Uploading…" : "📄 Upload PDF / Images"}
                                </button>
                                <button
                                  onClick={() => { setPasteMode(piece.id); setPendingPastes([]); }}
                                  style={{
                                    borderRadius: 2, border: "1px solid var(--border)", background: "var(--white)",
                                    padding: "0.375rem 0.75rem", cursor: "pointer",
                                    fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)",
                                  }}
                                >
                                  📋 Paste
                                </button>
                              </div>
                            )}

                            {/* Hidden file input */}
                            <input
                              ref={sheetInputRef}
                              type="file"
                              accept=".pdf,application/pdf,image/*"
                              multiple
                              style={{ display: "none" }}
                              onChange={e => {
                                const files = Array.from(e.target.files ?? []);
                                if (files.length) handleUploadSheetMusic(piece.id, files);
                                e.target.value = "";
                              }}
                            />
                          </div>

                          {/* ── Recordings ── */}
                          <div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>
                              Recordings
                            </div>

                            {piece.recordings.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                {piece.recordings.map(rec => (
                                  <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 3, padding: "0.5rem 0.75rem" }}>
                                    {rec.thumbnail_url && (
                                      <img src={rec.thumbnail_url} alt="" style={{ width: 48, height: 27, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {rec.title}
                                      </div>
                                      {rec.is_primary && (
                                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.125rem" }}>★ Primary</div>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                                      {!rec.is_primary && (
                                        <button
                                          onClick={() => handleSetPrimary(piece.id, rec.id)}
                                          title="Set as primary"
                                          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.2rem 0.4rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)" }}
                                        >
                                          ★
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleRemoveRecording(piece.id, rec.id)}
                                        title="Remove"
                                        style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.2rem 0.4rem", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem" }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic", marginBottom: "0.625rem" }}>
                                No recordings yet
                              </div>
                            )}

                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginBottom: "0.375rem" }}>
                              Add a recording:
                            </div>
                            <YouTubeSearch
                              placeholder={`Search for ${piece.title}…`}
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
