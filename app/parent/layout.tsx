"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import LanguageSwitcher from "../../components/LanguageSwitcher";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth/login"); return; }
    if (user.role !== "parent") {
      // Redirect to their actual home
      if (user.role === "teacher") router.replace("/teacher");
      else router.replace("/student");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "parent") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)" }}>
        <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.8125rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>Loading</p>
      </div>
    );
  }

  return (
    <div className="student-shell">
      {/* Mobile header */}
      <div className="student-mobile-header" style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--charcoal)" }}>
          Cadenza
        </span>
        <button onClick={() => signOut()} style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: 2, padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Out
        </button>
      </div>

      {/* Sidebar */}
      <aside className="student-sidebar">
        <Link href="/" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)", marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)", textDecoration: "none", display: "block" }}>
          Cadenza
        </Link>

        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.25rem" }}>
          Parent Portal
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2rem" }}>
          {user.displayName}
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
          {[{ href: "/parent", label: "My Children" }].map(t => {
            const active = path === t.href;
            return (
              <Link key={t.href} href={t.href} style={{ display: "flex", alignItems: "center", padding: "0.5rem 0.75rem", borderLeft: active ? "2px solid var(--charcoal)" : "2px solid transparent", background: active ? "var(--cream-deep)" : "transparent", color: active ? "var(--charcoal)" : "var(--muted)", fontFamily: "Inter, sans-serif", fontWeight: active ? 500 : 400, fontSize: "0.875rem", textDecoration: "none", transition: "all 0.15s" }}>
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <button onClick={toggleTheme} style={{ width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem", fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)", textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {theme === "light" ? "Light mode" : theme === "dark" ? "Dark mode" : "🎨 Fun mode"}
          </button>
          <LanguageSwitcher />
          <button onClick={() => signOut()} style={{ width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem", fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)", textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="student-scroll-area">
        <main className="teacher-main">{children}</main>
      </div>
    </div>
  );
}
