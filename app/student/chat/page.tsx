"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ChatService } from "../../../lib/services/ChatService";
import { Student } from "../../../lib/models/Student";
import type { MessageRow } from "../../../lib/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

type Tab = "announcements" | "private";

export default function StudentChat() {
  const { user } = useAuth();
  const student = user as Student;

  const [tab, setTab] = useState<Tab>("announcements");
  const [announcements, setAnnouncements] = useState<MessageRow[]>([]);
  const [privateMessages, setPrivateMessages] = useState<MessageRow[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load teacher ID, announcements, and private thread
  useEffect(() => {
    if (!student?.studioId || !student?.id) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.getInstance(supabase);

    const load = async () => {
      // Get studio owner (teacher) ID
      const { data: studioData } = await supabase
        .from("studios")
        .select("owner_id")
        .eq("id", student.studioId!)
        .single();
      const tId = studioData?.owner_id ?? null;
      setTeacherId(tId);

      // Load announcements
      const anns = await chatService.getAnnouncements(student.studioId!);
      setAnnouncements(anns);

      // Load private thread with teacher
      if (tId) {
        const priv = await chatService.getPrivateThread(student.studioId!, student.id, tId);
        setPrivateMessages(priv);
      }
      setLoading(false);
    };

    load().catch((err) => {
      const e = err as { message?: string };
      console.error("chat load error:", e?.message);
      setLoading(false);
    });

    // Subscribe to announcements
    const unsubAnn = chatService.subscribeToAnnouncements(student.studioId, (msg) => {
      setAnnouncements((prev) => [...prev, msg]);
    });

    return unsubAnn;
  }, [student?.studioId, student?.id]);

  // Subscribe to private thread once teacher ID is known
  useEffect(() => {
    if (!student?.studioId || !student?.id || !teacherId) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.getInstance(supabase);

    const unsubPriv = chatService.subscribeToPrivateThread(
      student.studioId,
      student.id,
      teacherId,
      (msg) => { setPrivateMessages((prev) => [...prev, msg]); }
    );
    return unsubPriv;
  }, [student?.studioId, student?.id, teacherId]);

  useEffect(() => { scrollToBottom(); }, [announcements, privateMessages, tab, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !student?.studioId || !teacherId || sending) return;
    setInput("");
    setSending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = ChatService.getInstance(supabase);
      await service.sendPrivateMessage(
        student.studioId, student.id, student.displayName, teacherId, text
      );
      // Switch to private tab after sending
      setTab("private");
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

  const activeMessages = tab === "announcements" ? announcements : privateMessages;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1.5px solid var(--border)", padding: "0.875rem 1.25rem" }}>
        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1rem", color: "var(--charcoal)", marginBottom: "0.75rem" }}>
          Messages
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setTab("announcements")}
            style={{
              flex: 1,
              padding: "0.45rem 0.5rem",
              borderRadius: 100,
              border: "1.5px solid",
              borderColor: tab === "announcements" ? "var(--peach)" : "var(--border)",
              background: tab === "announcements" ? "var(--peach)" : "transparent",
              color: tab === "announcements" ? "white" : "var(--muted)",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            📢 Announcements
          </button>
          <button
            onClick={() => setTab("private")}
            style={{
              flex: 1,
              padding: "0.45rem 0.5rem",
              borderRadius: 100,
              border: "1.5px solid",
              borderColor: tab === "private" ? "var(--sky)" : "var(--border)",
              background: tab === "private" ? "var(--sky)" : "transparent",
              color: tab === "private" ? "white" : "var(--muted)",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            💬 Private
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem", paddingBottom: "6rem" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "1rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, borderRadius: "var(--radius-md)", width: i % 2 === 0 ? "65%" : "50%", alignSelf: i % 2 === 0 ? "flex-end" : "flex-start" }} />
            ))}
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
              {tab === "announcements" ? "📢" : "💬"}
            </div>
            <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--charcoal)", margin: 0 }}>
              {tab === "announcements" ? "No announcements yet" : "No private messages yet"}
            </p>
            <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0", textAlign: "center" }}>
              {tab === "announcements"
                ? "Your teacher's announcements will appear here"
                : "Reply privately to your teacher below"}
            </p>
          </div>
        ) : (
          activeMessages.map((msg, i) => {
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
            const isMe = msg.sender_id === student?.id;
            const prev = i > 0 ? activeMessages[i - 1] : null;
            const showName = !isMe && prev?.sender_id !== msg.sender_id;
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: "0.15rem" }}>
                {showName && (
                  <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.68rem", color: "var(--muted)", paddingLeft: "0.25rem" }}>
                    {msg.sender_name}
                  </span>
                )}
                <div style={{
                  maxWidth: "75%",
                  padding: "0.6rem 0.9rem",
                  background: isMe ? "var(--peach)" : "var(--white)",
                  color: isMe ? "white" : "var(--charcoal)",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  border: isMe ? "none" : "1.5px solid var(--border)",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                  fontFamily: "DM Sans, sans-serif",
                }}>
                  {msg.content}
                </div>
                {(i === activeMessages.length - 1 || activeMessages[i + 1]?.sender_id !== msg.sender_id) && (
                  <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.65rem", color: "var(--muted)", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                    {formatTime(msg.created_at)}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Hint on announcements tab */}
        {!loading && tab === "announcements" && announcements.length > 0 && (
          <div
            onClick={() => setTab("private")}
            style={{
              marginTop: "0.5rem",
              padding: "0.6rem 0.875rem",
              background: "var(--sky-bg)",
              border: "1.5px solid var(--sky-light, var(--border))",
              borderRadius: "var(--radius-lg)",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.9rem" }}>💬</span>
            <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "var(--sky)" }}>
              Reply privately to your teacher →
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — only on Private tab */}
      {tab === "private" && (
        <div style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          padding: "0.75rem 1rem",
          background: "var(--white)",
          borderTop: "1.5px solid var(--border)",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={teacherId ? "Message your teacher…" : "Loading…"}
            disabled={sending || !teacherId}
            style={{
              flex: 1,
              borderRadius: 100,
              border: "1.5px solid var(--border)",
              padding: "0.6rem 1rem",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "0.875rem",
              outline: "none",
              background: "var(--cream)",
              color: "var(--charcoal)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || !teacherId}
            style={{
              width: 40, height: 40,
              borderRadius: "50%",
              background: !input.trim() || !teacherId ? "var(--border)" : "var(--peach)",
              border: "none",
              cursor: !input.trim() || !teacherId ? "default" : "pointer",
              color: "white",
              fontSize: "1rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
