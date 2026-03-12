"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PieceService } from "../../../lib/services/PieceService";
import type { PieceWithGoals } from "../../../lib/services/PieceService";
import { Student } from "../../../lib/models/Student";
import { usePlayer } from "../../../lib/context/PlayerContext";
import YouTubeSearch from "../../../components/YouTubeSearch";
import type { YouTubeResult, PieceRecording } from "../../../lib/types";

const SECTIONS: { category: string; label: string; color: string }[] = [
  { category: "technique",     label: "Technique",     color: "var(--sage)" },
  { category: "etude",         label: "Études",        color: "var(--sky)" },
  { category: "repertoire",    label: "Repertoire",    color: "var(--rose)" },
  { category: "theory",        label: "Theory",        color: "var(--butter)" },
  { category: "ear_training",  label: "Ear Training",  color: "var(--peach)" },
  { category: "sight_reading", label: "Sight Reading", color: "var(--muted)" },
  { category: "free",          label: "Other",         color: "var(--muted)" },
];

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  learning:          { label: "Learning",          emoji: "📖", color: "#C07A1A", bg: "rgba(230,168,23,0.12)" },
  polishing:         { label: "Polishing",         emoji: "✨", color: "#3A6BAA", bg: "rgba(74,123,196,0.12)" },
  performance_ready: { label: "Ready to perform!", emoji: "🎭", color: "#3A7A5A", bg: "rgba(91,158,121,0.14)" },
  completed:         { label: "Completed",         emoji: "🏆", color: "#7A6A5A", bg: "rgba(138,122,106,0.1)" },
};

