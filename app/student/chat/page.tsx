"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ChatService } from "../../../lib/services/ChatService";
import { Student } from "../../../lib/models/Student";
import type { MessageRow } from "../../../lib/types";
import AudioPlayer from "../../../components/AudioPlayer";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

type Tab = "announcements" | "private";
type HeartMap = Record<string, { count: number; liked: boolean }>;

export default function StudentChat() {
  const { user } = useAuth();
  const student = user as Student;

  const [tab, setTab] = useState<Tab>("private");
  const [announcements, setAnnouncements] = useState<MessageRow[]>([]);
  const [privateMessages, setPrivateMessages] = useState<MessageRow[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [hearts, setHearts] = useState<HeartMap>({});
  const [sessionFeedbacks, setSessionFeedbacks] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!student?.studioId || !student?.id) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.getInstance(supabase);

    const load = async () => {
      const { data: studioData } = await supabase
        .from("studios").select("owner_id").eq("id", student.studioId!).single();
      const tId = studioData?.owner_id ?? null;
      setTeacherId(tId);
      const anns = await chatService.getAnnouncements(student.studioId!);
      setAnnouncements(anns);
      let priv: MessageRow[] = [];
      if (tId) {
        priv = await chatService.getPrivateThread(student.studioId!, student.id, tId);
        setPrivateMessages(priv);
      }
      // Load hearts for all messages
      const allMsgs = [...anns, ...priv];
      const heartMap = await chatService.getHearts(allMsgs.map(m => m.id), student.id);
      setHearts(heartMap);
      setLoading(false);
    };
    load().catch(() => setLoading(false));

    const unsubAnn = chatService.subscribeToAnnouncements(
      student.studioId,
      msg => setAnnouncements(p => p.some(m => m.id === msg.id) ? p : [...p, msg]),
      msg => setAnnouncements(p => p.map(m => m.id === msg.id ? msg : m)),
      id  => setAnnouncements(p => p.filter(m => m.id !== id))
    );
    const pollAnn = setInterval(async () => {
      try {
        const fresh = await chatService.getAnnouncements(student.studioId!);
        setAnnouncements(prev => {
          const ids = new Set(prev.map(m => m.id));
          const added = fresh.filter((m: MessageRow) => !ids.has(m.id));
          return added.length ? [...prev, ...added] : prev;
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => { unsubAnn(); clearInterval(pollAnn); };
  }, [student?.studioId, student?.id]);

  useEffect(() => {
    if (!student?.studioId || !student?.id || !teacherId) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.getInstance(supabase);
    const unsubPriv = chatService.subscribeToPrivateThread(
      student.studioId, student.id, teacherId,
      msg => setPrivateMessages(p => p.some(m => m.id === msg.id) ? p : [...p, msg]),
      msg => setPrivateMessages(p => p.map(m => m.id === msg.id ? msg : m)),
      id  => setPrivateMessages(p => p.filter(m => m.id !== id))
    );
    const pollPriv = setInterval(async () => {
      try {
        const fresh = await chatService.getPrivateThread(student.studioId!, student.id, teacherId);
        setPrivateMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const added = fresh.filter((m: MessageRow) => !ids.has(m.id));
          return added.length ? [...prev, ...added] : prev;
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => { unsubPriv(); clearInterval(pollPriv); };
  }, [student?.studioId, student?.id, teacherId]);

  // Fetch AI feedback for any session system messages
  useEffect(() => {
    const allMsgs = [...announcements, ...privateMessages];
    const sessionIds = allMsgs
      .filter(m => m.message_type === "system")
      .map(m => {
        const match = m.content.split("\n").find(l => l.startsWith("SESSION:"));
        return match?.slice(8) ?? null;
      })
      .filter((id): id is string => !!id && !(id in sessionFeedbacks));
    if (sessionIds.length === 0) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("practice_sessions")
      .select("id, ai_feedback")
      .in("id", sessionIds)
      .then(({ data }: { data: Array<{ id: string; ai_feedback: string | null }> | null }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const row of data) {
          if (row.ai_feedback) map[row.id] = row.ai_feedback;
        }
        if (Object.keys(map).length > 0) setSessionFeedbacks(prev => ({ ...prev, ...map }));
      });
  }, [announcements, privateMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { scrollToBottom(); }, [announcements, privateMessages, tab, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !student?.studioId || !teacherId || sending) return;
    setInput("");
    setSending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const svc = ChatService.getInstance(supabase);
      await svc.sendPrivateMessage(student.studioId, student.id, student.displayName, teacherId, text);
      const fresh = await svc.getPrivateThread(student.studioId!, student.id, teacherId);
      setPrivateMessages(fresh);
      setTab("private");
    } catch {
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDelete(msgId: string) {
    setPrivateMessages(p => p.filter(m => m.id !== msgId));
    try {
      const supabase = getSupabaseBrowserClient();
      await ChatService.getInstance(supabase).deleteMessage(msgId);
    } catch { /* no-op */ }
  }

  async function handleEditSave(msgId: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setEditError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const updated = await ChatService.getInstance(supabase).updateMessage(msgId, trimmed);
      setPrivateMessages(p => p.map(m => m.id === msgId ? updated : m));
      setEditingId(null);
    } catch (err) {
      setEditError((err as Error).message ?? "Could not save.");
    }
  }

  async function handleHeart(msgId: string) {
    const current = hearts[msgId] ?? { count: 0, liked: false };
    setHearts(prev => ({
      ...prev,
      [msgId]: { count: current.liked ? Math.max(0, current.count - 1) : current.count + 1, liked: !current.liked },
    }));
    try {
      const supabase = getSupabaseBrowserClient();
      await ChatService.getInstance(supabase).toggleHeart(msgId);
    } catch {
      setHearts(prev => ({ ...prev, [msgId]: current }));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const activeMessages = tab === "announcements" ? announcements : privateMessages;

  return (
    <div data-chat-page style={{ height: "100%", background: "var(--cream)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem 0", flexShrink: 0 }}>
        <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.875rem" }}>Messages</div>
        <div style={{ display: "flex", gap: 0 }}>
          {(["announcements", "private"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "0.5rem 1.125rem", background: "none", border: "none", borderBottom: tab === t ? "1.5px solid var(--charcoal)" : "1.5px solid transparent", marginBottom: -1, fontSize: "0.8125rem", fontWeight: tab === t ? 500 : 400, color: tab === t ? "var(--charcoal)" : "var(--muted)", cursor: "pointer" }}>
              {t === "announcements" ? "Studio" : "Private"}
            </button>
          ))}
        </div>
        <div style={{ height: 1, background: "var(--border)" }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem", paddingBottom: "1rem" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", paddingTop: "1rem" }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 3, width: i % 2 === 0 ? "58%" : "44%", alignSelf: i % 2 === 0 ? "flex-end" : "flex-start" }} />)}
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
            <p className="empty-state-title">{tab === "announcements" ? "No announcements yet" : "No messages yet"}</p>
            <p className="empty-state-desc">{tab === "announcements" ? "Studio announcements from your teacher appear here." : "Send your teacher a message below."}</p>
          </div>
        ) : (
          activeMessages.map((msg, i) => {
            if (msg.message_type === "system") {
              const lines = msg.content.split("\n");
              const audioUrl = lines.find(l => l.startsWith("AUDIO:"))?.slice(6);
              const sessionId = lines.find(l => l.startsWith("SESSION:"))?.slice(8);
              const text = lines
                .filter(l => !l.startsWith("AUDIO:") && !l.startsWith("SESSION:"))
                .join("\n");
              const aiFeedback = sessionId ? sessionFeedbacks[sessionId] : undefined;
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: "center", padding: "0.625rem 0" }}>
                  <div style={{
                    background: "var(--white)", border: "1px solid var(--border)",
                    borderRadius: 16, padding: "1rem 1.125rem",
                    maxWidth: "90%", width: "100%",
                  }}>
                    <div style={{ fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: audioUrl ? "0.75rem" : 0 }}>
                      {text}
                    </div>
                    {audioUrl && <AudioPlayer src={audioUrl} />}
                    {aiFeedback && (
                      <div style={{ marginTop: "0.875rem", paddingTop: "0.875rem", borderTop: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
                          AI Coaching
                        </div>
                        <p style={{ fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.7, margin: 0 }}>
                          {aiFeedback}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const isMe = msg.sender_id === student?.id;
            const prev = i > 0 ? activeMessages[i - 1] : null;
            const next = i < activeMessages.length - 1 ? activeMessages[i + 1] : null;
            const showSender = !isMe && prev?.sender_id !== msg.sender_id;
            const isLast = !next || next.sender_id !== msg.sender_id;
            const isHovered = hoveredId === msg.id;
            const isEditing = editingId === msg.id;
            const canAct = tab === "private" && isMe;
            const heartInfo = hearts[msg.id] ?? { count: 0, liked: false };

            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: isLast ? "0.625rem" : 0 }}
                onMouseEnter={() => setHoveredId(msg.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {showSender && (
                  <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: "var(--muted)", marginBottom: "0.25rem", paddingLeft: "0.25rem" }}>
                    {msg.sender_name}
                  </span>
                )}

                {isEditing ? (
                  <div style={{ width: "100%", maxWidth: 400 }}>
                    <textarea
                      value={editText}
                      onChange={e => { setEditText(e.target.value); setEditError(null); }}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id); }
                        if (e.key === "Escape") { setEditingId(null); setEditError(null); }
                      }}
                      autoFocus
                      rows={Math.max(1, editText.split("\n").length)}
                      style={{ width: "100%", borderRadius: 3, border: `1px solid ${editError ? "var(--error)" : "var(--border-strong)"}`, padding: "0.5rem 0.75rem", fontSize: "0.875rem", lineHeight: 1.5, outline: "none", resize: "none", background: "var(--white)", color: "var(--charcoal)", fontFamily: "Inter, sans-serif" }}
                    />
                    {editError && <p style={{ fontSize: "0.6875rem", color: "var(--error)", margin: "0.25rem 0 0" }}>{editError}</p>}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.375rem", justifyContent: "flex-end" }}>
                      <button onClick={() => { setEditingId(null); setEditError(null); }} style={{ padding: "0.3rem 0.75rem", border: "1px solid var(--border-strong)", borderRadius: 3, background: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.75rem" }}>Cancel</button>
                      <button onClick={() => handleEditSave(msg.id)} style={{ padding: "0.3rem 0.75rem", border: "none", borderRadius: 3, background: "var(--charcoal)", color: "var(--white)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 500 }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    maxWidth: "78%", padding: "0.5rem 0.875rem",
                    background: isMe ? "var(--charcoal)" : "var(--white)",
                    color: isMe ? "var(--white)" : "var(--charcoal)",
                    borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    border: isMe ? "none" : "1px solid var(--border)",
                    fontSize: "0.875rem", lineHeight: 1.55,
                  }}>
                    {msg.content}
                  </div>
                )}

                {isLast && !isEditing && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--muted)", letterSpacing: "0.02em" }}>{formatTime(msg.created_at)}</span>

                    {/* Heart */}
                    <button
                      onClick={() => handleHeart(msg.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.75rem", color: heartInfo.liked ? "var(--peach)" : "var(--muted)", transition: "color 0.15s" }}
                    >
                      {heartInfo.liked ? "♥" : "♡"}
                      {heartInfo.count > 0 && <span style={{ fontSize: "0.625rem" }}>{heartInfo.count}</span>}
                    </button>

                    {/* Edit / Delete — own private messages, always visible */}
                    {canAct && (
                      <span style={{ display: "flex", gap: "0.375rem" }}>
                        <button onClick={() => { setEditingId(msg.id); setEditText(msg.content); setEditError(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0", fontSize: "0.625rem", color: "var(--muted)" }}>Edit</button>
                        <span style={{ fontSize: "0.625rem", color: "var(--border-strong)" }}>·</span>
                        <button onClick={() => handleDelete(msg.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0", fontSize: "0.625rem", color: "var(--muted)" }}>Delete</button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {!loading && tab === "announcements" && announcements.length > 0 && (
          <button onClick={() => setTab("private")} style={{ all: "unset", marginTop: "0.75rem", padding: "0.625rem 0.875rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer", fontSize: "0.8125rem", color: "var(--muted)", width: "100%", boxSizing: "border-box" }}>
            Reply privately to your teacher →
          </button>
        )}

        <div ref={bottomRef} />
      </div>

      {tab === "private" && (
        <div style={{ flexShrink: 0, padding: "0.75rem 1rem", background: "var(--white)", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem", alignItems: "center", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={teacherId ? "Message your teacher…" : "Loading…"} disabled={sending || !teacherId} style={{ flex: 1, borderRadius: 3, border: "1px solid var(--border)", padding: "0.5rem 0.875rem", fontSize: "0.875rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)" }} />
          <button onClick={handleSend} disabled={!input.trim() || sending || !teacherId} style={{ padding: "0.5rem 1rem", borderRadius: 3, border: "none", background: input.trim() && teacherId ? "var(--charcoal)" : "var(--border)", color: "var(--white)", cursor: input.trim() && teacherId ? "pointer" : "default", fontSize: "0.8125rem", fontWeight: 500, flexShrink: 0, transition: "background 0.15s" }}>Send</button>
        </div>
      )}
    </div>
  );
}
