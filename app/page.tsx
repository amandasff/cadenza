"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";

const SLIDES = [
  { label: "Record Your\nJourney", img: "/slides/01.png", vol: "VOL. 1 // ORIGIN" },
  { label: "Share With\nOthers", img: "/slides/02.png", vol: "VOL. 2 // ECHO" },
  { label: "Get Real\nFeedback", img: "/slides/03.png", vol: "VOL. 3 // PULSE" },
  { label: "Build Your\nProfile", img: "/slides/04.png", vol: "VOL. 4 // ICON" },
  { label: "Practice\nDaily", img: "/slides/05.png", vol: "VOL. 5 // RITUAL" },
  { label: "Join The\nCommunity", img: "/slides/06.png", vol: "VOL. 6 // CHORUS" },
  { label: "Learn\nWith AI", img: "/slides/07.png", vol: "VOL. 7 // SPARK" },
  { label: "Track Your\nGrowth", img: "/slides/08.png", vol: "VOL. 8 // ARC" },
  { label: "Discover Your\nSound", img: "/slides/09.png", vol: "VOL. 9 // TIMBRE" },
  { label: "Perform For\nThe World", img: "/slides/10.png", vol: "VOL. 10 // STAGE" },
];

const PAD = (n: number) => String(n).padStart(3, "0");

const PASTEL = ["#D97070", "#8B6FD4", "#4BA87A", "#D4A24C", "#5A9FD4", "#D4855A", "#8B6FD4"];
const cadenzaLetters = (size?: string) =>
  "CADENZA".split("").map((ch, i) => (
    <span key={i} style={{ color: PASTEL[i] }}>{ch}</span>
  ));

