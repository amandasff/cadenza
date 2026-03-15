"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";
import { useTheme } from "@/lib/context/ThemeContext";
import { useI18n } from "@/lib/context/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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

  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
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
    borderRadius: 4, border: "1px solid var(--border-strong)", background: "var(--cream)",
    fontSize: "0.875rem", color: "var(--charcoal)",
    padding: "0.625rem 0.875rem", outline: "none", width: "100%", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 500, fontSize: "0.75rem",
    color: "var(--charcoal)", letterSpacing: "0.02em",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--white)", display: "flex", flexDirection: "column", color: "var(--charcoal)" }}>

      {/* ── Nav ── */}
      <nav className="landing-nav-bg" style={{
        padding: "0 2rem", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 54, position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal)" }}>
          Cadenza
        </span>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {dashboardUrl ? (
            <a
              href={dashboardUrl}
              className="btn btn-primary"
              style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
            >
              {t.landing.goToDashboard}
            </a>
          ) : (
            <button
              onClick={() => { switchMode("signin"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              className="btn btn-secondary"
              style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
            >
              {t.landing.signIn}
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
            border: "1px solid var(--border)", background: "var(--cream)",
            marginBottom: "1.75rem", fontSize: "0.6875rem", color: "var(--muted)",
            letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage)", flexShrink: 0 }} />
            {t.landing.tagline}
          </div>

          <h1 style={{
            fontWeight: 500,
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)", color: "var(--charcoal)",
            lineHeight: 0.98, letterSpacing: "-0.02em", marginBottom: "1.5rem",
          }}>
            {role === "teacher" ? (
              <>{t.landing.heroTeacher}<br /><em style={{ color: "var(--peach)", fontStyle: "italic" }}>{t.landing.heroTeacherEmphasis}</em></>
            ) : (
              <>{t.landing.heroStudent}<br /><em style={{ color: "var(--peach)", fontStyle: "italic" }}>{t.landing.heroStudentEmphasis}</em></>
            )}
          </h1>

          <p style={{ color: "var(--muted)", fontSize: "1.0625rem", maxWidth: 440, marginBottom: "1.75rem", lineHeight: 1.75 }}>
            {t.landing.heroDesc}
          </p>

          {/* Audience pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2rem" }}>
            {[
              { text: t.landing.pillAiPlanner, bg: "var(--sage-bg)", border: "var(--sage-light)", color: "var(--sage)" },
              { text: t.landing.pillPracticeTracking, bg: "var(--sky-bg)", border: "var(--sky-light)", color: "var(--sky)" },
              { text: t.landing.pillStreaks, bg: "var(--butter-bg)", border: "var(--butter-light)", color: "var(--butter)" },
              { text: t.landing.pillAiTutor, bg: "var(--lavender-bg)", border: "var(--lavender-light)", color: "var(--lavender)" },
              { text: t.landing.pillParentUpdates, bg: "var(--rose-bg)", border: "var(--rose-light)", color: "var(--rose)" },
              { text: t.landing.pillMusicGames, bg: "var(--peach-bg)", border: "var(--peach-light)", color: "var(--peach)" },
            ].map(f => (
              <span key={f.text} style={{ fontSize: "0.75rem", fontWeight: 500, color: f.color, background: f.bg, border: `1px solid ${f.border}`, borderRadius: 999, padding: "0.25rem 0.75rem" }}>{f.text}</span>
            ))}
          </div>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { val: t.landing.statFreeLabel, sub: t.landing.statFreeFor },
              { val: t.landing.statSetupTime, sub: t.landing.statSetupLabel },
              { val: t.landing.statGamesCount, sub: t.landing.statGamesLabel },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontWeight: 600, fontSize: "1.5rem", color: "var(--charcoal)", lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", letterSpacing: "0.04em", marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form */}
        <div id="hero-form" style={{
          flex: "0 1 380px", minWidth: 300, width: "100%",
          background: "var(--white)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "var(--shadow-lg)", overflow: "hidden",
        }}>
          <div style={{ padding: "1.25rem 1.5rem 0" }}>
            <h2 style={{ fontWeight: 500, fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.875rem" }}>
              {mode === "signin" ? t.landing.welcomeBack : t.landing.getStartedFree}
            </h2>
            {mode === "signup" && (
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", marginBottom: "0.25rem" }}>
                {(["student", "teacher"] as UserRole[]).map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)} style={{
                    flex: 1, padding: "0.5rem", border: "none", cursor: "pointer",
                    background: role === r ? "var(--charcoal)" : "transparent",
                    fontWeight: 500, fontSize: "0.8125rem",
                    color: role === r ? "var(--white)" : "var(--muted)", transition: "all 0.15s", textTransform: "capitalize",
                  }}>
                    {r === "student" ? t.landing.labelStudent : t.landing.labelTeacher}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem", padding: "1rem 1.5rem 1.25rem" }}>
            {mode === "signup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={labelStyle}>{t.landing.labelName}</label>
                <input type="text" placeholder={role === "student" ? "Emma Chen" : "Ms. Rivera"} value={displayName} onChange={e => setDisplayName(e.target.value)} required style={inputStyle} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={labelStyle}>{t.landing.labelEmail}</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={labelStyle}>{t.landing.labelPassword}</label>
              <input type="password" placeholder={mode === "signin" ? t.landing.passwordPlaceholder : t.landing.passwordPlaceholderNew} value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            </div>
            {error && (
              <div style={{ border: "1px solid var(--peach-light)", borderRadius: 4, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "var(--peach)", background: "var(--peach-bg)" }}>{error}</div>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{
              width: "100%", padding: "0.75rem",
              opacity: loading ? 0.5 : 1,
              fontSize: "0.9375rem", fontWeight: 600, marginTop: "0.125rem", letterSpacing: "0.01em",
            }}>
              {loading
                ? (mode === "signin" ? t.landing.signingIn : t.landing.creatingAccount)
                : (mode === "signin" ? t.landing.signInAction : t.landing.createAccount.replace("{role}", role))}
            </button>
          </form>

          <div style={{ padding: "0 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 500 }}>{t.common.or}</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <button type="button" onClick={handleGoogleSignup} className="btn btn-secondary" style={{
              width: "100%", gap: "0.625rem", padding: "0.625rem", fontSize: "0.8125rem",
            }}>
              <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              {t.landing.continueWithGoogle}
            </button>
          </div>

          {(demoStudentEmail || demoTeacherEmail) && (
            <div style={{ padding: "0 1.5rem 0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 500 }}>{t.landing.orTryDemo}</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {demoStudentEmail && (
                  <button type="button" onClick={() => handleDemoLogin("student")} disabled={!!demoLoading} className="btn btn-secondary" style={{
                    flex: 1, padding: "0.5625rem", fontSize: "0.75rem",
                    opacity: demoLoading && demoLoading !== "student" ? 0.4 : 1,
                  }}>
                    {demoLoading === "student" ? t.landing.loadingDemo : t.landing.studentDemo}
                  </button>
                )}
                {demoTeacherEmail && (
                  <button type="button" onClick={() => handleDemoLogin("teacher")} disabled={!!demoLoading} className="btn btn-secondary" style={{
                    flex: 1, padding: "0.5625rem", fontSize: "0.75rem",
                    opacity: demoLoading && demoLoading !== "teacher" ? 0.4 : 1,
                  }}>
                    {demoLoading === "teacher" ? t.landing.loadingDemo : t.landing.teacherDemo}
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ padding: "1rem 1.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
              {mode === "signin" ? t.landing.noAccount : t.landing.alreadyHaveAccount}{" "}
              <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} style={{ background: "none", border: "none", padding: 0, color: "var(--charcoal)", fontWeight: 500, fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                {mode === "signin" ? t.landing.signUp : t.landing.signIn}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* ── Amanda's students note ── */}
      <div style={{ padding: "0 2rem 3rem", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
          🎉 <strong style={{ color: "var(--sage)" }}>Amanda&apos;s students:</strong> {t.landing.amandaStudentsNote}
        </p>
      </div>

      {/* ── Social proof strip ── */}
      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--cream)", padding: "1.25rem 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2.5rem" }}>
          {[
            { val: t.landing.statFreeLabel, label: t.landing.socialFreeFor },
            { val: t.landing.statSetupTime, label: t.landing.socialSetupLabel },
            { val: t.landing.statGamesCount, label: t.landing.socialGamesLabel },
            { val: t.landing.statAiLabel, label: t.landing.socialAiLabel },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, color: "var(--charcoal)", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem", letterSpacing: "0.03em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Demo video ── */}
      {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
        <div style={{ padding: "5rem 2rem", maxWidth: 900, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>{t.landing.seeInAction}</div>
            <h2 style={{ fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: "var(--charcoal)", letterSpacing: "-0.015em", margin: 0 }}>
              {t.landing.demoHeading}
            </h2>
          </div>
          <div style={{
            position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden",
            borderRadius: 16, boxShadow: "0 24px 64px rgba(44,40,36,0.18)",
            border: "1px solid var(--border)",
          }}>
            <iframe
              src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Cadenza demo"
            />
          </div>
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem", marginTop: "1.25rem" }}>
            {t.landing.demoCaption}
          </p>
        </div>
      )}

      {/* ── Feature cards ── */}
      <div style={{ padding: "1rem 2rem 5rem", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* For Teachers */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sage)", whiteSpace: "nowrap" }}>{t.landing.forTeachers}</span>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "4rem" }}>
          {[
            { bg: "var(--sage-bg)", border: "var(--sage-light)", color: "var(--sage)", icon: "🎹", title: t.landing.featureAiPlannerTitle, desc: t.landing.featureAiPlannerDesc },
            { bg: "var(--butter-bg)", border: "var(--butter-light)", color: "var(--butter)", icon: "📋", title: t.landing.featureGoalTrackingTitle, desc: t.landing.featureGoalTrackingDesc },
            { bg: "var(--rose-bg)", border: "var(--rose-light)", color: "var(--rose)", icon: "💰", title: t.landing.featurePaymentsTitle, desc: t.landing.featurePaymentsDesc },
            { bg: "var(--sky-bg)", border: "var(--sky-light)", color: "var(--sky)", icon: "👪", title: t.landing.featureParentUpdatesTitle, desc: t.landing.featureParentUpdatesDesc },
            { bg: "var(--lavender-bg)", border: "var(--lavender-light)", color: "var(--lavender)", icon: "📊", title: t.landing.featureDashboardTitle, desc: t.landing.featureDashboardDesc },
            { bg: "var(--peach-bg)", border: "var(--peach-light)", color: "var(--peach)", icon: "📝", title: t.landing.featureLessonNotesTitle, desc: t.landing.featureLessonNotesDesc },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "1.75rem", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", lineHeight: 1 }}>{c.icon}</div>
              <h3 style={{ fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>{c.title}</h3>
              <div style={{ fontSize: "0.875rem", color: c.color, lineHeight: 1.7 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        {/* For Students */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--peach)", whiteSpace: "nowrap" }}>{t.landing.forStudents}</span>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          {[
            { bg: "var(--sage-bg)", border: "var(--sage-light)", color: "var(--sage)", icon: "⏱", title: t.landing.featureTimerTitle, desc: t.landing.featureTimerDesc },
            { bg: "var(--peach-bg)", border: "var(--peach-light)", color: "var(--peach)", icon: "🔥", title: t.landing.featureStreaksTitle, desc: t.landing.featureStreaksDesc },
            { bg: "var(--lavender-bg)", border: "var(--lavender-light)", color: "var(--lavender)", icon: "🤖", title: t.landing.featureAiTutorTitle, desc: t.landing.featureAiTutorDesc },
            { bg: "var(--rose-bg)", border: "var(--rose-light)", color: "var(--rose)", icon: "🎮", title: t.landing.featureGamesTitle, desc: t.landing.featureGamesDesc },
            { bg: "var(--sky-bg)", border: "var(--sky-light)", color: "var(--sky)", icon: "🎤", title: t.landing.featureCoversTitle, desc: t.landing.featureCoversDesc },
            { bg: "var(--butter-bg)", border: "var(--butter-light)", color: "var(--butter)", icon: "🌍", title: t.landing.featureCommunityTitle, desc: t.landing.featureCommunityDesc },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "1.75rem", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", lineHeight: 1 }}>{c.icon}</div>
              <h3 style={{ fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>{c.title}</h3>
              <div style={{ fontSize: "0.875rem", color: c.color, lineHeight: 1.7 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ padding: "3rem 2rem 5rem", maxWidth: 900, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem", textAlign: "center" }}>{t.landing.gettingStarted}</div>
        <h2 style={{ fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: "var(--charcoal)", textAlign: "center", marginBottom: "3rem", letterSpacing: "-0.015em" }}>
          {t.landing.upAndRunning}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "3rem" }}>
          {/* Teacher track */}
          <div>
            <h3 style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--sage)", marginBottom: "1.25rem" }}>{t.landing.forTeachersTrack}</h3>
            {[
              { n: "1", bg: "var(--sage-bg)", border: "var(--sage-light)", title: t.landing.teacherStep1Title, sub: t.landing.teacherStep1Sub },
              { n: "2", bg: "var(--peach-bg)", border: "var(--peach-light)", title: t.landing.teacherStep2Title, sub: t.landing.teacherStep2Sub },
              { n: "3", bg: "var(--lavender-bg)", border: "var(--lavender-light)", title: t.landing.teacherStep3Title, sub: t.landing.teacherStep3Sub },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", padding: "1.375rem 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)" }}>{step.n}</div>
                <div style={{ paddingTop: "0.4rem" }}>
                  <div style={{ fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.2rem" }}>{step.title}</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65 }}>{step.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--border)" }} />
          </div>
          {/* Student track */}
          <div>
            <h3 style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--peach)", marginBottom: "1.25rem" }}>{t.landing.forStudentsTrack}</h3>
            {[
              { n: "1", bg: "var(--sage-bg)", border: "var(--sage-light)", title: t.landing.studentStep1Title, sub: t.landing.studentStep1Sub },
              { n: "2", bg: "var(--peach-bg)", border: "var(--peach-light)", title: t.landing.studentStep2Title, sub: t.landing.studentStep2Sub },
              { n: "3", bg: "var(--lavender-bg)", border: "var(--lavender-light)", title: t.landing.studentStep3Title, sub: t.landing.studentStep3Sub },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", padding: "1.375rem 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)" }}>{step.n}</div>
                <div style={{ paddingTop: "0.4rem" }}>
                  <div style={{ fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.2rem" }}>{step.title}</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65 }}>{step.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--border)" }} />
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background: "#1A1714", padding: "5rem 2rem", textAlign: "center" }}>
        <h2 style={{ fontWeight: 400, fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#F0EDE7", lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: "0.75rem" }}>
          {t.landing.ctaHeadingLine1}<br />
          <em style={{ color: "#D47050" }}>{t.landing.ctaHeadingLine2}</em>
        </h2>
        <p style={{ color: "#F0EDE7", opacity: 0.45, fontSize: "0.9375rem", marginBottom: "2.25rem", maxWidth: 480, margin: "0 auto 2.25rem" }}>
          {t.landing.ctaBody}
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => { switchMode("signup"); setRole("teacher"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="btn" style={{
            background: "#F0EDE7", color: "#1A1714", padding: "0.9375rem 2.5rem",
            fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "0.01em",
          }}>
            {t.landing.ctaSetupStudio}
          </button>
          <button onClick={() => { switchMode("signup"); setRole("student"); document.getElementById("hero-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="btn" style={{
            background: "transparent", color: "#F0EDE7", opacity: 0.7, padding: "0.9375rem 2.5rem",
            fontWeight: 500, fontSize: "0.9375rem", border: "1px solid rgba(240,237,231,0.2)",
            letterSpacing: "0.01em",
          }}>
            {t.landing.ctaJoinStudent}
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "1rem 2rem", background: "#111009", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,246,242,0.25)" }}>Cadenza</span>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          {[t.landing.footerPrivacy, t.landing.footerTerms, t.landing.footerContact].map(l => (
            <span key={l} style={{ fontSize: "0.625rem", color: "rgba(248,246,242,0.2)", cursor: "pointer" }}>{l}</span>
          ))}
          <div style={{ width: 100 }}>
            <LanguageSwitcher />
          </div>
        </div>
        <span style={{ fontSize: "0.5625rem", color: "rgba(248,246,242,0.2)" }}>&copy; {new Date().getFullYear()}</span>
      </div>

      {/* ── Fixed theme toggle ── */}
      <button
        onClick={toggleTheme}
        title={theme === "light" ? t.landing.switchToDark : t.landing.switchToLight}
        style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 100,
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--white)", border: "1px solid var(--border-strong)",
          boxShadow: "0 2px 12px rgba(44,40,36,0.12)",
          cursor: "pointer", fontSize: "1.1rem",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "box-shadow 0.15s",
        }}
      >
        {theme === "light" ? "🌙" : theme === "dark" ? "☀️" : "🎨"}
      </button>
    </div>
  );
}
