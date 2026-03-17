"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { Inspiration, YouTubeResult } from "../../../lib/types";
import YouTubeSearch from "../../../components/YouTubeSearch";
import { usePlayer } from "../../../lib/context/PlayerContext";
import { useI18n } from "../../../lib/context/I18nContext";
import { Play, Pause, Check } from "lucide-react";

export default function InspirationPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const player = usePlayer();
  const supabase = getSupabaseBrowserClient();

  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Collections / playlists
  const [activeCollection, setActiveCollection] = useState<string>("all");
  const [collectionPickerFor, setCollectionPickerFor] = useState<string | null>(null);
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const newCollectionInputRef = useRef<HTMLInputElement>(null);

  // Notes
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ id: string; state: "saving" | "saved" | "error" } | null>(null);


  // Load inspirations
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("inspirations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setInspirations((data ?? []) as Inspiration[]);
    setLoading(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Close collection picker on outside click
  useEffect(() => {
    if (!collectionPickerFor) return;
    function handler(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-col-picker]")) setCollectionPickerFor(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [collectionPickerFor]);

  const collections = Array.from(
    new Set(inspirations.map(i => i.collection_name).filter(Boolean) as string[])
  ).sort();

  const filtered = activeCollection === "all"
    ? inspirations
    : inspirations.filter(i => i.collection_name === activeCollection);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async function handleSave(video: YouTubeResult) {
    if (!user?.id) return;
    setSaving(video.id);
    const { data, error } = await supabase
      .from("inspirations")
      .upsert({ user_id: user.id, youtube_id: video.id, title: video.title, thumbnail_url: video.thumbnail || null }, { onConflict: "user_id,youtube_id" })
      .select().single();
    if (!error && data) {
      setInspirations(prev => prev.some(i => i.youtube_id === video.id) ? prev : [data as Inspiration, ...prev]);
      player.play({ id: video.id, title: video.title, thumbnail: video.thumbnail || undefined });
    }
    setSaving(null);
  }

  async function handleRemove(ins: Inspiration) {
    await supabase.from("inspirations").delete().eq("id", ins.id);
    setInspirations(prev => prev.filter(i => i.id !== ins.id));
    if (player.current?.id === ins.youtube_id) player.stop();
  }

  async function assignCollection(insId: string, name: string | null) {
    setSaveStatus({ id: insId, state: "saving" });
    const { error } = await supabase.from("inspirations").update({ collection_name: name }).eq("id", insId);
    if (error) {
      setSaveStatus({ id: insId, state: "error" });
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setInspirations(prev => prev.map(i => i.id === insId ? { ...i, collection_name: name } : i));
      setSaveStatus({ id: insId, state: "saved" });
      setTimeout(() => setSaveStatus(null), 1500);
    }
    setCollectionPickerFor(null);
    setShowNewCollectionInput(false);
    setNewCollectionName("");
  }

  function confirmNewCollection(insId: string) {
    const name = newCollectionName.trim();
    if (!name) { setShowNewCollectionInput(false); setNewCollectionName(""); return; }
    assignCollection(insId, name);
    setActiveCollection(name);
  }

  async function saveNote(ins: Inspiration) {
    const text = noteText.trim() || null;
    setSaveStatus({ id: ins.id, state: "saving" });
    const { error } = await supabase.from("inspirations").update({ notes: text }).eq("id", ins.id);
    if (error) {
      setSaveStatus({ id: ins.id, state: "error" });
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setInspirations(prev => prev.map(i => i.id === ins.id ? { ...i, notes: text } : i));
      setSaveStatus({ id: ins.id, state: "saved" });
      setTimeout(() => setSaveStatus(null), 1500);
      setEditingNoteFor(null);
    }
  }

  async function togglePublic(ins: Inspiration) {
    const next = !ins.is_public;
    setSaveStatus({ id: ins.id, state: "saving" });
    const { error } = await supabase.from("inspirations").update({ is_public: next }).eq("id", ins.id);
    if (error) {
      setSaveStatus({ id: ins.id, state: "error" });
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setInspirations(prev => prev.map(i => i.id === ins.id ? { ...i, is_public: next } : i));
      setSaveStatus({ id: ins.id, state: "saved" });
      setTimeout(() => setSaveStatus(null), 1500);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const showEmptyAll = !loading && inspirations.length === 0;
  const showEmptyCollection = !loading && inspirations.length > 0 && filtered.length === 0 && activeCollection !== "all";

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%", padding: "1.5rem 1.5rem 5rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.625rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t.student.inspirationsTitle}
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", margin: 0 }}>
          {t.student.inspirationsDesc}
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "1.5rem" }}>
        <YouTubeSearch
          placeholder={t.student.searchInspirations}
          onSelect={handleSave}
        />
        {saving && (
          <div style={{ marginTop: "0.375rem", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>{t.common.saving}</div>
        )}
      </div>

      {/* Playlist tabs + share */}
      {!loading && inspirations.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center" }}>
            {(["all", ...collections] as string[]).map(col => (
              <button
                key={col}
                onClick={() => setActiveCollection(col)}
                style={{
                  padding: "0.3rem 0.875rem", borderRadius: 99, border: "1px solid",
                  borderColor: activeCollection === col ? "var(--charcoal)" : "var(--border)",
                  background: activeCollection === col ? "var(--charcoal)" : "var(--white)",
                  color: activeCollection === col ? "var(--white)" : "var(--charcoal)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.75rem",
                  fontWeight: activeCollection === col ? 600 : 400,
                  cursor: "pointer", transition: "all 0.12s",
                }}
              >
                {col === "all" ? t.student.allCount.replace("{n}", String(inspirations.length)) : col}
              </button>
            ))}
          </div>

          {/* Playlist-level sharing */}
          {activeCollection !== "all" && (
            <div style={{ marginTop: "0.625rem", display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
              <button
                onClick={async () => {
                  const ids = filtered.filter(i => !i.is_public).map(i => i.id);
                  if (!ids.length) return;
                  await supabase.from("inspirations").update({ is_public: true }).in("id", ids);
                  setInspirations(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_public: true } : i));
                }}
                style={{
                  padding: "0.3rem 0.875rem", borderRadius: 99, border: "none",
                  background: "var(--charcoal)", color: "var(--white)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                {t.student.sharePlaylistWithTeacher.replace("{name}", activeCollection)}
              </button>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                {t.student.orToggleBelow}
              </span>
            </div>
          )}
          {activeCollection === "all" && (
            <div style={{ marginTop: "0.625rem" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                {t.student.useToggleHint}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.875rem" }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ aspectRatio: "16/9", borderRadius: 8 }} />)}
        </div>
      ) : showEmptyAll ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">{t.student.nothingSavedYet}</div>
          <p className="empty-state-desc">{t.student.nothingSavedDesc}</p>
        </div>
      ) : showEmptyCollection ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">{t.student.noPiecesInPlaylist.replace("{name}", activeCollection)}</div>
          <p className="empty-state-desc">{t.student.addToPlaylistHint}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.875rem" }}>
          {filtered.map(ins => {
            const isPlaying = player.current?.id === ins.youtube_id;
            const isEditingNote = editingNoteFor === ins.id;
            const isPickingCollection = collectionPickerFor === ins.id;

            return (
              <div
                key={ins.id}
                style={{
                  border: isPlaying ? "2px solid var(--charcoal)" : "1px solid var(--border)",
                  borderRadius: 10, background: "var(--white)",
                  transition: "border-color 0.15s",
                  display: "flex", flexDirection: "column",
                }}
              >
                {/* Thumbnail */}
                <div
                  onClick={() => isPlaying ? player.stop() : player.play({ id: ins.youtube_id, title: ins.title, thumbnail: ins.thumbnail_url ?? undefined })}
                  style={{ cursor: "pointer", borderRadius: "10px 10px 0 0", overflow: "hidden", position: "relative" }}
                >
                  {ins.thumbnail_url ? (
                    <img src={ins.thumbnail_url} alt={ins.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={32} strokeWidth={1.5} color="var(--muted)" /></div>
                  )}
                  {/* Play/pause overlay */}
                  <div style={{
                    position: "absolute", inset: 0, background: isPlaying ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}>
                    {isPlaying && <div style={{ color: "#fff", lineHeight: 1 }}><Pause size={28} strokeWidth={1.5} /></div>}
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "0.625rem 0.75rem 0.625rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {/* Title */}
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {ins.title}
                  </div>

                  {/* Playlist badge */}
                  {ins.collection_name && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--cream)", borderRadius: 4, padding: "0.1rem 0.375rem" }}>
                        {ins.collection_name}
                      </div>
                    </div>
                  )}

                  {/* Note display */}
                  {!isEditingNote && ins.notes && (
                    <div
                      onClick={() => { setEditingNoteFor(ins.id); setNoteText(ins.notes ?? ""); }}
                      title="Click to edit note"
                      style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", fontStyle: "italic", lineHeight: 1.4, cursor: "text", borderLeft: "2px solid var(--border)", paddingLeft: "0.375rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
                    >
                      {ins.notes}
                    </div>
                  )}

                  {/* Note textarea */}
                  {isEditingNote && (
                    <textarea
                      autoFocus
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onBlur={() => saveNote(ins)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(ins); } if (e.key === "Escape") setEditingNoteFor(null); }}
                      placeholder="e.g. bring to teacher, love this!, too hard?"
                      rows={2}
                      style={{ width: "100%", resize: "none", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", lineHeight: 1.5, border: "1px solid var(--border-strong)", borderRadius: 4, padding: "0.25rem 0.375rem", background: "var(--cream)", boxSizing: "border-box", outline: "none" }}
                    />
                  )}

                  {/* Action row */}
                  <div style={{ marginTop: "auto", paddingTop: "0.375rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {/* Save status */}
                    {saveStatus?.id === ins.id && (
                      <div style={{
                        fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600,
                        color: saveStatus.state === "error" ? "#C0392B" : saveStatus.state === "saved" ? "#2E7D52" : "var(--muted)",
                        textAlign: "center",
                      }}>
                        {saveStatus.state === "saving" ? t.common.saving : saveStatus.state === "saved" ? t.student.savedCheck : "⚠ Couldn't save — DB column missing (see below)"}
                      </div>
                    )}
                    {/* Note + remove row */}
                    <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", justifyContent: "space-between" }}>
                      <button
                        onClick={() => { setEditingNoteFor(ins.id); setNoteText(ins.notes ?? ""); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", padding: 0, textAlign: "left" }}
                      >
                        {ins.notes ? t.student.editNote : t.student.addNote}
                      </button>
                      <button
                        onClick={() => handleRemove(ins)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", padding: 0 }}
                        title="Remove from inspirations"
                      >
                        {t.common.remove}
                      </button>
                    </div>

                    {/* Visible to teacher toggle */}
                    <button
                      onClick={() => togglePublic(ins)}
                      title={ins.is_public ? "Your teacher can see this — click to make private" : "Only you can see this — click to share with teacher"}
                      style={{
                        width: "100%", padding: "0.3rem 0.5rem", borderRadius: 6,
                        border: `1px solid ${ins.is_public ? "#2E7D52" : "var(--border)"}`,
                        background: ins.is_public ? "#F0FBF4" : "none",
                        fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
                        color: ins.is_public ? "#2E7D52" : "var(--muted)",
                        cursor: "pointer", textAlign: "left", fontWeight: ins.is_public ? 600 : 400,
                        display: "flex", alignItems: "center", gap: "0.35rem",
                      }}
                    >
                      {ins.is_public ? t.student.visibleToTeacher : t.student.privateShareWithTeacher}
                    </button>

                    {/* Playlist row */}
                    <div style={{ position: "relative" }} data-col-picker>
                      <button
                        onClick={() => { setCollectionPickerFor(isPickingCollection ? null : ins.id); setShowNewCollectionInput(false); setNewCollectionName(""); }}
                        style={{
                          width: "100%", padding: "0.3rem 0.5rem", borderRadius: 6,
                          border: "1px solid var(--border)", background: "none",
                          fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
                          color: "var(--charcoal)", cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}
                      >
                        <span>📂 {ins.collection_name ? t.student.inPlaylist.replace("{name}", ins.collection_name) : t.student.addToPlaylist}</span>
                        <span style={{ color: "var(--muted)" }}>▾</span>
                      </button>

                      {/* Playlist dropdown */}
                      {isPickingCollection && (
                        <div
                          data-col-picker
                          style={{
                            position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0,
                            background: "var(--white)", border: "1px solid var(--border)",
                            borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden",
                          }}
                        >
                          {collections.length > 0 && (
                            <>
                              {collections.map(col => (
                                <button
                                  key={col}
                                  onClick={() => assignCollection(ins.id, col)}
                                  style={{
                                    display: "block", width: "100%", textAlign: "left",
                                    padding: "0.5rem 0.875rem", border: "none", background: "none",
                                    fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                                    color: ins.collection_name === col ? "var(--charcoal)" : "var(--muted)",
                                    fontWeight: ins.collection_name === col ? 600 : 400,
                                    cursor: "pointer",
                                  }}
                                >
                                  {ins.collection_name === col ? <><Check size={12} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} /></> : ""}{col}
                                </button>
                              ))}
                              <div style={{ height: 1, background: "var(--border)" }} />
                            </>
                          )}

                          {ins.collection_name && (
                            <button
                              onClick={() => assignCollection(ins.id, null)}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.875rem", border: "none", background: "none", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", cursor: "pointer" }}
                            >
                              {t.student.removeFromPlaylist}
                            </button>
                          )}

                          {showNewCollectionInput ? (
                            <div style={{ padding: "0.5rem 0.75rem", display: "flex", gap: "0.375rem" }}>
                              <input
                                ref={newCollectionInputRef}
                                autoFocus
                                value={newCollectionName}
                                onChange={e => setNewCollectionName(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") confirmNewCollection(ins.id); if (e.key === "Escape") { setShowNewCollectionInput(false); setNewCollectionName(""); } }}
                                placeholder="Playlist name…"
                                style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.75rem", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "0.25rem 0.375rem", outline: "none", background: "var(--cream)" }}
                              />
                              <button
                                onClick={() => confirmNewCollection(ins.id)}
                                style={{ padding: "0.25rem 0.5rem", borderRadius: 4, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", cursor: "pointer" }}
                              >
                                {t.common.save}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setShowNewCollectionInput(true); setTimeout(() => newCollectionInputRef.current?.focus(), 30); }}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.875rem", border: "none", background: "none", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", fontWeight: 500, cursor: "pointer" }}
                            >
                              {t.student.createNewPlaylist}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
