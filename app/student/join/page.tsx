"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { StudioService } from "../../../lib/services/StudioService";

export default function StudentJoinPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const service = StudioService.getInstance(supabase);
      const studio = await service.findByInviteCode(code.trim());
      if (!studio) {
        setError("No studio found with that code. Double-check with your teacher.");
        setLoading(false);
        return;
      }
      await service.joinStudio(user.id, studio.id);
      await refresh();
      router.replace("/student");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not join studio.");
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
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎹</div>
          <h1 style={{
            fontFamily: "Nunito, sans-serif",
            fontWeight: 900,
            fontSize: "1.75rem",
            color: "var(--charcoal)",
            margin: 0,
          }}>
            Join Your Studio
          </h1>
          <p style={{
            fontFamily: "DM Sans, sans-serif",
            color: "var(--muted)",
            fontSize: "0.95rem",
            marginTop: "0.5rem",
          }}>
            Ask your teacher for their studio invite code to get started.
          </p>
        </div>

        {/* Form card */}
        <div className="card-base" style={{ padding: "2rem" }}>
          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{
                fontFamily: "Nunito, sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "var(--charcoal)",
                display: "block",
                marginBottom: "0.4rem",
              }}>
                Invite code
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB12CD34"
                required
                disabled={loading}
                maxLength={12}
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--border)",
                  fontFamily: "Fredoka, sans-serif",
                  fontWeight: 600,
                  fontSize: "1.4rem",
                  letterSpacing: "0.12em",
                  color: "var(--charcoal)",
                  background: "var(--cream-deep)",
                  outline: "none",
                  boxSizing: "border-box",
                  textAlign: "center",
                  textTransform: "uppercase",
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
              disabled={loading || !code.trim()}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", opacity: (loading || !code.trim()) ? 0.65 : 1 }}
            >
              {loading ? "Joining..." : "Join Studio"}
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
          Your teacher will see you in their dashboard once you join.
        </p>
      </div>
    </div>
  );
}
