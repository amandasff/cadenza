"use client";
import React from "react";
import { Flame, Circle, Music, BookOpen, Brain, Headphones, Home, Star } from "lucide-react";

const GOALS = [
  { area: "technique",    color: "var(--sage)",     label: "Technique",    title: "Scales in G major – hands together",   done: true },
  { area: "repertoire",   color: "var(--rose)",     label: "Repertoire",   title: "Moonlight Sonata – first page",        done: false },
  { area: "ear_training", color: "var(--lavender)", label: "Ear Training", title: "Identify major vs minor chords",       done: false },
  { area: "theory",       color: "var(--butter)",   label: "Theory",       title: "Write a 4-bar melody in C major",      done: false },
];

const AREA_ICONS: Record<string, React.ReactNode> = {
  technique:    <Music size={13} strokeWidth={1.5} />,
  repertoire:   <BookOpen size={13} strokeWidth={1.5} />,
  ear_training: <Headphones size={13} strokeWidth={1.5} />,
  theory:       <Brain size={13} strokeWidth={1.5} />,
};

const NAV_ITEMS = [
  { label: "Home", active: true },
  { label: "Practice", active: false },
  { label: "Pieces", active: false },
  { label: "Journal", active: false },
  { label: "More", active: false },
];

export default function StudentHomeDemo() {
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "var(--peach-bg)", borderRadius: 99, padding: "0.2rem 0.5rem", border: "1px solid var(--peach-light)" }}>
            <Flame size={12} fill="#E6A817" color="#E6A817" strokeWidth={0} />
            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem", color: "var(--charcoal)" }}>12</span>
          </div>
          <div style={{ width: 28, height: 28, background: "var(--charcoal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.5625rem", color: "var(--white)" }}>EC</div>
        </div>
      </div>

      {/* Sidebar (desktop) */}
      <aside className="student-sidebar">
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)", marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)", display: "block" }}>Cadenza</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.5rem" }}>
          <div style={{ width: 36, height: 36, background: "var(--charcoal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--white)", flexShrink: 0 }}>EC</div>
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>Emma Chen</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.125rem" }}>
              <Flame size={11} fill="#E6A817" color="#E6A817" strokeWidth={0} />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>12 day streak</span>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
          {["Home", "Practice", "Pieces", "Tuner", "Journal", "Composers", "Rewards"].map((label, i) => (
            <div key={label} style={{
              padding: "0.5rem 0.75rem",
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

      {/* Scroll area */}
      <div className="student-scroll-area">
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "1.5rem 1.25rem 5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Greeting + streak hero */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.625rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
                Good evening,<br />Emma.
              </h1>
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: "0.5rem", fontFamily: "Inter, sans-serif" }}>
                Rivera Music Studio
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
              <div style={{ background: "var(--peach-bg)", border: "1px solid var(--peach-light)", borderRadius: 8, padding: "0.5rem 0.75rem", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "center" }}>
                  <Flame size={18} fill="#E6A817" color="#E6A817" strokeWidth={0} />
                  <span style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.625rem", color: "var(--charcoal)", lineHeight: 1 }}>12</span>
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "0.25rem" }}>day streak</div>
              </div>
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.375rem 0.625rem", textAlign: "center" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>3,240</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>points</div>
              </div>
            </div>
          </div>

          {/* Practice button */}
          <div style={{ background: "var(--charcoal)", borderRadius: 10, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#E05252", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 0 6px rgba(224,82,82,0.2)" }}>
              <Circle size={20} fill="white" strokeWidth={0} />
            </div>
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--cream)" }}>Start practicing</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "rgba(248,246,242,0.5)", marginTop: "0.125rem" }}>Tap to record your session</div>
            </div>
          </div>

          {/* Goals */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem 0.75rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>This week's goals</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>1/4 done</span>
            </div>
            {GOALS.map((g, i) => (
              <div key={g.area} style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", padding: "0.875rem 1.25rem", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${g.done ? "var(--sage)" : "var(--border-strong)"}`, background: g.done ? "var(--sage)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "0.1rem" }}>
                  {g.done && <span style={{ color: "white", fontSize: "0.6rem", fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: g.color, borderRadius: 3, padding: "0.1rem 0.4rem", fontSize: "0.5rem", fontFamily: "Inter, sans-serif", fontWeight: 600, color: "var(--charcoal)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {AREA_ICONS[g.area]} {g.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: g.done ? "var(--muted)" : "var(--charcoal)", textDecoration: g.done ? "line-through" : "none" }}>{g.title}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Collectibles preview */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Composer Collection</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>2/10</span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {/* Bach — unlocked */}
              <div style={{ flex: "0 0 90px", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                <div style={{ width: "100%", aspectRatio: "1", overflow: "hidden" }}>
                  <img src="/composers/bach.png" alt="Bach" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ padding: "0.375rem 0.5rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.625rem", color: "var(--charcoal)" }}>Bach</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", marginTop: "0.1rem" }}>Baroque · Common</div>
                </div>
                <div style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#7DB88A" }} />
              </div>
              {/* Beethoven — locked */}
              <div style={{ flex: "0 0 90px", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                <div style={{ width: "100%", aspectRatio: "1", overflow: "hidden", position: "relative" }}>
                  <img src="/composers/beethoven.png" alt="Beethoven" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.15) blur(1px)" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.25rem" }}>🔒</span>
                  </div>
                </div>
                <div style={{ padding: "0.375rem 0.5rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.625rem", color: "var(--muted)" }}>???</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", marginTop: "0.1rem" }}>Romantic · Rare</div>
                </div>
                <div style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#E07355" }} />
              </div>
              {/* Mozart — locked */}
              <div style={{ flex: "0 0 90px", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                <div style={{ width: "100%", aspectRatio: "1", overflow: "hidden", position: "relative" }}>
                  <img src="/composers/mozart.png" alt="Mozart" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.15) blur(1px)" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.25rem" }}>🔒</span>
                  </div>
                </div>
                <div style={{ padding: "0.375rem 0.5rem" }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.625rem", color: "var(--muted)" }}>???</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", marginTop: "0.1rem" }}>Classical · Common</div>
                </div>
                <div style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#7DB88A" }} />
              </div>
              {/* +7 more */}
              <div style={{ flex: "0 0 90px", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: "var(--muted)" }}>+7</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>more</div>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming lesson */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div style={{ width: 36, height: 36, background: "var(--sage)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Star size={16} strokeWidth={1.5} color="var(--charcoal)" />
            </div>
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>Lesson tomorrow at 4:00 PM</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>with Ms. Rivera · 45 min</div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <div className="student-bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
        background: "var(--white)", borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", zIndex: 100,
      }}>
        {NAV_ITEMS.map((item) => (
          <div key={item.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.2rem" }}>
            <Home size={20} strokeWidth={1.5} color={item.active ? "var(--charcoal)" : "var(--muted)"} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: item.active ? 600 : 400, color: item.active ? "var(--charcoal)" : "var(--muted)", letterSpacing: "0.03em" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
