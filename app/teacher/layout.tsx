"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { Teacher } from "../../lib/models/Teacher";

const tabs = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/goals", label: "Goals" },
  { href: "/teacher/chat", label: "Chat" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

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
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎵</div>
          <p style={{ fontFamily: "Nunito, sans-serif", color: "var(--muted)", fontSize: "0.9rem" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "teacher") return null;

  const teacher = user as Teacher;
  const initials = teacher.displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)" }}>
      <nav style={{
        background: "var(--white)",
        borderBottom: "1.5px solid var(--border)",
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: 0,
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "var(--shadow-xs)",
      }}>
        <div style={{
          fontFamily: "Nunito, sans-serif",
          fontWeight: 800,
          fontSize: "1.05rem",
          color: "var(--charcoal)",
          padding: "0.875rem 2rem 0.875rem 0",
          borderRight: "1.5px solid var(--border)",
          marginRight: "1rem",
        }}>
          🎵 Cadenza
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(t => {
            const active = t.href === "/teacher" ? path === "/teacher" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} style={{
                padding: "1rem 0.875rem",
                fontFamily: "Nunito, sans-serif",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--peach)" : "var(--muted)",
                textDecoration: "none",
                fontSize: "0.875rem",
                borderBottom: active ? "2.5px solid var(--peach)" : "2.5px solid transparent",
                transition: "all 0.15s",
              }}>
                {t.label}
              </Link>
            );
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {teacher.hasStudio() && (
            <span style={{
              fontFamily: "Nunito, sans-serif",
              fontSize: "0.75rem",
              color: "var(--muted)",
              background: "var(--cream-deep)",
              padding: "0.2rem 0.6rem",
              borderRadius: "999px",
            }}>
              {teacher.studioName}
            </span>
          )}
          <div style={{
            width: 32,
            height: 32,
            background: "var(--peach)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontFamily: "Nunito, sans-serif",
            fontWeight: 700,
            color: "white",
          }}>
            {initials}
          </div>
          <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--charcoal)" }}>
            {teacher.displayName}
          </span>
        </div>
      </nav>
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "2rem 1.5rem" }}>{children}</main>
    </div>
  );
}
