"use client";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/context/I18nContext";
import { Music, X, ArrowUp, MessageCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function SupportChatWidget() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreeted = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input and show greeting when opened
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    if (!hasGreeted.current) {
      hasGreeted.current = true;
      setMessages([{
        role: "assistant",
        content: t.common.supportGreeting,
      }]);
    }
    return () => clearTimeout(id);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
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
            const { text } = JSON.parse(data) as { text: string };
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + text,
              };
              return updated;
            });
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "Sorry, something went wrong. Please try again or use the ? button to report an issue.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  if (!user) return null;

  return (
    <div style={{ position: "fixed", bottom: 130, right: 16, zIndex: 1000 }}>
      {/* Chat panel — hardcoded light colors so it looks right in both light and dark mode */}
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 10px)", right: 0,
          width: 320, height: 440,
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
              }}><Music size={14} strokeWidth={1.5} color="rgba(255,255,255,0.8)" /></div>
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

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "0.75rem",
            display: "flex", flexDirection: "column", gap: "0.625rem",
            background: "#f7f5f2",
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: msg.role === "user" ? "#2C2824" : "#fff",
                  border: msg.role === "user" ? "none" : "1px solid #e5e2dc",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.8125rem",
                  lineHeight: 1.55,
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

          {/* Input */}
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
                fontSize: "0.875rem", transition: "background 0.12s", flexShrink: 0,
              }}
            >
              <ArrowUp size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Trigger button — hardcoded colors so fun-mode theme overrides don't affect it */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Get help"
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
        aria-label="Open support chat"
      >
        {open ? <X size={18} strokeWidth={1.5} /> : <MessageCircle size={18} strokeWidth={1.5} />}
      </button>
    </div>
  );
}
