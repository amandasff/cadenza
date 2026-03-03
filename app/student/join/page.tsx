"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { StudioService } from "../../../lib/services/StudioService";

type StudioEntry = { id: string; name: string; teacher_name: string };

export default function StudentJoinPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [search, setSearch] = useState("");
  const [studios, setStudios] = useState<StudioEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchStudios = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = StudioService.getInstance(supabase);
      const results = await service.listStudios(term);
      setStudios(results);
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all studios on mount
  useEffect(() => { fetchStudios(""); }, [fetchStudios]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchStudios(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchStudios]);

  async function handleJoin(studioId: string) {
    if (!user) return;
    setJoining(studioId);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const service = StudioService.getInstance(supabase);
      await service.joinStudio(user.id, studioId);
      await refresh();
      router.replace("/student");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not join studio.");
      setJoining(null);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--cream)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "3rem 1.5rem 4rem",
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎹</div>
          <h1 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontWeight: 500,
            fontSize: "2.25rem",
            color: "var(--charcoal)",
            margin: "0 0 0.5rem",
            letterSpacing: "-0.01em",
          }}>
            Find your studio
          </h1>
          <p style={{
            fontFamily: "Inter, sans-serif",
            color: "var(--muted)",
            fontSize: "0.9375rem",
            margin: 0,
            lineHeight: 1.6,
          }}>
            Search for your teacher&apos;s name or studio to get started.
          </p>
        </div>

        {/* Search box */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="e.g. Ms. Rivera, Piano Studio…"
          autoFocus
          style={{
            width: "100%",
            padding: "0.875rem 1rem",
            borderRadius: 6,
            border: "1.5px solid var(--border-strong)",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.9375rem",
            color: "var(--charcoal)",
            background: "var(--white)",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "1rem",
          }}
        />

        {/* Error */}
        {error && (
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.8125rem",
            color: "#c0392b",
            background: "#fff1f0",
            padding: "0.625rem 0.875rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}>
            {error}
          </p>
        )}

        {/* Studio list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {loading && studios.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "2rem 0" }}>
              Loading studios…
            </p>
          )}

          {!loading && studios.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "2rem 0" }}>
              {search ? "No studios found. Try a different name." : "No studios yet. Ask your teacher to set one up first."}
            </p>
          )}

          {studios.map(studio => (
            <div
              key={studio.id}
              style={{
                background: "var(--white)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
                  {studio.name}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                  {studio.teacher_name}
                </div>
              </div>
              <button
                onClick={() => handleJoin(studio.id)}
                disabled={joining === studio.id}
                style={{
                  background: joining === studio.id ? "var(--border-strong)" : "var(--charcoal)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: joining === studio.id ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >
                {joining === studio.id ? "Joining…" : "Join"}
              </button>
            </div>
          ))}
        </div>

        <p style={{
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
          fontSize: "0.75rem",
          color: "var(--muted)",
          marginTop: "2rem",
          lineHeight: 1.6,
        }}>
          Don&apos;t see your studio?<br />Ask your teacher to create one first.
        </p>

      </div>
    </div>
  );
}
