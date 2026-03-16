"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/context/I18nContext";

type FeedbackType = "bug" | "feature" | "general";

const TYPES: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: "bug",     label: "Bug",            emoji: "🐛" },
  { value: "feature", label: "Feature request", emoji: "✨" },
  { value: "general", label: "General",         emoji: "💬" },
];

export default function FeedbackWidget() {
  const { user } = useAuth();
  const { t } = useI18n();
  const supabase = getSupabaseBrowserClient();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus textarea when opened
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !user?.id) return;
    setStatus("sending");

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      display_name: profile?.display_name ?? null,
      type,
      message: message.trim(),
      page_url: window.location.pathname,
    });

    if (error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("sent");
      setTimeout(() => {
        setOpen(false);
        setMessage("");
        setType("general");
        setStatus("idle");
      }, 2000);
    }
  }

  if (!user) return null;

  return (
    <div ref={popoverRef} style={{ position: "fixed", bottom: 80, right: 16, zIndex: 1000 }}>
      {/* Popover */}
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 10px)", right: 0,
          width: 280, background: "var(--white)", border: "1px solid var(--border)",
          borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "0.75rem 1rem 0.625rem",
            borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--cream)",
          }}>
            <span style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)" }}>
              {t.common.feedbackTitle}
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", lineHeight: 1, padding: 0 }}
            >
              ✕
            </button>
          </div>

          {status === "sent" ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>🙏</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "var(--charcoal)" }}>
                {t.common.feedbackThanks}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: "0.875rem 1rem 1rem" }}>
              {/* Type selector */}
              <div style={{ display: "flex", gap: "0.375rem", marginBottom: "0.75rem" }}>
                {TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    style={{
                      flex: 1, padding: "0.3rem 0", borderRadius: 6, cursor: "pointer",
                      border: `1px solid ${type === t.value ? "var(--charcoal)" : "var(--border)"}`,
                      background: type === t.value ? "var(--charcoal)" : "none",
                      color: type === t.value ? "var(--white)" : "var(--muted)",
                      fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600,
                      letterSpacing: "0.03em", transition: "all 0.12s",
                    }}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              {/* Message */}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                  type === "bug"     ? "What happened? What did you expect?" :
                  type === "feature" ? "What would you love to see?" :
                                       "What's on your mind?"
                }
                rows={4}
                style={{
                  width: "100%", resize: "none", boxSizing: "border-box",
                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", lineHeight: 1.5,
                  color: "var(--charcoal)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "0.5rem 0.625rem",
                  background: "var(--cream)", outline: "none",
                }}
              />

              {status === "error" && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#C0392B", marginTop: "0.375rem" }}>
                  {t.common.feedbackCantSend}
                </div>
              )}

              <button
                type="submit"
                disabled={!message.trim() || status === "sending"}
                style={{
                  marginTop: "0.625rem", width: "100%",
                  padding: "0.5rem", borderRadius: 8, border: "none",
                  background: "var(--charcoal)", color: "var(--white)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 600,
                  cursor: message.trim() ? "pointer" : "default",
                  opacity: !message.trim() || status === "sending" ? 0.5 : 1,
                  transition: "opacity 0.12s",
                }}
              >
                {status === "sending" ? t.common.sending : t.common.feedbackSend}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Send feedback"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          background: open ? "var(--charcoal)" : "var(--white)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.1rem", lineHeight: 1,
          transition: "background 0.15s, transform 0.15s",
          transform: open ? "rotate(45deg)" : "none",
          color: open ? "var(--white)" : "var(--charcoal)",
        }}
        aria-label="Send feedback"
      >
        {open ? "✕" : "?"}
      </button>
    </div>
  );
}
