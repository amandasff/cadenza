"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";

export default function Home() {
  const router = useRouter();

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<"student" | "teacher" | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);

  const demoStudentEmail = process.env.NEXT_PUBLIC_DEMO_STUDENT_EMAIL;
  const demoStudentPassword = process.env.NEXT_PUBLIC_DEMO_STUDENT_PASSWORD;
  const demoTeacherEmail = process.env.NEXT_PUBLIC_DEMO_TEACHER_EMAIL;
  const demoTeacherPassword = process.env.NEXT_PUBLIC_DEMO_TEACHER_PASSWORD;

  function switchMode(m: "signup" | "signin") {
    setMode(m); setError(""); setDisplayName(""); setEmail(""); setPassword("");
  }

  // Check if already logged in — just show a dashboard link, don't auto-redirect
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      setDashboardUrl(profile?.role === "teacher" ? "/teacher" : "/student");
    });
  }, []);

  // Pre-fill email when switching accounts
  useEffect(() => {
    if (typeof window === "undefined") return;
    const switchEmail = localStorage.getItem("cadenza-switch-email");
    if (switchEmail) {
      localStorage.removeItem("cadenza-switch-email");
      setEmail(switchEmail);
      setMode("signin");
      setTimeout(() => {
        document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(""); setLoading(true);
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
    } finally { setLoading(false); }
  };

  const handleDemoLogin = async (type: "student" | "teacher") => {
    const email = type === "student" ? demoStudentEmail : demoTeacherEmail;
    const password = type === "student" ? demoStudentPassword : demoTeacherPassword;
    if (!email || !password) return;
    setDemoLoading(type); setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push(type === "teacher" ? "/teacher" : "/student");
    } catch {
      setError("Demo login failed — try signing up instead.");
    } finally { setDemoLoading(null); }
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

      {/* ── Nav ── */}
      <nav style={{
        padding: "0 2rem", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 54, position: "sticky", top: 0, zIndex: 50,
        background: "rgba(253,252,250,0.92)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #EDE8E0",
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#2C2824" }}>
          Cadenza
        </span>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a href="#pricing" style={{ fontSize: "0.8125rem", color: "#8A8580", textDecoration: "none", fontWeight: 500 }}>Pricing</a>
          {dashboardUrl ? (
            <a
              href={dashboardUrl}
              style={{ padding: "0.375rem 0.875rem", borderRadius: 3, color: "#FDFCFA", fontWeight: 500, fontSize: "0.8125rem", background: "#2C2824", textDecoration: "none", cursor: "pointer" }}
            >
              Go to dashboard →
            </a>
          ) : (
            <button
              onClick={() => { switchMode("signin"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              style={{ padding: "0.375rem 0.875rem", borderRadius: 3, color: "#2C2824", fontWeight: 500, fontSize: "0.8125rem", border: "1px solid #D8D2C8", background: "none", cursor: "pointer" }}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{
        padding: "4rem 2rem 3rem", maxWidth: 1080, margin: "0 auto", width: "100%",
        boxSizing: "border-box", display: "flex", flexWrap: "wrap", gap: "3rem", alignItems: "center",
      }}>
        {/* Left copy */}
        <div style={{ flex: "1 1 360px", minWidth: 280 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.3rem 0.875rem", borderRadius: 999,
            border: "1px solid #E4DFD6", background: "#F5F2ED",
            marginBottom: "1.75rem", fontSize: "0.6875rem", color: "#8A8580",
            letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5B9E79", flexShrink: 0 }} />
            The platform for music teachers &amp; students
          </div>

          <h1 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)", color: "#2C2824",
            lineHeight: 0.98, letterSpacing: "-0.02em", marginBottom: "1.5rem",
          }}>
            {role === "teacher" ? (
              <>Your students will<br /><em style={{ color: "#B85C3A", fontStyle: "italic" }}>actually practice.</em></>
            ) : (
              <>Practice more.<br /><em style={{ color: "#B85C3A", fontStyle: "italic" }}>Play better.</em></>
            )}
          </h1>

          <p style={{ color: "#8A8580", fontSize: "1.0625rem", maxWidth: 440, marginBottom: "1.75rem", lineHeight: 1.75 }}>
            Cadenza gives teachers a studio OS — AI lesson plans, goal tracking, parent updates, and payment logs. Students get games, streaks, an AI tutor, and a practice community. One platform. No notebooks required.
          </p>

          {/* Audience pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2rem" }}>
            {[
              { text: "🎹 AI lesson planner", color: "#EBF3EE", border: "#B8D4C2", textColor: "#3A6A4F" },
              { text: "📊 Practice tracking", color: "#EEF6FD", border: "#A8D4F0", textColor: "#2A5A7A" },
              { text: "🔥 Student streaks", color: "#FDF3E8", border: "#EAC98C", textColor: "#7A5A2A" },
              { text: "🤖 AI tutor 24/7", color: "#F0EEFA", border: "#C4B8E8", textColor: "#4A3A78" },
              { text: "👪 Parent updates", color: "#FEF3F2", border: "#F5C5BE", textColor: "#8A3A2A" },
              { text: "🎮 Music games", color: "#FDF8E8", border: "#E8D89C", textColor: "#6A5A1A" },
            ].map(f => (
              <span key={f.text} style={{ fontSize: "0.75rem", fontWeight: 500, color: f.textColor, background: f.color, border: `1px solid ${f.border}`, borderRadius: 999, padding: "0.25rem 0.75rem" }}>{f.text}</span>
            ))}
          </div>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { val: "Free", sub: "for students" },
              { val: "2 min", sub: "studio setup" },
              { val: "10+", sub: "games & tools" },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: "#2C2824", lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: "0.6875rem", color: "#ADA9A2", letterSpacing: "0.04em", marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form */}
        <div id="hero-form" style={{
          flex: "0 1 380px", minWidth: 300, width: "100%",
          background: "#FFFFFF", border: "1px solid #EDE8E0",
          borderRadius: 10, boxShadow: "0 4px 32px rgba(44,40,36,0.08)", overflow: "hidden",
        }}>
          <div style={{ padding: "1.25rem 1.5rem 0" }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.375rem", color: "#2C2824", marginBottom: "0.875rem" }}>
              {mode === "signin" ? "Welcome back" : "Get started for free"}
            </div>
            {mode === "signup" && (
              <div style={{ display: "flex", border: "1px solid #EDE8E0", borderRadius: 4, overflow: "hidden", marginBottom: "0.25rem" }}>
                {(["student", "teacher"] as UserRole[]).map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)} style={{
                    flex: 1, padding: "0.5rem", border: "none", cursor: "pointer",
                    background: role === r ? "#2C2824" : "transparent",
                    fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem",
                    color: role === r ? "#FDFCFA" : "#8A8580", transition: "all 0.15s", textTransform: "capitalize",
                  }}>
                    {r === "student" ? "Student" : "Teacher"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem", padding: "1rem 1.5rem 1.25rem" }}>
            {mode === "signup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={labelStyle}>Name</label>
                <input type="text" placeholder={role === "student" ? "Emma Chen" : "Ms. Rivera"} value={displayName} onChange={e => setDisplayName(e.target.value)} required style={inputStyle} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={labelStyle}>Email</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={labelStyle}>Password</label>
              <input type="password" placeholder={mode === "signin" ? "Your password" : "At least 6 characters"} value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            </div>
            {error && (
              <div style={{ border: "1px solid #E8C4BA", borderRadius: 4, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#B85C3A", background: "#FDF6F3" }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={{
              borderRadius: 4, background: loading ? "#ADA9A2" : "#2C2824", color: "#FDFCFA",
              fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", padding: "0.75rem",
              border: "none", cursor: loading ? "default" : "pointer", marginTop: "0.125rem", letterSpacing: "0.01em", transition: "background 0.15s",
            }}>
              {loading ? (mode === "signin" ? "Signing in..." : "Creating account...") : (mode === "signin" ? "Sign in" : `Create ${role} account`)}
            </button>
          </form>

          <div style={{ padding: "0 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
              <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
              <span style={{ fontSize: "0.6875rem", color: "#ADA9A2", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
            </div>
            <button type="button" onClick={handleGoogleSignup} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem",
              border: "1px solid #D8D2C8", borderRadius: 4, background: "#FDFCFA", padding: "0.625rem",
              cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "#2C2824", transition: "background 0.15s",
            }}>
              <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
          </div>

          {(demoStudentEmail || demoTeacherEmail) && (
            <div style={{ padding: "0 1.5rem 0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
                <span style={{ fontSize: "0.6875rem", color: "#ADA9A2", fontWeight: 500 }}>or try a demo</span>
                <div style={{ flex: 1, height: 1, background: "#EDE8E0" }} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {demoStudentEmail && (
                  <button type="button" onClick={() => handleDemoLogin("student")} disabled={!!demoLoading} style={{
                    flex: 1, padding: "0.5625rem", borderRadius: 4, border: "1px solid #D8D2C8",
                    background: "#FDFCFA", cursor: demoLoading ? "default" : "pointer",
                    fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "#5A5550",
                    opacity: demoLoading && demoLoading !== "student" ? 0.4 : 1,
                  }}>
                    {demoLoading === "student" ? "Loading..." : "👤 Student demo"}
                  </button>
                )}
                {demoTeacherEmail && (
                  <button type="button" onClick={() => handleDemoLogin("teacher")} disabled={!!demoLoading} style={{
                    flex: 1, padding: "0.5625rem", borderRadius: 4, border: "1px solid #D8D2C8",
                    background: "#FDFCFA", cursor: demoLoading ? "default" : "pointer",
                    fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "#5A5550",
                    opacity: demoLoading && demoLoading !== "teacher" ? 0.4 : 1,
                  }}>
                    {demoLoading === "teacher" ? "Loading..." : "🎹 Teacher demo"}
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#ADA9A2", margin: 0 }}>
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} style={{ background: "none", border: "none", padding: 0, color: "#2C2824", fontWeight: 500, fontSize: "0.75rem", fontFamily: "Inter, sans-serif", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* ── Amanda's students note ── */}
      <div style={{ padding: "0 2rem 3rem", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
        <p style={{ fontSize: "0.8125rem", color: "#8A8580", margin: 0 }}>
          🎉 <strong style={{ color: "#3A6A4F" }}>Amanda&apos;s students:</strong> Pro is already included with your lessons — just sign up free.
        </p>
      </div>

      {/* ── Feature cards ── */}
      <div style={{ padding: "1rem 2rem 5rem", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* For Teachers */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ height: 1, background: "#EDE8E0", flex: 1 }} />
          <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#5B9E79", whiteSpace: "nowrap" }}>For Teachers</span>
          <div style={{ height: 1, background: "#EDE8E0", flex: 1 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "4rem" }}>
          {[
            { bg: "#EBF3EE", border: "#B8D4C2", textColor: "#3A6A4F", rot: "-1.2deg", icon: "🎹", title: "AI lesson planner", desc: "AI reads your student's practice data and generates a structured lesson plan in 2 minutes. No competitor can do this." },
            { bg: "#FDF8E8", border: "#E8D89C", textColor: "#6A5A1A", rot: "1.0deg",  icon: "📋", title: "Goal & piece tracking", desc: "Set goals and assign pieces before each lesson. Students always know exactly what to work on." },
            { bg: "#FEF3F2", border: "#F5C5BE", textColor: "#8A3A2A", rot: "-0.8deg", icon: "💰", title: "Payment log & invoices", desc: "Track lesson fees, mark payments received, and generate clean printable invoices. Ditch the spreadsheet." },
            { bg: "#EEF6FD", border: "#A8D4F0", textColor: "#2A5A7A", rot: "1.3deg",  icon: "👪", title: "Parent updates", desc: "Parents see a live view of their child's streak and practice habits. They stay engaged. You stop fielding texts." },
            { bg: "#F0EEFA", border: "#C4B8E8", textColor: "#4A3A78", rot: "-1.5deg", icon: "📊", title: "Student progress dashboard", desc: "See every student's practice minutes, mood, and streak at a glance — without asking them." },
            { bg: "#FDF3E8", border: "#EAC98C", textColor: "#7A5A2A", rot: "0.7deg",  icon: "📝", title: "Lesson notes & history", desc: "Write quick post-lesson notes. AI can expand them. Everything stays in one place, searchable forever." },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "1.75rem", transform: `rotate(${c.rot})`, boxShadow: "0 2px 20px rgba(44,40,36,0.06)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", lineHeight: 1 }}>{c.icon}</div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.25rem", color: "#2C2824", marginBottom: "0.5rem" }}>{c.title}</div>
              <div style={{ fontSize: "0.875rem", color: c.textColor, lineHeight: 1.7 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        {/* For Students */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ height: 1, background: "#EDE8E0", flex: 1 }} />
          <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#B85C3A", whiteSpace: "nowrap" }}>For Students</span>
          <div style={{ height: 1, background: "#EDE8E0", flex: 1 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          {[
            { bg: "#EBF3EE", border: "#B8D4C2", textColor: "#3A6A4F", rot: "-1.5deg", icon: "⏱", title: "One-tap practice timer", desc: "Open the app, hit start, play. Every minute logged automatically — no fuss." },
            { bg: "#FDF3E8", border: "#EAC98C", textColor: "#7A5A2A", rot: "1.2deg",  icon: "🔥", title: "Streaks & points", desc: "Kids love protecting their streak. Earn bonus points the longer you keep it alive." },
            { bg: "#F0EEFA", border: "#C4B8E8", textColor: "#4A3A78", rot: "-0.8deg", icon: "🤖", title: "AI practice tutor", desc: "Ask anything about your pieces, theory, or technique. Your AI tutor is available 24/7." },
            { bg: "#FEF3F2", border: "#F5C5BE", textColor: "#8A3A2A", rot: "1.5deg",  icon: "🎮", title: "Music games", desc: "Fretboard notes, guitar chords, ear training, note ID — learning disguised as playing." },
            { bg: "#EEF6FD", border: "#A8D4F0", textColor: "#2A5A7A", rot: "-1deg",   icon: "🎤", title: "Share your covers", desc: "Record yourself and share your covers with your studio community. See what others are playing." },
            { bg: "#FDF8E8", border: "#E8D89C", textColor: "#6A5A1A", rot: "0.8deg",  icon: "🌍", title: "Practice community", desc: "Follow other musicians, see their streaks and pieces, and get inspired. Music is better together." },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "1.75rem", transform: `rotate(${c.rot})`, boxShadow: "0 2px 20px rgba(44,40,36,0.06)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", lineHeight: 1 }}>{c.icon}</div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.25rem", color: "#2C2824", marginBottom: "0.5rem" }}>{c.title}</div>
              <div style={{ fontSize: "0.875rem", color: c.textColor, lineHeight: 1.7 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ padding: "3rem 2rem 5rem", maxWidth: 900, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ADA9A2", marginBottom: "0.75rem", textAlign: "center" }}>Getting started</div>
        <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: "#2C2824", textAlign: "center", marginBottom: "3rem", letterSpacing: "-0.015em" }}>
          Up and running in minutes.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "3rem" }}>
          {/* Teacher track */}
          <div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.125rem", color: "#5B9E79", marginBottom: "1.25rem" }}>For teachers</div>
            {[
              { n: "1", bg: "#EBF3EE", border: "#B8D4C2", title: "Create your studio", sub: "Sign up as a teacher, name your studio, and set your first student's goals — in under 2 minutes." },
              { n: "2", bg: "#FDF3E8", border: "#EAC98C", title: "Invite students & parents", sub: "Share your studio link. Students join for free. Parents get a read-only view of practice habits." },
              { n: "3", bg: "#F0EEFA", border: "#C4B8E8", title: "Let the data come to you", sub: "See who practiced this week, plan next week's lesson with AI, and track payments — all in one place." },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", padding: "1.375rem 0", borderTop: "1px solid #EDE8E0" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1rem", color: "#2C2824" }}>{step.n}</div>
                <div style={{ paddingTop: "0.4rem" }}>
                  <div style={{ fontWeight: 500, fontSize: "0.9375rem", color: "#2C2824", marginBottom: "0.2rem" }}>{step.title}</div>
                  <div style={{ fontSize: "0.8125rem", color: "#8A8580", lineHeight: 1.65 }}>{step.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: "#EDE8E0" }} />
          </div>
          {/* Student track */}
          <div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.125rem", color: "#B85C3A", marginBottom: "1.25rem" }}>For students</div>
            {[
              { n: "1", bg: "#EBF3EE", border: "#B8D4C2", title: "Sign up free & find your teacher", sub: "Create an account and search for your teacher's studio by name. Join in one tap." },
              { n: "2", bg: "#FDF3E8", border: "#EAC98C", title: "Practice with purpose", sub: "Your teacher's goals are waiting. Hit start on the timer, work through them, and log your session." },
              { n: "3", bg: "#F0EEFA", border: "#C4B8E8", title: "Build your streak", sub: "Play music games, earn points, and share your progress. Learning music gets a lot more fun." },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", padding: "1.375rem 0", borderTop: "1px solid #EDE8E0" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1rem", color: "#2C2824" }}>{step.n}</div>
                <div style={{ paddingTop: "0.4rem" }}>
                  <div style={{ fontWeight: 500, fontSize: "0.9375rem", color: "#2C2824", marginBottom: "0.2rem" }}>{step.title}</div>
                  <div style={{ fontSize: "0.8125rem", color: "#8A8580", lineHeight: 1.65 }}>{step.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: "#EDE8E0" }} />
          </div>
        </div>
      </div>

      {/* ── Pricing ── */}
      <div id="pricing" style={{ padding: "4rem 2rem 5rem", background: "#F8F6F2", borderTop: "1px solid #EDE8E0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ADA9A2", marginBottom: "0.75rem", textAlign: "center" }}>Pricing</div>
          <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.75rem)", color: "#2C2824", textAlign: "center", marginBottom: "0.75rem", letterSpacing: "-0.015em" }}>
            Simple, fair pricing.
          </h2>
          <p style={{ textAlign: "center", color: "#8A8580", fontSize: "0.9375rem", marginBottom: "3rem" }}>
            Students in a studio are always free. Self-learners and teachers pay for what they use.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", alignItems: "start" }}>

            {/* Free */}
            <div style={{ background: "#FFFFFF", border: "1px solid #EDE8E0", borderRadius: 12, padding: "2rem", boxShadow: "0 2px 12px rgba(44,40,36,0.05)" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "#2C2824", marginBottom: "0.25rem" }}>Free</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#2C2824", lineHeight: 1, marginBottom: "0.25rem" }}>$0</div>
              <div style={{ fontSize: "0.75rem", color: "#ADA9A2", marginBottom: "1.5rem" }}>forever</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {["Practice timer & log", "Streaks & points", "Piece library", "Teacher goals & feedback", "Basic music games", "Studio chat"].map(f => (
                  <li key={f} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", color: "#5A5550" }}>
                    <span style={{ color: "#5B9E79", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => { document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={{ width: "100%", padding: "0.75rem", borderRadius: 6, border: "1px solid #D8D2C8", background: "none", color: "#2C2824", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", transition: "background 0.15s" }}>
                Get started free
              </button>
            </div>

            {/* Pro — featured */}
            <div style={{ background: "#2C2824", border: "2px solid #2C2824", borderRadius: 12, padding: "2rem", boxShadow: "0 8px 40px rgba(44,40,36,0.2)", position: "relative" }}>
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#B85C3A", color: "#fff", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.25rem 0.875rem", borderRadius: 999, whiteSpace: "nowrap" }}>
                Most popular
              </div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "#FDFCFA", marginBottom: "0.25rem" }}>Pro</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "#FDFCFA", lineHeight: 1 }}>$4.99</span>
                <span style={{ fontSize: "0.875rem", color: "rgba(253,252,250,0.5)" }}>/month</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "rgba(253,252,250,0.4)", marginBottom: "1.5rem" }}>per student · cancel anytime</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {["Everything in Free", "AI practice tutor (24/7)", "All music games & levels", "Discover community", "Journey & progress tracking", "Recording history", "Metronome & tuner"].map((f, i) => (
                  <li key={f} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", color: i === 0 ? "rgba(253,252,250,0.5)" : "#FDFCFA", fontStyle: i === 0 ? "italic" : "normal" }}>
                    <span style={{ color: "#7DD4A8", fontWeight: 700, flexShrink: 0 }}>{i === 0 ? "↑" : "✓"}</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => { document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={{ width: "100%", padding: "0.75rem", borderRadius: 6, border: "none", background: "#FDFCFA", color: "#2C2824", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer" }}>
                Start free, upgrade anytime
              </button>
            </div>

            {/* Studio */}
            <div style={{ background: "#FFFFFF", border: "1px solid #EDE8E0", borderRadius: 12, padding: "2rem", boxShadow: "0 2px 12px rgba(44,40,36,0.05)" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "#2C2824", marginBottom: "0.25rem" }}>Studio</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "#2C2824", lineHeight: 1 }}>$12.99</span>
                <span style={{ fontSize: "0.875rem", color: "#ADA9A2" }}>/month</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#ADA9A2", marginBottom: "1.5rem" }}>per teacher · unlimited students</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {["Pro included for all students", "AI lesson planner", "Lesson notes & history", "Payment log & invoices", "Parent progress portal", "Student practice dashboard"].map(f => (
                  <li key={f} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", color: "#5A5550" }}>
                    <span style={{ color: "#5B9E79", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => { switchMode("signup"); setRole("teacher"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={{ width: "100%", padding: "0.75rem", borderRadius: 6, border: "1px solid #D8D2C8", background: "none", color: "#2C2824", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", transition: "background 0.15s" }}>
                Set up your studio
              </button>
            </div>
          </div>

          {/* Amanda callout under pricing */}
          <div style={{ marginTop: "2rem", textAlign: "center", background: "#EBF3EE", border: "1px solid #B8D4C2", borderRadius: 8, padding: "1rem 1.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "#3A6A4F" }}>
              🎉 <strong>Amanda&apos;s students:</strong> Always free — Pro is included with your lessons!
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background: "#2C2824", padding: "5rem 2rem", textAlign: "center" }}>
        <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 400, fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#F8F6F2", lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: "0.75rem" }}>
          Stop managing.<br />
          <em style={{ color: "#E4C4B4" }}>Start teaching.</em>
        </h2>
        <p style={{ color: "rgba(248,246,242,0.4)", fontSize: "0.9375rem", marginBottom: "2.25rem", maxWidth: 480, margin: "0 auto 2.25rem" }}>
          Teachers get a studio OS. Students get a practice habit. Everyone wins.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => { switchMode("signup"); setRole("teacher"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={{
            background: "#F8F6F2", color: "#2C2824", padding: "0.9375rem 2.5rem",
            borderRadius: 4, fontWeight: 600, fontSize: "0.9375rem", border: "none",
            letterSpacing: "0.01em", cursor: "pointer", display: "inline-block",
          }}>
            Set up your studio →
          </button>
          <button onClick={() => { switchMode("signup"); setRole("student"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={{
            background: "transparent", color: "rgba(248,246,242,0.7)", padding: "0.9375rem 2.5rem",
            borderRadius: 4, fontWeight: 500, fontSize: "0.9375rem", border: "1px solid rgba(248,246,242,0.2)",
            letterSpacing: "0.01em", cursor: "pointer", display: "inline-block",
          }}>
            Join as a student
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "1rem 2rem", background: "#221F1B", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,246,242,0.25)" }}>Cadenza</span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {["Privacy", "Terms", "Contact"].map(l => (
            <span key={l} style={{ fontSize: "0.625rem", color: "rgba(248,246,242,0.2)", cursor: "pointer" }}>{l}</span>
          ))}
        </div>
        <span style={{ fontSize: "0.5625rem", color: "rgba(248,246,242,0.2)" }}>&copy; {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
