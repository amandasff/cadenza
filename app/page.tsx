"use client";
import Link from "next/link";

const CARDS = [
  {
    emoji: "🎯",
    title: "Goal Paths",
    desc: "Your teacher builds a personal sequence of goals across technique, repertoire, theory, and ear training — each one unlocking the next.",
    bg: "#EBF3EE",
    border: "#B4D0C4",
    rotate: "-2.5deg",
  },
  {
    emoji: "⏱",
    title: "Practice Timer",
    desc: "Built-in timer, metronome, sheet music with annotations, and performance recording — all in one place.",
    bg: "#E8F0F5",
    border: "#B0C8D8",
    rotate: "1.8deg",
  },
  {
    emoji: "💬",
    title: "Private Chat",
    desc: "Message your teacher between lessons. Get encouragement, quick tips, or hear studio-wide announcements.",
    bg: "#F3EFDC",
    border: "#D4C490",
    rotate: "-1.2deg",
  },
  {
    emoji: "⭐",
    title: "Points & Badges",
    desc: "Earn points for every minute you practice, unlock streak multipliers, level up through musician ranks, and collect achievement badges.",
    bg: "#F3EBF0",
    border: "#D4B4BE",
    rotate: "2.2deg",
  },
];

const STEPS = [
  {
    num: "1",
    title: "Teacher creates a studio",
    sub: "Gets a unique invite code to share with students",
    bg: "#EBF3EE", border: "#B4D0C4",
  },
  {
    num: "2",
    title: "Students join instantly",
    sub: "Enter the code and you're connected to your studio",
    bg: "#E8F0F5", border: "#B0C8D8",
  },
  {
    num: "3",
    title: "Goals get assigned",
    sub: "Your teacher builds a personal path across all four practice areas",
    bg: "#F3EFDC", border: "#D4C490",
  },
  {
    num: "4",
    title: "You practice and grow",
    sub: "Log sessions, earn points, and chat between lessons",
    bg: "#F3EBF0", border: "#D4B4BE",
  },
];

