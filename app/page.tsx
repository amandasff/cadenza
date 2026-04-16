"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";

const SLIDES = [
  { label: "RECORD YOUR JOURNEY",   img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1400&q=85&auto=format&fit=crop" },
  { label: "SHARE WITH OTHERS",     img: "https://images.unsplash.com/photo-1598387993441-a364f854cfdf?w=1400&q=85&auto=format&fit=crop" },
  { label: "GET REAL FEEDBACK",     img: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1400&q=85&auto=format&fit=crop" },
  { label: "BUILD YOUR PROFILE",    img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1400&q=85&auto=format&fit=crop" },
  { label: "PRACTICE DAILY",        img: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1400&q=85&auto=format&fit=crop" },
  { label: "JOIN THE COMMUNITY",    img: "https://images.unsplash.com/photo-1470019693664-1d202d2c0907?w=1400&q=85&auto=format&fit=crop" },
  { label: "LEARN WITH AI",         img: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1400&q=85&auto=format&fit=crop" },
  { label: "TRACK YOUR GROWTH",     img: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1400&q=85&auto=format&fit=crop" },
  { label: "DISCOVER YOUR SOUND",   img: "https://images.unsplash.com/photo-1484876065684-b683cf17d276?w=1400&q=85&auto=format&fit=crop" },
  { label: "PERFORM FOR THE WORLD", img: "https://images.unsplash.com/photo-1524230572899-a752b3835840?w=1400&q=85&auto=format&fit=crop" },
];

const PAD = (n: number) => String(n).padStart(3, "0");
const C      = "#1A1814";
const BG     = "#EDEAE3";
const BORDER = "#D0CCC4";

export default function Home() {
  const router = useRouter();
  const [mode, setMode]               = useState<"signup" | "signin">("signup");
  const [role, setRole]               = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [checking, setChecking]       = useState(true);
  const [slide, setSlide]             = useState(0);
  const [time, setTime]               = useState("");

  // Live clock — Toronto
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-CA", {
        timeZone: "America/Toronto",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) { setChecking(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      router.replace(profile?.role === "teacher" ? "/teacher" : "/student");
    });
  }, [router]);

  const prevSlide = () => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length);
  const nextSlide = () => setSlide(s => (s + 1) % SLIDES.length);
  const preview   = (slide + 1) % SLIDES.length;

  const switchMode = (m: "signup" | "signin") => { setMode(m); setError(""); setPassword(""); };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const user = await AuthService.getInstance(supabase).signUp(email, password, role, displayName);
      router.push(user.getHomeRoute());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setLoading(false);
    }
  }, [email, password, role, displayName, router]);

  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const user = await AuthService.getInstance(supabase).signIn(email, password);
      router.push(user.getHomeRoute());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }, [email, password, router]);

  const handleGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` },
    });
  }, [role]);

  if (checking) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#999" }}>
          Loading
        </span>
      </div>
    );
  }

  // ── Shared style fragments ───────────────────────────────────────────────
  const labelSt: React.CSSProperties = {
    display: "block",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.5rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#999",
    marginBottom: "0.3rem",
  };
  const inputSt: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${BORDER}`,
    outline: "none",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.75rem",
    color: C,
    padding: "0.3rem 0",
    letterSpacing: "0.02em",
  };
  const btnPrimary: React.CSSProperties = {
    width: "100%",
    background: C,
    color: BG,
    border: "none",
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.5625rem",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontWeight: 600,
    padding: "0.75rem 0.5rem",
  };
  const btnOutline: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: `1px solid ${BORDER}`,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.5rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: C,
    padding: "0.625rem 0.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
  };
  const linkBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.5rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#999",
    textAlign: "left",
  };

  const googleSvg = (
    <svg width="12" height="12" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );

  return (
    <div style={{ height: "100dvh", background: BG, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Inter, sans-serif", color: C }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.875rem 1.5rem",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1.9, minWidth: 90 }}>
          <div>Toronto, CA</div>
          <div style={{ color: "#999" }}>{time} EST</div>
        </div>

        <div style={{
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontWeight: 600,
          fontSize: "1.25rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
        }}>
          Cadenza
        </div>

        <nav style={{ display: "flex", gap: "1.5rem", minWidth: 90, justifyContent: "flex-end" }}>
          <span style={{ fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "default" }}>Home</span>
          <a href="mailto:amanda.sf.wu@gmail.com" style={{ fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#999", textDecoration: "none" }}>Contact</a>
        </nav>
      </header>

      {/* ── MAIN 3-COLUMN ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "240px 1fr 260px", overflow: "hidden" }}>

        {/* Left — form */}
        <div style={{
          borderRight: `1px solid ${BORDER}`,
          padding: "1.75rem 1.375rem",
          display: "flex", flexDirection: "column", gap: "1rem",
          overflowY: "auto",
        }}>
          <div style={{ fontSize: "0.5625rem", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.125rem" }}>
            {mode === "signup" ? "Initiate Access" : "Welcome Back"}
          </div>

          {/* Role toggle — signup only */}
          {mode === "signup" && (
            <div style={{ display: "flex", gap: "1.25rem" }}>
              {(["student", "teacher"] as UserRole[]).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)} style={{
                  background: "none", border: "none",
                  padding: "0 0 2px",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.5rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: role === r ? C : "#BBB",
                  fontWeight: role === r ? 600 : 400,
                  borderBottom: role === r ? `1px solid ${C}` : "1px solid transparent",
                }}>
                  {r}
                </button>
              ))}
            </div>
          )}

          {mode === "signup" ? (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
              <div>
                <label style={labelSt}>Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Security Key</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputSt} />
              </div>

              {error && (
                <div style={{ fontSize: "0.5625rem", color: "#A03020", letterSpacing: "0.04em" }}>{error}</div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "default" : "pointer" }}>
                  {loading ? "Joining…" : "Join the Quorum"}
                </button>
                <button type="button" onClick={handleGoogle} style={btnOutline}>
                  {googleSvg} Continue with Google
                </button>
              </div>

              <button type="button" onClick={() => switchMode("signin")} style={linkBtn}>
                Already have an account? Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
              <div>
                <label style={labelSt}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Security Key</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputSt} />
              </div>

              {error && (
                <div style={{ fontSize: "0.5625rem", color: "#A03020", letterSpacing: "0.04em" }}>{error}</div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "default" : "pointer" }}>
                  {loading ? "Entering…" : "Access Cadenza"}
                </button>
                <button type="button" onClick={handleGoogle} style={btnOutline}>
                  {googleSvg} Continue with Google
                </button>
              </div>

              <button type="button" onClick={() => switchMode("signup")} style={linkBtn}>
                Don&apos;t have an account? Create one
              </button>
            </form>
          )}
        </div>

        {/* Center — main slide */}
        <div style={{ position: "relative", overflow: "hidden", background: "#111" }}>
          {SLIDES.map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute", inset: 0,
                opacity: i === slide ? 1 : 0,
                transition: "opacity 0.55s ease",
                pointerEvents: i === slide ? "auto" : "none",
              }}
            >
              <img
                src={s.img}
                alt={s.label}
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(100%) contrast(1.08)", display: "block" }}
              />
              {/* Slide number badge */}
              <span style={{
                position: "absolute", top: 13, right: 15,
                fontFamily: "Inter, sans-serif", fontSize: "0.5rem",
                letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)",
              }}>
                {i + 1}
              </span>
              {/* Caption overlay */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "5rem 1.375rem 1.25rem",
                background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(1.375rem, 2.2vw, 2rem)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#fff",
                  lineHeight: 1.08,
                }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right — preview */}
        <div style={{ borderLeft: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#111" }}>
            {SLIDES.map((s, i) => (
              <div
                key={i}
                style={{
                  position: "absolute", inset: 0,
                  opacity: i === preview ? 1 : 0,
                  transition: "opacity 0.55s ease",
                }}
              >
                <img
                  src={s.img}
                  alt={s.label}
                  style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(100%) brightness(0.65)", display: "block" }}
                />
              </div>
            ))}
          </div>
          <div style={{
            flexShrink: 0,
            padding: "0.625rem 1rem",
            borderTop: `1px solid ${BORDER}`,
            fontSize: "0.5rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#999",
          }}>
            {SLIDES[preview].label}
          </div>
        </div>

      </div>

      {/* ── CAROUSEL NAV ───────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderTop: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "1.5rem",
        padding: "0.625rem 1.5rem",
      }}>
        <button onClick={prevSlide} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: C, padding: "0 0.25rem", lineHeight: 1 }}>←</button>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#999", minWidth: 56, textAlign: "center" }}>
          {PAD(slide + 1)} / {PAD(SLIDES.length)}
        </span>
        <button onClick={nextSlide} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: C, padding: "0 0.25rem", lineHeight: 1 }}>→</button>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{
        flexShrink: 0,
        borderTop: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.5rem 1.5rem",
      }}>
        <span style={{ fontSize: "0.4375rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#BBB" }}>
          &copy;{new Date().getFullYear()} Cadenza. All rights reserved.
        </span>
        <a href="mailto:amanda.sf.wu@gmail.com" style={{ fontSize: "0.4375rem", letterSpacing: "0.08em", color: "#BBB", textDecoration: "none" }}>
          amanda.sf.wu@gmail.com
        </a>
      </footer>

      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: #C8C4BE; }
        input:focus { border-bottom-color: ${C} !important; }

        @media (max-width: 720px) {
          .cad-grid { grid-template-columns: 1fr !important; }
          .cad-preview { display: none !important; }
          .cad-form { border-right: none !important; border-bottom: 1px solid ${BORDER}; max-height: none !important; }
        }
      `}</style>
    </div>
  );
}
