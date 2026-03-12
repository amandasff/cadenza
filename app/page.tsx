"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";

export default function Home() {
  const router = useRouter();

  // Form mode toggle
  const [mode, setMode] = useState<"signup" | "signin">("signup");

  // Signup form state — embedded right in the hero
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(m: "signup" | "signin") {
    setMode(m);
    setError("");
    setDisplayName("");
    setEmail("");
    setPassword("");
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role === "teacher") router.replace("/teacher");
      else router.replace("/student");
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user!.id).single();
        router.push(profile?.role === "teacher" ? "/teacher" : "/student");
      } else {
        if (password.length < 6) { setError("Password must be at least 6 characters"); setLoading(false); return; }
        const service = AuthService.getInstance(supabase);
        const user = await service.signUp(email, password, role, displayName);
        router.push(user.getHomeRoute());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === "signin" ? "Sign in failed" : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` },
    });
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: 4, border: "1px solid #D8D2C8", background: "#F8F6F2",
    fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#2C2824",
    padding: "0.625rem 0.875rem", outline: "none", width: "100%", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem",
    color: "#2C2824", letterSpacing: "0.02em",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#FDFCFA", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", color: "#2C2824" }}>

      {/* Nav */}
      <nav style={{
        padding: "0 2rem", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 54, position: "sticky", top: 0, zIndex: 50,
        background: "rgba(253,252,250,0.92)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #EDE8E0",
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#2C2824" }}>
          Cadenza
        </span>
        <button
          onClick={() => { switchMode("signin"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
          style={{ padding: "0.375rem 0.875rem", borderRadius: 3, color: "#2C2824", fontWeight: 500, fontSize: "0.8125rem", border: "1px solid #D8D2C8", background: "none", cursor: "pointer" }}
        >
          Sign in
        </button>
      </nav>

      {/* Hero — copy left, signup form right */}
      <div style={{
        padding: "4rem 2rem 3rem",
        maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box",
        display: "flex", flexWrap: "wrap", gap: "3rem",
        alignItems: "center",
      }}>
        {/* Left: headline + subtext */}
        <div style={{ flex: "1 1 360px", minWidth: 280 }}>
          {/* Pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.3rem 0.875rem", borderRadius: 999,
            border: "1px solid #E4DFD6", background: "#F5F2ED",
            marginBottom: "1.75rem", fontSize: "0.6875rem", color: "#8A8580",
            letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5B9E79", flexShrink: 0 }} />
            For music students &amp; families
          </div>

          <h1 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
            fontSize: "clamp(2.75rem, 7vw, 5rem)", color: "#2C2824",
            lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: "1.5rem",
          }}>
            Make practice<br />
            <em style={{ color: "#B85C3A", fontStyle: "italic" }}>actually fun.</em>
          </h1>

          <p style={{ color: "#8A8580", fontSize: "1.0625rem", maxWidth: 420, marginBottom: "2rem", lineHeight: 1.75 }}>
            Cadenza turns daily music practice into a game — with streaks, points, and goals set by your teacher.
          </p>

          {/* Social proof / trust */}
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { val: "Free", sub: "to start" },
              { val: "30s", sub: "to sign up" },
              { val: "Daily", sub: "streaks" },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: "#2C2824", lineHeight: 1 }}>
                  {item.val}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "#ADA9A2", letterSpacing: "0.04em", marginTop: 2 }}>
                  {item.sub}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: signup / signin form */}
        <div id="hero-form" style={{
          flex: "0 1 380px", minWidth: 300, width: "100%",
          background: "#FFFFFF", border: "1px solid #EDE8E0",
          borderRadius: 10, boxShadow: "0 4px 32px rgba(44,40,36,0.08)",
          overflow: "hidden",
        }}>
          {/* Form header */}
          <div style={{ padding: "1.25rem 1.5rem 0" }}>
            <div style={{
              fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
              fontSize: "1.375rem", color: "#2C2824", marginBottom: "0.875rem",
            }}>
              {mode === "signin" ? "Welcome back" : "Get started for free"}
            </div>

            {/* Role toggle — only for signup */}
            {mode === "signup" && (
              <div style={{ display: "flex", border: "1px solid #EDE8E0", borderRadius: 4, overflow: "hidden", marginBottom: "0.25rem" }}>
                {(["student", "teacher"] as UserRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1, padding: "0.5rem", border: "none", cursor: "pointer",
                      background: role === r ? "#2C2824" : "transparent",
                      fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem",
                      color: role === r ? "#FDFCFA" : "#8A8580",
                      transition: "all 0.15s", textTransform: "capitalize",
                    }}
                  >
                    {r === "student" ? "Student" : "Teacher"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem", padding: "1rem 1.5rem 1.25rem" }}>
            {/* Name — signup only */}
            {mode === "signup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  placeholder={role === "student" ? "Emma Chen" : "Ms. Rivera"}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder={mode === "signin" ? "Your password" : "At least 6 characters"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                border: "1px solid #E8C4BA", borderRadius: 4, padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem", color: "#B85C3A", fontFamily: "Inter, sans-serif",
                background: "#FDF6F3",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                borderRadius: 4, background: loading ? "#ADA9A2" : "#2C2824",
                color: "#FDFCFA", fontFamily: "Inter, sans-serif", fontWeight: 600,
                fontSize: "0.9375rem", padding: "0.75rem", border: "none",
                cursor: loading ? "default" : "pointer", marginTop: "0.125rem",
                letterSpacing: "0.01em", transition: "background 0.15s",
              }}
            >
              {loading
                ? (mode === "signin" ? "Signing in..." : "Creating account...")
                : (mode === "signin" ? "Sign in" : `Create ${role} account`)}
            </button>
          </form>

          {/* Google divider + button */}
          <div style={{ padding: "0 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
              <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
              <span style={{ fontSize: "0.6875rem", color: "#ADA9A2", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignup}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem",
                border: "1px solid #D8D2C8", borderRadius: 4, background: "#FDFCFA",
                padding: "0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif",
                fontWeight: 500, fontSize: "0.8125rem", color: "#2C2824", transition: "background 0.15s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
          </div>

          {/* Mode toggle footer */}
          <div style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#ADA9A2", margin: 0 }}>
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                style={{ background: "none", border: "none", padding: 0, color: "#2C2824", fontWeight: 500, fontSize: "0.75rem", fontFamily: "Inter, sans-serif", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* 3 Feature cards */}
      <div style={{ padding: "2rem 2rem 5rem", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          <div style={{ background: "#EBF3EE", border: "1px solid #B8D4C2", borderRadius: 14, padding: "2rem", transform: "rotate(-1.5deg)", boxShadow: "0 2px 20px rgba(44,40,36,0.06)" }}>
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem", lineHeight: 1 }}>⏱</div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.35rem", color: "#2C2824", marginBottom: "0.5rem" }}>
              One-tap practice timer
            </div>
            <div style={{ fontSize: "0.875rem", color: "#6A7D6F", lineHeight: 1.7 }}>
              Open the app, hit start, play. Every minute is logged automatically — no fuss.
            </div>
          </div>

          <div style={{ background: "#FDF3E8", border: "1px solid #EAC98C", borderRadius: 14, padding: "2rem", transform: "rotate(1.2deg)", boxShadow: "0 2px 20px rgba(44,40,36,0.06)" }}>
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem", lineHeight: 1 }}>🔥</div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.35rem", color: "#2C2824", marginBottom: "0.5rem" }}>
              Streaks &amp; points
            </div>
            <div style={{ fontSize: "0.875rem", color: "#7A6A4A", lineHeight: 1.7 }}>
              Kids love protecting their streak. Earn bonus points the longer you keep it alive.
            </div>
          </div>

          <div style={{ background: "#F0EEFA", border: "1px solid #C4B8E8", borderRadius: 14, padding: "2rem", transform: "rotate(-0.8deg)", boxShadow: "0 2px 20px rgba(44,40,36,0.06)" }}>
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem", lineHeight: 1 }}>🎯</div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.35rem", color: "#2C2824", marginBottom: "0.5rem" }}>
              Goals from your teacher
            </div>
            <div style={{ fontSize: "0.875rem", color: "#5A5070", lineHeight: 1.7 }}>
              Your teacher sets what to work on. You check it off as you go — always knowing what&apos;s next.
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: "3rem 2rem 5rem", maxWidth: 540, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ADA9A2", marginBottom: "0.75rem", textAlign: "center" }}>
          Getting started
        </div>
        <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: "#2C2824", textAlign: "center", marginBottom: "2.5rem", letterSpacing: "-0.015em" }}>
          Three steps, then just practice.
        </h2>

        {[
          { n: "1", bg: "#EBF3EE", border: "#B8D4C2", title: "Your teacher sets up a studio", sub: "They add your name and goals before the first lesson." },
          { n: "2", bg: "#FDF3E8", border: "#EAC98C", title: "You search and join", sub: "Find your teacher's studio by name — no codes to remember." },
          { n: "3", bg: "#F0EEFA", border: "#C4B8E8", title: "Practice every day", sub: "Log sessions, protect your streak, and level up as a musician." },
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", padding: "1.375rem 0", borderTop: "1px solid #EDE8E0" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: step.bg, border: `1px solid ${step.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1rem", color: "#2C2824",
            }}>
              {step.n}
            </div>
            <div style={{ paddingTop: "0.4rem" }}>
              <div style={{ fontWeight: 500, fontSize: "0.9375rem", color: "#2C2824", marginBottom: "0.2rem" }}>{step.title}</div>
              <div style={{ fontSize: "0.8125rem", color: "#8A8580", lineHeight: 1.65 }}>{step.sub}</div>
            </div>
          </div>
        ))}
        <div style={{ height: 1, background: "#EDE8E0" }} />
      </div>

      {/* Bottom CTA */}
      <div style={{ background: "#2C2824", padding: "5rem 2rem", textAlign: "center" }}>
        <h2 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 400,
          fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#F8F6F2",
          lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: "0.75rem",
        }}>
          Every practice session<br />
          <em style={{ color: "#E4C4B4" }}>builds a musician.</em>
        </h2>
        <p style={{ color: "rgba(248,246,242,0.4)", fontSize: "0.9375rem", marginBottom: "2.25rem" }}>
          Join your teacher&apos;s studio and start your streak today.
        </p>
        <Link href="/auth/signup" style={{
          background: "#F8F6F2", color: "#2C2824", padding: "0.9375rem 2.5rem",
          borderRadius: 4, fontWeight: 600, fontSize: "0.9375rem", textDecoration: "none",
          letterSpacing: "0.01em", display: "inline-block",
        }}>
          Get Started
        </Link>
      </div>

      {/* Footer */}
      <div style={{ padding: "1rem 2rem", background: "#221F1B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,246,242,0.25)" }}>Cadenza</span>
        <span style={{ fontSize: "0.5625rem", color: "rgba(248,246,242,0.2)" }}>&copy; {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
