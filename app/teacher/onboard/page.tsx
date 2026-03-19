"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { StudioService } from "../../../lib/services/StudioService";
import { useI18n } from "../../../lib/context/I18nContext";

export default function TeacherOnboardPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const [studioName, setStudioName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !studioName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const service = StudioService.create(supabase);
      const studio = await service.createStudio(user.id, studioName.trim());
      // Silently auto-create a linked student practice profile for this teacher
      void fetch("/api/accounts/create-practice-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioId: studio?.id }),
      });
      await refresh();
      router.replace("/teacher");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      setError(msg || "Could not create studio.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--cream)",
      padding: "1.5rem",
    }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🏫</div>
          <h1 style={{
            fontFamily: "Nunito, sans-serif",
            fontWeight: 900,
            fontSize: "1.75rem",
            color: "var(--charcoal)",
            margin: 0,
          }}>
            {t.teacher.onboardTitle}
          </h1>
          <p style={{
            fontFamily: "DM Sans, sans-serif",
            color: "var(--muted)",
            fontSize: "0.95rem",
            marginTop: "0.5rem",
          }}>
            {t.teacher.onboardSubtitle}
          </p>
        </div>

        {/* Form card */}
        <div className="card-base" style={{ padding: "2rem" }}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{
                fontFamily: "Nunito, sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "var(--charcoal)",
                display: "block",
                marginBottom: "0.4rem",
              }}>
                {t.teacher.onboardStudioName}
              </label>
              <input
                type="text"
                value={studioName}
                onChange={e => setStudioName(e.target.value)}
                placeholder="e.g. Rivera Piano Studio"
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--border)",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "0.95rem",
                  color: "var(--charcoal)",
                  background: "var(--white)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "var(--peach)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            </div>

            {error && (
              <p style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "0.85rem",
                color: "var(--error)",
                background: "#fff1f0",
                padding: "0.6rem 0.875rem",
                borderRadius: "var(--radius-md)",
                margin: 0,
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !studioName.trim()}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", opacity: (loading || !studioName.trim()) ? 0.65 : 1 }}
            >
              {loading ? t.teacher.onboardCreating : t.teacher.onboardCreate}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: "center",
          fontFamily: "DM Sans, sans-serif",
          fontSize: "0.8rem",
          color: "var(--muted)",
          marginTop: "1.5rem",
        }}>
          {t.teacher.onboardInviteNote}
        </p>
      </div>
    </div>
  );
}
