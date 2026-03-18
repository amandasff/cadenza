"use client";
import React from "react";
import { Flame } from "lucide-react";

const STUDENTS = [
  { name: "Emma Chen",     initials: "EC", streak: 12, points: 3240, goals: 3, total: 4 },
  { name: "Oliver Park",   initials: "OP", streak: 5,  points: 1180, goals: 1, total: 3 },
  { name: "Lily Johnson",  initials: "LJ", streak: 21, points: 5620, goals: 4, total: 4 },
  { name: "Kai Patel",     initials: "KP", streak: 0,  points: 420,  goals: 0, total: 2 },
];

const SESSIONS = [
  { name: "Emma Chen",    initials: "EC", mins: 45, ago: "2h ago",   dot: true },
  { name: "Lily Johnson", initials: "LJ", mins: 32, ago: "3h ago",   dot: true },
  { name: "Oliver Park",  initials: "OP", mins: 20, ago: "yesterday", dot: false },
];

const NAV = ["Students", "Schedule", "Billing", "Goals", "Review", "Chat", "Inspire"];

export default function TeacherHomeDemo() {
  return (
    <div
      className="student-shell"
      style={{ background: "var(--cream)", pointerEvents: "none", userSelect: "none", position: "absolute", inset: 0 }}
    >
      {/* Mobile header */}
      <div className="student-mobile-header" style={{
        background: "var(--white)", borderBottom: "1px solid var(--border)",
        padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--charcoal)" }}>Cadenza</span>
        <div style={{ width: 28, height: 28, background: "var(--charcoal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.5625rem", color: "var(--white)" }}>MR</div>
      </div>

      {/* Sidebar */}
      <aside className="student-sidebar">
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)", marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)", display: "block" }}>
          Cadenza
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
          <div style={{ width: 36, height: 36, background: "var(--charcoal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--white)", flexShrink: 0 }}>MR</div>
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>Ms. Rivera</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", marginTop: "0.125rem" }}>Rivera Music Studio</div>
          </div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
          {NAV.map((label, i) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", padding: "0.5rem 0.75rem",
              borderLeft: i === 0 ? "2px solid var(--charcoal)" : "2px solid transparent",
              background: i === 0 ? "var(--cream-deep)" : "transparent",
              color: i === 0 ? "var(--charcoal)" : "var(--muted)",
              fontFamily: "Inter, sans-serif", fontWeight: i === 0 ? 500 : 400, fontSize: "0.875rem",
            }}>
              {label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="student-scroll-area">
        <main className="teacher-main">
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

            {/* Greeting */}
            <div>
              <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "2rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                Good evening, Ms. Rivera.
              </h1>
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: "0.5rem", fontFamily: "Inter, sans-serif" }}>
                4 students · 8 goals completed
              </p>
            </div>

            {/* Invite */}
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Invite Students</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.5rem 0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  cadenza.app/student/join?code=RIVERA
                </div>
                <div style={{ background: "var(--charcoal)", color: "var(--white)", borderRadius: 4, padding: "0.5rem 1rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, flexShrink: 0 }}>Copy link</div>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {[["Create goal", true], ["Review sessions", false], ["Open chat", false]].map(([label, primary]) => (
                <div key={String(label)} style={{ padding: "0.5rem 1rem", borderRadius: 3, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", background: primary ? "var(--charcoal)" : "var(--white)", color: primary ? "var(--white)" : "var(--charcoal)", border: primary ? "none" : "1px solid var(--border)" }}>
                  {String(label)}
                </div>
              ))}
            </div>

            {/* Two-col */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "2rem" }}>
              {/* Students */}
              <div>
                <div style={{ marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Students (4)</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  {STUDENTS.map(s => (
                    <div key={s.name} className="card-base" style={{ padding: "1.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                        <div style={{ width: 36, height: 36, background: "var(--charcoal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem", color: "var(--white)", flexShrink: 0 }}>{s.initials}</div>
                        <div>
                          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>{s.name}</div>
                          <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.125rem" }}>{s.total} goals</div>
                        </div>
                      </div>
                      {s.total > 0 && (
                        <div style={{ marginBottom: "0.875rem" }}>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.round((s.goals / s.total) * 100)}%` }} />
                          </div>
                          <div style={{ fontSize: "0.625rem", color: "var(--muted)", marginTop: "0.375rem", fontFamily: "Inter, sans-serif" }}>{s.goals} / {s.total} complete</div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <div style={{ flex: 1, background: s.streak > 0 ? "var(--peach-bg)" : "var(--cream)", borderRadius: 2, padding: "0.375rem 0.5rem", textAlign: "center", border: `1px solid ${s.streak > 0 ? "var(--peach-light)" : "var(--border)"}` }}>
                          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem" }}>
                            {s.streak > 0 && <Flame size={14} fill="#E6A817" color="#E6A817" strokeWidth={0} />}
                            {s.streak}
                          </div>
                          <div style={{ fontSize: "0.5625rem", color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "0.125rem" }}>day streak</div>
                        </div>
                        <div style={{ flex: 1, background: "var(--cream)", borderRadius: 2, padding: "0.375rem 0.5rem", textAlign: "center", border: "1px solid var(--border)" }}>
                          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>{s.points.toLocaleString()}</div>
                          <div style={{ fontSize: "0.5625rem", color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "0.125rem" }}>points</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div style={{ background: "var(--white)", borderRadius: 4, border: "1px solid var(--border)", padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent Activity</span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)" }}>All →</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {SESSIONS.map(s => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0.625rem", borderRadius: 3 }}>
                      <div style={{ width: 26, height: 26, background: "var(--charcoal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.5625rem", color: "var(--white)", flexShrink: 0 }}>{s.initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>{s.name}</div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.125rem" }}>{s.mins} min · {s.ago}</div>
                      </div>
                      {s.dot && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--peach)", flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
