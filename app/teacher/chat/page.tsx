"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ChatService } from "../../../lib/services/ChatService";
import { StudioService } from "../../../lib/services/StudioService";
import { Teacher } from "../../../lib/models/Teacher";
import { useRecording } from "../../../lib/context/RecordingContext";
import VideoRecorderModal from "../../../components/VideoRecorderModal";
import type { MessageRow, ProfileRow } from "../../../lib/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

type HeartMap = Record<string, { count: number; liked: boolean }>;

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function TeacherChat() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [selectedStudent, setSelectedStudent] = useState<ProfileRow | null>(null);
  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [hearts, setHearts] = useState<HeartMap>({});
  const { isRecording, recordingSeconds, uploadingAudio, audioError, startRecording, stopRecording, clearError } = useRecording();
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const initialScrollDone = useRef(false);
  const scrollToBottom = useCallback((instant?: boolean) => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
    });
  }, []);

  useEffect(() => {
    if (!teacher?.studioId) return;
    const supabase = getSupabaseBrowserClient();
    StudioService.create(supabase)
      .getStudents(teacher.studioId)
      .then(data => { setStudents(data); setLoadingStudents(false); })
      .catch(() => setLoadingStudents(false));
  }, [teacher?.studioId]);

  useEffect(() => {
    if (!teacher?.studioId || !teacher?.id) return;
    setLoadingMessages(true);
    setMessages([]);
    setHearts({});
    setEditingId(null);
    setEditError(null);
    const supabase = getSupabaseBrowserClient();
    const service = ChatService.create(supabase);

    const onInsert = (msg: MessageRow) => setMessages(p => p.some(m => m.id === msg.id) ? p : [...p, msg]);
    const onUpdate = (msg: MessageRow) => setMessages(p => p.map(m => m.id === msg.id ? msg : m));
    const onDelete = (id: string) => setMessages(p => p.filter(m => m.id !== id));

    const loadWithHearts = async (msgs: MessageRow[]) => {
      setMessages(msgs);
      const heartMap = await service.getHearts(msgs.map(m => m.id), teacher.id);
      setHearts(heartMap);
      setLoadingMessages(false);
    };

    let unsub: () => void;
    if (selectedStudent === null) {
      service.getAnnouncements(teacher.studioId)
        .then(loadWithHearts)
        .catch(() => setLoadingMessages(false));
      unsub = service.subscribeToAnnouncements(teacher.studioId, onInsert, onUpdate, onDelete);
    } else {
      service.getPrivateThread(teacher.studioId, teacher.id, selectedStudent.id)
        .then(loadWithHearts)
        .catch(() => setLoadingMessages(false));
      unsub = service.subscribeToPrivateThread(teacher.studioId, teacher.id, selectedStudent.id, onInsert, onUpdate, onDelete);
    }
    const pollInterval = setInterval(async () => {
      try {
        const fresh = selectedStudent === null
          ? await service.getAnnouncements(teacher.studioId!)
          : await service.getPrivateThread(teacher.studioId!, teacher.id, selectedStudent.id);
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const added = (fresh as MessageRow[]).filter(m => !ids.has(m.id));
          return added.length ? [...prev, ...added] : prev;
        });
      } catch { /* ignore */ }
    }, 3000);

    return () => { unsub(); clearInterval(pollInterval); };
  }, [teacher?.studioId, teacher?.id, selectedStudent]);

  useEffect(() => {
    const instant = !initialScrollDone.current;
    if (instant) initialScrollDone.current = true;
    scrollToBottom(instant);
  }, [messages, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !teacher?.studioId || sending) return;
    setInput("");
    setSending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = ChatService.create(supabase);
      if (selectedStudent === null) {
        await service.postAnnouncement(teacher.studioId, teacher.id, teacher.displayName, text);
        const fresh = await service.getAnnouncements(teacher.studioId);
        setMessages(fresh);
      } else {
        await service.sendPrivateMessage(teacher.studioId, teacher.id, teacher.displayName, selectedStudent.id, text);
        const fresh = await service.getPrivateThread(teacher.studioId, teacher.id, selectedStudent.id);
        setMessages(fresh);
      }
    } catch {
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDelete(msgId: string) {
    setMessages(p => p.filter(m => m.id !== msgId));
    try {
      const supabase = getSupabaseBrowserClient();
      await ChatService.create(supabase).deleteMessage(msgId);
    } catch { /* no-op */ }
  }

  async function handleEditSave(msgId: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setEditError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const updated = await ChatService.create(supabase).updateMessage(msgId, trimmed);
      setMessages(p => p.map(m => m.id === msgId ? updated : m));
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
      await ChatService.create(supabase).toggleHeart(msgId);
    } catch {
      setHearts(prev => ({ ...prev, [msgId]: current }));
    }
  }


  async function handleSendImage(file: File) {
    if (!teacher?.studioId) return;
    setSendingImage(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = 'chat/' + teacher.studioId + '/' + teacher.id + '/' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      const service = ChatService.create(supabase);
      if (selectedStudent === null) {
        await service.postAnnouncement(teacher.studioId, teacher.id, teacher.displayName, 'IMAGE:' + urlData.publicUrl);
        setMessages(await service.getAnnouncements(teacher.studioId));
      } else {
        await service.sendPrivateMessage(teacher.studioId, teacher.id, teacher.displayName, selectedStudent.id, 'IMAGE:' + urlData.publicUrl);
        setMessages(await service.getPrivateThread(teacher.studioId, teacher.id, selectedStudent.id));
      }
    } catch (err) { console.error('Image upload failed:', err); }
    finally { setSendingImage(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function videoUploadPath() {
    return `${teacher?.studioId}/${teacher?.id}/${Date.now()}.webm`;
  }

  async function handleSendVideo(publicUrl: string) {
    if (!teacher?.studioId) return;
    const supabase = getSupabaseBrowserClient();
    const content = `VIDEO:${publicUrl}`;
    const service = ChatService.create(supabase);
    if (selectedStudent === null) {
      await service.postAnnouncement(teacher.studioId, teacher.id, teacher.displayName, content);
      setMessages(await service.getAnnouncements(teacher.studioId));
    } else {
      await service.sendPrivateMessage(teacher.studioId, teacher.id, teacher.displayName, selectedStudent.id, content);
      setMessages(await service.getPrivateThread(teacher.studioId, teacher.id, selectedStudent.id));
    }
  }

  async function handleStartRecording() {
    if (!teacher?.studioId) return;
    const supabase = getSupabaseBrowserClient();
    const service = ChatService.create(supabase);
    await startRecording({
      studioId: teacher.studioId,
      senderId: teacher.id,
      senderName: teacher.displayName,
      recipientId: selectedStudent?.id ?? null,
      onSent: async () => {
        if (selectedStudent === null) {
          setMessages(await service.getAnnouncements(teacher.studioId!));
        } else {
          setMessages(await service.getPrivateThread(teacher.studioId!, teacher.id, selectedStudent.id));
        }
      },
    });
  }

  const isAnnouncements = selectedStudent === null;
  const headerTitle = isAnnouncements ? "Announcements" : selectedStudent.display_name;
  const headerSub = isAnnouncements ? "Visible to all students" : "Private message";
  // Mobile: track whether we're showing the list or the chat pane
  const [mobilePane, setMobilePane] = React.useState<"list" | "chat">("list");

  function selectAndOpen(s: ProfileRow | null) {
    setSelectedStudent(s);
    setMobilePane("chat");
  }

  return (
    <div>
      {/* Desktop heading — hidden on mobile when in chat pane */}
      <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 500, fontSize: "1.875rem", color: "var(--charcoal)", marginBottom: "1.5rem", letterSpacing: "-0.01em" }}
        className="chat-desktop-heading">
        Messages
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1px", height: "calc(100dvh - 120px)", maxHeight: "74vh", background: "var(--border)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}
        className="chat-grid">

        {/* Sidebar */}
        <div style={{ background: "var(--white)", display: "flex", flexDirection: "column", overflow: "hidden" }}
          className={`chat-sidebar${mobilePane === "chat" ? " chat-sidebar-hidden" : ""}`}>
          <button
            onClick={() => selectAndOpen(null)}
            style={{ all: "unset", display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.875rem 1rem", borderBottom: "1px solid var(--border)", cursor: "pointer", background: isAnnouncements && mobilePane === "chat" ? "var(--cream)" : "transparent", boxSizing: "border-box", width: "100%" }}
          >
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--peach-bg)", border: "1px solid var(--peach-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "0.5625rem", fontWeight: 600, color: "var(--peach)", letterSpacing: "0.02em" }}>ALL</span>
            </div>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)" }}>Announcements</span>
          </button>

          <div style={{ padding: "0.5rem 1rem 0.375rem", fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)" }}>
            Direct Messages
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingStudents ? (
              <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 32, borderRadius: 3 }} />)}
              </div>
            ) : students.length === 0 ? (
              <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>No students yet</p>
              </div>
            ) : students.map(s => {
              const isSel = selectedStudent?.id === s.id;
              return (
                <button key={s.id} onClick={() => selectAndOpen(s)} style={{ all: "unset", display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", cursor: "pointer", background: isSel ? "var(--cream)" : "transparent", width: "100%", boxSizing: "border-box" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: isSel ? "var(--charcoal)" : "var(--cream-deep)", border: `1px solid ${isSel ? "var(--charcoal)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5625rem", fontWeight: 600, color: isSel ? "var(--white)" : "var(--muted)", flexShrink: 0, overflow: "hidden" }}>
                    {s.avatar_url ? <img src={s.avatar_url} alt={s.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(s.display_name)}
                  </div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: isSel ? 500 : 400, color: isSel ? "var(--charcoal)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.display_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message pane */}
        <div style={{ background: "var(--cream)", display: "flex", flexDirection: "column", overflow: "hidden" }}
          className={`chat-pane${mobilePane === "list" ? " chat-pane-hidden" : ""}`}>

          <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border)", background: "var(--white)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Back button — mobile only */}
            <button
              onClick={() => setMobilePane("list")}
              className="chat-back-btn"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0.5rem 0.25rem 0", color: "var(--muted)", fontSize: "1rem", display: "none", flexShrink: 0 }}
            >
              ←
            </button>
            {!isAnnouncements && selectedStudent.avatar_url && (
              <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                <img src={selectedStudent.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--charcoal)" }}>{headerTitle}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{headerSub}</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {loadingMessages ? (
              [1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 38, borderRadius: 3, width: i % 2 === 0 ? "55%" : "42%", alignSelf: i % 2 === 0 ? "flex-end" : "flex-start" }} />)
            ) : messages.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
                <p className="empty-state-title">{isAnnouncements ? "No announcements yet" : "No messages yet"}</p>
                <p className="empty-state-desc">{isAnnouncements ? "Post an announcement — all students will see it" : `Start a conversation with ${selectedStudent?.display_name}`}</p>
              </div>
            ) : messages.map((msg, i) => {
              if (msg.message_type === "system") {
                const lines = msg.content.split("\n");
                const audioUrl = lines.find(l => l.startsWith("AUDIO:"))?.slice(6);
                const text = lines.filter(l => !l.startsWith("AUDIO:") && !l.startsWith("SESSION:") && !l.startsWith("LESSON_ROOM:")).join("\n");
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: "center", padding: "0.5rem 0" }}>
                    <div style={{ padding: "0.5rem 0.875rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 3, fontSize: "0.75rem", color: "var(--muted)", maxWidth: "80%", lineHeight: 1.6, overflowWrap: "break-word", wordBreak: "break-word" }}>
                      <div style={{ whiteSpace: "pre-line" }}>{text}</div>
                      {audioUrl && <audio controls src={audioUrl} style={{ width: "100%", marginTop: "0.5rem", height: 32 }} />}
                    </div>
                  </div>
                );
              }

              const isMe = msg.sender_id === teacher?.id;
              const prev = i > 0 ? messages[i - 1] : null;
              const next = i < messages.length - 1 ? messages[i + 1] : null;
              const showSender = !isMe && prev?.sender_id !== msg.sender_id;
              const isLast = !next || next.sender_id !== msg.sender_id;
              const isHovered = hoveredId === msg.id;
              const isEditing = editingId === msg.id;
              const heartInfo = hearts[msg.id] ?? { count: 0, liked: false };
              const audioLine = msg.content.split("\n").find(l => l.startsWith("AUDIO:"));
              const audioSrc = audioLine?.slice(6);
              const audioLabel = audioLine ? msg.content.split("\n").filter(l => !l.startsWith("AUDIO:")).join("\n").trim() : "";
              const videoLine = msg.content.split("\n").find(l => l.startsWith("VIDEO:"));
              const videoSrc = videoLine?.slice(6);

              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: isLast ? "0.625rem" : "0.125rem" }}
                  onMouseEnter={() => setHoveredId(msg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {showSender && (
                    <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: "var(--muted)", marginBottom: "0.25rem", paddingLeft: "0.25rem" }}>
                      {msg.sender_name}
                    </span>
                  )}

                  {isEditing ? (
                    <div style={{ width: "100%", maxWidth: 420 }}>
                      <textarea
                        value={editText}
                        onChange={e => { setEditText(e.target.value); setEditError(null); }}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id); }
                          if (e.key === "Escape") { setEditingId(null); setEditError(null); }
                        }}
                        autoFocus
                        rows={Math.max(2, editText.split("\n").length)}
                        style={{ width: "100%", borderRadius: 3, border: `1px solid ${editError ? "var(--error)" : "var(--border-strong)"}`, padding: "0.5rem 0.75rem", fontSize: "0.875rem", lineHeight: 1.5, outline: "none", resize: "none", background: "var(--white)", color: "var(--charcoal)", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }}
                      />
                      {editError && <p style={{ fontSize: "0.6875rem", color: "var(--error)", margin: "0.25rem 0 0" }}>{editError}</p>}
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.375rem", justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditingId(null); setEditError(null); }} style={{ padding: "0.3rem 0.75rem", border: "1px solid var(--border-strong)", borderRadius: 3, background: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.75rem" }}>Cancel</button>
                        <button onClick={() => handleEditSave(msg.id)} style={{ padding: "0.3rem 0.75rem", border: "none", borderRadius: 3, background: "var(--charcoal)", color: "var(--white)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 500 }}>Save</button>
                      </div>
                    </div>
                  ) : videoSrc ? (
                    <div style={{ maxWidth: "66%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden", border: isMe ? "none" : "1px solid var(--border-strong)" }}>
                      <video controls src={videoSrc} style={{ display: "block", width: "100%", maxWidth: 280 }} />
                    </div>
                  ) : msg.content.startsWith('IMAGE:') ? (
                    <div style={{ maxWidth: "66%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden" }}>
                      <img src={msg.content.slice(6)} alt="shared image" style={{ display: "block", width: "100%", maxWidth: 280, borderRadius: "inherit" }} />
                    </div>
                  ) : audioSrc ? (
                    <div style={{
                      maxWidth: "66%", padding: "0.5rem 0.75rem",
                      background: isMe ? (isAnnouncements ? "var(--peach-bg)" : "var(--charcoal)") : "var(--white)",
                      border: isMe ? (isAnnouncements ? "1px solid var(--peach-light)" : "none") : "1px solid var(--border-strong)",
                      borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    }}>
                      {audioLabel && <p style={{ margin: "0 0 0.375rem", fontSize: "0.8125rem", color: isMe ? (isAnnouncements ? "var(--charcoal)" : "var(--cream)") : "var(--charcoal)" }}>{audioLabel}</p>}
                      <audio controls src={audioSrc} style={{ height: 32, maxWidth: "100%" }} />
                    </div>
                  ) : (
                    <div style={{
                      maxWidth: "66%", padding: "0.5rem 0.875rem", fontSize: "0.875rem", lineHeight: 1.6,
                      background: isMe ? (isAnnouncements ? "var(--peach-bg)" : "var(--charcoal)") : "var(--white)",
                      color: isMe ? (isAnnouncements ? "var(--charcoal)" : "var(--cream)") : "var(--charcoal)",
                      border: isMe ? (isAnnouncements ? "1px solid var(--peach-light)" : "none") : "1px solid var(--border-strong)",
                      borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      overflowWrap: "break-word", wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}>
                      {msg.content}
                    </div>
                  )}

                  {/* Edit/Delete — shown on ALL own messages when hovered */}
                  {isMe && !isEditing && (
                    <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.15rem", opacity: isHovered ? 1 : 0, transition: "opacity 0.15s", pointerEvents: isHovered ? "auto" : "none", paddingRight: "0.25rem" }}>
                      <button onClick={() => { setEditingId(msg.id); setEditText(msg.content); setEditError(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.625rem", color: "var(--muted)" }}>Edit</button>
                      <span style={{ fontSize: "0.625rem", color: "var(--border-strong)" }}>·</span>
                      <button onClick={() => handleDelete(msg.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.625rem", color: "var(--muted)" }}>Delete</button>
                    </div>
                  )}

                  {isLast && !isEditing && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.15rem", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                      <span style={{ fontSize: "0.625rem", color: "var(--muted)", letterSpacing: "0.02em" }}>{formatTime(msg.created_at)}</span>

                      {/* Heart button */}
                      <button
                        onClick={() => handleHeart(msg.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.75rem", color: heartInfo.liked ? "var(--peach)" : "var(--muted)", transition: "color 0.15s" }}
                      >
                        {heartInfo.liked ? "♥" : "♡"}
                        {heartInfo.count > 0 && <span style={{ fontSize: "0.625rem" }}>{heartInfo.count}</span>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {audioError && (
            <div style={{ padding: "0.375rem 1.25rem", background: "var(--error-bg, #fff0f0)", borderTop: "1px solid var(--error, #d00)", fontSize: "0.75rem", color: "var(--error, #d00)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{audioError}</span>
              <button onClick={clearError} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0.25rem", color: "var(--error, #d00)", fontSize: "0.75rem" }}>✕</button>
            </div>
          )}
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border)", background: "var(--white)", display: "flex", gap: "0.625rem", alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAnnouncements ? "Post an announcement…" : `Message ${selectedStudent?.display_name}…`}
              disabled={sending || isRecording || uploadingAudio}
              rows={Math.min(6, Math.max(1, input.split("\n").length))}
              style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 3, padding: "0.5625rem 0.875rem", fontSize: "0.875rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", resize: "none", lineHeight: 1.5, fontFamily: "inherit" }}
            />
            {/* Mic button — audio-only voice note */}
            <button
              onClick={isRecording ? stopRecording : handleStartRecording}
              disabled={uploadingAudio || sending}
              title={isRecording ? "Stop recording" : "Send voice note"}
              style={{
                padding: "0.5625rem 0.75rem", borderRadius: 3, border: "1px solid var(--border)",
                background: isRecording ? "var(--error-bg)" : "var(--white)",
                color: isRecording ? "var(--error)" : "var(--muted)",
                cursor: uploadingAudio || sending ? "default" : "pointer",
                fontSize: "1rem", flexShrink: 0, marginBottom: "0.125rem",
                transition: "all 0.15s",
              }}
            >
              {uploadingAudio ? "⏳" : isRecording ? `⏹ ${recordingSeconds}s` : "🎙"}
            </button>
            {/* Camera button — video message */}
            <button
              onClick={() => setShowVideoRecorder(true)}
              disabled={sending || isRecording || uploadingAudio}
              title="Send video message"
              style={{
                padding: "0.5625rem 0.75rem", borderRadius: 3, border: "1px solid var(--border)",
                background: "var(--white)", color: "var(--muted)",
                cursor: sending || isRecording || uploadingAudio ? "default" : "pointer",
                fontSize: "1rem", flexShrink: 0, marginBottom: "0.125rem",
                transition: "all 0.15s",
              }}
            >
              📹
            </button>
            {/* Hidden image input */}
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { void handleSendImage(f); e.target.value = ''; } }} />
            {/* Image button */}
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={sending || isRecording || uploadingAudio || sendingImage}
              title="Send image"
              style={{
                padding: "0.5625rem 0.75rem", borderRadius: 3, border: "1px solid var(--border)",
                background: "var(--white)", color: "var(--muted)",
                cursor: sending || isRecording || uploadingAudio || sendingImage ? "default" : "pointer",
                fontSize: "1rem", flexShrink: 0, marginBottom: "0.125rem",
              }}
            >
              {sendingImage ? "⏳" : "🖼"}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || isRecording}
              style={{ padding: "0.5625rem 1.25rem", borderRadius: 3, border: "none", background: input.trim() && !isRecording ? "var(--charcoal)" : "var(--border)", color: "var(--white)", cursor: input.trim() && !isRecording ? "pointer" : "default", fontSize: "0.8125rem", fontWeight: 500, transition: "background 0.15s", flexShrink: 0, marginBottom: "0.125rem" }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {showVideoRecorder && (
        <VideoRecorderModal
          uploadPath={videoUploadPath()}
          onSend={handleSendVideo}
          onClose={() => setShowVideoRecorder(false)}
        />
      )}
    </div>
  );
}