interface Recording { id: string; title: string; url: string; artist: string }

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [slide, setSlide] = useState(0);
  const [time, setTime] = useState("");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [showForm, setShowForm] = useState(false);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [showPlayer, setShowPlayer] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) { setChecking(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      router.replace(profile?.role === "teacher" ? "/teacher" : "/student");
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/public/recordings")
      .then(r => r.json())
      .then(d => setRecordings(d.recordings ?? []))
      .catch(() => {});
  }, []);

  const preview = (slide + 1) % SLIDES.length;
  const prevSlide = () => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length);
  const nextSlide = () => setSlide(s => (s + 1) % SLIDES.length);
  const switchMode = (m: "signup" | "signin") => { setMode(m); setError(""); setPassword(""); };

  const playRecording = useCallback((rec: Recording) => {
    if (!audioRef.current) return;
    if (playingId === rec.id) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else { audioRef.current.play().catch(() => setIsPlaying(false)); setIsPlaying(true); }
      return;
    }
    audioRef.current.src = rec.url;
    audioRef.current.play().catch(() => setIsPlaying(false));
    setPlayingId(rec.id);
    setIsPlaying(true);
  }, [playingId, isPlaying]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const user = await AuthService.getInstance(supabase).signUp(email, password, role, displayName);
      router.push(user.getHomeRoute());
    } catch (err) { setError(err instanceof Error ? err.message : "Sign up failed"); setLoading(false); }
  }, [email, password, role, displayName, router]);

  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const user = await AuthService.getInstance(supabase).signIn(email, password);
      router.push(user.getHomeRoute());
    } catch (err) { setError(err instanceof Error ? err.message : "Sign in failed"); setLoading(false); }
  }, [email, password, router]);

  const handleGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` },
    });
  }, [role]);

  const handleSwipeStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; };
  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? nextSlide() : prevSlide(); }
    touchStartRef.current = null;
  };

  if (checking) {
    return (
      <div style={{
        height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#fbf9f4", fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#777",
      }}>
        Loading
      </div>
    );
  }

  const cur = SLIDES[slide];
  const nxt = SLIDES[preview];

  const googleSvg = (
    <svg width="14" height="14" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );

  const lbl: React.CSSProperties = {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, letterSpacing: "0.15em",
    textTransform: "uppercase", position: "absolute", top: -16, left: 0, color: "rgba(0,0,0,0.7)",
  };

  const lblDark: React.CSSProperties = { ...lbl, color: "rgba(255,255,255,0.45)" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=Work+Sans:wght@400;500;600&display=swap');

        .cad-noise {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          pointer-events: none; z-index: 9999; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        @keyframes cad-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cad-vinyl-spin { animation: cad-spin 8s linear infinite; }
        .cad-vinyl-paused { animation-play-state: paused; }
        .cad-vinyl-grooves {
          background: repeating-radial-gradient(circle, transparent, transparent 2px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px);
        }

        .cad-input {
          width: 100%; background: transparent; border: none;
          border-bottom: 1px solid #000; outline: none;
          font-family: 'Work Sans', sans-serif; font-size: 13px;
          padding: 6px 0; color: #000; border-radius: 0;
        }
        .cad-input::placeholder { color: rgba(0,0,0,0.3); }

        .cad-input-dark {
          width: 100%; background: transparent; border: none;
          border-bottom: 1px solid rgba(255,255,255,0.25); outline: none;
          font-family: 'Work Sans', sans-serif; font-size: 15px;
          padding: 10px 0; color: #fbf9f4; border-radius: 0;
        }
        .cad-input-dark::placeholder { color: rgba(255,255,255,0.2); }
        .cad-input-dark:focus { border-bottom-color: rgba(255,255,255,0.6); }

        .cad-hero-img { transition: transform 0.7s ease-out; }
        .cad-hero-img:hover { transform: scale(1.05); }
        .cad-nav-arrow { transition: opacity 0.2s; }
        .cad-nav-arrow:hover { opacity: 0.5; }
        .cad-btn-primary { transition: background 0.3s; }
        .cad-btn-primary:hover { background: #3b3b3b !important; }
        .cad-btn-pastel { transition: filter 0.3s; }
        .cad-btn-pastel:hover { filter: brightness(0.92); }
        .cad-input:focus { border-bottom-color: #8B6FD4 !important; }
        .cad-input-dark:focus { border-bottom-color: #8B6FD4 !important; }
        .cad-btn-outline { transition: background 0.2s; }
        .cad-btn-outline:hover { background: rgba(0,0,0,0.04); }
        .cad-link:hover { text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 0.5px; }
        .cad-track { transition: background 0.15s; }
        .cad-track:hover { background: rgba(255,255,255,0.08) !important; }
        .cad-player-scroll::-webkit-scrollbar { width: 3px; }
        .cad-player-scroll::-webkit-scrollbar-track { background: transparent; }
        .cad-player-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }

        @keyframes cad-sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .cad-sheet { animation: cad-sheet-up 0.35s ease-out forwards; }
      `}</style>

      <div className="cad-noise" />
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); setPlayingId(null); }} style={{ display: "none" }} />

      <div style={{
        background: "#fbf9f4", color: "#000", fontFamily: "'Work Sans', sans-serif",
        height: "100dvh", display: "flex", flexDirection: "column",
        overflow: "hidden", position: "relative",
      }}>

        {isMobile ? (
          /* ═══════════════════════════════════════════════════════════════════
             MOBILE LAYOUT
             ═══════════════════════════════════════════════════════════════════ */
          <>
            {/* MOBILE HEADER */}
            <header style={{
              flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "1rem 1.25rem",
              borderBottom: "0.5px solid #000",
            }}>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 9,
                letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)",
              }}>
                {time} EST
              </span>
              <h1 style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.5rem",
                fontWeight: 900, letterSpacing: "-0.03em", textTransform: "uppercase",
                lineHeight: 1, margin: 0,
              }}>
                {cadenzaLetters()}
              </h1>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 9,
                letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)",
              }}>
                {PAD(slide + 1)}/{PAD(SLIDES.length)}
              </span>
            </header>

            {/* MOBILE HERO */}
            <div
              style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
            >
              {SLIDES.map((s, i) => (
                <div key={i} style={{
                  position: "absolute", inset: 0,
                  opacity: i === slide ? 1 : 0, transition: "opacity 0.5s ease",
                  pointerEvents: i === slide ? "auto" : "none",
                }}>
                  <img
                    src={s.img} alt={s.label.replace("\n", " ")}
                    style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      filter: "grayscale(100%) contrast(1.2)", display: "block",
                    }}
                  />
                </div>
              ))}

              {/* Gradient overlay for readability */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
                background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)",
                pointerEvents: "none", zIndex: 1,
              }} />

              {/* Vol label */}
              <div style={{
                position: "absolute", top: 16, right: 16,
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 9,
                letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase", zIndex: 2,
              }}>
                {cur.vol}
              </div>

              {/* Caption */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "0 1.25rem 1.25rem", zIndex: 2,
              }}>
                {cur.label.split("\n").map((line, i) => (
                  <p key={i} style={{
                    fontFamily: "'Space Grotesk', sans-serif", color: "#fff",
                    fontSize: "2rem", fontWeight: 900,
                    letterSpacing: "-0.03em", textTransform: "uppercase",
                    lineHeight: 1.05, margin: 0,
                  }}>
                    {line}
                  </p>
                ))}
                <p style={{
                  fontFamily: "'Work Sans', sans-serif", fontSize: 12,
                  color: "#D4A24C", marginTop: 8,
                  letterSpacing: "0.02em", lineHeight: 1.4,
                }}>
                  A practice platform for music learners
                </p>
              </div>
            </div>

            {/* MOBILE BOTTOM BAR */}
            <div style={{
              flexShrink: 0, display: "flex", alignItems: "center",
              padding: "0.75rem 1.25rem", gap: "0.75rem",
              borderTop: "0.5px solid #000",
            }}>
              {/* Carousel arrows */}
              <div style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, letterSpacing: "0.12em",
              }}>
                <button onClick={prevSlide} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 28,
                  color: "#000", padding: 4, lineHeight: 1,
                }}>&#8592;</button>
                <button onClick={nextSlide} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 28,
                  color: "#000", padding: 4, lineHeight: 1,
                }}>&#8594;</button>
              </div>

              <div style={{ flex: 1 }} />

              {/* CTA */}
              <button
                onClick={() => setShowForm(true)}
                style={{
                  background: "linear-gradient(135deg, #D97070, #8B6FD4, #5A9FD4)",
                  color: "#000", border: "none",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 11,
                  fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
                  padding: "0.7rem 1.5rem", cursor: "pointer", borderRadius: 0,
                }}
              >
                Get Started
              </button>
            </div>

            {/* MOBILE FORM OVERLAY */}
            {showForm && (
              <div className="cad-sheet" style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "#000", color: "#fbf9f4",
                display: "flex", flexDirection: "column",
                overflowY: "auto",
              }}>
                {/* Close + wordmark */}
                <div style={{
                  flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "1.25rem 1.5rem",
                  borderBottom: "0.5px solid rgba(255,255,255,0.1)",
                }}>
                  <h1 style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.25rem",
                    fontWeight: 900, letterSpacing: "-0.03em", textTransform: "uppercase",
                    margin: 0,
                  }}>
                    {cadenzaLetters()}
                  </h1>
                  <button onClick={() => setShowForm(false)} style={{
                    background: "none", border: "none", color: "rgba(255,255,255,0.5)",
                    cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0,
                  }}>
                    &#10005;
                  </button>
                </div>

                {/* Form content */}
                <div style={{ flex: 1, padding: "2rem 1.5rem 3rem", maxWidth: 400, width: "100%" }}>
                  <h2 style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.5rem",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.02em",
                    margin: "0 0 2rem 0", color: "#fbf9f4",
                  }}>
                    {mode === "signup" ? "Initiate Access" : "Welcome Back"}
                  </h2>

                  <form
                    onSubmit={mode === "signup" ? handleSubmit : handleSignIn}
                    style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
                  >
                    {mode === "signup" && (
                      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.25rem" }}>
                        {(["student", "teacher"] as UserRole[]).map(r => (
                          <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ display: "none" }} />
                            <div style={{
                              width: 12, height: 12, borderRadius: "50%",
                              border: "1px solid rgba(255,255,255,0.4)",
                              background: role === r ? (r === "student" ? "#5A9FD4" : "#8B6FD4") : "transparent",
                              transition: "background 0.15s",
                            }} />
                            <span style={{
                              fontFamily: "'Space Grotesk', sans-serif", fontSize: 11,
                              letterSpacing: "0.15em", textTransform: "uppercase",
                              opacity: role === r ? 1 : 0.5, transition: "opacity 0.15s",
                              color: "#fbf9f4",
                            }}>
                              {r}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {mode === "signup" && (
                      <div style={{ position: "relative" }}>
                        <label style={lblDark}>Display Name</label>
                        <input className="cad-input-dark" type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                      </div>
                    )}

                    <div style={{ position: "relative" }}>
                      <label style={lblDark}>Email Address</label>
                      <input className="cad-input-dark" type="email" placeholder="user@domain.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>

                    <div style={{ position: "relative" }}>
                      <label style={lblDark}>Security Key</label>
                      <input className="cad-input-dark" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>

                    {error && (
                      <div style={{ fontSize: 12, color: "#ff6b6b", letterSpacing: "0.04em" }}>{error}</div>
                    )}

                    <button type="submit" disabled={loading} style={{
                      marginTop: "0.5rem",
                      background: "linear-gradient(135deg, #D97070, #8B6FD4, #5A9FD4)",
                      color: "#000", border: "none",
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 12,
                      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em",
                      padding: "1rem 1.5rem", cursor: loading ? "default" : "pointer",
                      opacity: loading ? 0.6 : 1, width: "100%", textAlign: "center", borderRadius: 0,
                    }}>
                      {mode === "signup"
                        ? (loading ? "Joining\u2026" : "Join The Quorum")
                        : (loading ? "Entering\u2026" : "Access Cadenza")}
                    </button>

                    <button type="button" onClick={handleGoogle} style={{
                      width: "100%", background: "transparent",
                      border: "0.5px solid rgba(255,255,255,0.25)",
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                      letterSpacing: "0.12em", textTransform: "uppercase", color: "#fbf9f4",
                      padding: "0.8rem 1rem", cursor: "pointer", borderRadius: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    }}>
                      {googleSvg} Continue with Google
                    </button>

                    <div style={{
                      textAlign: "center", fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
                      marginTop: "0.5rem",
                    }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>
                        {mode === "signup" ? "Already have an account? " : "Don\u2019t have an account? "}
                      </span>
                      <button type="button" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")} style={{
                        background: "none", border: "none", padding: 0, cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                        letterSpacing: "0.15em", textTransform: "uppercase",
                        fontWeight: 700, color: "#fbf9f4",
                      }}>
                        {mode === "signup" ? "Sign In" : "Create One"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════
             DESKTOP LAYOUT
             ═══════════════════════════════════════════════════════════════════ */
          <>
            {/* DESKTOP HEADER */}
            <header style={{
              flexShrink: 0,
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              padding: "1.25rem 2.5rem 0.75rem",
              borderBottom: "0.5px solid #000", margin: "0 1rem",
            }}>
              <div style={{ width: "33.33%", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Toronto, CA
                </span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  {time} EST
                </span>
              </div>
              <div style={{ width: "33.33%", textAlign: "center" }}>
                <h1 style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(1.5rem, 3vw, 2.75rem)",
                  fontWeight: 900, letterSpacing: "-0.03em", textTransform: "uppercase", lineHeight: 1, margin: 0,
                }}>
                  {cadenzaLetters()}
                </h1>
              </div>
              <nav style={{
                width: "33.33%", display: "flex", justifyContent: "flex-end", gap: "1.5rem",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
              }}>
                <a href="#" className="cad-link" style={{ color: "#000", textDecoration: "none" }}>Home</a>
                <a href="mailto:amanda.sf.wu@gmail.com" className="cad-link" style={{ color: "#000", textDecoration: "none" }}>Contact</a>
              </nav>
            </header>

            {/* DESKTOP MAIN */}
            <main style={{
              flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
              padding: "1rem 2.5rem",
            }}>
              <div style={{
                flex: 1, minHeight: 0, display: "flex", gap: "2rem", alignItems: "center",
              }}>
                {/* LEFT — FORM */}
                <div style={{
                  width: "25%", flexShrink: 0, height: "75%",
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  borderRight: "0.5px solid #000", paddingRight: "2rem",
                }}>
                  <h2 style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.35rem",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.02em",
                    margin: "0 0 1.5rem 0",
                  }}>
                    {mode === "signup" ? "Initiate Access" : "Welcome Back"}
                  </h2>

                  <form
                    onSubmit={mode === "signup" ? handleSubmit : handleSignIn}
                    style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
                  >
                    {mode === "signup" && (
                      <div style={{ display: "flex", gap: "1.25rem", marginBottom: "0.25rem" }}>
                        {(["student", "teacher"] as UserRole[]).map(r => (
                          <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ display: "none" }} />
                            <div style={{
                              width: 11, height: 11, borderRadius: "50%", border: "1px solid #000",
                              background: role === r ? (r === "student" ? "#5A9FD4" : "#8B6FD4") : "transparent", transition: "background 0.15s",
                            }} />
                            <span style={{
                              fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                              letterSpacing: "0.15em", textTransform: "uppercase",
                              opacity: role === r ? 1 : 0.6, transition: "opacity 0.15s",
                            }}>
                              {r}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {mode === "signup" && (
                      <div style={{ position: "relative" }}>
                        <label style={lbl}>Display Name</label>
                        <input className="cad-input" type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                      </div>
                    )}

                    <div style={{ position: "relative" }}>
                      <label style={lbl}>Email Address</label>
                      <input className="cad-input" type="email" placeholder="user@domain.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>

                    <div style={{ position: "relative" }}>
                      <label style={lbl}>Security Key</label>
                      <input className="cad-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>

                    {error && (
                      <div style={{ fontSize: 11, color: "#ba1a1a", letterSpacing: "0.04em" }}>{error}</div>
                    )}

                    <button type="submit" disabled={loading} className="cad-btn-pastel" style={{
                      marginTop: "0.5rem",
                      background: "linear-gradient(135deg, #D97070, #8B6FD4, #5A9FD4)",
                      color: "#000", border: "none",
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 11,
                      textTransform: "uppercase", letterSpacing: "0.15em",
                      padding: "0.85rem 1rem", cursor: loading ? "default" : "pointer",
                      opacity: loading ? 0.6 : 1, width: "100%", textAlign: "center", borderRadius: 0,
                    }}>
                      {mode === "signup"
                        ? (loading ? "Joining\u2026" : "Join The Quorum")
                        : (loading ? "Entering\u2026" : "Access Cadenza")}
                    </button>

                    <button type="button" onClick={handleGoogle} className="cad-btn-outline" style={{
                      width: "100%", background: "transparent", border: "0.5px solid #000",
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                      letterSpacing: "0.12em", textTransform: "uppercase", color: "#000",
                      padding: "0.6rem 1rem", cursor: "pointer", borderRadius: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    }}>
                      {googleSvg} Continue with Google
                    </button>

                    <div style={{
                      textAlign: "center", fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", marginTop: "0.5rem",
                    }}>
                      <span style={{ color: "rgba(0,0,0,0.6)" }}>
                        {mode === "signup" ? "Already have an account? " : "Don\u2019t have an account? "}
                      </span>
                      <button type="button" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")} style={{
                        background: "none", border: "none", padding: 0, cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                        letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, color: "#000",
                      }}>
                        {mode === "signup" ? "Sign In" : "Create One"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* CENTER — MAIN IMAGE */}
                <div style={{ width: "40%", flexShrink: 0, height: "100%", position: "relative" }}>
                  <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#eae8e3" }}>
                    {SLIDES.map((s, i) => (
                      <div key={i} style={{
                        position: "absolute", inset: 0,
                        opacity: i === slide ? 1 : 0, transition: "opacity 0.6s ease",
                        pointerEvents: i === slide ? "auto" : "none",
                      }}>
                        <img
                          src={s.img} alt={s.label.replace("\n", " ")}
                          className={i === slide ? "cad-hero-img" : undefined}
                          style={{
                            width: "100%", height: "100%", objectFit: "cover",
                            filter: "grayscale(100%) contrast(1.25)", display: "block",
                          }}
                        />
                      </div>
                    ))}
                    <div style={{ position: "absolute", bottom: 16, left: 16, mixBlendMode: "difference", zIndex: 2 }}>
                      {cur.label.split("\n").map((line, i) => (
                        <p key={i} style={{
                          fontFamily: "'Space Grotesk', sans-serif", color: "#fbf9f4",
                          fontSize: "clamp(1.25rem, 2vw, 1.75rem)", fontWeight: 700,
                          letterSpacing: "-0.02em", textTransform: "uppercase", lineHeight: 1, margin: 0,
                        }}>
                          {line}
                        </p>
                      ))}
                    </div>
                    <div style={{
                      position: "absolute", top: 16, right: 16,
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 11,
                      letterSpacing: "0.15em", color: "#fbf9f4",
                      mixBlendMode: "difference", transform: "rotate(90deg)", transformOrigin: "right top",
                      whiteSpace: "nowrap", zIndex: 2,
                    }}>
                      {cur.vol}
                    </div>
                  </div>
                </div>

                {/* RIGHT — PREVIEW IMAGE */}
                <div style={{ width: "25%", flexShrink: 0, height: "83.33%", opacity: 0.6 }}>
                  <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#eae8e3" }}>
                    {SLIDES.map((s, i) => (
                      <div key={i} style={{
                        position: "absolute", inset: 0,
                        opacity: i === preview ? 1 : 0, transition: "opacity 0.6s ease",
                      }}>
                        <img
                          src={s.img} alt={s.label.replace("\n", " ")}
                          style={{
                            width: "100%", height: "100%", objectFit: "cover",
                            filter: "grayscale(100%) contrast(1.25)", display: "block",
                          }}
                        />
                      </div>
                    ))}
                    <div style={{ position: "absolute", bottom: 16, left: 16 }}>
                      <p style={{
                        fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                        letterSpacing: "0.15em", textTransform: "uppercase",
                        color: "#fbf9f4", mixBlendMode: "difference", margin: 0,
                      }}>
                        {nxt.label.replace("\n", " ")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CAROUSEL NAV */}
              <div style={{
                flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center",
                padding: "0.75rem 0", gap: "1rem",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: "0.15em",
              }}>
                <button onClick={prevSlide} className="cad-nav-arrow" style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#000", padding: "0.25rem", lineHeight: 1,
                }}>&#8592;</button>
                <span style={{ fontWeight: 700, color: PASTEL[slide % PASTEL.length] }}>{PAD(slide + 1)}</span>
                <span style={{ color: "rgba(0,0,0,0.4)" }}>/ {PAD(SLIDES.length)}</span>
                <button onClick={nextSlide} className="cad-nav-arrow" style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#000", padding: "0.25rem", lineHeight: 1,
                }}>&#8594;</button>
              </div>
            </main>

            {/* VINYL PLAYER (desktop only) */}
            <div style={{
              position: "fixed", bottom: "4.5rem", right: "2.5rem", zIndex: 50,
              display: "flex", flexDirection: "column", alignItems: "flex-end",
            }}>
              {showPlayer && (
                <div style={{
                  marginBottom: "0.75rem", background: "#000", color: "#fbf9f4",
                  width: 260, maxHeight: 300, display: "flex", flexDirection: "column",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                }}>
                  <div style={{
                    padding: "0.75rem 1rem", borderBottom: "0.5px solid rgba(255,255,255,0.12)",
                    display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
                  }}>
                    <span style={{
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                      letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700,
                    }}>Student Archives</span>
                    <button onClick={() => setShowPlayer(false)} style={{
                      background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                      cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
                    }}>&#10005;</button>
                  </div>
                  <div className="cad-player-scroll" style={{ overflowY: "auto", flex: 1 }}>
                    {recordings.length === 0 ? (
                      <div style={{
                        padding: "2rem 1rem", textAlign: "center",
                        fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                        letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
                      }}>No recordings yet</div>
                    ) : (
                      recordings.map(rec => (
                        <button key={rec.id} className="cad-track" onClick={() => playRecording(rec)} style={{
                          display: "block", width: "100%", padding: "0.6rem 1rem",
                          background: playingId === rec.id ? "rgba(255,255,255,0.1)" : "transparent",
                          border: "none", borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                          cursor: "pointer", textAlign: "left",
                        }}>
                          <div style={{
                            fontFamily: "'Work Sans', sans-serif", fontSize: 12, color: "#fbf9f4",
                            display: "flex", alignItems: "center", gap: 6,
                          }}>
                            <span style={{ fontSize: 9, opacity: 0.6 }}>
                              {playingId === rec.id && isPlaying ? "\u25A0" : "\u25B6"}
                            </span>
                            {rec.title}
                          </div>
                          <div style={{
                            fontFamily: "'Space Grotesk', sans-serif", fontSize: 9,
                            color: "rgba(255,255,255,0.4)", marginTop: 2,
                            letterSpacing: "0.1em", textTransform: "uppercase",
                          }}>{rec.artist}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div onClick={() => setShowPlayer(p => !p)} style={{
                display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", flexDirection: "row-reverse",
              }}>
                <div className={`cad-vinyl-spin ${!isPlaying ? "cad-vinyl-paused" : ""}`} style={{
                  position: "relative", width: 56, height: 56, borderRadius: "50%",
                  background: "#000", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
                }}>
                  <div className="cad-vinyl-grooves" style={{ position: "absolute", inset: 0, borderRadius: "50%" }} />
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", background: "#fbf9f4",
                    border: "0.5px solid #000", display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", zIndex: 10,
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#000" }} />
                  </div>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "linear-gradient(to top right, rgba(255,255,255,0.2), transparent)",
                    mixBlendMode: "overlay",
                  }} />
                </div>
                {!showPlayer && (
                  <div style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
                    <span style={{
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 9,
                      letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700,
                    }}>{isPlaying ? "Now Playing" : "Student Archives"}</span>
                    <span style={{
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 9,
                      letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)",
                    }}>
                      {isPlaying && playingId
                        ? recordings.find(r => r.id === playingId)?.title ?? ""
                        : `${recordings.length} Recording${recordings.length !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* DESKTOP FOOTER */}
            <footer style={{
              flexShrink: 0,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "0.6rem 2.5rem", borderTop: "0.5px solid #000", margin: "0 1rem",
            }}>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.6,
              }}>
                &copy;2026 CADENZA. ALL RIGHTS RESERVED.
              </div>
              <a href="mailto:amanda.sf.wu@gmail.com" className="cad-link" style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
                letterSpacing: "0.15em", textTransform: "uppercase", color: "#000", textDecoration: "none",
              }}>
                amanda.sf.wu@gmail.com
              </a>
            </footer>
          </>
        )}
      </div>
    </>
  );
}
