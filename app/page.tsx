"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      // Already logged in — find their role and go straight to their dashboard
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role === "teacher") router.replace("/teacher");
      else router.replace("/student");
    });
  }, [router]);

  return (
    <div style={{ minHeight: "100dvh", background: "#FDFCFA", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", color: "#2C2824" }}>

      {/* ── Nav ── */}
      <nav style={{
        padding: "0 1.75rem", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 54, position: "sticky", top: 0, zIndex: 50,
        background: "rgba(253,252,250,0.92)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #EDE8E0",
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#2C2824" }}>
          Cadenza
        </span>
        <Link href="/auth/login" style={{ padding: "0.375rem 0.875rem", borderRadius: 3, color: "#2C2824", textDecoration: "none", fontWeight: 500, fontSize: "0.8125rem", border: "1px solid #D8D2C8" }}>
          Sign in
        </Link>
      </nav>

      {/* ── Hero ── */}
      <div style={{ padding: "5rem 1.75rem 4rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Pill */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.875rem", borderRadius: 999, border: "1px solid #E4DFD6", background: "#F5F2ED", marginBottom: "2rem", fontSize: "0.6875rem", color: "#8A8580", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5B9E79", flexShrink: 0 }} />
          For music students &amp; families
        </div>

        <h1 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
          fontSize: "clamp(3.25rem, 10vw, 6rem)", color: "#2C2824",
          lineHeight: 0.95, letterSpacing: "-0.02em", marginBottom: "1.75rem", maxWidth: 620,
        }}>
          Make practice<br />
          <em style={{ color: "#B85C3A", fontStyle: "italic" }}>actually fun.</em>
        </h1>

        <p style={{ color: "#8A8580", fontSize: "1.0625rem", maxWidth: 400, marginBottom: "2.75rem", lineHeight: 1.75 }}>
          Cadenza turns daily music practice into a game — with streaks, points, and goals set by your teacher.
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.875rem", width: "100%", maxWidth: 320 }}>
          <Link href="/auth/signup?role=student" style={{
            background: "#2C2824", color: "#FDFCFA", padding: "1rem 2rem",
            borderRadius: 4, fontWeight: 500, fontSize: "1rem", textDecoration: "none",
            width: "100%", textAlign: "center", boxSizing: "border-box",
          }}>
            Join your studio →
          </Link>
          <Link href="/auth/signup?role=teacher" style={{
            background: "transparent", color: "#2C2824", padding: "1rem 2rem",
            borderRadius: 4, fontWeight: 500, fontSize: "1rem", textDecoration: "none",
            width: "100%", textAlign: "center", border: "1px solid #D8D2C8", boxSizing: "border-box",
          }}>
            I&apos;m a teacher
          </Link>
        </div>

        <p style={{ fontSize: "0.75rem", color: "#ADA9A2", marginTop: "1.5rem" }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "#2C2824", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" }}>Sign in</Link>
        </p>
      </div>

      {/* ── 3 Feature cards ── */}
      <div style={{ padding: "0 1.75rem 5rem", maxWidth: 860, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
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

      {/* ── How it works ── */}
      <div style={{ padding: "3rem 1.75rem 5rem", maxWidth: 540, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
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

      {/* ── Bottom CTA ── */}
      <div style={{ background: "#2C2824", padding: "5rem 1.75rem", textAlign: "center" }}>
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
          Get Started →
        </Link>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "1rem 1.75rem", background: "#221F1B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,246,242,0.25)" }}>Cadenza</span>
        <span style={{ fontSize: "0.5625rem", color: "rgba(248,246,242,0.2)" }}>© {new Date().getFullYear()}</span>
      </div>

    </div>
  );
}
