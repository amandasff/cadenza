"use client";
import Link from "next/link";

const features = [
  { icon: "🗺", label: "Gamified Path", desc: "A winding musical journey with goal nodes, zones, and boss challenges", color: "var(--sage-bg)", border: "var(--sage-light)" },
  { icon: "🎙", label: "Practice Sessions", desc: "Timed sessions with a built-in metronome and session notes", color: "var(--rose-bg)", border: "var(--rose-light)" },
  { icon: "💬", label: "Real-Time Chat", desc: "Direct messaging between teacher and student, with instant updates", color: "var(--sky-bg)", border: "var(--sky-light)" },
  { icon: "🔥", label: "Streaks & Levels", desc: "Daily streaks, points, and four skill levels from Beginner to Virtuoso", color: "var(--butter-bg)", border: "var(--butter-light)" },
];

const instruments = ["🎹", "🎵", "🎸", "🎺", "🥁", "🎻"];

export default function Home() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav style={{
        padding: "1rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1.5px solid var(--border)",
        background: "var(--white)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "var(--shadow-xs)",
      }}>
        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.25rem", color: "var(--charcoal)", letterSpacing: "-0.02em" }}>
          🎵 Cadenza
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link href="/auth/login" style={{
            padding: "0.5rem 1.25rem",
            borderRadius: 100,
            background: "transparent",
            color: "var(--charcoal)",
            textDecoration: "none",
            fontFamily: "Nunito, sans-serif",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "1.5px solid var(--border)",
            transition: "all 0.15s",
          }}>
            Sign In
          </Link>
          <Link href="/auth/signup" style={{
            padding: "0.5rem 1.25rem",
            borderRadius: 100,
            background: "var(--peach)",
            color: "white",
            textDecoration: "none",
            fontFamily: "Nunito, sans-serif",
            fontWeight: 700,
            fontSize: "0.875rem",
            boxShadow: "var(--shadow-peach)",
          }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 2rem 4rem", textAlign: "center" }}>

        {/* Floating instruments */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
          {instruments.map((e, i) => (
            <span
              key={i}
              style={{
                fontSize: "1.75rem",
                animation: `float ${2.8 + i * 0.25}s ease-in-out ${i * 0.18}s infinite`,
                display: "inline-block",
              }}
            >
              {e}
            </span>
          ))}
        </div>

        <h1 style={{
          fontFamily: "Nunito, sans-serif",
          fontWeight: 900,
          fontSize: "clamp(2.2rem, 5.5vw, 3.75rem)",
          color: "var(--charcoal)",
          marginBottom: "1rem",
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          maxWidth: 700,
        }}>
          Where music students<br />
          <span style={{ color: "var(--peach)" }}>love to practice.</span>
        </h1>

        <p style={{
          color: "var(--muted)",
          fontSize: "1.1rem",
          maxWidth: 500,
          marginBottom: "2.75rem",
          lineHeight: 1.65,
          fontWeight: 400,
        }}>
          Cadenza connects teachers and students between lessons — with a gamified goal path, timed practice sessions, streaks, and real-time chat.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "1.5rem" }}>
          <Link href="/auth/signup?role=teacher" style={{
            background: "var(--charcoal)",
            color: "white",
            padding: "0.95rem 2rem",
            borderRadius: 100,
            fontFamily: "Nunito, sans-serif",
            fontWeight: 800,
            fontSize: "1rem",
            textDecoration: "none",
            boxShadow: "var(--shadow-md)",
          }}>
            👩‍🏫 I&apos;m a Teacher
          </Link>
          <Link href="/auth/signup?role=student" style={{
            background: "var(--peach)",
            color: "white",
            padding: "0.95rem 2rem",
            borderRadius: 100,
            fontFamily: "Nunito, sans-serif",
            fontWeight: 800,
            fontSize: "1rem",
            textDecoration: "none",
            boxShadow: "var(--shadow-peach)",
          }}>
            🎹 I&apos;m a Student
          </Link>
        </div>

        <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "var(--peach)", fontWeight: 700, textDecoration: "none", fontFamily: "Nunito, sans-serif" }}>
            Sign in →
          </Link>
        </p>

        {/* Feature cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
          marginTop: "5rem",
          width: "100%",
          maxWidth: 780,
        }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                background: f.color,
                borderRadius: 20,
                padding: "1.5rem",
                border: `1.5px solid ${f.border}`,
                textAlign: "left",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-md)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{f.icon}</div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--charcoal)", marginBottom: "0.4rem" }}>{f.label}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ marginTop: "5rem", maxWidth: 580, width: "100%" }}>
          <h2 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.4rem", color: "var(--charcoal)", marginBottom: "1.5rem" }}>
            How it works
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { num: "1", text: "Teacher signs up and creates a studio", sub: "Gets a unique invite code to share with students" },
              { num: "2", text: "Students join with the invite code", sub: "Immediately connected to their teacher's studio" },
              { num: "3", text: "Teacher builds a goal path for each student", sub: "Technique, Repertoire, Ear Training, and Theory goals" },
              { num: "4", text: "Students practice, earn points, build streaks", sub: "Chat with teacher, get feedback, level up" },
            ].map(step => (
              <div key={step.num} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "var(--white)", borderRadius: 16, padding: "1rem 1.25rem", border: "1.5px solid var(--border)", textAlign: "left" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "var(--peach)",
                  color: "white", fontFamily: "Nunito, sans-serif", fontWeight: 800,
                  fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "var(--charcoal)" }}>{step.text}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.1rem" }}>{step.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "4rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/auth/signup" style={{
            background: "var(--peach)",
            color: "white",
            padding: "1rem 2.25rem",
            borderRadius: 100,
            fontFamily: "Nunito, sans-serif",
            fontWeight: 800,
            fontSize: "1.05rem",
            textDecoration: "none",
            boxShadow: "var(--shadow-peach)",
          }}>
            Start for free →
          </Link>
        </div>

        <p style={{ marginTop: "2rem", fontSize: "0.78rem", color: "var(--border-strong)" }}>
          Free during beta · No credit card required
        </p>
      </div>
    </div>
  );
}
