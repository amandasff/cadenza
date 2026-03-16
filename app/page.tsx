"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/context/ThemeContext";
import { useI18n } from "@/lib/context/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  Brain, Target, CreditCard, Bell, BarChart2, FileText,
  Timer, Flame, Bot, Gamepad2, Mic, Globe, ArrowRight,
  CheckCircle, Circle, Sparkles, Users, Music2,
} from "lucide-react";

/* ─── Tiny product UI mockups ─── */

function PracticeMockup() {
  return (
    <div style={{
      background: "var(--white)", borderRadius: 20, border: "1px solid var(--border)",
      boxShadow: "0 24px 64px rgba(44,40,36,0.14)", overflow: "hidden",
      width: "100%", maxWidth: 340,
    }}>
      {/* App header */}
      <div style={{ background: "var(--charcoal)", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", flex: 1 }}>Cadenza</div>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3D6B55" }} />
        <div style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.4)" }}>Practice</div>
      </div>
      {/* Content */}
      <div style={{ padding: "1.5rem" }}>
        {/* Greeting */}
        <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginBottom: "0.25rem" }}>Good morning, Emma</div>
        <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", marginBottom: "1.25rem" }}>Today&apos;s Practice</div>

        {/* Timer card */}
        <div style={{
          background: "var(--sage-bg)", border: "1px solid var(--sage-light)",
          borderRadius: 12, padding: "1.25rem", textAlign: "center", marginBottom: "1rem",
        }}>
          <div style={{ fontSize: "0.625rem", color: "var(--sage)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Moonlight Sonata · Beethoven</div>
          <div style={{ fontSize: "2.75rem", fontWeight: 300, color: "var(--charcoal)", lineHeight: 1, letterSpacing: "-0.03em", fontFamily: "Cormorant Garamond, Georgia, serif" }}>14:23</div>
          <div style={{ marginTop: "0.75rem", height: 4, background: "var(--sage-light)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: "62%", height: "100%", background: "var(--sage)", borderRadius: 99 }} />
          </div>
        </div>

        {/* Streak badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            background: "var(--peach-bg)", border: "1px solid var(--peach-light)",
            borderRadius: 999, padding: "0.3rem 0.75rem",
            fontSize: "0.75rem", fontWeight: 600, color: "var(--peach)",
          }}>
            <Flame size={12} />
            7 day streak
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Keep it up!</div>
        </div>

        {/* Goals list */}
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.625rem" }}>Today&apos;s Goals</div>
        {[
          { done: true, text: "Bars 1–16, right hand" },
          { done: true, text: "Slow practice with metronome" },
          { done: false, text: "Hands together, bars 1–8" },
        ].map((g, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.4rem 0", borderTop: i === 0 ? "1px solid var(--border)" : undefined }}>
            {g.done
              ? <CheckCircle size={13} color="var(--sage)" strokeWidth={2.5} />
              : <Circle size={13} color="var(--muted)" strokeWidth={1.5} />}
            <span style={{ fontSize: "0.8125rem", color: g.done ? "var(--muted)" : "var(--charcoal)", textDecoration: g.done ? "line-through" : "none" }}>{g.text}</span>
          </div>
        ))}

        {/* AI tutor bubble */}
        <div style={{
          background: "var(--lavender-bg)", border: "1px solid var(--lavender-light)",
          borderRadius: 10, padding: "0.75rem", marginTop: "1rem",
          display: "flex", gap: "0.625rem", alignItems: "flex-start",
        }}>
          <Bot size={14} color="var(--lavender)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: "0.75rem", color: "var(--lavender)", lineHeight: 1.5 }}>
            Great focus! Try playing bar 8 left hand alone at 60 bpm — it&apos;ll unlock the whole passage.
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonPlanMockup() {
  return (
    <div style={{
      background: "var(--white)", borderRadius: 16, border: "1px solid var(--border)",
      boxShadow: "var(--shadow-lg)", overflow: "hidden", width: "100%", maxWidth: 380,
    }}>
      <div style={{ background: "var(--sage-bg)", borderBottom: "1px solid var(--sage-light)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <Brain size={16} color="var(--sage)" />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>AI Lesson Plan · Emma Chen</div>
          <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>45 min this week · 5 of 7 days practiced</div>
        </div>
      </div>
      <div style={{ padding: "1.25rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Suggested Focus</div>
        {[
          { checked: true, text: "Review bars 8–12 · struggled 3× this week", tag: "High priority", tagColor: "var(--peach)", tagBg: "var(--peach-bg)", tagBorder: "var(--peach-light)" },
          { checked: true, text: "Left hand independence exercise · C major", tag: "Technique", tagColor: "var(--sage)", tagBg: "var(--sage-bg)", tagBorder: "var(--sage-light)" },
          { checked: false, text: "Introduce Burgmüller No. 2 · new piece", tag: "Repertoire", tagColor: "var(--sky)", tagBg: "var(--sky-bg)", tagBorder: "var(--sky-light)" },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", gap: "0.75rem", alignItems: "flex-start",
            padding: "0.75rem 0", borderTop: "1px solid var(--border)",
          }}>
            {item.checked
              ? <CheckCircle size={15} color="var(--sage)" style={{ flexShrink: 0, marginTop: 1 }} />
              : <Circle size={15} color="var(--border-strong)" style={{ flexShrink: 0, marginTop: 1 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.4, marginBottom: "0.375rem" }}>{item.text}</div>
              <span style={{ fontSize: "0.625rem", fontWeight: 600, color: item.tagColor, background: item.tagBg, border: `1px solid ${item.tagBorder}`, borderRadius: 999, padding: "0.15rem 0.5rem", letterSpacing: "0.04em" }}>{item.tag}</span>
            </div>
          </div>
        ))}
        <div style={{
          background: "var(--lavender-bg)", border: "1px solid var(--lavender-light)",
          borderRadius: 8, padding: "0.75rem", marginTop: "0.5rem",
          fontSize: "0.75rem", color: "var(--lavender)", lineHeight: 1.5,
          display: "flex", gap: "0.5rem",
        }}>
          <Sparkles size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Emma is consistent and motivated. Bar 8 is a stumbling block — start there and the rest will follow.
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─── */

export default function Home() {
  const router = useRouter();
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<"student" | "teacher" | null>(null);
  const [demoError, setDemoError] = useState("");

  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  const demoStudentEmail = process.env.NEXT_PUBLIC_DEMO_STUDENT_EMAIL;
  const demoStudentPassword = process.env.NEXT_PUBLIC_DEMO_STUDENT_PASSWORD;
  const demoTeacherEmail = process.env.NEXT_PUBLIC_DEMO_TEACHER_EMAIL;
  const demoTeacherPassword = process.env.NEXT_PUBLIC_DEMO_TEACHER_PASSWORD;
  const hasDemos = !!(demoStudentEmail || demoTeacherEmail);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      setDashboardUrl(profile?.role === "teacher" ? "/teacher" : "/student");
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const switchEmail = localStorage.getItem("cadenza-switch-email");
    if (switchEmail) {
      localStorage.removeItem("cadenza-switch-email");
      router.push(`/auth/login?email=${encodeURIComponent(switchEmail)}`);
    }
  }, [router]);

  const handleDemoLogin = async (type: "student" | "teacher") => {
    const email = type === "student" ? demoStudentEmail : demoTeacherEmail;
    const password = type === "student" ? demoStudentPassword : demoTeacherPassword;
    if (!email || !password) return;
    setDemoLoading(type); setDemoError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(type === "teacher" ? "/teacher" : "/student");
    } catch {
      setDemoError("Demo login failed — try signing up instead.");
    } finally { setDemoLoading(null); }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--white)", display: "flex", flexDirection: "column", color: "var(--charcoal)" }}>

      {/* ── Nav ── */}
      <nav className="landing-nav-bg" style={{
        padding: "0 2rem", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 56, position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Music2 size={16} color="var(--peach)" strokeWidth={2} />
          <span style={{ fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal)" }}>
            Cadenza
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {dashboardUrl ? (
            <a href={dashboardUrl} className="btn btn-primary" style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}>
              {t.landing.goToDashboard}
            </a>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-secondary" style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}>
                {t.landing.signIn}
              </Link>
              <Link href="/auth/signup" className="btn btn-primary" style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}>
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        padding: "5rem 2rem 4rem", maxWidth: 1080, margin: "0 auto", width: "100%",
        boxSizing: "border-box", display: "flex", flexWrap: "wrap", gap: "3.5rem", alignItems: "center",
      }}>
        {/* Left copy */}
        <div style={{ flex: "1 1 380px", minWidth: 280 }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.3rem 0.875rem", borderRadius: 999,
            border: "1px solid var(--border)", background: "var(--cream)",
            marginBottom: "2rem", fontSize: "0.6875rem", color: "var(--muted)",
            letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage)", flexShrink: 0 }} />
            {t.landing.tagline}
          </div>

          <h1 style={{
            fontWeight: 500, fontSize: "clamp(2.75rem, 6vw, 4.5rem)",
            color: "var(--charcoal)", lineHeight: 0.98, letterSpacing: "-0.025em", marginBottom: "1.5rem",
          }}>
            {t.landing.heroStudent}<br />
            <em style={{ color: "var(--peach)", fontStyle: "italic" }}>{t.landing.heroStudentEmphasis}</em>
          </h1>

          <p style={{ color: "var(--muted)", fontSize: "1.0625rem", maxWidth: 460, marginBottom: "2.25rem", lineHeight: 1.8 }}>
            {t.landing.heroDesc}
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", alignItems: "center", marginBottom: "2.5rem" }}>
            <Link href="/auth/signup" className="btn btn-primary" style={{
              padding: "0.875rem 2rem", fontSize: "1rem", fontWeight: 600,
              letterSpacing: "0.01em", display: "inline-flex", alignItems: "center", gap: "0.5rem",
            }}>
              {t.landing.getStartedFree} <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <Link href="/auth/login" style={{
              fontSize: "0.875rem", color: "var(--muted)", fontWeight: 500,
              textDecoration: "underline", textUnderlineOffset: "3px",
            }}>
              {t.landing.alreadyHaveAccount} {t.landing.signIn}
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "2.25rem", flexWrap: "wrap" }}>
            {[
              { val: t.landing.statFreeLabel, sub: t.landing.statFreeFor },
              { val: t.landing.statSetupTime, sub: t.landing.statSetupLabel },
              { val: t.landing.statGamesCount, sub: t.landing.statGamesLabel },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontWeight: 600, fontSize: "1.5rem", color: "var(--charcoal)", lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", letterSpacing: "0.04em", marginTop: 3 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: product mockup */}
        <div style={{ flex: "0 1 340px", display: "flex", justifyContent: "center" }}>
          <PracticeMockup />
        </div>
      </section>

      {/* ── Amanda's students note ── */}
      <div style={{ padding: "0 2rem 2.5rem", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
          <strong style={{ color: "var(--sage)" }}>Amanda&apos;s students:</strong> {t.landing.amandaStudentsNote}
        </p>
      </div>

      {/* ── Social proof strip ── */}
      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--cream)", padding: "1.5rem 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "3rem" }}>
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
            borderRadius: 16, boxShadow: "0 24px 64px rgba(44,40,36,0.18)", border: "1px solid var(--border)",
          }}>
            <iframe
              src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen title="Cadenza demo"
            />
          </div>
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem", marginTop: "1.25rem" }}>{t.landing.demoCaption}</p>
        </div>
      )}

      {/* ── For Teachers ── */}
      <section style={{ padding: "5rem 2rem 2rem", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Section label */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "3.5rem" }}>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sage)", whiteSpace: "nowrap" }}>{t.landing.forTeachers}</span>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
        </div>

        {/* Hero teacher feature */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "3rem", alignItems: "center",
          background: "var(--sage-bg)", border: "1px solid var(--sage-light)",
          borderRadius: 20, padding: "3rem", marginBottom: "2rem",
        }}>
          <div style={{ flex: "1 1 300px", minWidth: 260 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <Brain size={20} color="var(--sage)" />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--sage)", letterSpacing: "0.04em", textTransform: "uppercase" }}>AI Lesson Planner</span>
            </div>
            <h2 style={{ fontWeight: 500, fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--charcoal)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
              {t.landing.featureAiPlannerTitle}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.8, marginBottom: "1.5rem", maxWidth: 420 }}>
              {t.landing.featureAiPlannerDesc}
            </p>
            <Link href="/auth/signup?role=teacher" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", fontSize: "0.875rem" }}>
              Set up your studio <ArrowRight size={15} />
            </Link>
          </div>
          <div style={{ flex: "0 1 380px", display: "flex", justifyContent: "center" }}>
            <LessonPlanMockup />
          </div>
        </div>

        {/* 3 supporting teacher features */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "5rem" }}>
          {[
            { icon: <Target size={20} color="var(--butter)" />, bg: "var(--butter-bg)", border: "var(--butter-light)", color: "var(--butter)", title: t.landing.featureGoalTrackingTitle, desc: t.landing.featureGoalTrackingDesc },
            { icon: <Bell size={20} color="var(--rose)" />, bg: "var(--rose-bg)", border: "var(--rose-light)", color: "var(--rose)", title: t.landing.featureParentUpdatesTitle, desc: t.landing.featureParentUpdatesDesc },
            { icon: <CreditCard size={20} color="var(--sky)" />, bg: "var(--sky-bg)", border: "var(--sky-light)", color: "var(--sky)", title: t.landing.featurePaymentsTitle, desc: t.landing.featurePaymentsDesc },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, padding: "1.75rem", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ marginBottom: "1rem" }}>{c.icon}</div>
              <h3 style={{ fontWeight: 600, fontSize: "1.0625rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>{c.title}</h3>
              <p style={{ fontSize: "0.875rem", color: c.color, lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── For Students ── */}
      <section style={{ background: "var(--cream)", padding: "5rem 2rem" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "3.5rem" }}>
            <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
            <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--peach)", whiteSpace: "nowrap" }}>{t.landing.forStudents}</span>
            <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          </div>

          {/* Hero student feature */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "3rem", alignItems: "center",
            background: "var(--white)", border: "1px solid var(--border)",
            borderRadius: 20, padding: "3rem", marginBottom: "2rem",
          }}>
            <div style={{ flex: "0 1 340px", display: "flex", justifyContent: "center", order: 2 }}>
              {/* Streak mockup */}
              <div style={{ background: "var(--peach-bg)", border: "1px solid var(--peach-light)", borderRadius: 20, padding: "2rem", width: "100%", maxWidth: 300 }}>
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                  <Flame size={40} color="var(--peach)" style={{ margin: "0 auto 0.75rem" }} />
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "3.5rem", fontWeight: 600, color: "var(--charcoal)", lineHeight: 1 }}>7</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.25rem" }}>day streak</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.375rem", marginBottom: "1.25rem" }}>
                  {["M","T","W","T","F","S","S"].map((d, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.5625rem", color: "var(--muted)", marginBottom: "0.25rem" }}>{d}</div>
                      <div style={{
                        width: "100%", aspectRatio: "1", borderRadius: 6,
                        background: i < 7 ? "var(--peach)" : "var(--border)",
                        opacity: i < 7 ? 1 : 0.3,
                      }} />
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--lavender-bg)", border: "1px solid var(--lavender-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Sparkles size={14} color="var(--lavender)" />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal)" }}>247 points earned</div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Top 10% this week</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 260, order: 1 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <Flame size={20} color="var(--peach)" />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--peach)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Streaks & Progress</span>
              </div>
              <h2 style={{ fontWeight: 500, fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--charcoal)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                {t.landing.featureStreaksTitle}
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.8, marginBottom: "1.5rem", maxWidth: 420 }}>
                {t.landing.featureStreaksDesc}
              </p>
              <Link href="/auth/signup?role=student" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", fontSize: "0.875rem" }}>
                Start your streak <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* 3 supporting student features */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
            {[
              { icon: <Bot size={20} color="var(--lavender)" />, bg: "var(--lavender-bg)", border: "var(--lavender-light)", color: "var(--lavender)", title: t.landing.featureAiTutorTitle, desc: t.landing.featureAiTutorDesc },
              { icon: <Gamepad2 size={20} color="var(--sky)" />, bg: "var(--sky-bg)", border: "var(--sky-light)", color: "var(--sky)", title: t.landing.featureGamesTitle, desc: t.landing.featureGamesDesc },
              { icon: <Mic size={20} color="var(--rose)" />, bg: "var(--rose-bg)", border: "var(--rose-light)", color: "var(--rose)", title: t.landing.featureCoversTitle, desc: t.landing.featureCoversDesc },
            ].map((c, i) => (
              <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, padding: "1.75rem", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ marginBottom: "1rem" }}>{c.icon}</div>
                <h3 style={{ fontWeight: 600, fontSize: "1.0625rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>{c.title}</h3>
                <p style={{ fontSize: "0.875rem", color: c.color, lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Try a demo ── */}
      {hasDemos && (
        <div style={{ padding: "3rem 2rem", maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
          <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem" }}>{t.landing.orTryDemo}</div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.25rem" }}>Not ready to sign up? Explore the app instantly with a demo account.</p>
          {demoError && <p style={{ fontSize: "0.8125rem", color: "var(--peach)", marginBottom: "0.75rem" }}>{demoError}</p>}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            {demoStudentEmail && (
              <button onClick={() => handleDemoLogin("student")} disabled={!!demoLoading} className="btn btn-secondary" style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem", opacity: demoLoading && demoLoading !== "student" ? 0.4 : 1 }}>
                {demoLoading === "student" ? t.landing.loadingDemo : t.landing.studentDemo}
              </button>
            )}
            {demoTeacherEmail && (
              <button onClick={() => handleDemoLogin("teacher")} disabled={!!demoLoading} className="btn btn-secondary" style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem", opacity: demoLoading && demoLoading !== "teacher" ? 0.4 : 1 }}>
                {demoLoading === "teacher" ? t.landing.loadingDemo : t.landing.teacherDemo}
              </button>
            )}
          </div>
        </div>
      )}

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
          <Link href="/auth/signup?role=teacher" className="btn" style={{
            background: "#F0EDE7", color: "#1A1714", padding: "0.9375rem 2.5rem",
            fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "0.01em",
          }}>
            {t.landing.ctaSetupStudio}
          </Link>
          <Link href="/auth/signup?role=student" className="btn" style={{
            background: "transparent", color: "#F0EDE7", opacity: 0.7, padding: "0.9375rem 2.5rem",
            fontWeight: 500, fontSize: "0.9375rem", border: "1px solid rgba(240,237,231,0.2)",
            letterSpacing: "0.01em",
          }}>
            {t.landing.ctaJoinStudent}
          </Link>
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
