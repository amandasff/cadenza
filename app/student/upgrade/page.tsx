"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { Student } from "../../../lib/models/Student";
import { useI18n } from "../../../lib/context/I18nContext";

const FEATURES = [
  { icon: "🎵", label: "AI Sheet Music", desc: "Convert a photo of sheet music into a playable score instantly" },
  { icon: "🎸", label: "Guitar Tuner", desc: "Real-time pitch detection tuner with visual feedback" },
  { icon: "🎙", label: "Practice Recordings", desc: "Record yourself, review playback, and track your progress" },
  { icon: "📊", label: "Full Practice History", desc: "Unlimited session history with detailed analytics" },
  { icon: "🏆", label: "Rewards & Streaks", desc: "Advanced gamification to keep you motivated" },
];

function UpgradeInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const student = user as Student | null;
  const { t } = useI18n();

  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState("");

  const isActive = student && (student as unknown as { subscription_status?: string }).subscription_status === "active";
  const successMsg = searchParams.get("success") === "1";
  const canceledMsg = searchParams.get("canceled") === "1";

  async function handleSubscribe() {
    setLoading("checkout");
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setError(json.error ?? "Something went wrong.");
        setLoading(null);
      }
    } catch {
      setError("Could not connect to payment system. Try again.");
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    setError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setError(json.error ?? "Something went wrong.");
        setLoading(null);
      }
    } catch {
      setError("Could not open billing portal. Try again.");
      setLoading(null);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--cream)",
      padding: "2.5rem 1.5rem 5rem",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontWeight: 500,
            fontSize: "2rem",
            color: "var(--charcoal)",
            margin: "0 0 0.375rem",
            letterSpacing: "-0.01em",
          }}>
            {t.student.upgradeTitle}
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
            {t.student.upgradeSubtitle}
          </p>
        </div>

        {/* Status banners */}
        {successMsg && (
          <div style={{
            background: "#f0faf4", border: "1px solid #4CAF84", borderRadius: 8,
            padding: "0.875rem 1rem", marginBottom: "1.5rem",
            fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#2d7a55",
          }}>
            {t.student.upgradeSuccessMsg}
          </div>
        )}
        {canceledMsg && (
          <div style={{
            background: "#fff8f0", border: "1px solid #E6A817", borderRadius: 8,
            padding: "0.875rem 1rem", marginBottom: "1.5rem",
            fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#9a6b00",
          }}>
            {t.student.upgradeCanceledMsg}
          </div>
        )}

        {/* Plan card */}
        <div style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.75rem",
          marginBottom: "1.5rem",
        }}>
          {/* Price */}
          <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "flex-end", gap: "0.25rem" }}>
            <span style={{
              fontFamily: "Cormorant Garamond, Georgia, serif",
              fontSize: "3rem",
              fontWeight: 700,
              color: "var(--charcoal)",
              lineHeight: 1,
            }}>
              $9.99
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", paddingBottom: "0.5rem" }}>
              / month
            </span>
          </div>

          {/* Feature list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.75rem" }}>
            {FEATURES.map(f => (
              <div key={f.label} style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.25rem", flexShrink: 0, lineHeight: 1.3 }}>{f.icon}</span>
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                    {f.label}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {isActive ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{
                background: "#f0faf4", border: "1px solid #4CAF84", borderRadius: 6,
                padding: "0.625rem 1rem", textAlign: "center",
                fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#2d7a55", fontWeight: 500,
              }}>
                {t.student.upgradeActiveStatus}
              </div>
              <button
                onClick={handlePortal}
                disabled={loading === "portal"}
                style={{
                  width: "100%", padding: "0.75rem",
                  border: "1px solid var(--border-strong)", borderRadius: 6,
                  background: "transparent", color: "var(--muted)",
                  fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem",
                  cursor: loading === "portal" ? "default" : "pointer",
                  opacity: loading === "portal" ? 0.6 : 1,
                }}
              >
                {loading === "portal" ? t.student.upgradeOpening : t.student.upgradeManage}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={!!loading}
              style={{
                width: "100%", padding: "0.875rem",
                background: "var(--charcoal)", color: "var(--white)",
                border: "none", borderRadius: 6,
                fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {loading === "checkout" ? t.student.upgradeRedirecting : t.student.upgradeSubscribe}
            </button>
          )}

          {error && (
            <p style={{
              fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
              color: "#c0392b", marginTop: "0.75rem", textAlign: "center",
            }}>
              {error}
            </p>
          )}
        </div>

        {/* Fine print */}
        <p style={{
          fontFamily: "Inter, sans-serif", fontSize: "0.75rem",
          color: "var(--muted)", textAlign: "center", lineHeight: 1.6,
        }}>
          {t.student.upgradeFineprint}
        </p>

      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradeInner />
    </Suspense>
  );
}
