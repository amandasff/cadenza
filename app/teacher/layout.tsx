"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import { Teacher } from "../../lib/models/Teacher";

const tabs = [
  { href: "/teacher",         label: "Dashboard" },
  { href: "/teacher/goals",   label: "Goals" },
  { href: "/teacher/review",  label: "Review" },
  { href: "/teacher/chat",    label: "Chat" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "teacher") {
      router.replace("/auth/login");
      return;
    }
    const teacher = user as Teacher;
    if (!teacher.hasStudio() && path !== "/teacher/onboard") {
      router.replace("/teacher/onboard");
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

  if (!user || user.role !== "teacher") return null;

  const teacher = user as Teacher;
  const initials = teacher.displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)" }}>
      <nav style={{
        background: "var(--white)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: 0,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        {/* Wordmark */}
        <div style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "0.8125rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--charcoal)",
          padding: "1rem 1.5rem 1rem 0",
          borderRight: "1px solid var(--border)",
          marginRight: "1rem",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          Cadenza
        </div>

        {/* Tab links */}
        <div className="teacher-nav-tabs">
          {tabs.map(t => {
            const active = t.href === "/teacher" ? path === "/teacher" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} style={{
                padding: "1rem 0.875rem",
                fontFamily: "Inter, sans-serif",
                fontWeight: active ? 500 : 400,
                color: active ? "var(--charcoal)" : "var(--muted)",
                textDecoration: "none",
                fontSize: "0.875rem",
                borderBottom: active ? "1.5px solid var(--charcoal)" : "1.5px solid transparent",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
                letterSpacing: "0.005em",
              }}>
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="teacher-nav-right" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {teacher.hasStudio() && (
            <span className="teacher-nav-studio" style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.6875rem",
              color: "var(--muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              {teacher.studioName}
            </span>
          )}
          <div style={{
            width: 28,
            height: 28,
            background: "var(--charcoal)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.625rem",
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            color: "var(--white)",
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}>
            {initials}
          </div>
          <span style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            fontSize: "0.8125rem",
            color: "var(--charcoal)",
            whiteSpace: "nowrap",
          }}>
            {teacher.displayName}
          </span>
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
              marginLeft: "0.25rem",
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
            Sign out
          </button>
        </div>
      </nav>
      <main className="teacher-main">{children}</main>
    </div>
  );
}
