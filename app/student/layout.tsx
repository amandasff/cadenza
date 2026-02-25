"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import { Student } from "../../lib/models/Student";

const tabs = [
  { href: "/student", label: "Path", icon: "🗺" },
  { href: "/student/practice", label: "Record", icon: "🎙" },
  { href: "/student/chat", label: "Chat", icon: "💬" },
  { href: "/student/journey", label: "Journey", icon: "🎼" },
  { href: "/student/rewards", label: "Stars", icon: "⭐" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "student") {
      router.replace("/auth/login");
      return;
    }
    const student = user as Student;
    if (!student.studioId && path !== "/student/join") {
      router.replace("/student/join");
    }
  }, [user, loading, path, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎵</div>
          <p style={{ fontFamily: "Nunito, sans-serif", color: "var(--muted)", fontSize: "0.9rem" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "student") return null;

  const student = user as Student;
  const initials = student.displayName
    .split(" ")
    .map((w: string) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="student-shell">

      {/* ── Mobile header (hidden ≥700px) ── */}
      <div className="student-mobile-header" style={{
        background: "var(--white)",
        borderBottom: "1.5px solid var(--border)",
        padding: "0.6rem 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "var(--shadow-xs)",
      }}>
        <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--charcoal)" }}>
          🎵 Cadenza
        </span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className="streak-pill">🔥 {student.streakDays}d</span>
          <span className="points-pill">⭐ {student.totalPoints.toLocaleString()}</span>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
            style={{
              background: "none",
              border: "1.5px solid var(--border)",
              borderRadius: 100,
              padding: "0.2rem 0.5rem",
              cursor: "pointer",
              fontSize: "0.7rem",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              color: "var(--muted)",
              lineHeight: 1.4,
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </div>

      {/* ── Desktop sidebar (hidden <700px) ── */}
      <aside className="student-sidebar">
        {/* Logo */}
        <div style={{
          fontFamily: "Nunito, sans-serif",
          fontWeight: 800,
          fontSize: "1rem",
          color: "var(--charcoal)",
          marginBottom: "1.5rem",
          paddingBottom: "1rem",
          borderBottom: "1.5px solid var(--border)",
        }}>
          🎵 Cadenza
        </div>

        {/* Student avatar + stats */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "1.25rem",
          padding: "0.625rem 0.75rem",
          background: "var(--cream)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{
            width: 34,
            height: 34,
            background: "var(--peach)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontFamily: "Nunito, sans-serif",
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              fontSize: "0.8rem",
              color: "var(--charcoal)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {student.displayName}
            </div>
            <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
              <span className="streak-pill" style={{ fontSize: "0.6rem" }}>🔥 {student.streakDays}d</span>
              <span className="points-pill" style={{ fontSize: "0.6rem" }}>⭐ {student.totalPoints.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          {tabs.map(t => {
            const active = t.href === "/student" ? path === "/student" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-md)",
                background: active ? "var(--peach-bg)" : "transparent",
                color: active ? "var(--peach)" : "var(--muted)",
                fontFamily: "Nunito, sans-serif",
                fontWeight: active ? 700 : 500,
                fontSize: "0.875rem",
                textDecoration: "none",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: "1rem", lineHeight: 1 }}>{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle at bottom */}
        <div style={{ paddingTop: "1rem", borderTop: "1.5px solid var(--border)" }}>
          <button
            onClick={toggleTheme}
            style={{
              width: "100%",
              background: "none",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "0.45rem 0.75rem",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              color: "var(--muted)",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "all 0.15s",
            }}
          >
            {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
          </button>
        </div>
      </aside>

      {/* ── Scrollable content area ── */}
      <div className="student-scroll-area">
        {children}
      </div>

      {/* ── Mobile bottom nav (hidden ≥700px via CSS) ── */}
      <nav className="student-bottom-nav" style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--white)",
        borderTop: "1.5px solid var(--border)",
        display: "flex",
        zIndex: 100,
        padding: "0.5rem 0 0.75rem",
      }}>
        {tabs.map(t => {
          const active = t.href === "/student" ? path === "/student" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              textDecoration: "none",
              padding: "0.35rem 0",
              color: active ? "var(--peach)" : "var(--muted)",
              transition: "color 0.15s",
            }}>
              <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: "0.6rem", fontFamily: "Nunito, sans-serif", fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
