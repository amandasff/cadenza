"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ChatService } from "../../../lib/services/ChatService";
import { StudioService } from "../../../lib/services/StudioService";
import { Teacher } from "../../../lib/models/Teacher";
import type { MessageRow, ProfileRow } from "../../../lib/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function TeacherChat() {
  const { user } = useAuth();
  const teacher = user as Teacher;

  // null = Announcements view; a ProfileRow = DM with that student
  const [selectedStudent, setSelectedStudent] = useState<ProfileRow | null>(null);
  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load student roster once
  useEffect(() => {
    if (!teacher?.studioId) return;
    const supabase = getSupabaseBrowserClient();
    StudioService.getInstance(supabase)
      .getStudents(teacher.studioId)
      .then((data) => { setStudents(data); setLoadingStudents(false); })
      .catch((err) => {
        const e = err as { message?: string };
        console.error("getStudents error:", e?.message);
        setLoadingStudents(false);
      });
  }, [teacher?.studioId]);

  // Load messages + subscribe whenever the active pane changes
  useEffect(() => {
    if (!teacher?.studioId || !teacher?.id) return;
    setLoadingMessages(true);
    setMessages([]);
    const supabase = getSupabaseBrowserClient();
    const service = ChatService.getInstance(supabase);

    let unsubscribe: () => void;

    if (selectedStudent === null) {
      service
        .getAnnouncements(teacher.studioId)
        .then((msgs) => { setMessages(msgs); setLoadingMessages(false); })
        .catch((err) => {
          const e = err as { message?: string };
          console.error("getAnnouncements error:", e?.message);
          setLoadingMessages(false);
        });
      unsubscribe = service.subscribeToAnnouncements(teacher.studioId, (msg) => {
        setMessages((prev) => [...prev, msg]);
      });
    } else {
      service
        .getPrivateThread(teacher.studioId, teacher.id, selectedStudent.id)
        .then((msgs) => { setMessages(msgs); setLoadingMessages(false); })
        .catch((err) => {
          const e = err as { message?: string };
          console.error("getPrivateThread error:", e?.message);
          setLoadingMessages(false);
        });
      unsubscribe = service.subscribeToPrivateThread(
        teacher.studioId,
        teacher.id,
        selectedStudent.id,
        (msg) => { setMessages((prev) => [...prev, msg]); }
      );
    }

    return unsubscribe;
  }, [teacher?.studioId, teacher?.id, selectedStudent]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !teacher?.studioId || sending) return;
    setInput("");
    setSending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = ChatService.getInstance(supabase);
      if (selectedStudent === null) {
        await service.postAnnouncement(teacher.studioId, teacher.id, teacher.displayName, text);
      } else {
        await service.sendPrivateMessage(
          teacher.studioId, teacher.id, teacher.displayName, selectedStudent.id, text
        );
      }
    } catch (err) {
      const e = err as { message?: string };
      console.error("send error:", e?.message);
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const isAnnouncements = selectedStudent === null;
  const headerTitle = isAnnouncements ? "Announcements" : selectedStudent.display_name;
  const headerSub = isAnnouncements ? "All students see these" : "Private message";
  const placeholder = isAnnouncements
    ? "Post an announcement to all students…"
    : `Message ${selectedStudent?.display_name}…`;

  return (
    <div>
      <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.4rem", color: "var(--charcoal)", marginBottom: "1.25rem" }}>
        Messages
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1rem", height: "72vh" }}>
        {/* Left sidebar */}
        <div className="card-base" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Announcements button */}
          <button
            onClick={() => setSelectedStudent(null)}
            style={{
              all: "unset",
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.875rem 1rem",
              borderBottom: "1.5px solid var(--border)",
              cursor: "pointer",
              background: isAnnouncements ? "var(--peach-bg)" : "transparent",
              transition: "background 0.15s",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div style={{
              width: 32, height: 32,
              background: isAnnouncements ? "var(--peach)" : "var(--cream-deep)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.85rem", flexShrink: 0,
              transition: "background 0.15s",
            }}>
              📢
            </div>
            <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: isAnnouncements ? "var(--peach)" : "var(--charcoal)" }}>
              Announcements
            </span>
          </button>

          {/* DMs header */}
          <div style={{ padding: "0.5rem 1rem", fontSize: "0.67rem", fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
            Direct Messages
          </div>

          {/* Student list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingStudents ? (
              <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 36, borderRadius: "var(--radius-md)" }} />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div style={{ padding: "1.25rem 1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>🎹</div>
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>No students yet</p>
              </div>
            ) : (
              students.map((s) => {
                const isSelected = selectedStudent?.id === s.id;
                const initials = s.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    style={{
                      all: "unset",
                      display: "flex", alignItems: "center", gap: "0.625rem",
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      background: isSelected ? "var(--sky-bg)" : "transparent",
                      width: "100%",
                      boxSizing: "border-box",
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{
                      width: 32, height: 32,
                      background: isSelected ? "var(--sky)" : "var(--sky-bg)",
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.7rem",
                      color: isSelected ? "white" : "var(--sky)",
                      flexShrink: 0, transition: "all 0.15s",
                    }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.display_name}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                        🔥 {s.streak_days}d · ⭐ {s.total_points}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: message pane */}
        <div className="card-base" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span style={{ fontSize: "1.1rem" }}>{isAnnouncements ? "📢" : "💬"}</span>
            <div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--charcoal)" }}>
                {headerTitle}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                {headerSub}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {loadingMessages ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" style={{ height: 36, borderRadius: "var(--radius-md)", width: i % 2 === 0 ? "60%" : "45%", alignSelf: i % 2 === 0 ? "flex-end" : "flex-start" }} />
              ))
            ) : messages.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{isAnnouncements ? "📢" : "💬"}</div>
                <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "var(--charcoal)", margin: 0 }}>
                  {isAnnouncements ? "No announcements yet" : "No messages yet"}
                </p>
                <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
                  {isAnnouncements
                    ? "Post an announcement below — all students will see it"
                    : `Start a conversation with ${selectedStudent?.display_name}`}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.message_type === "system") {
                  const lines = msg.content.split("\n");
                  const audioUrl = lines.find((l) => l.startsWith("AUDIO:"))?.slice(6);
                  const textContent = lines.filter((l) => !l.startsWith("AUDIO:")).join("\n");
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: "center", padding: "0.25rem 0" }}>
                      <div style={{ padding: "0.625rem 0.875rem", background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", fontSize: "0.73rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", maxWidth: "88%", lineHeight: 1.6 }}>
                        <div style={{ whiteSpace: "pre-line" }}>{textContent}</div>
                        {audioUrl && (
                          <audio controls src={audioUrl} style={{ width: "100%", marginTop: "0.5rem", height: 36 }} />
                        )}
                      </div>
                    </div>
                  );
                }
                const isMe = msg.sender_id === teacher?.id;
                return (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: "0.2rem" }}>
                    {!isMe && (
                      <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.68rem", color: "var(--muted)", paddingLeft: "0.25rem" }}>
                        {msg.sender_name}
                      </span>
                    )}
                    <div style={{
                      maxWidth: "68%",
                      padding: "0.55rem 0.875rem",
                      background: isMe ? (isAnnouncements ? "var(--peach)" : "var(--sky)") : "var(--cream-deep)",
                      color: isMe ? "white" : "var(--charcoal)",
                      borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      fontSize: "0.875rem",
                      lineHeight: 1.5,
                      fontFamily: "DM Sans, sans-serif",
                    }}>
                      {msg.content}
                    </div>
                    <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.65rem", color: "var(--muted)", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "0.75rem 1rem", borderTop: "1.5px solid var(--border)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={sending}
              style={{
                flex: 1, borderRadius: 100, border: "1.5px solid var(--border)",
                padding: "0.6rem 1rem", fontFamily: "DM Sans, sans-serif",
                fontSize: "0.875rem", outline: "none",
                background: "var(--cream)", color: "var(--charcoal)",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: !input.trim() ? "var(--border)" : isAnnouncements ? "var(--peach)" : "var(--sky)",
                border: "none", cursor: !input.trim() ? "default" : "pointer",
                color: "white", fontSize: "1rem",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s", flexShrink: 0,
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
