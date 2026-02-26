"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import { Student } from "../../lib/models/Student";

const tabs = [
  { href: "/student",          label: "Path" },
  { href: "/student/practice", label: "Practice" },
  { href: "/student/chat",     label: "Chat" },
  { href: "/student/journey",  label: "Journey" },
  { href: "/student/rewards",  label: "Awards" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
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
          <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.8125rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>Loading</p>
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
        borderBottom: "1px solid var(--border)",
        padding: "0.75rem 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "0.875rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--charcoal)",
        }}>
          Cadenza
        </span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className="streak-pill">{student.streakDays}d</span>
          <span className="points-pill">{student.totalPoints.toLocaleString()}</span>
          <button
            onClick={toggleTheme}
            style={{
              background: "none",
              border: "1px solid var(--border-strong)",
              borderRadius: 2,
              padding: "0.25rem 0.625rem",
              cursor: "pointer",
              fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              color: "var(--muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={() => signOut()}
            style={{
              background: "none",
              border: "1px solid var(--border-strong)",
              borderRadius: 2,
              padding: "0.25rem 0.625rem",
              cursor: "pointer",
              fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              color: "var(--muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
          >
            Out
          </button>
        </div>
      </div>

      {/* ── Desktop sidebar (hidden <700px) ── */}
      <aside className="student-sidebar">
        {/* Wordmark */}
        <div style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "0.8125rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--charcoal)",
          marginBottom: "2rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--border)",
        }}>
          Cadenza
        </div>

        {/* Student profile */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginBottom: "2rem",
        }}>
          <div style={{
            width: 32,
            height: 32,
            background: "var(--charcoal)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.6875rem",
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            color: "var(--white)",
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: "0.8125rem",
              color: "var(--charcoal)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {student.displayName}
            </div>
            <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
              <span className="streak-pill">{student.streakDays}d</span>
              <span className="points-pill">{student.totalPoints.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
          {tabs.map(t => {
            const active = t.href === "/student" ? path === "/student" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} style={{
                display: "flex",
                alignItems: "center",
                padding: "0.5rem 0.75rem",
                borderLeft: active ? "2px solid var(--charcoal)" : "2px solid transparent",
                background: active ? "var(--cream-deep)" : "transparent",
                color: active ? "var(--charcoal)" : "var(--muted)",
                fontFamily: "Inter, sans-serif",
                fontWeight: active ? 500 : 400,
                fontSize: "0.875rem",
                textDecoration: "none",
                transition: "all 0.15s",
                letterSpacing: "0.005em",
              }}>
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle + logout */}
        <div style={{ paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <button
            onClick={toggleTheme}
            style={{
              width: "100%",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 2,
              padding: "0.4rem 0.75rem",
              cursor: "pointer",
              fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              color: "var(--muted)",
              textAlign: "left",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={() => signOut()}
            style={{
              width: "100%",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 2,
              padding: "0.4rem 0.75rem",
              cursor: "pointer",
              fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              color: "var(--muted)",
              textAlign: "left",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
          >
            Sign out
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
        borderTop: "1px solid var(--border)",
        display: "flex",
        zIndex: 100,
        padding: "0.5rem 0 0.625rem",
      }}>
        {tabs.map(t => {
          const active = t.href === "/student" ? path === "/student" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              textDecoration: "none",
              padding: "0.375rem 0",
              color: active ? "var(--charcoal)" : "var(--muted)",
              transition: "color 0.15s",
              position: "relative",
            }}>
              {active && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 20,
                  height: 1.5,
                  background: "var(--charcoal)",
                }} />
              )}
              <span style={{
                fontSize: "0.5625rem",
                fontFamily: "Inter, sans-serif",
                fontWeight: active ? 600 : 400,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginTop: "0.125rem",
              }}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
