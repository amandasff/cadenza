"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";

const SLIDES = [
  { label: "Record Your\nJourney", img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 1 // ORIGIN" },
  { label: "Share With\nOthers", img: "https://images.unsplash.com/photo-1598387993441-a364f854cfdf?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 2 // ECHO" },
  { label: "Get Real\nFeedback", img: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 3 // PULSE" },
  { label: "Build Your\nProfile", img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 4 // ICON" },
  { label: "Practice\nDaily", img: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 5 // RITUAL" },
  { label: "Join The\nCommunity", img: "https://images.unsplash.com/photo-1470019693664-1d202d2c0907?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 6 // CHORUS" },
  { label: "Learn\nWith AI", img: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 7 // SPARK" },
  { label: "Track Your\nGrowth", img: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 8 // ARC" },
  { label: "Discover Your\nSound", img: "https://images.unsplash.com/photo-1484876065684-b683cf17d276?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 9 // TIMBRE" },
  { label: "Perform For\nThe World", img: "https://images.unsplash.com/photo-1524230572899-a752b3835840?w=1400&q=85&auto=format&fit=crop", vol: "VOL. 10 // STAGE" },
];

const PAD = (n: number) => String(n).padStart(3, "0");

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
  const [slide, setSlide] = useState(3);
  const [time, setTime] = useState("");

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

  const preview = (slide + 1) % SLIDES.length;
  const prevSlide = () => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length);
  const nextSlide = () => setSlide(s => (s + 1) % SLIDES.length);
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
      <div style={{
        height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#fbf9f4", fontFamily: "'Space Grotesk', sans-serif",
        fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#777",
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
        .cad-vinyl-grooves {
          background: repeating-radial-gradient(circle, transparent, transparent 2px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px);
        }

        .cad-input {
          width: 100%; background: transparent; border: none;
          border-bottom: 1px solid #000; outline: none;
          font-family: 'Work Sans', sans-serif; font-size: 14px;
          padding: 8px 0; color: #000; border-radius: 0;
        }
        .cad-input::placeholder { color: rgba(0,0,0,0.3); }

        .cad-hero-img { transition: transform 0.7s ease-out; }
        .cad-hero-img:hover { transform: scale(1.05); }

        .cad-vinyl-wrap .cad-vinyl-label { opacity: 0; transition: opacity 0.3s; }
        .cad-vinyl-wrap:hover .cad-vinyl-label { opacity: 1; }

        .cad-nav-arrow { transition: opacity 0.2s; }
        .cad-nav-arrow:hover { opacity: 0.5; }

        .cad-btn-primary { transition: background 0.3s; }
        .cad-btn-primary:hover { background: #3b3b3b !important; }

        .cad-btn-outline { transition: background 0.2s; }
        .cad-btn-outline:hover { background: rgba(0,0,0,0.04); }

        .cad-link:hover { text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 0.5px; }
      `}</style>

      <div className="cad-noise" />

      <div style={{
        background: "#fbf9f4", color: "#000", fontFamily: "'Work Sans', sans-serif",
        minHeight: "100vh", display: "flex", flexDirection: "column",
        overflowX: "hidden", position: "relative",
      }}>

        {/* ── HEADER ── */}
        <header style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          padding: "2rem 2.5rem 1rem",
          borderBottom: "0.5px solid #000",
          margin: "0 1rem",
        }}>
          <div style={{ width: "33.33%", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Toronto, CA
            </span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              {time} EST
            </span>
          </div>
          <div style={{ width: "33.33%", textAlign: "center" }}>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(1.75rem, 3.5vw, 3rem)",
              fontWeight: 900, letterSpacing: "-0.03em", textTransform: "uppercase", lineHeight: 1, margin: 0,
            }}>
              CADENZA
            </h1>
          </div>
          <nav style={{
            width: "33.33%", display: "flex", justifyContent: "flex-end", gap: "1.5rem",
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase",
          }}>
            <a href="#" className="cad-link" style={{ color: "#000", textDecoration: "none" }}>Home</a>
            <a href="mailto:amanda.sf.wu@gmail.com" className="cad-link" style={{ color: "#000", textDecoration: "none" }}>Contact</a>
          </nav>
        </header>

        {/* ── MAIN ── */}
        <main style={{
          flexGrow: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "3rem",
        }}>
          <div style={{
            display: "flex", gap: "2rem", height: 716, alignItems: "center",
          }}>

            {/* LEFT — FORM */}
            <div style={{
              width: "25%", flexShrink: 0, height: "75%",
              display: "flex", flexDirection: "column", justifyContent: "center",
              borderRight: "0.5px solid #000", paddingRight: "2rem",
            }}>
              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.5rem",
                fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.02em",
                margin: "0 0 2rem 0",
              }}>
                {mode === "signup" ? "Initiate Access" : "Welcome Back"}
              </h2>

              <form
                onSubmit={mode === "signup" ? handleSubmit : handleSignIn}
                style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
              >
                {mode === "signup" && (
                  <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.5rem" }}>
                    {(["student", "teacher"] as UserRole[]).map(r => (
                      <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                        <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} style={{ display: "none" }} />
                        <div style={{
                          width: 12, height: 12, borderRadius: "50%", border: "1px solid #000",
                          background: role === r ? "#000" : "transparent", transition: "background 0.15s",
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
                    <label style={{
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, letterSpacing: "0.15em",
                      textTransform: "uppercase", position: "absolute", top: -16, left: 0, color: "rgba(0,0,0,0.7)",
                    }}>Display Name</label>
                    <input className="cad-input" type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                )}

                <div style={{ position: "relative" }}>
                  <label style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, letterSpacing: "0.15em",
                    textTransform: "uppercase", position: "absolute", top: -16, left: 0, color: "rgba(0,0,0,0.7)",
                  }}>Email Address</label>
                  <input className="cad-input" type="email" placeholder="user@domain.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>

                <div style={{ position: "relative" }}>
                  <label style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, letterSpacing: "0.15em",
                    textTransform: "uppercase", position: "absolute", top: -16, left: 0, color: "rgba(0,0,0,0.7)",
                  }}>Security Key</label>
                  <input className="cad-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: "#ba1a1a", letterSpacing: "0.04em" }}>{error}</div>
                )}

                <button type="submit" disabled={loading} className="cad-btn-primary" style={{
                  marginTop: "1rem", background: "#000", color: "#fbf9f4", border: "none",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.15em",
                  padding: "1rem 1.5rem", cursor: loading ? "default" : "pointer",
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
                  padding: "0.75rem 1rem", cursor: "pointer", borderRadius: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                }}>
                  {googleSvg} Continue with Google
                </button>

                <div style={{
                  textAlign: "center", fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", marginTop: "1rem",
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
                      fontSize: "clamp(1.5rem, 2vw, 1.875rem)", fontWeight: 700,
                      letterSpacing: "-0.02em", textTransform: "uppercase", lineHeight: 1, margin: 0,
                    }}>
                      {line}
                    </p>
                  ))}
                </div>
                <div style={{
                  position: "absolute", top: 16, right: 16,
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 12,
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
            display: "flex", justifyContent: "center", alignItems: "center",
            marginTop: "3rem", gap: "1rem",
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: "0.15em",
          }}>
            <button onClick={prevSlide} className="cad-nav-arrow" style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#000", padding: "0.25rem", lineHeight: 1,
            }}>&#8592;</button>
            <span style={{ fontWeight: 700 }}>{PAD(slide + 1)}</span>
            <span style={{ color: "rgba(0,0,0,0.4)" }}>/ {PAD(SLIDES.length)}</span>
            <button onClick={nextSlide} className="cad-nav-arrow" style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#000", padding: "0.25rem", lineHeight: 1,
            }}>&#8594;</button>
          </div>
        </main>

        {/* VINYL PLAYER */}
        <div className="cad-vinyl-wrap" style={{
          position: "fixed", bottom: "6rem", right: "3rem", zIndex: 50,
          display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer", flexDirection: "row-reverse",
        }}>
          <div className="cad-vinyl-spin" style={{
            position: "relative", width: 64, height: 64, borderRadius: "50%",
            background: "#000", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          }}>
            <div className="cad-vinyl-grooves" style={{ position: "absolute", inset: 0, borderRadius: "50%" }} />
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "#fbf9f4",
              border: "0.5px solid #000", display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", zIndex: 10,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#000" }} />
            </div>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "linear-gradient(to top right, rgba(255,255,255,0.2), transparent)",
              mixBlendMode: "overlay",
            }} />
          </div>
          <div className="cad-vinyl-label" style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
              letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700,
            }}>Student Archives</span>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 10,
              letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(0,0,0,0.6)",
            }}>Play Recordings</span>
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "2rem 2.5rem", borderTop: "0.5px solid #000", margin: "0 1rem",
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
      </div>
    </>
  );
}
