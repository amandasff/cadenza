"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { Inspiration, YouTubeResult } from "../../../lib/types";
import YouTubeSearch from "../../../components/YouTubeSearch";
import { usePlayer } from "../../../lib/context/PlayerContext";

export default function InspirationPage() {
  const { user } = useAuth();
  const player = usePlayer();
  const supabase = getSupabaseBrowserClient();

  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Collections
  const [activeCollection, setActiveCollection] = useState<string>("all");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const newCollectionInputRef = useRef<HTMLInputElement>(null);

  // Collection picker per card
  const [collectionPickerFor, setCollectionPickerFor] = useState<string | null>(null);

  // Notes editing
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

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

  // Close collection picker when clicking outside
  useEffect(() => {
    if (!collectionPickerFor) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-collection-picker]")) setCollectionPickerFor(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [collectionPickerFor]);

  // Derived collections list
  const collections = Array.from(
    new Set(inspirations.map(i => i.collection_name).filter(Boolean) as string[])
  ).sort();

  const filtered = activeCollection === "all"
    ? inspirations
    : inspirations.filter(i => i.collection_name === activeCollection);

  async function handleSave(video: YouTubeResult) {
    if (!user?.id) return;
    setSaving(video.id);
    const { data, error } = await supabase
      .from("inspirations")
      .upsert({
        user_id: user.id,
        youtube_id: video.id,
        title: video.title,
        thumbnail_url: video.thumbnail || null,
      }, { onConflict: "user_id,youtube_id" })
      .select()
      .single();
    if (!error && data) {
      setInspirations(prev => {
        if (prev.some(i => i.youtube_id === video.id)) return prev;
        return [data as Inspiration, ...prev];
      });
      player.play({ id: video.id, title: video.title, thumbnail: video.thumbnail || undefined });
    }
    setSaving(null);
  }

  async function handleRemove(inspiration: Inspiration) {
    await supabase.from("inspirations").delete().eq("id", inspiration.id);
    setInspirations(prev => prev.filter(i => i.id !== inspiration.id));
    if (player.current?.id === inspiration.youtube_id) player.stop();
  }

  async function assignCollection(inspirationId: string, name: string | null) {
    await supabase.from("inspirations").update({ collection_name: name }).eq("id", inspirationId);
    setInspirations(prev => prev.map(i => i.id === inspirationId ? { ...i, collection_name: name } : i));
    setCollectionPickerFor(null);
  }

  function startNewCollection() {
    setShowNewCollection(true);
    setTimeout(() => newCollectionInputRef.current?.focus(), 50);
  }

  function confirmNewCollection(inspirationId: string) {
    const name = newCollectionName.trim();
    if (!name) { setShowNewCollection(false); setNewCollectionName(""); return; }
    assignCollection(inspirationId, name);
    setShowNewCollection(false);
    setNewCollectionName("");
    setActiveCollection(name);
  }

  function startEditNote(ins: Inspiration) {
    setEditingNoteFor(ins.id);
    setNoteText(ins.notes ?? "");
  }

  async function saveNote(ins: Inspiration) {
    const text = noteText.trim() || null;
    await supabase.from("inspirations").update({ notes: text }).eq("id", ins.id);
    setInspirations(prev => prev.map(i => i.id === ins.id ? { ...i, notes: text } : i));
    setEditingNoteFor(null);
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%", padding: "1.5rem 1.5rem 5rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.625rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Inspirations
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center", margin: 0 }}>
          Listen to pieces, leave notes, and organise what you want to work on
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "1.25rem" }}>
        <YouTubeSearch
          placeholder="Search YouTube for RCM pieces, composers, styles…"
          onSelect={handleSave}
        />
        {saving && (
          <div style={{ marginTop: "0.375rem", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
            Saving…
          </div>
        )}
      </div>

      {/* Collections tabs */}
      {!loading && inspirations.length > 0 && (
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
          {(["all", ...collections] as string[]).map(col => (
            <button
              key={col}
              onClick={() => setActiveCollection(col)}
              style={{
                padding: "0.3rem 0.875rem", borderRadius: 99, border: "1px solid",
                borderColor: activeCollection === col ? "var(--charcoal)" : "var(--border)",
                background: activeCollection === col ? "var(--charcoal)" : "var(--white)",
                color: activeCollection === col ? "var(--white)" : "var(--charcoal)",
                fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: activeCollection === col ? 600 : 400,
                cursor: "pointer", transition: "all 0.12s",
              }}
            >
              {col === "all" ? `All (${inspirations.length})` : col}
            </button>
          ))}
          <button
            onClick={() => {}}
            title="Create a new collection by assigning a piece to it"
            style={{
              padding: "0.3rem 0.75rem", borderRadius: 99,
              border: "1px dashed var(--border)", background: "transparent",
              color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem",
              cursor: "default",
            }}
          >
            + add via card below
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ aspectRatio: "16/9", borderRadius: 4 }} />)}
        </div>
      ) : filtered.length === 0 && activeCollection !== "all" ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">No pieces in "{activeCollection}"</div>
          <p className="empty-state-desc">Assign pieces to this collection using the folder icon on each card.</p>
        </div>
      ) : inspirations.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <div className="empty-state-title">Nothing saved yet</div>
          <p className="empty-state-desc">Search above to find RCM pieces and save them here as inspiration.</p>
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
                  borderRadius: 8, overflow: "visible", background: "var(--white)",
                  transition: "border-color 0.15s", position: "relative",
                  display: "flex", flexDirection: "column",
                }}
              >
                {/* Thumbnail */}
                <div
                  onClick={() => isPlaying ? player.stop() : player.play({ id: ins.youtube_id, title: ins.title, thumbnail: ins.thumbnail_url ?? undefined })}
                  style={{ cursor: "pointer", borderRadius: "8px 8px 0 0", overflow: "hidden", position: "relative" }}
                >
                  {ins.thumbnail_url ? (
                    <img src={ins.thumbnail_url} alt={ins.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>▶</div>
                  )}
                  {isPlaying && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ color: "#fff", fontSize: "1.5rem" }}>⏸</div>
                    </div>
                  )}
                </div>

                {/* Title + actions */}
                <div style={{ padding: "0.5rem 0.625rem 0.5rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {ins.title}
                  </div>

                  {/* Collection badge */}
                  {ins.collection_name && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--cream)", borderRadius: 4, padding: "0.1rem 0.375rem", alignSelf: "flex-start" }}>
                      {ins.collection_name}
                    </div>
                  )}

                  {/* Note */}
                  {isEditingNote ? (
                    <textarea
                      autoFocus
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onBlur={() => saveNote(ins)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(ins); } if (e.key === "Escape") setEditingNoteFor(null); }}
                      placeholder="Add a note… (e.g. bring to teacher, too hard?)"
                      rows={2}
                      style={{
                        width: "100%", resize: "none", fontFamily: "Inter, sans-serif",
                        fontSize: "0.6875rem", color: "var(--charcoal)", lineHeight: 1.5,
                        border: "1px solid var(--border-strong)", borderRadius: 4,
                        padding: "0.25rem 0.375rem", background: "var(--cream)",
                        boxSizing: "border-box", outline: "none",
                      }}
                    />
                  ) : ins.notes ? (
                    <div
                      onClick={() => startEditNote(ins)}
                      title="Click to edit note"
                      style={{
                        fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)",
                        fontStyle: "italic", lineHeight: 1.4, cursor: "text",
                        borderLeft: "2px solid var(--border)", paddingLeft: "0.375rem",
                        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                      }}
                    >
                      {ins.notes}
                    </div>
                  ) : null}

                  {/* Action row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "0.25rem" }}>
                    <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                      {/* Note button */}
                      <button
                        onClick={() => isEditingNote ? null : startEditNote(ins)}
                        title={ins.notes ? "Edit note" : "Add note"}
                        style={{
                          background: ins.notes ? "var(--cream)" : "none", border: ins.notes ? "1px solid var(--border)" : "none",
                          cursor: "pointer", padding: ins.notes ? "0.1rem 0.3rem" : "0",
                          borderRadius: 4, color: "var(--muted)", fontSize: "0.6875rem", lineHeight: 1,
                        }}
                      >
                        {ins.notes ? "✏️" : "📝"}
                      </button>

                      {/* Collection picker button */}
                      <div style={{ position: "relative" }} data-collection-picker>
                        <button
                          onClick={() => setCollectionPickerFor(isPickingCollection ? null : ins.id)}
                          title="Add to collection"
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--muted)", fontSize: "0.6875rem", lineHeight: 1, padding: 0,
                          }}
                        >
                          📁
                        </button>

                        {/* Collection dropdown */}
                        {isPickingCollection && (
                          <div
                            data-collection-picker
                            style={{
                              position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                              background: "var(--white)", border: "1px solid var(--border)",
                              borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                              minWidth: 180, zIndex: 50, overflow: "hidden",
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
                                    {ins.collection_name === col ? "✓ " : ""}{col}
                                  </button>
                                ))}
                                <div style={{ height: 1, background: "var(--border)", margin: "0.25rem 0" }} />
                              </>
                            )}
                            {ins.collection_name && (
                              <button
                                onClick={() => assignCollection(ins.id, null)}
                                style={{
                                  display: "block", width: "100%", textAlign: "left",
                                  padding: "0.5rem 0.875rem", border: "none", background: "none",
                                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                                  color: "var(--muted)", cursor: "pointer",
                                }}
                              >
                                Remove from collection
                              </button>
                            )}
                            {showNewCollection ? (
                              <div style={{ padding: "0.5rem 0.75rem", display: "flex", gap: "0.375rem" }}>
                                <input
                                  ref={newCollectionInputRef}
                                  value={newCollectionName}
                                  onChange={e => setNewCollectionName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") confirmNewCollection(ins.id);
                                    if (e.key === "Escape") { setShowNewCollection(false); setNewCollectionName(""); }
                                  }}
                                  placeholder="Collection name…"
                                  style={{
                                    flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.75rem",
                                    border: "1px solid var(--border-strong)", borderRadius: 4,
                                    padding: "0.25rem 0.375rem", outline: "none", background: "var(--cream)",
                                  }}
                                />
                                <button
                                  onClick={() => confirmNewCollection(ins.id)}
                                  style={{
                                    padding: "0.25rem 0.5rem", borderRadius: 4, border: "none",
                                    background: "var(--charcoal)", color: "var(--white)",
                                    fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", cursor: "pointer",
                                  }}
                                >
                                  ✓
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={startNewCollection}
                                style={{
                                  display: "block", width: "100%", textAlign: "left",
                                  padding: "0.5rem 0.875rem", border: "none", background: "none",
                                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                                  color: "var(--charcoal)", fontWeight: 500, cursor: "pointer",
                                }}
                              >
                                + New collection
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(ins)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", padding: "0 0.125rem" }}
                      title="Remove"
                    >
                      ✕
                    </button>
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
