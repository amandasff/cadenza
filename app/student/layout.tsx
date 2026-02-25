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

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", maxWidth: 430, margin: "0 auto", position: "relative" }}>
      {/* Top header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
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
            title={theme === "game" ? "Switch to Elegant mode" : "Switch to Game mode"}
            style={{
              background: "none",
              border: "1.5px solid var(--border)",
              borderRadius: theme === "elegant" ? 2 : 100,
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
            {theme === "game" ? "✦ Elegant" : "◈ Game"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>{children}</div>

      <nav style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
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
