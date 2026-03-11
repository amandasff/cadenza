"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED = [
  "What do I need for my Grade 5 RCM exam?",
  "How many scales are required at Level 8?",
  "What's the difference between harmonic and melodic minor?",
  "Tips for improving my sight reading?",
  "Explain the circle of fifths",
  "What ear training is tested at Grade 3?",
  "How do I practice hands together effectively?",
  "What are the mark requirements to pass vs honours?",
];

export default function AITutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const dec = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = dec.decode(value, { stream: !done });
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          );
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "Something went wrong");
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--cream)", fontFamily: "Inter, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "1.5rem 1.5rem 1rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--white)",
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.5rem", fontWeight: 500, color: "var(--charcoal)", letterSpacing: "-0.01em", marginBottom: "0.125rem" }}>
            AI Music Tutor
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Ask anything — RCM exam prep, music theory, technique, practice strategies.
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* Empty state: suggested questions */}
          {isEmpty && (
            <div>
              <div style={{ textAlign: "center", marginBottom: "2rem", paddingTop: "1rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎵</div>
                <div style={{ fontSize: "1rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.375rem" }}>
                  What would you like to know?
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
                  I know the full RCM curriculum, music theory, and have years of teaching experience.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.625rem" }}>
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    style={{
                      background: "var(--white)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "0.875rem 1rem",
                      fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                      color: "var(--charcoal)", cursor: "pointer", textAlign: "left",
                      lineHeight: 1.5, transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--charcoal)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--cream-deep)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--white)"; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message thread */}
          {messages.map((m) => (
            <div key={m.id} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: "1rem",
            }}>
              {m.role === "assistant" && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--charcoal)", color: "var(--white)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", flexShrink: 0, marginRight: "0.625rem",
                  marginTop: "0.125rem", fontWeight: 600,
                }}>
                  AI
                </div>
              )}
              <div style={{
                maxWidth: "78%",
                background: m.role === "user" ? "var(--charcoal)" : "var(--white)",
                color: m.role === "user" ? "var(--white)" : "var(--charcoal)",
                borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                padding: "0.75rem 1rem",
                fontSize: "0.875rem",
                lineHeight: 1.65,
                border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                whiteSpace: m.role === "user" ? "pre-wrap" : undefined,
              }}>
                {m.content ? (
                  m.role === "assistant" ? (
                    <div className="ai-markdown">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : m.content
                ) : (streaming && m.role === "assistant" ? (
                  <span style={{ opacity: 0.4 }}>Thinking…</span>
                ) : "")}
                {streaming && m.role === "assistant" && m.content && (
                  <span style={{
                    display: "inline-block", width: 6, height: 14,
                    background: "var(--charcoal)", borderRadius: 1,
                    marginLeft: 2, verticalAlign: "middle",
                    animation: "blink 1s steps(1) infinite",
                  }} />
                )}
              </div>
            </div>
          ))}

          {error && (
            <div style={{ textAlign: "center", padding: "1rem", color: "#c0392b", fontSize: "0.8125rem" }}>
              {error}
              <button onClick={() => setError(null)} style={{ marginLeft: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem" }}>dismiss</button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div style={{
        padding: "1rem 1.5rem",
        borderTop: "1px solid var(--border)",
        background: "var(--white)",
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: "0.625rem", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about RCM levels, theory, practice tips…"
            rows={1}
            disabled={streaming}
            style={{
              flex: 1, resize: "none", border: "1px solid var(--border-strong)",
              borderRadius: 12, padding: "0.75rem 1rem",
              fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
              color: "var(--charcoal)", background: "var(--cream)",
              outline: "none", lineHeight: 1.5,
              maxHeight: 160, overflowY: "auto",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--charcoal)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 160) + "px";
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
              background: input.trim() && !streaming ? "var(--charcoal)" : "var(--border)",
              color: "var(--white)", cursor: input.trim() && !streaming ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem", transition: "background 0.15s",
            }}
          >
            {streaming ? (
              <span style={{ fontSize: "0.75rem", fontFamily: "Inter, sans-serif" }}>…</span>
            ) : "↑"}
          </button>
        </div>
        <div style={{ maxWidth: 720, margin: "0.375rem auto 0", textAlign: "center" }}>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
            Enter to send · Shift+Enter for new line · AI can make mistakes — verify exam details at{" "}
            <a href="https://rcmusic.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted)" }}>rcmusic.com</a>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .ai-markdown { overflow-wrap: break-word; word-break: break-word; }
        .ai-markdown > :first-child { margin-top: 0; }
        .ai-markdown > :last-child { margin-bottom: 0; }
        .ai-markdown h1 { font-size: 1.125rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .ai-markdown h2 { font-size: 1rem; font-weight: 700; margin: 0.875rem 0 0.375rem; }
        .ai-markdown h3 { font-size: 0.9375rem; font-weight: 600; margin: 0.75rem 0 0.375rem; }
        .ai-markdown p { margin: 0.5rem 0; }
        .ai-markdown ul, .ai-markdown ol { margin: 0.5rem 0; padding-left: 1.25rem; }
        .ai-markdown li { margin: 0.25rem 0; }
        .ai-markdown blockquote {
          margin: 0.5rem 0; padding: 0.375rem 0.75rem;
          border-left: 3px solid var(--muted); opacity: 0.85;
          font-style: italic;
        }
        .ai-markdown code {
          background: rgba(0,0,0,0.06); padding: 0.125rem 0.375rem;
          border-radius: 4px; font-size: 0.8125rem;
        }
        .ai-markdown pre { margin: 0.5rem 0; overflow-x: auto; }
        .ai-markdown pre code { background: rgba(0,0,0,0.06); display: block; padding: 0.625rem; border-radius: 6px; }
        .ai-markdown hr { border: none; border-top: 1px solid var(--border); margin: 0.75rem 0; }
        .ai-markdown strong { font-weight: 700; }
        .ai-markdown table { border-collapse: collapse; margin: 0.5rem 0; font-size: 0.8125rem; }
        .ai-markdown th, .ai-markdown td { border: 1px solid var(--border); padding: 0.375rem 0.625rem; text-align: left; }
      `}</style>
    </div>
  );
}
