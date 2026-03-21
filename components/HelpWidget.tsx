"use client";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/context/I18nContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Music, X, ArrowUp, Bug, Sparkles, MessageCircle } from "lucide-react";

type Tab = "chat" | "feedback";
type FeedbackType = "bug" | "feature" | "general";

const TYPES: { value: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { value: "bug",     label: "Bug",            icon: <Bug size={12} strokeWidth={1.5} /> },
  { value: "feature", label: "Feature request", icon: <Sparkles size={12} strokeWidth={1.5} /> },
  { value: "general", label: "General",         icon: <MessageCircle size={12} strokeWidth={1.5} /> },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function HelpWidget() {
  const { user } = useAuth();
  const { t } = useI18n();
  const supabase = getSupabaseBrowserClient();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const panelRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreeted = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Feedback state
  const [fbType, setFbType] = useState<FeedbackType>("general");
  const [fbMessage, setFbMessage] = useState("");
  const [fbStatus, setFbStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abort in-flight stream and clear pending timers on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (fbTimerRef.current) clearTimeout(fbTimerRef.current);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // On open: greet + focus
  useEffect(() => {
    if (!open) return;
    let id: ReturnType<typeof setTimeout>;
    if (tab === "chat") {
      id = setTimeout(() => inputRef.current?.focus(), 60);
      if (!hasGreeted.current) {
        hasGreeted.current = true;
        setMessages([{ role: "assistant", content: t.common.supportGreeting }]);
      }
    } else {
      id = setTimeout(() => textareaRef.current?.focus(), 60);
    }
    return () => clearTimeout(id);
  }, [open, tab]);

  // Auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setStreaming(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("Failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text: chunk } = JSON.parse(data) as { text: string };
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + chunk };
              return updated;
            });
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: "Sorry, something went wrong. Please try again." };
        return updated;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!fbMessage.trim() || !user?.id) return;
    setFbStatus("sending");
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      display_name: profile?.display_name ?? null,
      type: fbType,
      message: fbMessage.trim(),
      page_url: window.location.pathname,
    });
    if (error) {
      setFbStatus("error");
      fbTimerRef.current = setTimeout(() => setFbStatus("idle"), 3000);
    } else {
      setFbStatus("sent");
      fbTimerRef.current = setTimeout(() => { setOpen(false); setFbMessage(""); setFbType("general"); setFbStatus("idle"); }, 2000);
    }
  }

  if (!user) return null;

  return (
    <div ref={panelRef} style={{ position: "fixed", bottom: 80, right: 16, zIndex: 1000 }}>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 10px)", right: 0,
          width: 320,
          background: "#fff", border: "1px solid #e5e2dc",
          borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "0.75rem 1rem",
            background: "#2C2824",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Music size={14} strokeWidth={1.5} color="rgba(255,255,255,0.8)" />
              </div>
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 600, color: "#fff" }}>
                  {t.common.supportTitle}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "rgba(255,255,255,0.55)" }}>
                  {t.common.supportSubtitle}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", padding: 0, lineHeight: 1, display: "flex", alignItems: "center" }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid #e5e2dc",
            background: "#faf8f5", flexShrink: 0,
          }}>
            {(["chat", "feedback"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "0.5rem 0",
                  fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? "#2C2824" : "#999",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: `2px solid ${tab === t ? "#2C2824" : "transparent"}`,
                  transition: "all 0.12s",
                }}
              >
                {t === "chat" ? "Help" : "Feedback"}
              </button>
            ))}
          </div>

          {/* Chat panel */}
          {tab === "chat" && (
            <>
              <div style={{
                height: 340, overflowY: "auto", padding: "0.75rem",
                display: "flex", flexDirection: "column", gap: "0.625rem",
                background: "#f7f5f2",
              }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "82%", padding: "0.5rem 0.75rem",
                      borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      background: msg.role === "user" ? "#2C2824" : "#fff",
                      border: msg.role === "user" ? "none" : "1px solid #e5e2dc",
                      fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", lineHeight: 1.55,
                      color: msg.role === "user" ? "#fff" : "#2C2824",
                      whiteSpace: "pre-wrap",
                    }}>
                      {msg.content}
                      {streaming && i === messages.length - 1 && msg.role === "assistant" && msg.content === "" && (
                        <span style={{ opacity: 0.4 }}>●●●</span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div style={{
                padding: "0.625rem 0.75rem",
                borderTop: "1px solid #e5e2dc",
                display: "flex", gap: "0.5rem", alignItems: "center",
                flexShrink: 0, background: "#fff",
              }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={t.common.supportPlaceholder}
                  disabled={streaming}
                  style={{
                    flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                    border: "1px solid #ddd", borderRadius: 20,
                    padding: "0.4rem 0.875rem", outline: "none",
                    background: "#f7f5f2", color: "#2C2824",
                    opacity: streaming ? 0.6 : 1,
                  }}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || streaming}
                  style={{
                    width: 32, height: 32, borderRadius: "50%", border: "none",
                    background: input.trim() && !streaming ? "#2C2824" : "#ccc",
                    color: "#fff", cursor: input.trim() && !streaming ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.12s", flexShrink: 0,
                  }}
                >
                  <ArrowUp size={16} strokeWidth={1.5} />
                </button>
              </div>
            </>
          )}

          {/* Feedback panel */}
          {tab === "feedback" && (
            <div style={{ padding: "0.875rem 1rem 1rem" }}>
              {fbStatus === "sent" ? (
                <div style={{ padding: "2rem 0", textAlign: "center" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "#2C2824" }}>
                    {t.common.feedbackThanks}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback}>
                  <div style={{ display: "flex", gap: "0.375rem", marginBottom: "0.75rem" }}>
                    {TYPES.map(tp => (
                      <button
                        key={tp.value}
                        type="button"
                        onClick={() => setFbType(tp.value)}
                        style={{
                          flex: 1, padding: "0.3rem 0", borderRadius: 6, cursor: "pointer",
                          border: `1px solid ${fbType === tp.value ? "#2C2824" : "#e5e2dc"}`,
                          background: fbType === tp.value ? "#2C2824" : "none",
                          color: fbType === tp.value ? "#fff" : "#999",
                          fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600,
                          letterSpacing: "0.03em", transition: "all 0.12s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem",
                        }}
                      >
                        {tp.icon} {tp.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={fbMessage}
                    onChange={e => setFbMessage(e.target.value)}
                    placeholder={
                      fbType === "bug"     ? "What happened? What did you expect?" :
                      fbType === "feature" ? "What would you love to see?" :
                                             "What's on your mind?"
                    }
                    rows={5}
                    style={{
                      width: "100%", resize: "none", boxSizing: "border-box",
                      fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", lineHeight: 1.5,
                      color: "#2C2824", border: "1px solid #e5e2dc",
                      borderRadius: 8, padding: "0.5rem 0.625rem",
                      background: "#f7f5f2", outline: "none",
                    }}
                  />
                  {fbStatus === "error" && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#C0392B", marginTop: "0.375rem" }}>
                      {t.common.feedbackCantSend}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={!fbMessage.trim() || fbStatus === "sending"}
                    style={{
                      marginTop: "0.625rem", width: "100%",
                      padding: "0.5rem", borderRadius: 8, border: "none",
                      background: "#2C2824", color: "#fff",
                      fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 600,
                      cursor: fbMessage.trim() ? "pointer" : "default",
                      opacity: !fbMessage.trim() || fbStatus === "sending" ? 0.5 : 1,
                      transition: "opacity 0.12s",
                    }}
                  >
                    {fbStatus === "sending" ? t.common.sending : t.common.feedbackSend}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Help & feedback"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          background: open ? "#2C2824" : "#fff",
          border: "1px solid #ddd",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.1rem", lineHeight: 1,
          transition: "background 0.15s",
          color: open ? "#fff" : "#2C2824",
        }}
        aria-label="Help and feedback"
      >
        {open ? <X size={18} strokeWidth={1.5} /> : <MessageCircle size={18} strokeWidth={1.5} />}
      </button>
    </div>
  );
}
