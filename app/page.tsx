"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";

const serif: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

type AuthMode = "signup" | "signin";

const FEATURES = [
  {
    icon: "M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z",
    title: "Practice streaks that stick",
    body: "A daily practice loop with streaks, points, and goals — momentum students can see, and a reason to sit down and play on a Tuesday.",
  },
  {
    icon: "M8 10h8m-8 4h5m-9 7 3.5-3.5H19a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16z",
    title: "Your teacher, between lessons",
    body: "Students send recordings and questions; teachers reply in context. The week between lessons stops being a black box.",
  },
  {
    icon: "M12 2 14.5 9H22l-6 4.5L18.5 21 12 16.5 5.5 21 8 13.5 2 9h7.5L12 2z",
    title: "An AI tutor that knows the syllabus",
    body: "Theory questions, exam requirements, practice strategies — grounded in the full RCM curriculum from Prep A to Level 10.",
  },
  {
    icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
    title: "Every piece in one place",
    body: "Repertoire, reference library, ear training, and sight reading — organized by level, not scattered across binders and tabs.",
  },
];

export default function Home() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) { setChecking(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      router.replace(profile?.role === "teacher" ? "/teacher" : "/student");
    });
  }, [router]);

  const openAuth = useCallback((m: AuthMode, r?: UserRole) => {
    setMode(m);
    if (r) setRole(r);
    setError("");
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => { setAuthOpen(false); setError(""); setPassword(""); }, []);

  useEffect(() => {
    if (!authOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAuth(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [authOpen, closeAuth]);

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

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center" style={{ background: "var(--cream)" }}>
        <span className="text-sm" style={{ color: "var(--muted)" }}>Loading…</span>
      </div>
    );
  }

  const googleSvg = (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );

  return (
    <div style={{ background: "var(--cream)", color: "var(--charcoal)" }} className="min-h-dvh">

      {/* ── Nav ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "color-mix(in srgb, var(--cream) 92%, transparent)", backdropFilter: "blur(8px)", borderColor: "var(--border)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#" className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-6 w-auto" />
            <span className="text-2xl" style={{ ...serif, fontWeight: 500 }}>Cadenza</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm md:flex" style={{ color: "var(--muted)" }}>
            <a href="#features" className="transition-colors hover:text-[var(--charcoal)]">Features</a>
            <a href="#teachers" className="transition-colors hover:text-[var(--charcoal)]">For teachers</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => openAuth("signin")} className="cursor-pointer text-sm" style={{ color: "var(--muted)" }}>
              Sign in
            </button>
            <button
              onClick={() => openAuth("signup")}
              className="cursor-pointer rounded-lg px-4 py-2 text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--sage)" }}
            >
              Start free
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
        <div>
          <p className="mb-4 text-sm" style={{ color: "var(--peach)" }}>
            For music students, teachers, and parents
          </p>
          <h1 className="text-5xl leading-[1.08] sm:text-6xl" style={{ ...serif, fontWeight: 500 }}>
            Practice that carries the lesson home
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
            Cadenza keeps students playing between lessons — daily streaks, shared
            repertoire, and an AI tutor built on the RCM syllabus — with teachers
            and parents in the loop.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => openAuth("signup", "student")}
              className="cursor-pointer rounded-xl border p-5 text-left transition-colors"
              style={{ background: "var(--sage-bg)", borderColor: "var(--sage-light)" }}
            >
              <span className="block text-base font-medium" style={{ color: "var(--sage)" }}>I&rsquo;m learning</span>
              <span className="mt-1 block text-sm leading-snug" style={{ color: "var(--sage-mid)" }}>
                Build a streak, learn your pieces, get help when you&rsquo;re stuck.
              </span>
              <span className="mt-3 inline-block rounded-lg px-4 py-2 text-sm text-white" style={{ background: "var(--sage)" }}>
                Start practicing — free
              </span>
            </button>
            <button
              onClick={() => openAuth("signup", "teacher")}
              className="cursor-pointer rounded-xl border p-5 text-left transition-colors"
              style={{ background: "var(--white)", borderColor: "var(--border-strong)" }}
            >
              <span className="block text-base font-medium">I teach</span>
              <span className="mt-1 block text-sm leading-snug" style={{ color: "var(--muted)" }}>
                See who practiced, send feedback mid-week, run your studio in one place.
              </span>
              <span className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm" style={{ borderColor: "var(--charcoal)" }}>
                Set up your studio
              </span>
            </button>
          </div>

          <p className="mt-5 text-sm" style={{ color: "var(--muted)" }}>
            Free to start · No credit card required
          </p>
        </div>

        <div className="rounded-2xl border p-3 shadow-sm" style={{ background: "var(--white)", borderColor: "var(--border)" }}>
          <img
            src="/slides/01.png"
            alt="The Cadenza student home screen: a practice start card, streak and points, teacher chat, and the next scheduled lesson"
            className="w-full rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section id="features" className="border-t" style={{ background: "var(--white)", borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="max-w-2xl text-4xl leading-tight" style={{ ...serif, fontWeight: 500 }}>
            One weekly lesson isn&rsquo;t what makes a musician. It&rsquo;s the six days in between.
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {FEATURES.map(f => (
              <div key={f.title} className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={f.icon} />
                </svg>
                <h3 className="mt-3 text-lg font-medium">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
            <div className="rounded-2xl border p-3" style={{ background: "var(--cream)", borderColor: "var(--border)" }}>
              <img
                src="/slides/09.png"
                alt="The Cadenza AI music tutor answering questions about RCM exams, scales, and theory"
                className="w-full rounded-xl border"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <h3 className="text-3xl leading-tight" style={{ ...serif, fontWeight: 500 }}>
                Stuck at 8&thinsp;pm on a Wednesday? Ask.
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
                The AI tutor knows the full RCM curriculum — what your Grade 5 exam
                requires, how many scales Level 8 needs, why harmonic and melodic
                minor differ. It answers the questions that used to wait a week for
                the next lesson.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── For teachers ────────────────────────────────── */}
      <section id="teachers" className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm" style={{ color: "var(--peach)" }}>For teachers</p>
            <h2 className="text-4xl leading-tight" style={{ ...serif, fontWeight: 500 }}>
              Know how the week went before the lesson starts
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
              Your studio in one view: who practiced, what they worked on, and the
              recordings they sent. Reply when it suits you, assign repertoire, and
              walk into every lesson already knowing where to begin.
            </p>
            <button
              onClick={() => openAuth("signup", "teacher")}
              className="mt-6 cursor-pointer rounded-lg px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--charcoal)" }}
            >
              Set up your studio
            </button>
          </div>
          <div className="rounded-2xl border p-3" style={{ background: "var(--white)", borderColor: "var(--border)" }}>
            <img
              src="/slides/08.png"
              alt="A teacher and student chatting in Cadenza, with practice recordings shared in the conversation"
              className="w-full rounded-xl border"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section className="border-t" style={{ background: "var(--charcoal)", borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8">
          <h2 className="text-4xl" style={{ ...serif, fontWeight: 500, color: "var(--cream)" }}>
            Your first practice session is a minute away
          </h2>
          <button
            onClick={() => openAuth("signup")}
            className="mt-6 cursor-pointer rounded-lg px-6 py-3 text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--cream)", color: "var(--charcoal)" }}
          >
            Start free
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-sm sm:px-8" style={{ color: "var(--muted)" }}>
          <span>© 2026 Cadenza</span>
          <button onClick={() => openAuth("signin")} className="cursor-pointer">Sign in</button>
        </div>
      </footer>

      {/* ── Auth modal ──────────────────────────────────── */}
      {authOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(44,40,36,0.45)" }}
          onClick={closeAuth}
        >
          <div
            className="w-full max-w-md rounded-2xl p-8 shadow-xl"
            style={{ background: "var(--white)" }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-6 flex items-start justify-between">
              <h2 className="text-3xl" style={{ ...serif, fontWeight: 500 }}>
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h2>
              <button onClick={closeAuth} aria-label="Close" className="cursor-pointer text-xl leading-none" style={{ color: "var(--muted)" }}>
                ✕
              </button>
            </div>

            <form onSubmit={mode === "signup" ? handleSubmit : handleSignIn} className="flex flex-col gap-4">
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-2">
                  {(["student", "teacher"] as UserRole[]).map(r => (
                    <label
                      key={r}
                      className="cursor-pointer rounded-lg border px-4 py-2.5 text-center text-sm transition-colors"
                      style={role === r
                        ? { background: "var(--sage-bg)", borderColor: "var(--sage)", color: "var(--sage)" }
                        : { borderColor: "var(--border-strong)", color: "var(--muted)" }}
                    >
                      <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                      {r === "student" ? "I'm learning" : "I teach"}
                    </label>
                  ))}
                </div>
              )}

              {mode === "signup" && (
                <div>
                  <label className="mb-1 block text-sm" style={{ color: "var(--muted)" }}>Name</label>
                  <input
                    type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
                    placeholder="Your name"
                    className="w-full rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-[var(--sage)]"
                    style={{ borderColor: "var(--border-strong)", background: "var(--white)" }}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm" style={{ color: "var(--muted)" }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="name@example.com"
                  className="w-full rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: "var(--border-strong)", background: "var(--white)" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm" style={{ color: "var(--muted)" }}>Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                  className="w-full rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: "var(--border-strong)", background: "var(--white)" }}
                />
              </div>

              {error && <p className="text-sm" style={{ color: "#ba1a1a" }}>{error}</p>}

              <button
                type="submit" disabled={loading}
                className="mt-1 w-full cursor-pointer rounded-lg py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--sage)" }}
              >
                {mode === "signup" ? (loading ? "Creating account…" : "Create account") : (loading ? "Signing in…" : "Sign in")}
              </button>

              <button
                type="button" onClick={handleGoogle}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border py-2.5 text-sm transition-colors hover:bg-[var(--cream)]"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {googleSvg} Continue with Google
              </button>

              <p className="mt-1 text-center text-sm" style={{ color: "var(--muted)" }}>
                {mode === "signup" ? "Already have an account? " : "New to Cadenza? "}
                <button
                  type="button"
                  onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setPassword(""); }}
                  className="cursor-pointer font-medium"
                  style={{ color: "var(--sage)" }}
                >
                  {mode === "signup" ? "Sign in" : "Create one"}
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
