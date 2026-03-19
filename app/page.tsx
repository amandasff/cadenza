"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";
import dynamic from "next/dynamic";
import Link from "next/link";

// Load demo backgrounds lazily — not needed for first paint
const TeacherHomeDemo = dynamic(() => import("../components/demo/TeacherHomeDemo"), { ssr: false });
const StudentHomeDemo = dynamic(() => import("../components/demo/StudentHomeDemo"), { ssr: false });

const STUDENT_BULLETS = [
  "Play music games, earn streaks, climb leaderboards, and collect avatars",
  "Learn anything from an AI tutor",
  "Share your practice with teachers, receive feedback between lessons",
  "Find and listen to music you like",
  "Upload pieces for easy access, and goal setting",
  "Track your practice journey, share it, and discover others",
  "Tuner, metronome, and full chords directory",
];

const TEACHER_BULLETS = [
  "Share your practice with teachers, receive feedback between lessons",
  "Play music games, earn streaks, climb leaderboards, and collect avatars",
  "Upload pieces for easy access, and goal setting",
  "Learn anything from an AI tutor",
  "Track your practice journey, share it, and discover others",
  "Find and listen to music you like",
  "Tuner, metronome, and full chords directory",
];

const COPY: Record<string, { headline: string; subline: string; sub2: string; bullets: string[] }> = {
  student: {
    headline: "Practice every day.\nActually enjoy it.",
    subline: "Learn faster, level up, and keep everything in one place.",
    sub2: "Try for free in 10 seconds.",
    bullets: STUDENT_BULLETS,
  },
  teacher: {
    headline: "Your students\nwill actually practice.",
    subline: "And you'll know exactly how it went.",
    sub2: "Try for free in 10 seconds.",
    bullets: TEACHER_BULLETS,
  },
};

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unblurring, setUnblurring] = useState(false);

  const switchMode = (m: "signup" | "signin") => {
    setMode(m);
    setError("");
    setPassword("");
  };

  // Redirect if already logged in
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (profile?.role === "teacher") router.replace("/teacher");
      else router.replace("/student");
    });
  }, [router]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = AuthService.getInstance(supabase);
      const user = await service.signUp(email, password, role, displayName);
      // Trigger unblur animation, then navigate
      setUnblurring(true);
      setTimeout(() => router.push(user.getHomeRoute()), 1600);
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
      const service = AuthService.getInstance(supabase);
      const user = await service.signIn(email, password);
      setUnblurring(true);
      setTimeout(() => router.push(user.getHomeRoute()), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }, [email, password, router]);

  const handleGoogleSignup = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` },
    });
  }, [role]);

  const inputStyle: React.CSSProperties = {
    borderRadius: 4, border: "1px solid #D8D2C8", background: "#F8F6F2",
    fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#2C2824",
    padding: "0.625rem 0.875rem", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", fontFamily: "Inter, sans-serif" }}>

      {/* ── Layer 1: blurred app background ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        filter: unblurring ? "blur(0px)" : "blur(10px)",
        transform: "scale(1.04)",
        transition: "filter 1.8s ease-out",
        transformOrigin: "center center",
      }}>
        {/* Teacher demo */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: role === "teacher" ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}>
          <TeacherHomeDemo />
        </div>
        {/* Student demo */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: role === "student" ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}>
          <StudentHomeDemo />
        </div>
      </div>

      {/* ── Layer 2: dark overlay ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "rgba(20,17,14,0.48)",
        opacity: unblurring ? 0 : 1,
        transition: "opacity 1.8s ease-out",
        pointerEvents: "none",
      }} />

      {/* ── Layer 3: wordmark ── */}
      <div style={{
        position: "absolute", top: 24, left: 28, zIndex: 10,
        opacity: unblurring ? 0 : 1, transition: "opacity 0.6s ease",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        right: 28,
        pointerEvents: unblurring ? "none" : "auto",
      }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(253,252,250,0.9)" }}>
          Cadenza
        </span>
        <button onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "rgba(253,252,250,0.6)", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}>
          {mode === "signin" ? "Create account →" : "Sign in →"}
        </button>
      </div>

      {/* ── Layer 4: floating card ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 5,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
        opacity: unblurring ? 0 : 1,
        transition: "opacity 0.8s ease-out",
        pointerEvents: unblurring ? "none" : "auto",
      }}>
        <div style={{
          width: "100%", maxWidth: 840,
          background: "rgba(253,252,250,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.55)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.38), 0 2px 8px rgba(0,0,0,0.12)",
          display: "flex",
          overflow: "hidden",
        }} className="landing-card">

          {/* LEFT — copy */}
          <div className="landing-copy" style={{
            flex: "1 1 0", padding: "2.5rem 2rem 2.5rem 2.5rem",
            display: "flex", flexDirection: "column", justifyContent: "center",
            borderRight: "1px solid rgba(44,40,36,0.08)",
          }}>
            {/* Label */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              marginBottom: "1.25rem", fontSize: "0.625rem", color: "#5B9E79",
              letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5B9E79", flexShrink: 0 }} />
              {role === "teacher" ? "For music teachers" : "For music students"}
            </div>

            <h1 style={{
              fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
              fontSize: "clamp(1.75rem, 4vw, 2.875rem)", color: "#2C2824",
              lineHeight: 1.08, letterSpacing: "-0.02em", margin: "0 0 0.625rem",
              whiteSpace: "pre-line",
            }}>
              {(COPY[role] ?? COPY.student).headline}
            </h1>

            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.9rem", color: "#6B6560", lineHeight: 1.5, margin: "0 0 0.375rem" }}>
              {(COPY[role] ?? COPY.student).subline}
            </p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8rem", color: "#5B9E79", fontWeight: 600, letterSpacing: "0.01em", margin: "0 0 1.25rem" }}>
              {(COPY[role] ?? COPY.student).sub2}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.75rem" }}>
              {(COPY[role] ?? COPY.student).bullets.map(line => (
                <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#2C2824" }}>
                  <span style={{ color: "#5B9E79", flexShrink: 0, lineHeight: "1.4rem" }}>—</span>
                  {line}
                </div>
              ))}
            </div>

          </div>

          {/* RIGHT — form */}
          <div className="landing-form-col" style={{ flex: "0 0 340px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>

            {mode === "signup" ? (
              <>
                <div style={{ padding: "1.75rem 1.75rem 0" }}>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.25rem", color: "#2C2824", marginBottom: "0.875rem" }}>
                    Get started for free
                  </div>
                  <div style={{ display: "flex", border: "1px solid #EDE8E0", borderRadius: 4, overflow: "hidden" }}>
                    {(["student", "teacher"] as UserRole[]).map(r => (
                      <button key={r} type="button" onClick={() => setRole(r)} style={{ flex: 1, padding: "0.5rem", border: "none", cursor: "pointer", background: role === r ? "#2C2824" : "transparent", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: role === r ? "#FDFCFA" : "#8A8580", transition: "all 0.15s", textTransform: "capitalize" }}>
                        {r === "student" ? "Student" : "Teacher"}
                      </button>
                    ))}
                  </div>
                </div>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.875rem 1.75rem 1.25rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "#2C2824" }}>Name</label>
                    <input type="text" placeholder={role === "student" ? "Emma Chen" : "Ms. Rivera"} value={displayName} onChange={e => setDisplayName(e.target.value)} required style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "#2C2824" }}>Email</label>
                    <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "#2C2824" }}>Password</label>
                    <input type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
                  </div>
                  {error && <div style={{ border: "1px solid #E8C4BA", borderRadius: 4, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#B85C3A", fontFamily: "Inter, sans-serif", background: "#FDF6F3" }}>{error}</div>}
                  <button type="submit" disabled={loading || unblurring} style={{ borderRadius: 4, background: loading || unblurring ? "#ADA9A2" : "#4CAF84", color: "#fff", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem", border: "none", cursor: loading || unblurring ? "default" : "pointer", letterSpacing: "0.01em", transition: "background 0.15s", marginTop: "0.125rem" }}>
                    {unblurring ? "Welcome! Opening Cadenza…" : loading ? "Creating account..." : `Create ${role} account →`}
                  </button>
                </form>
                <div style={{ padding: "0 1.75rem 1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
                    <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
                    <span style={{ fontSize: "0.6875rem", color: "#ADA9A2", fontWeight: 500 }}>or</span>
                    <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
                  </div>
                  <button type="button" onClick={handleGoogleSignup} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", border: "1px solid #D8D2C8", borderRadius: 4, background: "#FDFCFA", padding: "0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "#2C2824" }}>
                    <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                    Continue with Google
                  </button>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#ADA9A2", margin: "1rem 0 0", textAlign: "center" }}>
                    Already have an account?{" "}
                    <button onClick={() => switchMode("signin")} style={{ color: "#2C2824", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "2px", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", padding: 0 }}>Sign in</button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: "1.75rem 1.75rem 0" }}>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.25rem", color: "#2C2824", marginBottom: "0.25rem" }}>
                    Welcome back
                  </div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#8A8580", margin: "0 0 1.25rem" }}>Sign in to your account</p>
                </div>
                <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0 1.75rem 1.25rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "#2C2824" }}>Email</label>
                    <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "#2C2824" }}>Password</label>
                    <input type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
                  </div>
                  {error && <div style={{ border: "1px solid #E8C4BA", borderRadius: 4, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#B85C3A", fontFamily: "Inter, sans-serif", background: "#FDF6F3" }}>{error}</div>}
                  <button type="submit" disabled={loading || unblurring} style={{ borderRadius: 4, background: loading || unblurring ? "#ADA9A2" : "#4CAF84", color: "#fff", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem", border: "none", cursor: loading || unblurring ? "default" : "pointer", letterSpacing: "0.01em", transition: "background 0.15s", marginTop: "0.125rem" }}>
                    {unblurring ? "Welcome back! Opening Cadenza…" : loading ? "Signing in..." : "Sign in →"}
                  </button>
                </form>
                <div style={{ padding: "0 1.75rem 1.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
                    <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
                    <span style={{ fontSize: "0.6875rem", color: "#ADA9A2", fontWeight: 500 }}>or</span>
                    <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
                  </div>
                  <button type="button" onClick={handleGoogleSignup} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", border: "1px solid #D8D2C8", borderRadius: 4, background: "#FDFCFA", padding: "0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "#2C2824" }}>
                    <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                    Continue with Google
                  </button>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#ADA9A2", margin: "1rem 0 0", textAlign: "center" }}>
                    Don&apos;t have an account?{" "}
                    <button onClick={() => switchMode("signup")} style={{ color: "#2C2824", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "2px", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", padding: 0 }}>Create one</button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: stack copy above form ── */}
      <style>{`
        @media (max-width: 640px) {
          .landing-card { flex-direction: column !important; max-height: 100dvh; overflow-y: auto; }
          .landing-copy { border-right: none !important; border-bottom: 1px solid rgba(44,40,36,0.08) !important; padding: 1.75rem 1.5rem 1.25rem !important; }
          .landing-copy h1 { font-size: 1.75rem !important; }
          .landing-copy p, .landing-copy .proof { display: none !important; }
          .landing-form-col { flex: 1 1 auto !important; }
        }
      `}</style>
    </div>
  );
}
