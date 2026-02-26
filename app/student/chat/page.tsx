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

  useEffect(() => {
    if (!student?.studioId || !student?.id) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.getInstance(supabase);

    const load = async () => {
      const { data: studioData } = await supabase
        .from("studios")
        .select("owner_id")
        .eq("id", student.studioId!)
        .single();
      const tId = studioData?.owner_id ?? null;
      setTeacherId(tId);
      const anns = await chatService.getAnnouncements(student.studioId!);
      setAnnouncements(anns);
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

    const unsubAnn = chatService.subscribeToAnnouncements(student.studioId, (msg) => {
      setAnnouncements((prev) => [...prev, msg]);
    });
    return unsubAnn;
  }, [student?.studioId, student?.id]);

  useEffect(() => {
    if (!student?.studioId || !student?.id || !teacherId) return;
    const supabase = getSupabaseBrowserClient();
    const chatService = ChatService.getInstance(supabase);
    const unsubPriv = chatService.subscribeToPrivateThread(
      student.studioId, student.id, teacherId,
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
      await service.sendPrivateMessage(student.studioId, student.id, student.displayName, teacherId, text);
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
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "0.875rem 1.25rem" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.875rem" }}>
          Messages
        </div>
        {/* Underline-style tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: 0 }}>
          {(["announcements", "private"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "0.5rem 1rem",
                background: "none",
                border: "none",
                borderBottom: tab === t ? "1.5px solid var(--charcoal)" : "1.5px solid transparent",
                marginBottom: -1,
                fontFamily: "Inter, sans-serif",
                fontWeight: tab === t ? 500 : 400,
                fontSize: "0.8125rem",
                color: tab === t ? "var(--charcoal)" : "var(--muted)",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {t === "announcements" ? "Studio" : "Private"}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem", paddingBottom: "6rem" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "1rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 3, width: i % 2 === 0 ? "60%" : "45%", alignSelf: i % 2 === 0 ? "flex-end" : "flex-start" }} />
            ))}
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="empty-state" style={{ flex: 1, justifyContent: "center" }}>
            <div className="empty-state-title">
              {tab === "announcements" ? "No announcements yet" : "No private messages yet"}
            </div>
            <p className="empty-state-desc">
              {tab === "announcements"
                ? "Studio announcements from your teacher appear here."
                : "Message your teacher privately below."}
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
                  <div style={{ padding: "0.625rem 0.875rem", background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 3, fontSize: "0.75rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", maxWidth: "88%", lineHeight: 1.6 }}>
                    <div style={{ whiteSpace: "pre-line" }}>{textContent}</div>
                    {audioUrl && <audio controls src={audioUrl} style={{ width: "100%", marginTop: "0.5rem", height: 32 }} />}
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
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", paddingLeft: "0.25rem" }}>
                    {msg.sender_name}
                  </span>
                )}
                <div style={{
                  maxWidth: "75%",
                  padding: "0.575rem 0.875rem",
                  background: isMe ? "var(--charcoal)" : "var(--white)",
                  color: isMe ? "white" : "var(--charcoal)",
                  borderRadius: isMe ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                  border: isMe ? "none" : "1px solid var(--border)",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                  fontFamily: "Inter, sans-serif",
                }}>
                  {msg.content}
                </div>
                {(i === activeMessages.length - 1 || activeMessages[i + 1]?.sender_id !== msg.sender_id) && (
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", paddingLeft: "0.25rem", paddingRight: "0.25rem", letterSpacing: "0.02em" }}>
                    {formatTime(msg.created_at)}
                  </span>
                )}
              </div>
            );
          })
        )}

        {!loading && tab === "announcements" && announcements.length > 0 && (
          <div onClick={() => setTab("private")} style={{ marginTop: "0.5rem", padding: "0.625rem 0.875rem", background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Reply privately to your teacher →
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {tab === "private" && (
        <div style={{ position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "0.75rem 1rem", background: "var(--white)", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={teacherId ? "Message your teacher" : "Loading…"}
            disabled={sending || !teacherId}
            style={{ flex: 1, borderRadius: 3, border: "1px solid var(--border-strong)", padding: "0.575rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", outline: "none", background: "var(--cream)", color: "var(--charcoal)" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || !teacherId}
            style={{ width: 36, height: 36, borderRadius: 3, background: !input.trim() || !teacherId ? "var(--border)" : "var(--charcoal)", border: "none", cursor: !input.trim() || !teacherId ? "default" : "pointer", color: "white", fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s", flexShrink: 0 }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
