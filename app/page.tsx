"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTheme } from "@/lib/context/ThemeContext";
import { useI18n } from "@/lib/context/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  Timer, Flame, Bot, Gamepad2, Mic, MessageCircle,
  BarChart2, FileText, Users, ArrowRight, CheckCircle,
  Circle, Music2, Play,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   CSS-accurate mockup: practice session screen
   Matches real app: timer, piece, segments, record indicator
───────────────────────────────────────────────────────── */
function PracticeMockup() {
  return (
    <div style={{
      background: "var(--white)", borderRadius: 20, border: "1px solid var(--border)",
      boxShadow: "0 20px 60px rgba(44,40,36,0.12)", overflow: "hidden",
      width: "100%", maxWidth: 320,
    }}>
      {/* App bar */}
      <div style={{
        background: "var(--charcoal)", padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Practice</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, color: "#E57373", fontWeight: 600,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E57373", animation: "pulse 1.5s infinite" }} />
          Recording
        </span>
      </div>

      <div style={{ padding: "24px 20px" }}>
        {/* Piece */}
        <div style={{ marginBottom: 4, fontSize: 11, color: "var(--muted)", fontWeight: 500, letterSpacing: "0.04em" }}>
          Moonlight Sonata · Beethoven
        </div>

        {/* Timer */}
        <div style={{
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontSize: 56, fontWeight: 400, color: "var(--charcoal)",
          lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 8,
        }}>
          18:42
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ width: "62%", height: "100%", background: "var(--sage)", borderRadius: 99 }} />
        </div>

        {/* Segments */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
          Today&apos;s focus
        </div>
        {[
          { label: "Technique", status: "done" },
          { label: "Repertoire", status: "active" },
          { label: "Ear training", status: "upcoming" },
        ].map((seg) => (
          <div key={seg.label} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 0", borderTop: "1px solid var(--border)",
          }}>
            {seg.status === "done" && <CheckCircle size={14} color="var(--sage)" strokeWidth={2.5} />}
            {seg.status === "active" && <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--peach)", flexShrink: 0 }} />}
            {seg.status === "upcoming" && <Circle size={14} color="var(--border-strong)" strokeWidth={1.5} />}
            <span style={{
              fontSize: 13, color: seg.status === "upcoming" ? "var(--muted)" : "var(--charcoal)",
              fontWeight: seg.status === "active" ? 500 : 400,
            }}>{seg.label}</span>
            {seg.status === "active" && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--peach)", fontWeight: 600 }}>Active</span>}
            {seg.status === "done" && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>Done</span>}
          </div>
        ))}
        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Metronome BPM */}
        <div style={{
          marginTop: 16, display: "flex", alignItems: "center", gap: 8,
          background: "var(--cream)", borderRadius: 8, padding: "10px 14px",
          border: "1px solid var(--border)",
        }}>
          <Timer size={14} color="var(--muted)" />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Metronome</span>
          <span style={{ marginLeft: "auto", fontWeight: 600, fontSize: 13, color: "var(--charcoal)" }}>♩ = 72 bpm</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CSS-accurate mockup: teacher's student practice overview
   Matches real teacher dashboard: student list, sessions, streaks
