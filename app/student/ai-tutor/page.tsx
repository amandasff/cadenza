"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";

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

const DAILY_LIMIT = 20;

// ── Simple markdown → React renderer ─────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line → skip
    if (line.trim() === "") { i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} />);
      i++; continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      elements.push(<Tag key={key++}>{inlineFormat(hMatch[2])}</Tag>);
      i++; continue;
    }

    // Unordered list
    if (/^[-•*]\s/.test(line.trim())) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i].trim())) {
        items.push(<li key={key++}>{inlineFormat(lines[i].trim().replace(/^[-•*]\s+/, ""))}</li>);
        i++;
      }
      elements.push(<ul key={key++}>{items}</ul>);
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s/.test(line.trim())) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(<li key={key++}>{inlineFormat(lines[i].trim().replace(/^\d+[.)]\s+/, ""))}</li>);
        i++;
      }
      elements.push(<ol key={key++}>{items}</ol>);
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        bqLines.push(lines[i].trimStart().replace(/^>\s?/, ""));
        i++;
      }
      elements.push(<blockquote key={key++}>{inlineFormat(bqLines.join(" "))}</blockquote>);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={key++}>{inlineFormat(line)}</p>);
    i++;
  }

  return elements;
}

function inlineFormat(text: string): React.ReactNode {
  // Split on bold (**), inline code (`), then italic (*) using a single pass
  const parts: React.ReactNode[] = [];
  // Match **bold**, `code`, or *italic* — bold checked before italic
  const regex = /\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*/g;
  let lastIndex = 0;
  let k = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<strong key={k++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<code key={k++}>{match[2]}</code>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={k++}>{match[3]}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return text;
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default function AITutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load daily message count from localStorage
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const stored = localStorage.getItem("ai-tutor-usage");
    if (stored) {
      try {
        const { date, count } = JSON.parse(stored);
        if (date === today) {
          setMsgCount(count);
        } else {
          localStorage.setItem("ai-tutor-usage", JSON.stringify({ date: today, count: 0 }));
        }
      } catch {
        localStorage.setItem("ai-tutor-usage", JSON.stringify({ date: today, count: 0 }));
      }
    }
  }, []);

  function incrementCount() {
    const today = new Date().toISOString().slice(0, 10);
    const newCount = msgCount + 1;
    setMsgCount(newCount);
    localStorage.setItem("ai-tutor-usage", JSON.stringify({ date: today, count: newCount }));
  }

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    if (msgCount >= DAILY_LIMIT) {
      setError(`You've reached your daily limit of ${DAILY_LIMIT} messages. Come back tomorrow!`);
      return;
    }

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

      incrementCount();
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
  const atLimit = msgCount >= DAILY_LIMIT;
  const remaining = DAILY_LIMIT - msgCount;

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
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.5rem", fontWeight: 500, color: "var(--charcoal)", letterSpacing: "-0.01em", marginBottom: "0.125rem" }}>
              AI Music Tutor
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
              Ask anything — RCM exam prep, music theory, technique, practice strategies.
            </p>
          </div>
          <div style={{
            fontSize: "0.6875rem", color: remaining <= 5 ? "var(--error)" : "var(--muted)",
            background: remaining <= 5 ? "var(--error-bg)" : "var(--cream)",
            padding: "0.25rem 0.625rem", borderRadius: 12,
            fontWeight: 500, whiteSpace: "nowrap", marginTop: "0.25rem",
          }}>
            {remaining}/{DAILY_LIMIT} left today
          </div>
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
                    disabled={atLimit}
                    className="ai-tutor-suggestion"
                    style={{
                      background: "var(--white)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "0.875rem 1rem",
                      fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                      color: "var(--charcoal)", cursor: atLimit ? "default" : "pointer", textAlign: "left",
                      lineHeight: 1.5, transition: "all 0.15s",
                      opacity: atLimit ? 0.5 : 1,
                    }}
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
                      {renderMarkdown(m.content)}
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
            <div style={{ textAlign: "center", padding: "1rem", color: "var(--error)", fontSize: "0.8125rem" }}>
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
            placeholder={atLimit ? "Daily limit reached — come back tomorrow!" : "Ask about RCM levels, theory, practice tips…"}
            rows={1}
            disabled={streaming || atLimit}
            style={{
              flex: 1, resize: "none", border: "1px solid var(--border-strong)",
              borderRadius: 12, padding: "0.75rem 1rem",
              fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
              color: "var(--charcoal)", background: "var(--cream)",
              outline: "none", lineHeight: 1.5,
              maxHeight: 160, overflowY: "auto",
              transition: "border-color 0.15s",
              opacity: atLimit ? 0.5 : 1,
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
            disabled={!input.trim() || streaming || atLimit}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
              background: input.trim() && !streaming && !atLimit ? "var(--charcoal)" : "var(--border)",
              color: "var(--white)", cursor: input.trim() && !streaming && !atLimit ? "pointer" : "default",
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
        .ai-tutor-suggestion:not(:disabled):hover { border-color: var(--charcoal) !important; background: var(--cream-deep) !important; }
        .ai-markdown { overflow-wrap: break-word; word-break: break-word; }
        .ai-markdown > :first-child { margin-top: 0; }
        .ai-markdown > :last-child { margin-bottom: 0; }
        .ai-markdown h1 { font-size: 1.125rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .ai-markdown h2 { font-size: 1rem; font-weight: 700; margin: 0.875rem 0 0.375rem; }
        .ai-markdown h3 { font-size: 0.9375rem; font-weight: 600; margin: 0.75rem 0 0.375rem; }
        .ai-markdown p { margin: 0.5rem 0; }
        .ai-markdown ul, .ai-markdown ol { margin: 0.5rem 0; padding-left: 1.25rem; }
        .ai-markdown li { margin: 0.25rem 0; }
        .ai-markdown li::marker { color: var(--muted); }
        .ai-markdown blockquote {
          margin: 0.5rem 0; padding: 0.375rem 0.75rem;
          border-left: 3px solid var(--muted); opacity: 0.85;
          font-style: italic;
        }
        .ai-markdown code {
          background: rgba(0,0,0,0.06); padding: 0.125rem 0.375rem;
          border-radius: 4px; font-size: 0.8125rem;
        }
        .ai-markdown hr { border: none; border-top: 1px solid var(--border); margin: 0.75rem 0; }
        .ai-markdown strong { font-weight: 700; }
      `}</style>
    </div>
  );
}