const NOTES = [
  { s: "♩", top: "14%",  left: "7%",  r: undefined, size: "2.25rem", color: "#B4D0C4", rot: "-22deg", op: 0.7 },
  { s: "♫", top: "20%",  r: "8%", left: undefined, size: "2rem",   color: "#D4B4BE", rot: "14deg",  op: 0.6 },
  { s: "♪", top: "58%",  left: "5%",  r: undefined, size: "1.75rem",color: "#D4C490", rot: "-8deg",  op: 0.55 },
  { s: "♬", top: "9%",   r: "22%",left: undefined, size: "1.5rem", color: "#B0C8D8", rot: "20deg",  op: 0.5 },
  { s: "𝄞", top: "68%",  r: "6%", left: undefined, size: "2rem",   color: "#C4C0D8", rot: "-15deg", op: 0.5 },
  { s: "♩", top: "38%",  left: "11%", r: undefined, size: "1.25rem",color: "#E4C4B4", rot: "8deg",   op: 0.5 },
  { s: "♪", top: "28%",  r: "16%",left: undefined, size: "1.5rem", color: "#B4D0C4", rot: "-18deg", op: 0.4 },
  { s: "♫", top: "75%",  left: "18%", r: undefined, size: "1.125rem",color:"#D4C490",rot: "12deg",  op: 0.4 },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100dvh", background: "#F8F6F2", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", color: "#2C2824" }}>

      {/* ── Nav ── */}
      <nav style={{
        padding: "0 2rem", display: "flex", justifyContent: "space-between",
        alignItems: "center", height: 56, position: "sticky", top: 0, zIndex: 50,
        background: "rgba(248,246,242,0.88)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #E8E3D9",
      }}>
        <span style={{ fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Cadenza
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/auth/login" style={{ padding: "0.4rem 1rem", borderRadius: 3, color: "#2C2824", textDecoration: "none", fontWeight: 500, fontSize: "0.8125rem", border: "1px solid #D0CBC0", background: "transparent" }}>
            Sign In
          </Link>
          <Link href="/auth/signup" style={{ padding: "0.4rem 1rem", borderRadius: 3, background: "#2C2824", color: "#FDFCFA", textDecoration: "none", fontWeight: 500, fontSize: "0.8125rem" }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ position: "relative", overflow: "hidden", padding: "7rem 2rem 5rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Scattered music notes */}
        {NOTES.map((n, i) => (
          <span key={i} aria-hidden="true" style={{
            position: "absolute", top: n.top, left: n.left, right: n.r,
            fontSize: n.size, color: n.color, opacity: n.op,
            transform: `rotate(${n.rot})`, userSelect: "none", pointerEvents: "none", lineHeight: 1,
          }}>
            {n.s}
          </span>
        ))}

        {/* Pill label */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.875rem", borderRadius: 999, border: "1px solid #E8E3D9", background: "#FDFCFA", marginBottom: "2rem", fontSize: "0.625rem", color: "#9A9590", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3D6B55", flexShrink: 0 }} />
          Music studio, reimagined
        </div>

        <h1 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
          fontSize: "clamp(3rem, 9vw, 5.75rem)", color: "#2C2824",
          lineHeight: 1.0, letterSpacing: "-0.02em", marginBottom: "1.5rem", maxWidth: 700,
        }}>
          Your studio,<br />
          <em style={{ color: "#B85C3A", fontStyle: "italic" }}>all in one place.</em>
        </h1>

        <p style={{ color: "#9A9590", fontSize: "1.0625rem", maxWidth: 440, marginBottom: "2.5rem", lineHeight: 1.75, fontWeight: 400 }}>
          A friendly space where teachers and students share goals, track practice, and stay connected between lessons.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "1.125rem" }}>
          <Link href="/auth/signup?role=teacher" style={{
            background: "#2C2824", color: "#FDFCFA", padding: "0.9375rem 2.25rem",
            borderRadius: 4, fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none", letterSpacing: "0.01em",
          }}>
            I&apos;m a Teacher →
          </Link>
          <Link href="/auth/signup?role=student" style={{
            background: "#FDFCFA", color: "#2C2824", padding: "0.9375rem 2.25rem",
            borderRadius: 4, fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none",
            border: "1px solid #D0CBC0", letterSpacing: "0.01em",
          }}>
            I&apos;m a Student →
          </Link>
        </div>

        <p style={{ fontSize: "0.75rem", color: "#9A9590", letterSpacing: "0.02em" }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "#2C2824", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" }}>Sign in</Link>
        </p>
      </div>

      {/* ── Feature cards ── */}
      <div style={{ padding: "3rem 2rem 5rem", maxWidth: 920, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <div style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9A9590", marginBottom: "0.75rem" }}>
            Everything in one place
          </div>
          <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "clamp(1.875rem, 4vw, 2.875rem)", color: "#2C2824", letterSpacing: "-0.015em", lineHeight: 1.1 }}>
            Built for the lesson — and beyond.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          {CARDS.map((card, i) => (
            <div key={i} style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: 12,
              padding: "2rem 2rem 1.875rem",
              transform: `rotate(${card.rotate})`,
              boxShadow: "0 2px 16px rgba(44,40,36,0.06), 0 0 0 1px rgba(44,40,36,0.03)",
            }}>
              <div style={{ fontSize: "2rem", marginBottom: "1rem", lineHeight: 1 }}>{card.emoji}</div>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "#2C2824", marginBottom: "0.625rem", letterSpacing: "-0.01em" }}>
                {card.title}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#9A9590", lineHeight: 1.7 }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={{ padding: "3rem 2rem 5rem", maxWidth: 640, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9A9590", marginBottom: "0.75rem" }}>
            Get started in minutes
          </div>
          <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "clamp(1.875rem, 4vw, 2.5rem)", color: "#2C2824", letterSpacing: "-0.015em", lineHeight: 1.1 }}>
            How it works
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", padding: "1.375rem 0", borderTop: "1px solid #E8E3D9" }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: step.bg, border: `1px solid ${step.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.0625rem", color: "#2C2824",
              }}>
                {step.num}
              </div>
              <div style={{ paddingTop: "0.4375rem" }}>
                <div style={{ fontWeight: 500, fontSize: "0.9375rem", color: "#2C2824", marginBottom: "0.2rem" }}>{step.title}</div>
                <div style={{ fontSize: "0.8125rem", color: "#9A9590", lineHeight: 1.65 }}>{step.sub}</div>
              </div>
            </div>
          ))}
          <div style={{ height: 1, background: "#E8E3D9" }} />
        </div>
      </div>

      {/* ── Bottom CTA — dark ── */}
      <div style={{ background: "#2C2824", padding: "5rem 2rem 5.5rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Subtle note decorations on dark bg */}
        {[
          { s: "♩", top: "20%",  left: "6%",  size: "2rem",   op: 0.08, rot: "-18deg" },
          { s: "♫", top: "60%",  right: "7%", size: "1.75rem", op: 0.07, rot: "12deg"  },
          { s: "♬", top: "15%",  right: "18%",size: "1.5rem",  op: 0.07, rot: "22deg"  },
          { s: "♪", bottom: "20%",left: "20%", size: "1.25rem", op: 0.07, rot: "-10deg" },
        ].map((n, i) => (
          <span key={i} aria-hidden="true" style={{
            position: "absolute",
            top: "top" in n ? n.top : undefined,
            bottom: "bottom" in n ? n.bottom : undefined,
            left: "left" in n ? n.left : undefined,
            right: "right" in n ? n.right : undefined,
            fontSize: n.size, color: "#F8F6F2", opacity: n.op,
            transform: `rotate(${n.rot})`, userSelect: "none", pointerEvents: "none", lineHeight: 1,
          }}>
            {n.s}
          </span>
        ))}

        <h2 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 400,
          fontSize: "clamp(2.25rem, 6vw, 3.75rem)", color: "#F8F6F2",
          lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: "0.75rem",
        }}>
          A warm place to grow<br />
          <em style={{ color: "#E4C4B4" }}>as a musician.</em>
        </h2>
        <p style={{ color: "rgba(248,246,242,0.45)", fontSize: "0.9375rem", marginBottom: "2.5rem" }}>
          Join your teacher&apos;s studio today.
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
      <div style={{ padding: "1.125rem 2rem", background: "#221F1B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,246,242,0.3)" }}>Cadenza</span>
        <span style={{ fontSize: "0.5625rem", color: "rgba(248,246,242,0.25)" }}>© {new Date().getFullYear()}</span>
      </div>

    </div>
  );
}
