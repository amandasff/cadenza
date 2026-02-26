"use client";
import Link from "next/link";

const features = [
  { label: "Structured Goal Path", desc: "A teacher-curated sequence of technique, repertoire, ear training, and theory goals — each unlocked in order." },
  { label: "Timed Practice Sessions", desc: "Built-in timer, metronome, and audio recording. Sessions are automatically shared with the teacher." },
  { label: "Direct Messaging", desc: "Real-time private chat and studio-wide announcements between teacher and students." },
  { label: "Progress Tracking", desc: "Daily practice streaks, points, level progression, and a portfolio of recorded performances." },
];

const steps = [
  { num: "01", text: "Teacher creates a studio", sub: "Gets a unique invite code" },
  { num: "02", text: "Students join with the code", sub: "Instantly connected to their teacher" },
  { num: "03", text: "Teacher builds personalised goal paths", sub: "Across four practice areas" },
  { num: "04", text: "Students practice, earn points, and improve", sub: "With ongoing feedback via chat" },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav style={{ padding: "0 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", height: 56, borderBottom: "1px solid var(--border)", background: "var(--white)", position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)" }}>
          Cadenza
        </span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href="/auth/login" style={{ padding: "0.4rem 1rem", borderRadius: 2, background: "transparent", color: "var(--charcoal)", textDecoration: "none", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", border: "1px solid var(--border-strong)", transition: "all 0.15s" }}>
            Sign In
          </Link>
          <Link href="/auth/signup" style={{ padding: "0.4rem 1rem", borderRadius: 2, background: "var(--charcoal)", color: "white", textDecoration: "none", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem" }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "6rem 2rem 5rem", maxWidth: 760, margin: "0 auto", width: "100%" }}>

        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "1.5rem", textAlign: "center" }}>
          Professional music education
        </div>

        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "clamp(2.5rem, 7vw, 4.5rem)", color: "var(--charcoal)", marginBottom: "1.5rem", lineHeight: 1.05, letterSpacing: "-0.015em", textAlign: "center" }}>
          The platform that connects<br />
          teachers and students<br />
          <em style={{ color: "var(--peach)" }}>between lessons.</em>
        </h1>

        <p style={{ color: "var(--muted)", fontSize: "1rem", maxWidth: 480, marginBottom: "3rem", lineHeight: 1.7, fontFamily: "Inter, sans-serif", fontWeight: 400, textAlign: "center" }}>
          Cadenza gives music teachers a structured way to set goals, review practice sessions, and stay in touch with students.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "1rem" }}>
          <Link href="/auth/signup?role=teacher" style={{ background: "var(--charcoal)", color: "white", padding: "0.875rem 2rem", borderRadius: 3, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none", letterSpacing: "0.01em" }}>
            For Teachers
          </Link>
          <Link href="/auth/signup?role=student" style={{ background: "transparent", color: "var(--charcoal)", padding: "0.875rem 2rem", borderRadius: 3, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none", border: "1px solid var(--border-strong)", letterSpacing: "0.01em" }}>
            For Students
          </Link>
        </div>

        <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.02em", textAlign: "center" }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "var(--charcoal)", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" }}>Sign in</Link>
        </p>

        <div style={{ width: "100%", maxWidth: 600, height: 1, background: "var(--border)", margin: "5rem auto 0" }} />

        {/* Features */}
        <div style={{ width: "100%", maxWidth: 720, marginTop: "4rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "2.5rem", textAlign: "left" }}>
            What&apos;s included
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", textAlign: "left" }}>
            {features.map((f, i) => (
              <div key={i} style={{ padding: "1.75rem 2rem", borderTop: "1px solid var(--border)", borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.5rem", letterSpacing: "-0.005em" }}>{f.label}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, fontFamily: "Inter, sans-serif" }}>{f.desc}</div>
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1", height: 1, background: "var(--border)" }} />
          </div>
        </div>

        {/* How it works */}
        <div style={{ width: "100%", maxWidth: 560, marginTop: "5rem", textAlign: "left" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "2.5rem" }}>
            How it works
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {steps.map((step, i) => (
              <div key={step.num} style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", padding: "1.25rem 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "0.6875rem", color: "var(--muted)", letterSpacing: "0.04em", marginTop: "0.1rem", flexShrink: 0, minWidth: 24 }}>{step.num}</div>
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.2rem" }}>{step.text}</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>{step.sub}</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--border)" }} />
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ marginTop: "5rem", textAlign: "center" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: "var(--charcoal)", marginBottom: "1.5rem", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            Built for serious teachers<br />and ambitious students.
          </h2>
          <Link href="/auth/signup" style={{ background: "var(--charcoal)", color: "white", padding: "0.875rem 2.25rem", borderRadius: 3, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", textDecoration: "none", letterSpacing: "0.01em", display: "inline-block" }}>
            Start for free
          </Link>
          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.02em" }}>
            Free during beta · No credit card required
          </p>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>Cadenza</span>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
