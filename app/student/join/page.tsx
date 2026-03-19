"use client";
import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { StudioService } from "../../../lib/services/StudioService";
import { useI18n } from "../../../lib/context/I18nContext";
import { Piano } from "lucide-react";

type StudioEntry = { id: string; name: string; teacher_name: string };
type Tab = "search" | "code";

function StudentJoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useAuth();
  const { t } = useI18n();

  // If ?code= is in URL, start on code tab
  const urlCode = searchParams.get("code") ?? "";
  const [tab, setTab] = useState<Tab>(urlCode ? "code" : "search");

  // Search tab state
  const [search, setSearch] = useState("");
  const [studios, setStudios] = useState<StudioEntry[]>([]);
  const [loadingStudios, setLoadingStudios] = useState(false);

  // Code tab state
  const [code, setCode] = useState(urlCode);
  const [codeStudio, setCodeStudio] = useState<StudioEntry | null>(null);
  const [codeError, setCodeError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const [joining, setJoining] = useState<string | null>(null);
  const [joinError, setJoinError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [goingSolo, setGoingSolo] = useState(false);

  // ── Search ───────────────────────────────────────────────────
  const fetchStudios = useCallback(async (term: string) => {
    setLoadingStudios(true);
    setSearchError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const results = await StudioService.create(supabase).listStudios(term);
      setStudios(results);
    } catch (err) {
      setStudios([]);
      setSearchError(err instanceof Error ? err.message : "Could not load studios.");
    } finally {
      setLoadingStudios(false);
    }
  }, []);

  useEffect(() => { fetchStudios(""); }, [fetchStudios]);

  useEffect(() => {
    const t = setTimeout(() => fetchStudios(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchStudios]);

  // ── Invite code lookup ────────────────────────────────────────
  const lookupCode = useCallback(async (c: string) => {
    if (!c.trim()) { setCodeStudio(null); setCodeError(""); return; }
    setLookingUp(true);
    setCodeError("");
    setCodeStudio(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const studio = await StudioService.create(supabase).findByInviteCode(c.trim());
      if (!studio) { setCodeError(t.student.joinCodeNotFound); return; }
      // Fetch teacher name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", studio.owner_id)
        .single();
      setCodeStudio({ id: studio.id, name: studio.name, teacher_name: profile?.display_name ?? "Unknown teacher" });
    } catch {
      setCodeError("Could not look up that code. Try again.");
    } finally {
      setLookingUp(false);
    }
  }, []);

  // Auto-lookup if code came from URL
  useEffect(() => {
    if (urlCode) lookupCode(urlCode);
  }, [urlCode, lookupCode]);

  // ── Solo mode ─────────────────────────────────────────────────
  async function handleGoSolo() {
    if (!user || goingSolo) return;
    setGoingSolo(true);
    try {
      await fetch("/api/student/solo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      await refresh();
      router.replace("/student");
    } catch {
      setGoingSolo(false);
    }
  }

  // ── Join ──────────────────────────────────────────────────────
  async function handleJoin(studioId: string) {
    if (!user) return;
    setJoining(studioId);
    setJoinError("");
    try {
      const supabase = getSupabaseBrowserClient();
      await StudioService.create(supabase).joinStudio(user.id, studioId);
      await refresh();
      router.replace("/student");
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Could not join studio.");
      setJoining(null);
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1,
        padding: "0.625rem",
        border: "none",
        borderRadius: 6,
        fontFamily: "Inter, sans-serif",
        fontWeight: 500,
        fontSize: "0.875rem",
        cursor: "pointer",
        background: tab === t ? "var(--charcoal)" : "transparent",
        color: tab === t ? "var(--white)" : "var(--muted)",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  const StudioCard = ({ studio }: { studio: StudioEntry }) => (
    <div style={{
      background: "var(--white)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "1rem 1.25rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
    }}>
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
        {joining === studio.id ? t.student.joinJoining : t.student.joinJoin}
      </button>
    </div>
  );

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
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}><Piano size={48} strokeWidth={1.5} color="var(--charcoal)" /></div>
          <h1 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontWeight: 500,
            fontSize: "2.25rem",
            color: "var(--charcoal)",
            margin: "0 0 0.5rem",
            letterSpacing: "-0.01em",
          }}>
            {t.student.joinTitle}
          </h1>
          <p style={{
            fontFamily: "Inter, sans-serif",
            color: "var(--muted)",
            fontSize: "0.9375rem",
            margin: 0,
            lineHeight: 1.6,
          }}>
            {t.student.joinSubtitle}
          </p>
        </div>

        {/* Tab toggle */}
        <div style={{
          display: "flex",
          background: "var(--border)",
          borderRadius: 8,
          padding: 3,
          marginBottom: "1.25rem",
          gap: 2,
        }}>
          {tabBtn("search", t.common.search)}
          {tabBtn("code", t.student.joinInviteCode)}
        </div>

        {/* Join error */}
        {joinError && (
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.8125rem",
            color: "#c0392b",
            background: "#fff1f0",
            padding: "0.625rem 0.875rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}>
            {joinError}
          </p>
        )}

        {/* ── Search tab ── */}
        {tab === "search" && (
          <>
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
                border: "1px solid var(--border-strong)",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.9375rem",
                color: "var(--charcoal)",
                background: "var(--white)",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "1rem",
              }}
            />
            {searchError && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b", background: "#fff1f0", padding: "0.625rem 0.875rem", borderRadius: 6, marginBottom: "1rem" }}>
                {searchError}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {loadingStudios && studios.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "2rem 0" }}>
                  {t.common.loading}
                </p>
              )}
              {!loadingStudios && studios.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "2rem 0" }}>
                  {search ? t.student.joinNoStudios : t.student.joinNoStudiosYet}
                </p>
              )}
              {studios.map(s => <StudioCard key={s.id} studio={s} />)}
            </div>
          </>
        )}

        {/* ── Invite code tab ── */}
        {tab === "code" && (
          <>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. XK7B2P"
                autoFocus
                style={{
                  flex: 1,
                  padding: "0.875rem 1rem",
                  borderRadius: 6,
                  border: "1px solid var(--border-strong)",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "1rem",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--charcoal)",
                  background: "var(--white)",
                  outline: "none",
                  textTransform: "uppercase",
                }}
              />
              <button
                onClick={() => lookupCode(code)}
                disabled={!code.trim() || lookingUp}
                style={{
                  padding: "0.875rem 1.25rem",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--charcoal)",
                  color: "var(--white)",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  cursor: (!code.trim() || lookingUp) ? "default" : "pointer",
                  opacity: (!code.trim() || lookingUp) ? 0.5 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {lookingUp ? "…" : t.student.joinLookup}
              </button>
            </div>

            {codeError && (
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem",
                color: "#c0392b",
                background: "#fff1f0",
                padding: "0.625rem 0.875rem",
                borderRadius: 6,
                marginBottom: "1rem",
              }}>
                {codeError}
              </p>
            )}

            {codeStudio && <StudioCard studio={codeStudio} />}

            {!codeStudio && !codeError && !lookingUp && (
              <p style={{ textAlign: "center", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "2rem 0" }}>
                {t.student.joinCodeHint}
              </p>
            )}
          </>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "2rem 0 1.25rem" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Solo option */}
        <button
          onClick={handleGoSolo}
          disabled={goingSolo}
          style={{
            width: "100%",
            padding: "0.875rem",
            borderRadius: 8,
            border: "1.5px solid var(--border-strong)",
            background: "transparent",
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            fontSize: "0.9375rem",
            color: "var(--charcoal)",
            cursor: goingSolo ? "default" : "pointer",
            opacity: goingSolo ? 0.6 : 1,
            transition: "all 0.15s",
          }}
        >
          {goingSolo ? "Setting up…" : "🎵 Learn on my own for now"}
        </button>
        <p style={{
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
          fontSize: "0.75rem",
          color: "var(--muted)",
          marginTop: "0.625rem",
          lineHeight: 1.6,
        }}>
          You can join a teacher&apos;s studio anytime later.
        </p>

      </div>
    </div>
  );
}

export default function StudentJoinPage() {
  return (
    <Suspense>
      <StudentJoinInner />
    </Suspense>
  );
}