───────────────────────────────────────────────────────── */
function TeacherDashMockup() {
  const students = [
    { name: "Emma Chen",   streak: 7,  minutes: 48, days: 5, level: "Performer",  levelColor: "var(--lavender)" },
    { name: "Sofia Park",  streak: 3,  minutes: 22, days: 3, level: "Student",    levelColor: "var(--sky)" },
    { name: "Oliver Lee",  streak: 0,  minutes: 0,  days: 0, level: "Apprentice", levelColor: "var(--sage)" },
  ];

  return (
    <div style={{
      background: "var(--white)", borderRadius: 16, border: "1px solid var(--border)",
      boxShadow: "0 16px 48px rgba(44,40,36,0.10)", overflow: "hidden",
      width: "100%", maxWidth: 380,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--charcoal)" }}>This week&apos;s practice</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Mar 10 – Mar 16</div>
        </div>
        <div style={{
          background: "var(--sage-bg)", border: "1px solid var(--sage-light)",
          borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--sage)",
        }}>3 students</div>
      </div>

      {/* Student rows */}
      {students.map((s, i) => (
        <div key={s.name} style={{
          padding: "14px 20px",
          borderBottom: i < students.length - 1 ? "1px solid var(--border)" : "none",
          background: s.days === 0 ? "var(--peach-bg)" : "transparent",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: s.days === 0 ? "var(--peach-light)" : "var(--sage-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600, color: "var(--charcoal)", flexShrink: 0,
            }}>
              {s.name.split(" ").map(n => n[0]).join("")}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--charcoal)" }}>{s.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: s.levelColor,
                  background: s.days === 0 ? "transparent" : "var(--cream)",
                  border: `1px solid ${s.levelColor}30`,
                  borderRadius: 20, padding: "1px 6px",
                }}>{s.level}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                {s.days === 0 ? "No practice logged this week" : `${s.days} days · ${s.minutes} min total`}
              </div>
            </div>

            {s.streak > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: "var(--peach)" }}>
                <Flame size={13} color="var(--peach)" />
                {s.streak}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--peach)", fontWeight: 500 }}>nudge →</div>
            )}
          </div>

          {/* Practice bar */}
          {s.minutes > 0 && (
            <div style={{ height: 3, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(100, (s.minutes / 60) * 100)}%`,
                height: "100%",
                background: s.minutes >= 30 ? "var(--sage)" : "var(--butter)",
                borderRadius: 99,
              }} />
            </div>
          )}
        </div>
      ))}
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
        padding: "0 24px", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 56, position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Music2 size={16} color="var(--peach)" strokeWidth={2} />
          <span style={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Cadenza
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dashboardUrl ? (
            <a href={dashboardUrl} className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
              {t.landing.goToDashboard}
            </a>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }}>
                {t.landing.signIn}
              </Link>
              <Link href="/auth/signup" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        padding: "80px 24px 64px", maxWidth: 1080, margin: "0 auto", width: "100%",
        boxSizing: "border-box", display: "flex", flexWrap: "wrap", gap: 56, alignItems: "center",
      }}>
        {/* Copy */}
        <div style={{ flex: "1 1 380px", minWidth: 280 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 999,
            border: "1px solid var(--border)", background: "var(--cream)",
            marginBottom: 32, fontSize: 11, color: "var(--muted)",
            letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage)", flexShrink: 0 }} />
            {t.landing.tagline}
          </div>

          <h1 style={{
            fontWeight: 500, fontSize: "clamp(2.5rem, 5.5vw, 4rem)",
            color: "var(--charcoal)", lineHeight: 1.0, letterSpacing: "-0.025em", marginBottom: 24,
          }}>
            Daily practice,<br />
            <em style={{ color: "var(--peach)", fontStyle: "italic" }}>joyfully done.</em>
          </h1>

          <p style={{
            color: "var(--muted)", fontSize: 17, maxWidth: 480,
            marginBottom: 40, lineHeight: 1.75,
          }}>
            A practice app your students will actually use — with a timer, games, an AI tutor, and a community. Everything a music teacher needs, in one place.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 48 }}>
            <Link href="/auth/signup" className="btn btn-primary" style={{
              padding: "14px 28px", fontSize: 16, fontWeight: 600,
              letterSpacing: "0.01em", display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              Start for free <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <Link href="/auth/login" style={{
              fontSize: 14, color: "var(--muted)", fontWeight: 500,
              textDecoration: "underline", textUnderlineOffset: 3,
            }}>
              Already have an account
            </Link>
          </div>

          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            {[
              { val: "Free", sub: "for every student" },
              { val: "2 min", sub: "studio setup" },
              { val: "10+", sub: "music games & tools" },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontWeight: 600, fontSize: 22, color: "var(--charcoal)", lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em", marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mockup */}
        <div style={{ flex: "0 1 320px", display: "flex", justifyContent: "center" }}>
          <PracticeMockup />
        </div>
      </section>

      {/* ── Amanda's students note ── */}
      <div style={{ padding: "0 24px 32px", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          <strong style={{ color: "var(--sage)" }}>Amanda&apos;s students:</strong> {t.landing.amandaStudentsNote}
        </p>
      </div>

      {/* ── Social proof strip ── */}
      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--cream)", padding: "24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 48 }}>
          {[
            { val: "Free", label: "for every student" },
            { val: "2 min", label: "to set up a studio" },
            { val: "10+", label: "music games & tools" },
            { val: "24/7", label: "AI practice tutor" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 32, fontWeight: 600, color: "var(--charcoal)", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, letterSpacing: "0.03em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Demo video ── */}
      {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
        <div style={{ padding: "80px 24px", maxWidth: 900, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>{t.landing.seeInAction}</div>
            <h2 style={{ fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: "var(--charcoal)", letterSpacing: "-0.015em", margin: 0 }}>
              {t.landing.demoHeading}
            </h2>
          </div>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: 16, boxShadow: "0 24px 64px rgba(44,40,36,0.18)", border: "1px solid var(--border)" }}>
            <iframe src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Cadenza demo" />
          </div>
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 20 }}>{t.landing.demoCaption}</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          FOR TEACHERS
      ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px 48px", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Label */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 56 }}>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sage)", whiteSpace: "nowrap" }}>For teachers</span>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
        </div>

        {/* Hero teacher feature: student practice overview */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center",
          background: "var(--sage-bg)", border: "1px solid var(--sage-light)",
          borderRadius: 20, padding: "48px", marginBottom: 24,
        }}>
          <div style={{ flex: "1 1 300px", minWidth: 260 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <BarChart2 size={20} color="var(--sage)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sage)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Practice overview</span>
            </div>
            <h2 style={{ fontWeight: 500, fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--charcoal)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Know who practiced before you walk in.
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.75, marginBottom: 24, maxWidth: 400 }}>
              Every student&apos;s practice session is automatically logged. See minutes practiced, streak days, and which pieces they worked on — right from your dashboard.
            </p>
            <Link href="/auth/signup?role=teacher" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 14 }}>
              Set up your studio <ArrowRight size={15} />
            </Link>
          </div>
          <div style={{ flex: "0 1 380px", display: "flex", justifyContent: "center" }}>
            <TeacherDashMockup />
          </div>
        </div>

        {/* 3 supporting teacher features */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 80 }}>
          {[
            {
              icon: <MessageCircle size={20} color="var(--sky)" />,
              bg: "var(--sky-bg)", border: "var(--sky-light)", color: "var(--sky)",
              title: "Chat & announcements",
              desc: "Send announcements to your whole studio or message students privately. They can reply with audio, video, or text.",
            },
            {
              icon: <FileText size={20} color="var(--butter)" />,
              bg: "var(--butter-bg)", border: "var(--butter-light)", color: "var(--butter)",
              title: "Lesson notes & goals",
              desc: "Assign pieces and set goals for each student. Keep lesson notes so you always remember what to work on next.",
            },
            {
              icon: <Users size={20} color="var(--rose)" />,
              bg: "var(--rose-bg)", border: "var(--rose-light)", color: "var(--rose)",
              title: "Parent visibility",
              desc: "Parents see their child's practice progress week by week — no extra work from you. Families stay in the loop.",
            },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, padding: "28px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ marginBottom: 16 }}>{c.icon}</div>
              <h3 style={{ fontWeight: 600, fontSize: 17, color: "var(--charcoal)", marginBottom: 8 }}>{c.title}</h3>
              <p style={{ fontSize: 14, color: c.color, lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          FOR STUDENTS
      ────────────────────────────────────────────────────────────── */}
      <section style={{ background: "var(--cream)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* Label */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 56 }}>
            <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--peach)", whiteSpace: "nowrap" }}>For students</span>
            <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          </div>

          {/* Hero student feature: practice tracker */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center",
            background: "var(--white)", border: "1px solid var(--border)",
            borderRadius: 20, padding: "48px", marginBottom: 24,
          }}>
            <div style={{ flex: "0 1 320px", display: "flex", justifyContent: "center", order: 2 }}>
              <PracticeMockup />
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 260, order: 1 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <Timer size={20} color="var(--peach)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--peach)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Practice tracker</span>
              </div>
              <h2 style={{ fontWeight: 500, fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--charcoal)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 16 }}>
                Record your practice.<br />Earn points. Get feedback.
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.75, marginBottom: 8, maxWidth: 400 }}>
                Open the app, press start, and play. Each session is automatically logged — your teacher sees exactly what you worked on and gives feedback throughout the week.
              </p>
              <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.75, marginBottom: 24, maxWidth: 400 }}>
                Points you earn can be redeemed for prizes at your next lesson.
              </p>
              <Link href="/auth/signup?role=student" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 14 }}>
                Start practicing <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* 4 supporting student features */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            {[
              {
                icon: <MessageCircle size={20} color="var(--sky)" />,
                bg: "var(--sky-bg)", border: "var(--sky-light)", color: "var(--sky)",
                title: "Chat with your teacher",
                desc: "Message your teacher anytime during the week. Ask questions, share audio clips, and stay connected between lessons.",
              },
              {
                icon: <Bot size={20} color="var(--lavender)" />,
                bg: "var(--lavender-bg)", border: "var(--lavender-light)", color: "var(--lavender)",
                title: "AI music tutor",
                desc: "Stuck on a passage or curious about a chord? Your AI tutor is available 24/7 — ask anything about music, anytime.",
              },
              {
                icon: <Gamepad2 size={20} color="var(--butter)" />,
                bg: "var(--butter-bg)", border: "var(--butter-light)", color: "var(--butter)",
                title: "Music games",
                desc: "Train your ear, sharpen note reading, and practise theory — the skills you need for your exams, made actually fun.",
              },
              {
                icon: <Flame size={20} color="var(--peach)" />,
                bg: "var(--peach-bg)", border: "var(--peach-light)", color: "var(--peach)",
                title: "Streaks & levels",
                desc: "Build a daily streak, earn points, and climb from Beginner to Maestro. Progress you can see and be proud of.",
              },
            ].map((c, i) => (
              <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, padding: "28px", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ marginBottom: 16 }}>{c.icon}</div>
                <h3 style={{ fontWeight: 600, fontSize: 17, color: "var(--charcoal)", marginBottom: 8 }}>{c.title}</h3>
                <p style={{ fontSize: 14, color: c.color, lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Share your journey — full-width feature ── */}
      <section style={{ padding: "80px 24px", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{
          background: "var(--lavender-bg)", border: "1px solid var(--lavender-light)",
          borderRadius: 20, padding: "48px", display: "flex", flexWrap: "wrap",
          gap: 48, alignItems: "center",
        }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Mic size={20} color="var(--lavender)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--lavender)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Journey & discovery</span>
            </div>
            <h2 style={{ fontWeight: 500, fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--charcoal)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Record it. Share it. Inspire each other.
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.75, maxWidth: 440 }}>
              Upload recordings of your playing to your personal journey, or make them public so your studio can discover them. Follow other students and let their progress inspire yours.
            </p>
          </div>
          <div style={{ flex: "0 1 320px", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Journey preview items */}
            {[
              { title: "Für Elise — hands together 🎹", date: "March 14", type: "audio" },
              { title: "Scales — C major, both hands", date: "March 11", type: "audio" },
              { title: "Bach Minuet — first run-through", date: "March 8", type: "video" },
            ].map((item, i) => (
              <div key={i} style={{
                background: "var(--white)", border: "1px solid var(--lavender-light)",
                borderRadius: 12, padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: item.type === "video" ? "var(--lavender-bg)" : "var(--sage-bg)",
                  border: `1px solid ${item.type === "video" ? "var(--lavender-light)" : "var(--sage-light)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {item.type === "video"
                    ? <Play size={14} color="var(--lavender)" />
                    : <Mic size={14} color="var(--sage)" />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--charcoal)" }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{item.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Try a demo ── */}
      {hasDemos && (
        <div style={{ padding: "0 24px 64px", maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Or try it first</div>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20 }}>Not ready to sign up? Explore the app instantly with a demo account.</p>
          {demoError && <p style={{ fontSize: 13, color: "var(--peach)", marginBottom: 12 }}>{demoError}</p>}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {demoStudentEmail && (
              <button onClick={() => handleDemoLogin("student")} disabled={!!demoLoading} className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: 14, opacity: demoLoading && demoLoading !== "student" ? 0.4 : 1 }}>
                {demoLoading === "student" ? "Loading..." : "Student demo"}
              </button>
            )}
            {demoTeacherEmail && (
              <button onClick={() => handleDemoLogin("teacher")} disabled={!!demoLoading} className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: 14, opacity: demoLoading && demoLoading !== "teacher" ? 0.4 : 1 }}>
                {demoLoading === "teacher" ? "Loading..." : "Teacher demo"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <div style={{ padding: "0 24px 80px", maxWidth: 900, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12, textAlign: "center" }}>Getting started</div>
        <h2 style={{ fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: "var(--charcoal)", textAlign: "center", marginBottom: 48, letterSpacing: "-0.015em" }}>
          Up and running in minutes.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 48 }}>
          {/* Teacher track */}
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 18, color: "var(--sage)", marginBottom: 20 }}>For teachers</h3>
            {[
              { n: "1", bg: "var(--sage-bg)", border: "var(--sage-light)", title: "Create your studio", sub: "Sign up, name your studio, and set your first student's goals. Ready in two minutes." },
              { n: "2", bg: "var(--peach-bg)", border: "var(--peach-light)", title: "Invite students & parents", sub: "Share a link. Students join for free, and parents get a window into their child's practice week." },
              { n: "3", bg: "var(--lavender-bg)", border: "var(--lavender-light)", title: "See who practiced", sub: "Check your dashboard before each lesson. No more guessing who did the work." },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "22px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 16, color: "var(--charcoal)" }}>{step.n}</div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ fontWeight: 500, fontSize: 15, color: "var(--charcoal)", marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{step.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--border)" }} />
          </div>
          {/* Student track */}
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 18, color: "var(--peach)", marginBottom: 20 }}>For students</h3>
            {[
              { n: "1", bg: "var(--sage-bg)", border: "var(--sage-light)", title: "Sign up & join your studio", sub: "Create your account and join your teacher's studio with one link." },
              { n: "2", bg: "var(--peach-bg)", border: "var(--peach-light)", title: "Practice with the timer", sub: "Open the app, press start, and play. Your session logs automatically — no fuss." },
              { n: "3", bg: "var(--lavender-bg)", border: "var(--lavender-light)", title: "Build your streak", sub: "Practice every day and watch your streak grow. Earn points, play games, share your progress." },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "22px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: step.bg, border: `1px solid ${step.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 16, color: "var(--charcoal)" }}>{step.n}</div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ fontWeight: 500, fontSize: 15, color: "var(--charcoal)", marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{step.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--border)" }} />
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background: "#1A1714", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontWeight: 400, fontSize: "clamp(2.25rem, 6vw, 3.5rem)", color: "#F0EDE7", lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: 12 }}>
          More music.<br />
          <em style={{ color: "#D47050" }}>Less admin.</em>
        </h2>
        <p style={{ color: "#F0EDE7", opacity: 0.45, fontSize: 15, marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
          Cadenza gives teachers their time back — and gives students a reason to practice every single day.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/auth/signup?role=teacher" className="btn" style={{ background: "#F0EDE7", color: "#1A1714", padding: "15px 40px", fontWeight: 600, fontSize: 15, letterSpacing: "0.01em" }}>
            Set up your studio →
          </Link>
          <Link href="/auth/signup?role=student" className="btn" style={{ background: "transparent", color: "#F0EDE7", opacity: 0.7, padding: "15px 40px", fontWeight: 500, fontSize: 15, border: "1px solid rgba(240,237,231,0.2)", letterSpacing: "0.01em" }}>
            Join as a student
          </Link>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "16px 24px", background: "#111009", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,246,242,0.25)" }}>Cadenza</span>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {["Privacy", "Terms", "Contact"].map(l => (
            <span key={l} style={{ fontSize: 10, color: "rgba(248,246,242,0.2)", cursor: "pointer" }}>{l}</span>
          ))}
          <div style={{ width: 100 }}>
            <LanguageSwitcher />
          </div>
        </div>
        <span style={{ fontSize: 9, color: "rgba(248,246,242,0.2)" }}>&copy; {new Date().getFullYear()}</span>
      </div>

      {/* ── Theme toggle ── */}
      <button
        onClick={toggleTheme}
        title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--white)", border: "1px solid var(--border-strong)",
          boxShadow: "0 2px 12px rgba(44,40,36,0.12)",
          cursor: "pointer", fontSize: "1.1rem",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {theme === "light" ? "🌙" : theme === "dark" ? "☀️" : "🎨"}
      </button>
    </div>
  );
}
