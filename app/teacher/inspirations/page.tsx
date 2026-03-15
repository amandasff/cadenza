"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import type { Inspiration, InspirationComment, YouTubeResult } from "../../../lib/types";
import type { Teacher } from "../../../lib/models/Teacher";
import YouTubeSearch from "../../../components/YouTubeSearch";

interface StudentPick extends Inspiration {
  student_name: string;
  comments: InspirationComment[];
  showComments: boolean;
}

export default function TeacherInspirationPage() {
  const { user } = useAuth();
  const teacher = user as Teacher | null;
  const supabase = getSupabaseBrowserClient();

  const [tab, setTab] = useState<"mine" | "students">("mine");

  // ── My inspirations ──────────────────────────────────────────────────────────
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
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

  useEffect(() => { loadMine(); }, [loadMine]);

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
      setPlayingId(video.id);
    }
    setSaving(null);
  }

  async function handleRemoveMine(inspiration: Inspiration) {
    await supabase.from("inspirations").delete().eq("id", inspiration.id);
    setInspirations(prev => prev.filter(i => i.id !== inspiration.id));
    if (playingId === inspiration.youtube_id) setPlayingId(null);
  }

  const playing = inspirations.find(i => i.youtube_id === playingId);

  // ── Student picks ────────────────────────────────────────────────────────────
  const [picks, setPicks] = useState<StudentPick[]>([]);
  const [picksLoading, setPicksLoading] = useState(false);
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [teacherDisplayName, setTeacherDisplayName] = useState<string>("");

  const loadStudentPicks = useCallback(async () => {
    if (!teacher?.studioId || !user?.id) return;
    setPicksLoading(true);

    // Get teacher display name for comments
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    setTeacherDisplayName(myProfile?.display_name ?? "Teacher");

    // Get all students in this studio
    const { data: students } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("studio_id", teacher.studioId)
      .eq("role", "student");

    if (!students?.length) { setPicks([]); setPicksLoading(false); return; }

    const studentMap: Record<string, string> = {};
    students.forEach((s: { id: string; display_name: string }) => { studentMap[s.id] = s.display_name; });

    // Get their public inspirations
    const { data: insps } = await supabase
      .from("inspirations")
      .select("*")
      .eq("is_public", true)
      .in("user_id", students.map((s: { id: string }) => s.id))
      .order("created_at", { ascending: false });

    if (!insps?.length) { setPicks([]); setPicksLoading(false); return; }

    // Get comments on those inspirations
    const { data: comments } = await supabase
      .from("inspiration_comments")
      .select("*")
      .in("inspiration_id", insps.map((i: Inspiration) => i.id))
      .order("created_at", { ascending: true });

    const commentsByInsp: Record<string, InspirationComment[]> = {};
    (comments ?? []).forEach((c: InspirationComment) => {
      if (!commentsByInsp[c.inspiration_id]) commentsByInsp[c.inspiration_id] = [];
      commentsByInsp[c.inspiration_id].push(c);
    });

    setPicks(insps.map((ins: Inspiration) => ({
      ...ins,
      student_name: studentMap[ins.user_id] ?? "Student",
      comments: commentsByInsp[ins.id] ?? [],
      showComments: false,
    })));
    setPicksLoading(false);
  }, [teacher?.studioId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "students") loadStudentPicks();
  }, [tab, loadStudentPicks]);

  function toggleComments(insId: string) {
    setPicks(prev => prev.map(p => p.id === insId ? { ...p, showComments: !p.showComments } : p));
  }

  async function submitComment(ins: StudentPick) {
    const text = newComments[ins.id]?.trim();
    if (!text || !user?.id) return;
    setSubmittingComment(ins.id);
    const { data, error } = await supabase
      .from("inspiration_comments")
      .insert({ inspiration_id: ins.id, user_id: user.id, display_name: teacherDisplayName, content: text })
      .select()
      .single();
    if (!error && data) {
      setPicks(prev => prev.map(p =>
        p.id === ins.id ? { ...p, comments: [...p.comments, data as InspirationComment], showComments: true } : p
      ));
      setNewComments(prev => ({ ...prev, [ins.id]: "" }));
    }
    setSubmittingComment(null);
  }

  // Group picks by student
  const picksByStudent: Record<string, { name: string; items: StudentPick[] }> = {};
  picks.forEach(p => {
    if (!picksByStudent[p.user_id]) picksByStudent[p.user_id] = { name: p.student_name, items: [] };
    picksByStudent[p.user_id].items.push(p);
  });

  return (
    <div className="teacher-main" style={{ padding: "2rem 1.5rem 3rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
          fontSize: "1.5rem", color: "var(--charcoal)", margin: "0 0 0.375rem",
        }}>
          Inspirations
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
          Your music mood board, plus pieces your students want to share
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        {(["mine", "students"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 1.25rem", border: "none", background: "none", cursor: "pointer",
              fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--charcoal)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid var(--charcoal)" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.12s",
            }}
          >
            {t === "mine" ? "My Inspirations" : "Student Picks"}
          </button>
        ))}
      </div>

      {/* ── MY INSPIRATIONS TAB ─────────────────────────────────────────────── */}
      {tab === "mine" && (
        <>
          {/* Search */}
          <div style={{ maxWidth: 640, marginBottom: "1.5rem" }}>
            <YouTubeSearch
              placeholder="Search YouTube for music to inspire you…"
              onSelect={handleSave}
            />
            {saving && (
              <div style={{ marginTop: "0.375rem", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
                Saving…
              </div>
            )}
          </div>

          {/* Now playing */}
          {playing && (
            <div style={{ maxWidth: 640, marginBottom: "1.5rem", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", background: "var(--charcoal)" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.375rem 0.75rem", background: "var(--cream)", borderBottom: "1px solid var(--border)",
              }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "0.5rem" }}>
                  {playing.title}
                </span>
                <button onClick={() => setPlayingId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", lineHeight: 1, padding: 0 }}>✕</button>
              </div>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${playing.youtube_id}?autoplay=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                  title={playing.title}
                />
              </div>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ aspectRatio: "16/9", borderRadius: 4 }} />)}
            </div>
          ) : inspirations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>Nothing saved yet</div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>Search above to find music and build your mood board.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
              {inspirations.map(ins => (
                <div
                  key={ins.id}
                  style={{
                    border: playingId === ins.youtube_id ? "2px solid var(--charcoal)" : "1px solid var(--border)",
                    borderRadius: 4, overflow: "hidden", background: "var(--white)", cursor: "pointer",
                  }}
                >
                  <div onClick={() => setPlayingId(playingId === ins.youtube_id ? null : ins.youtube_id)}>
                    {ins.thumbnail_url ? (
                      <img src={ins.thumbnail_url} alt={ins.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>▶</div>
                    )}
                  </div>
                  <div style={{ padding: "0.625rem 0.75rem 0.5rem" }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {ins.title}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                      <button
                        onClick={() => setPlayingId(playingId === ins.youtube_id ? null : ins.youtube_id)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}
                      >
                        {playingId === ins.youtube_id ? "▶ Playing" : "▶ Play"}
                      </button>
                      <button
                        onClick={() => handleRemoveMine(ins)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", padding: "0 0.125rem" }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── STUDENT PICKS TAB ───────────────────────────────────────────────── */}
      {tab === "students" && (
        <>
          {picksLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ aspectRatio: "16/9", borderRadius: 8 }} />)}
            </div>
          ) : picks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                No student picks yet
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
                When students mark an inspiration as "Visible to teacher" it will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {Object.entries(picksByStudent).map(([studentId, group]) => (
                <div key={studentId}>
                  {/* Student name heading */}
                  <div style={{
                    fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600,
                    color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em",
                    marginBottom: "0.75rem",
                  }}>
                    {group.name}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
                    {group.items.map(ins => (
                      <div
                        key={ins.id}
                        style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--white)", display: "flex", flexDirection: "column" }}
                      >
                        {/* Thumbnail */}
                        <a
                          href={`https://www.youtube.com/watch?v=${ins.youtube_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "block", position: "relative" }}
                        >
                          {ins.thumbnail_url ? (
                            <img src={ins.thumbnail_url} alt={ins.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                          ) : (
                            <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>▶</div>
                          )}
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0)", transition: "background 0.15s" }} className="play-overlay" />
                        </a>

                        {/* Card body */}
                        <div style={{ padding: "0.625rem 0.75rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {ins.title}
                          </div>

                          {/* Collection badge */}
                          {ins.collection_name && (
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--cream)", borderRadius: 4, padding: "0.1rem 0.375rem", alignSelf: "flex-start" }}>
                              {ins.collection_name}
                            </div>
                          )}

                          {/* Student note */}
                          {ins.notes && (
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", fontStyle: "italic", lineHeight: 1.4, borderLeft: "2px solid var(--border)", paddingLeft: "0.375rem" }}>
                              {ins.notes}
                            </div>
                          )}

                          {/* Comment toggle */}
                          <button
                            onClick={() => toggleComments(ins.id)}
                            style={{
                              marginTop: "auto", borderTop: "1px solid var(--border)",
                              background: "none", border: "none", cursor: "pointer", padding: "0.375rem 0 0",
                              fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)",
                              textAlign: "left",
                            }}
                          >
                            {ins.comments.length > 0
                              ? `💬 ${ins.comments.length} comment${ins.comments.length !== 1 ? "s" : ""} ${ins.showComments ? "▴" : "▾"}`
                              : `💬 Leave a comment ${ins.showComments ? "▴" : "▾"}`}
                          </button>

                          {/* Comment thread */}
                          {ins.showComments && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.25rem" }}>
                              {ins.comments.map(c => (
                                <div key={c.id} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", lineHeight: 1.4 }}>
                                  <span style={{ fontWeight: 600, color: "var(--charcoal)" }}>{c.display_name}: </span>
                                  <span style={{ color: "var(--charcoal)" }}>{c.content}</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.25rem" }}>
                                <input
                                  value={newComments[ins.id] ?? ""}
                                  onChange={e => setNewComments(prev => ({ ...prev, [ins.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(ins); } }}
                                  placeholder="Add a comment…"
                                  style={{
                                    flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
                                    border: "1px solid var(--border)", borderRadius: 4,
                                    padding: "0.25rem 0.375rem", outline: "none", background: "var(--cream)",
                                  }}
                                />
                                <button
                                  onClick={() => submitComment(ins)}
                                  disabled={submittingComment === ins.id || !newComments[ins.id]?.trim()}
                                  style={{
                                    padding: "0.25rem 0.5rem", borderRadius: 4, border: "none",
                                    background: "var(--charcoal)", color: "var(--white)",
                                    fontFamily: "Inter, sans-serif", fontSize: "0.6875rem",
                                    cursor: "pointer", opacity: submittingComment === ins.id ? 0.6 : 1,
                                  }}
                                >
                                  Send
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