export default function MyPieces() {
  const { user } = useAuth();
  const student = user as Student;
  const player = usePlayer();

  const [pieces, setPieces]         = useState<PieceWithGoals[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchOpenFor, setSearchOpenFor] = useState<string | null>(null);
  const [managingPieceId, setManagingPieceId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

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

  // ── Sheet music upload — uses a fresh dynamic input each time to avoid ref issues ──
  async function handleUploadSheetMusic(pieceId: string, files: File[]) {
    if (!files.length) return;
    setUploadingFor(pieceId);
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

      await PieceService.getInstance(supabase).updatePiece(pieceId, { sheet_music_url: sheetUrl });
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, sheet_music_url: sheetUrl } : p));
    } catch (err) {
      console.error("upload error:", err);
    } finally {
      setUploadingFor(null);
    }
  }

  // Programmatic file picker — no ref needed, always fresh
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

  // ── Recordings ──
  async function handleAddRecording(pieceId: string, video: YouTubeResult) {
    const piece = pieces.find(p => p.id === pieceId);
    const isPrimary = !piece || piece.recordings.length === 0;
    try {
      const rec = await PieceService.getInstance(supabase).addRecording(pieceId, video, student.id, isPrimary);
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, recordings: [...p.recordings, rec] } : p));
    } catch (err) { console.error(err); }
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
    } catch (err) { console.error(err); }
  }

  async function handleSetPrimary(pieceId: string, recordingId: string) {
    try {
      await PieceService.getInstance(supabase).setPrimaryRecording(pieceId, recordingId);
      setPieces(prev => prev.map(p =>
        p.id === pieceId
          ? { ...p, recordings: p.recordings.map((r: PieceRecording) => ({ ...r, is_primary: r.id === recordingId })) }
          : p
      ));
    } catch (err) { console.error(err); }
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
    padding: "0.5rem 1rem", borderRadius: 8, border: "1.5px solid var(--border-strong)",
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
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>My Pieces</span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", margin: "0.5rem 0 0", lineHeight: 1.5 }}>
          Your teacher&apos;s assignments — tap a piece to see your goals and sheet music.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: section.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--charcoal)" }}>
                  {section.label}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {section.pieces.map(piece => {
                  const total    = piece.goals.length;
                  const done     = piece.goals.filter(g => g.status === "completed").length;
                  const current  = piece.goals.filter(g => g.status === "current").length;
                  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
                  const playing  = isPlaying(piece);
                  const hasRecs  = piece.recordings.length > 0;
                  const managing = managingPieceId === piece.id;
                  const statusCfg = STATUS_CONFIG[piece.status] ?? { label: piece.status, emoji: "📌", color: "var(--muted)", bg: "rgba(0,0,0,0.04)" };

                  return (
                    <div key={piece.id} style={{
                      background: "var(--white)",
                      border: playing ? "2px solid var(--charcoal)" : "1px solid var(--border)",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                    }}>
                      {/* Card body */}
                      <div style={{ padding: "1rem 1.25rem 0.875rem" }}>

                        {/* Top row: status badge */}
                        <div style={{ marginBottom: "0.5rem" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "0.3rem",
                            padding: "0.2rem 0.625rem", borderRadius: 99,
                            background: statusCfg.bg, color: statusCfg.color,
                            fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem",
                          }}>
                            {statusCfg.emoji} {statusCfg.label}
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
                                {done === total ? "🎉 All goals done!" : `${done} of ${total} goals done`}
                                {current > 0 && done < total && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {current} in progress</span>}
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
                            No goals assigned yet
                          </div>
                        )}
                      </div>

                      {/* Action row */}
                      <div style={{ padding: "0 1.25rem 1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        {/* Listen / Find recording */}
                        {hasRecs ? (
                          <button
                            onClick={() => playing ? player.stop() : handlePlayPiece(piece)}
                            style={playing ? { ...btnPrimary, background: "#3A6B55" } : btnPrimary}
                          >
                            {playing ? "⏸ Pause" : "▶ Listen"}
                            {piece.recordings.length > 1 && !playing && (
                              <span style={{ opacity: 0.6, fontWeight: 400 }}>({piece.recordings.length})</span>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => setSearchOpenFor(searchOpenFor === piece.id ? null : piece.id)}
                            style={btnOutline}
                          >
                            🔍 Find a recording
                          </button>
                        )}

                        {/* Sheet music */}
                        {piece.sheet_music_url ? (
                          <a
                            href={piece.sheet_music_url.startsWith("[")
                              ? JSON.parse(piece.sheet_music_url as string)[0]
                              : piece.sheet_music_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...btnOutline, textDecoration: "none" }}
                          >
                            📄 Sheet Music
                          </a>
                        ) : (
                          <button
                            onClick={() => openFilePicker(piece.id)}
                            disabled={uploadingFor === piece.id}
                            style={btnGhost}
                          >
                            {uploadingFor === piece.id ? "⏳ Uploading…" : "📄 Upload sheet music"}
                          </button>
                        )}

                        {/* More / manage toggle */}
                        <button
                          onClick={() => setManagingPieceId(managing ? null : piece.id)}
                          style={{
                            ...btnGhost,
                            marginLeft: "auto",
                            background: managing ? "var(--cream-deep, #f0ede8)" : "transparent",
                            color: managing ? "var(--charcoal)" : "var(--muted)",
                          }}
                          title="Manage recordings & sheet music"
                        >
                          {managing ? "▲ Close" : "··· More"}
                        </button>
                      </div>

                      {/* Quick search (for pieces with no recordings) */}
                      {searchOpenFor === piece.id && (
                        <div style={{ padding: "0 1.25rem 1rem" }}>
                          <div style={{ background: "var(--cream)", borderRadius: 8, border: "1px solid var(--border)", padding: "0.875rem" }}>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", fontWeight: 500, marginBottom: "0.5rem" }}>
                              Search for a recording to listen to:
                            </div>
                            <YouTubeSearch
                              placeholder={`${piece.title}${piece.composer ? ` ${piece.composer}` : ""}…`}
                              onSelect={(v: YouTubeResult) => handleSearchPlay(v)}
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

                          {/* Sheet music section */}
                          <div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
                              📄 Sheet Music
                            </div>
                            {piece.sheet_music_url ? (
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#3A7A5A" }}>
                                  ✓ Sheet music uploaded
                                  {piece.sheet_music_url.startsWith("[") && ` (${JSON.parse(piece.sheet_music_url).length} pages)`}
                                </span>
                                <button onClick={() => openFilePicker(piece.id)} style={btnGhost}>
                                  🔄 Replace
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                <button
                                  onClick={() => openFilePicker(piece.id)}
                                  disabled={uploadingFor === piece.id}
                                  style={btnOutline}
                                >
                                  {uploadingFor === piece.id ? "⏳ Uploading…" : "📤 Upload PDF or image"}
                                </button>
                                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                                  PDF or image files
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Recordings section */}
                          <div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
                              🎵 Recordings
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
                                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#C07A1A", marginTop: "0.125rem" }}>★ Main recording</div>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                                      {!rec.is_primary && (
                                        <button onClick={() => handleSetPrimary(piece.id, rec.id)} title="Set as main" style={btnGhost}>★</button>
                                      )}
                                      <button onClick={() => handleRemoveRecording(piece.id, rec.id)} title="Remove" style={{ ...btnGhost, color: "#C05050" }}>✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                              {piece.recordings.length === 0 ? "Add a YouTube recording to listen to:" : "Add another recording:"}
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
