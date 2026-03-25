"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ChatService } from "../../../lib/services/ChatService";
import { Student } from "../../../lib/models/Student";
import { useRecording } from "../../../lib/context/RecordingContext";
import VideoRecorderModal from "../../../components/VideoRecorderModal";
import type { MessageRow } from "../../../lib/types";
import AudioPlayer from "../../../components/AudioPlayer";
import { useI18n } from "../../../lib/context/I18nContext";
import { Hourglass, Square, Mic, Video, Image, X } from "lucide-react";

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
  const { t: tr } = useI18n();

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
  const { isRecording, recordingSeconds, uploadingAudio, audioError, startRecording, stopRecording, clearError } = useRecording();
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string } | null>(null);

  const initialScrollDone = useRef(false);
  const scrollToBottom = useCallback((instant?: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    const go = () => { el.scrollTop = el.scrollHeight; };
    if (instant) {
      go();
      // Double-tap: catch layout shifts from images/audio
      setTimeout(go, 50);
      setTimeout(go, 200);
    } else {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
  }, []);

  useEffect(() => {
    if (!student?.id || (!student?.studioId && student?.isSolo)) { setLoading(false); return; }
    if (!student?.studioId) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.create(supabase);

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
    let mounted = true;
    const pollAnn = setInterval(async () => {
      if (!mounted) return;
      try {
        const fresh = await chatService.getAnnouncements(student.studioId!);
        if (!mounted) return;
        setAnnouncements(prev => {
          const ids = new Set(prev.map(m => m.id));
          const added = fresh.filter((m: MessageRow) => !ids.has(m.id));
          return added.length ? [...prev, ...added] : prev;
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => { mounted = false; unsubAnn(); clearInterval(pollAnn); };
  }, [student?.studioId, student?.id]);

  useEffect(() => {
    if (!student?.studioId || !student?.id || !teacherId) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.create(supabase);
    const unsubPriv = chatService.subscribeToPrivateThread(
      student.studioId, student.id, teacherId,
      msg => setPrivateMessages(p => p.some(m => m.id === msg.id) ? p : [...p, msg]),
      msg => setPrivateMessages(p => p.map(m => m.id === msg.id ? msg : m)),
      id  => setPrivateMessages(p => p.filter(m => m.id !== id))
    );
    let mounted = true;
    const pollPriv = setInterval(async () => {
      if (!mounted) return;
      try {
        const fresh = await chatService.getPrivateThread(student.studioId!, student.id, teacherId);
        if (!mounted) return;
        setPrivateMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const added = fresh.filter((m: MessageRow) => !ids.has(m.id));
          return added.length ? [...prev, ...added] : prev;
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => { mounted = false; unsubPriv(); clearInterval(pollPriv); };
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

  useEffect(() => {
    initialScrollDone.current = false;
  }, [tab]);

  useEffect(() => {
    const msgs = tab === "announcements" ? announcements : privateMessages;
    if (msgs.length === 0) return;
    const instant = !initialScrollDone.current;
    if (instant) initialScrollDone.current = true;
    scrollToBottom(instant);
  }, [announcements, privateMessages, tab, scrollToBottom]);

  // Parse reply header out of message content
  function parseReply(content: string): { replyId: string; replySender: string; body: string } | null {
    if (!content.startsWith('REPLYTO:')) return null;
    const nl = content.indexOf('\n');
    if (nl === -1) return null;
    const header = content.slice(8, nl);
    const sep = header.indexOf('|');
    if (sep === -1) return null;
    return { replyId: header.slice(0, sep), replySender: header.slice(sep + 1), body: content.slice(nl + 1) };
  }

  function getReplyPreview(msgId: string): string {
    const original = activeMessages.find(m => m.id === msgId);
    if (!original) return '…';
    const parsed = parseReply(original.content);
    const raw = parsed ? parsed.body : original.content;
    // Strip media prefixes for preview
    const text = raw.replace(/^(AUDIO:|VIDEO:|IMAGE:)\S+\n?/m, '').trim();
    return text.length > 60 ? text.slice(0, 60) + '…' : text || '(media)';
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !student?.studioId || !teacherId || sending) return;
    const content = replyTo ? `REPLYTO:${replyTo.id}|${replyTo.senderName}\n${text}` : text;
    setInput("");
    setReplyTo(null);
    setSending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const svc = ChatService.create(supabase);
      await svc.sendPrivateMessage(student.studioId, student.id, student.displayName, teacherId, content);
      const fresh = await svc.getPrivateThread(student.studioId!, student.id, teacherId);
      setPrivateMessages(fresh);
      setTab("private");
    } catch {
      setInput(text);
      toast.error("Failed to send — please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDelete(msgId: string) {
    setPrivateMessages(p => p.filter(m => m.id !== msgId));
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
      await ChatService.create(supabase).toggleHeart(msgId);
    } catch {
      setHearts(prev => ({ ...prev, [msgId]: current }));
    }
  }


  async function handleSendImage(file: File) {
    if (!student?.studioId || !teacherId) return;
    setSendingImage(true);
    setImageError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = 'chat/' + student.studioId + '/' + student.id + '/' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      const svc = ChatService.create(supabase);
      await svc.sendPrivateMessage(student.studioId, student.id, student.displayName, teacherId, 'IMAGE:' + urlData.publicUrl);
      const fresh = await svc.getPrivateThread(student.studioId, student.id, teacherId);
      setPrivateMessages(fresh);
      setTab('private');
    } catch (err) {
      console.error('Image upload failed:', err);
      setImageError('Failed to send image — please try again.');
      toast.error('Failed to send image — please try again.');
    }
    finally { setSendingImage(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function videoUploadPath() {
    if (!student?.studioId || !student?.id) return "";
    return `${student.studioId}/${student.id}/${Date.now()}.webm`;
  }

  async function handleSendVideo(publicUrl: string) {
    if (!student?.studioId || !teacherId) return;
    const supabase = getSupabaseBrowserClient();
    const content = `VIDEO:${publicUrl}`;
    const svc = ChatService.create(supabase);
    await svc.sendPrivateMessage(student.studioId, student.id, student.displayName, teacherId, content);
    const fresh = await svc.getPrivateThread(student.studioId, student.id, teacherId);
    setPrivateMessages(fresh);
    setTab("private");
  }

  async function handleStartRecording() {
    if (!student?.studioId || !teacherId) return;
    const supabase = getSupabaseBrowserClient();
    const svc = ChatService.create(supabase);
    await startRecording({
      studioId: student.studioId,
      senderId: student.id,
      senderName: student.displayName,
      recipientId: teacherId,
      onSent: async () => {
        const fresh = await svc.getPrivateThread(student.studioId!, student.id, teacherId!);
        setPrivateMessages(fresh);
        setTab("private");
      },
    });
  }

  const activeMessages = tab === "announcements" ? announcements : privateMessages;

  return (
    <div data-chat-page style={{ height: "100%", background: "var(--cream)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem 0", flexShrink: 0 }}>
        <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.875rem" }}>{tr.student.chatMessages}</div>
        <div style={{ display: "flex", gap: 0 }}>
          {(["announcements", "private"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "0.5rem 1.125rem", background: "none", border: "none", borderBottom: tab === t ? "1.5px solid var(--charcoal)" : "1.5px solid transparent", marginBottom: -1, fontSize: "0.8125rem", fontWeight: tab === t ? 500 : 400, color: tab === t ? "var(--charcoal)" : "var(--muted)", cursor: "pointer" }}>
              {t === "announcements" ? tr.student.chatStudioTab : tr.student.chatPrivateTab}
            </button>
          ))}
        </div>
        <div style={{ height: 1, background: "var(--border)" }} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem", paddingBottom: "1rem" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", paddingTop: "1rem" }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 3, width: i % 2 === 0 ? "58%" : "44%", alignSelf: i % 2 === 0 ? "flex-end" : "flex-start" }} />)}
          </div>
        ) : student?.isSolo && !student?.studioId ? (
          <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
            <p className="empty-state-title">No teacher yet</p>
            <p className="empty-state-desc">Your practice logs and recordings will appear here once you join a studio. For now, keep practicing — everything is saved to your profile.</p>
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
            <p className="empty-state-title">{tab === "announcements" ? tr.student.chatNoAnnouncements : tr.student.chatNoMessages}</p>
            <p className="empty-state-desc">{tab === "announcements" ? tr.student.chatAnnouncementsDesc : tr.student.chatMessagesDesc}</p>
          </div>
        ) : (
          activeMessages.map((msg, i) => {
            if (msg.message_type === "system") {
              const lines = msg.content.split("\n");
              const audioUrl = lines.find(l => l.startsWith("AUDIO:"))?.slice(6);
              const sessionId = lines.find(l => l.startsWith("SESSION:"))?.slice(8);
              const lessonRoom = lines.find(l => l.startsWith("LESSON_ROOM:"))?.slice(12);
              const clipUrls = lines
                .filter(l => /^CLIP_\d+:/.test(l))
                .map((l, i) => ({ label: `Clip ${i + 1}`, url: l.replace(/^CLIP_\d+:/, "") }));
              const text = lines
                .filter(l =>
                  !l.startsWith("AUDIO:") &&
                  !l.startsWith("SESSION:") &&
                  !l.startsWith("LESSON_ROOM:") &&
                  !/^CLIP_\d+:/.test(l)
                )
                .join("\n");
              const aiFeedback = sessionId ? sessionFeedbacks[sessionId] : undefined;
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: "center", padding: "0.625rem 0" }}>
                  <div style={{
                    background: "var(--white)", border: "1px solid var(--border)",
                    borderRadius: 16, padding: "1rem 1.125rem",
                    maxWidth: "90%", width: "100%",
                  }}>
                    <div style={{ fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: (audioUrl || lessonRoom) ? "0.75rem" : 0, overflowWrap: "break-word", wordBreak: "break-word" }}>
                      {text}
                    </div>
                    {lessonRoom && (
                      <a
                        href={`/lesson/${lessonRoom}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "0.4rem",
                          padding: "0.5rem 1rem", borderRadius: 6,
                          background: "var(--charcoal)", color: "var(--white)",
                          fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem",
                          textDecoration: "none", marginBottom: audioUrl ? "0.75rem" : 0,
                          transition: "opacity 0.15s",
                        }}
                      >
                        {tr.student.chatJoinLesson}
                      </a>
                    )}
                    {audioUrl && <AudioPlayer src={audioUrl} />}
                    {clipUrls.map(({ label, url }) => (
                      <div key={url} style={{ marginTop: "0.625rem" }}>
                        <div style={{ fontSize: "0.625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sage)", marginBottom: "0.25rem" }}>{label}</div>
                        <AudioPlayer src={url} />
                      </div>
                    ))}
                    {aiFeedback && (
                      <div style={{ marginTop: "0.875rem", paddingTop: "0.875rem", borderTop: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
                          {tr.student.chatAiCoaching}
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
            const audioLine = msg.content.split("\n").find(l => l.startsWith("AUDIO:"));
            const audioSrc = audioLine?.slice(6);
            const audioLabel = audioLine ? msg.content.split("\n").filter(l => !l.startsWith("AUDIO:")).join("\n").trim() : "";
            const videoLine = msg.content.split("\n").find(l => l.startsWith("VIDEO:"));
            const videoSrc = videoLine?.slice(6);

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
                      <button onClick={() => { setEditingId(null); setEditError(null); }} style={{ padding: "0.3rem 0.75rem", border: "1px solid var(--border-strong)", borderRadius: 3, background: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.75rem" }}>{tr.common.cancel}</button>
                      <button onClick={() => handleEditSave(msg.id)} style={{ padding: "0.3rem 0.75rem", border: "none", borderRadius: 3, background: "var(--charcoal)", color: "var(--white)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 500 }}>{tr.common.save}</button>
                    </div>
                  </div>
                ) : videoSrc ? (
                  <div style={{ maxWidth: "78%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden", border: isMe ? "none" : "1px solid var(--border-strong)" }}>
                    <video controls src={videoSrc} style={{ display: "block", width: "100%", maxWidth: 280 }} />
                  </div>
                ) : msg.content.startsWith('IMAGE:') ? (
                  <div style={{ maxWidth: "78%", borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", overflow: "hidden" }}>
                    <img src={msg.content.slice(6)} alt="shared image" style={{ display: "block", width: "100%", maxWidth: 280, borderRadius: "inherit" }} />
                  </div>
                ) : audioSrc ? (
                  <div style={{
                    maxWidth: "78%", padding: "0.5rem 0.75rem",
                    background: isMe ? "var(--charcoal)" : "var(--white)",
                    borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    border: isMe ? "none" : "1px solid var(--border-strong)",
                  }}>
                    {audioLabel && <p style={{ margin: "0 0 0.375rem", fontSize: "0.8125rem", color: isMe ? "var(--cream)" : "var(--charcoal)" }}>{audioLabel}</p>}
                    <audio controls src={audioSrc} style={{ height: 32, maxWidth: "100%" }} />
                  </div>
                ) : (() => {
                  const replyData = parseReply(msg.content);
                  const displayContent = replyData ? replyData.body : msg.content;
                  return (
                    <div style={{
                      maxWidth: "78%", padding: replyData ? "0" : "0.5rem 0.875rem",
                      background: isMe ? "var(--charcoal)" : "var(--white)",
                      color: isMe ? "var(--cream)" : "var(--charcoal)",
                      borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      border: isMe ? "none" : "1px solid var(--border-strong)",
                      fontSize: "0.875rem", lineHeight: 1.6,
                      overflowWrap: "break-word", wordBreak: "break-word",
                      overflow: "hidden",
                    }}>
                      {replyData && (
                        <div style={{
                          borderLeft: `3px solid ${isMe ? "rgba(255,255,255,0.3)" : "var(--sage)"}`,
                          background: isMe ? "rgba(255,255,255,0.08)" : "var(--cream)",
                          padding: "0.375rem 0.625rem",
                          margin: "0",
                        }}>
                          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: isMe ? "rgba(255,255,255,0.6)" : "var(--sage)", marginBottom: "0.1rem" }}>
                            {replyData.replySender}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: isMe ? "rgba(255,255,255,0.5)" : "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {getReplyPreview(replyData.replyId)}
                          </div>
                        </div>
                      )}
                      <div style={{ padding: "0.5rem 0.875rem", whiteSpace: "pre-wrap" }}>{displayContent}</div>
                    </div>
                  );
                })()}

                {/* Reply / Edit / Delete — hovered actions */}
                {tab === "private" && !isEditing && (
                  <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.15rem", opacity: hoveredId === msg.id ? 1 : 0, transition: "opacity 0.15s", pointerEvents: hoveredId === msg.id ? "auto" : "none", paddingLeft: isMe ? 0 : "0.25rem", paddingRight: isMe ? "0.25rem" : 0 }}>
                    <button onClick={() => { setReplyTo({ id: msg.id, senderName: msg.sender_name ?? "them" }); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.625rem", color: "var(--muted)" }}>↩ Reply</button>
                    {canAct && <>
                      <span style={{ fontSize: "0.625rem", color: "var(--border-strong)" }}>·</span>
                      <button onClick={() => { setEditingId(msg.id); setEditText(msg.content); setEditError(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.625rem", color: "var(--muted)" }}>{tr.common.edit}</button>
                      <span style={{ fontSize: "0.625rem", color: "var(--border-strong)" }}>·</span>
                      <button onClick={() => handleDelete(msg.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.625rem", color: "var(--muted)" }}>{tr.common.delete}</button>
                    </>}
                  </div>
                )}

                {isLast && !isEditing && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.15rem", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--muted)", letterSpacing: "0.02em" }}>{formatTime(msg.created_at)}</span>

                    {/* Heart */}
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
          })
        )}

        {!loading && tab === "announcements" && announcements.length > 0 && (
          <button onClick={() => setTab("private")} style={{ all: "unset", marginTop: "0.75rem", padding: "0.625rem 0.875rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer", fontSize: "0.8125rem", color: "var(--muted)", width: "100%", boxSizing: "border-box" }}>
            {tr.student.chatReplyPrivately}
          </button>
        )}

        <div ref={bottomRef} />
      </div>

      {tab === "private" && audioError && (
        <div style={{ padding: "0.375rem 1rem", background: "var(--error-bg, #fff0f0)", borderTop: "1px solid var(--error, #d00)", fontSize: "0.75rem", color: "var(--error, #d00)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span>{audioError}</span>
          <button onClick={clearError} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0.25rem", color: "var(--error, #d00)", display: "flex", alignItems: "center" }}><X size={14} strokeWidth={1.5} /></button>
        </div>
      )}
      {tab === "private" && imageError && (
        <div style={{ padding: "0.375rem 1rem", background: "var(--error-bg, #fff0f0)", borderTop: "1px solid var(--error, #d00)", fontSize: "0.75rem", color: "var(--error, #d00)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span>{imageError}</span>
          <button onClick={() => setImageError(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0.25rem", color: "var(--error, #d00)", display: "flex", alignItems: "center" }}><X size={14} strokeWidth={1.5} /></button>
        </div>
      )}
      {tab === "private" && (
        <div style={{ flexShrink: 0, background: "var(--white)", borderTop: "1px solid var(--border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {replyTo && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, borderLeft: "2px solid var(--sage)", paddingLeft: "0.5rem", minWidth: 0 }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--sage)" }}>Replying to {replyTo.senderName}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getReplyPreview(replyTo.id)}</div>
              </div>
              <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0.125rem", display: "flex", flexShrink: 0 }}><X size={14} strokeWidth={1.5} /></button>
            </div>
          )}
        <div style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={student?.isSolo && !student?.studioId ? "Join a studio to message your teacher" : teacherId ? tr.student.chatMessageTeacher : tr.common.loading} disabled={sending || !teacherId || isRecording || uploadingAudio || (student?.isSolo && !student?.studioId)} rows={Math.min(5, Math.max(1, input.split("\n").length))} style={{ flex: 1, borderRadius: 3, border: "1px solid var(--border)", padding: "0.5rem 0.875rem", fontSize: "0.875rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)", resize: "none", lineHeight: 1.5, fontFamily: "inherit" }} />
          {/* Mic button — audio-only voice note */}
          <button
            onClick={isRecording ? stopRecording : handleStartRecording}
            disabled={uploadingAudio || sending || !teacherId}
            title={isRecording ? "Stop recording" : "Send voice note"}
            style={{
              padding: "0.5rem 0.625rem", borderRadius: 3, border: "1px solid var(--border)",
              background: isRecording ? "var(--error-bg)" : "var(--white)",
              color: isRecording ? "var(--error)" : "var(--muted)",
              cursor: uploadingAudio || sending || !teacherId ? "default" : "pointer",
              fontSize: "1rem", flexShrink: 0, marginBottom: "0.0625rem",
              transition: "all 0.15s",
            }}
          >
            {uploadingAudio ? <Hourglass size={18} strokeWidth={1.5} /> : isRecording ? <><Square size={14} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle" }} /> {recordingSeconds}s</> : <Mic size={18} strokeWidth={1.5} />}
          </button>
          {/* Camera button — video message */}
          <button
            onClick={() => setShowVideoRecorder(true)}
            disabled={sending || isRecording || uploadingAudio || !teacherId}
            title="Send video message"
            style={{
              padding: "0.5rem 0.625rem", borderRadius: 3, border: "1px solid var(--border)",
              background: "var(--white)", color: "var(--muted)",
              cursor: sending || isRecording || uploadingAudio || !teacherId ? "default" : "pointer",
              fontSize: "1rem", flexShrink: 0, marginBottom: "0.0625rem",
              transition: "all 0.15s",
            }}
          >
            <Video size={18} strokeWidth={1.5} />
          </button>
          {/* Hidden image input */}
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { void handleSendImage(f); e.target.value = ''; } }} />
          {/* Image button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={sending || isRecording || uploadingAudio || sendingImage || !teacherId}
            title="Send image"
            style={{
              padding: "0.5rem 0.625rem", borderRadius: 3, border: "1px solid var(--border)",
              background: "var(--white)", color: sendingImage ? "var(--muted)" : "var(--muted)",
              cursor: sending || isRecording || uploadingAudio || sendingImage || !teacherId ? "default" : "pointer",
              fontSize: "1rem", flexShrink: 0, marginBottom: "0.0625rem",
            }}
          >
            {sendingImage ? <Hourglass size={18} strokeWidth={1.5} /> : <Image size={18} strokeWidth={1.5} />}
          </button>
          <button onClick={handleSend} disabled={!input.trim() || sending || !teacherId || isRecording} style={{ padding: "0.5rem 1rem", borderRadius: 3, border: "none", background: input.trim() && teacherId && !isRecording ? "var(--charcoal)" : "var(--border)", color: "var(--white)", cursor: input.trim() && teacherId && !isRecording ? "pointer" : "default", fontSize: "0.8125rem", fontWeight: 500, flexShrink: 0, transition: "background 0.15s", marginBottom: "0.0625rem" }}>{tr.common.send}</button>
        </div>
        </div>
      )}

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
