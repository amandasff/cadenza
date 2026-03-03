"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { Student } from "../../lib/models/Student";
import { PlayerProvider } from "../../lib/context/PlayerContext";
import MiniPlayer from "../../components/MiniPlayer";

const tabs = [
  { href: "/student",                label: "Home" },
  { href: "/student/practice",       label: "Practice" },
  { href: "/student/pieces",         label: "Pieces" },
  { href: "/student/chat",           label: "Chat" },
  { href: "/student/rewards",        label: "Awards" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load avatar from DB on mount
  useEffect(() => {
    const student = user as Student | null;
    if (!student?.id) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", student.id)
      .single()
      .then(({ data }: { data: { avatar_url?: string | null } | null }) => {
        if (data) {
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
        }
      });
  }, [(user as Student | null)?.id]);

  // Unread chat badge
  useEffect(() => {
    const student = user as Student | null;
    if (!student?.id || !student?.studioId) return;

    if (path.startsWith("/student/chat")) {
      localStorage.setItem(`chat_last_read_${student.id}`, new Date().toISOString());
      setHasUnread(false);
      return;
    }

    const checkUnread = async () => {
      const lastRead = localStorage.getItem(`chat_last_read_${student.id}`) ?? new Date(0).toISOString();
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("messages")
        .select("id")
        .eq("studio_id", student.studioId!)
        .neq("sender_id", student.id)
        .gt("created_at", lastRead)
        .limit(1);
      setHasUnread((data?.length ?? 0) > 0);
    };

    checkUnread().catch(() => {});
    const interval = setInterval(() => checkUnread().catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, [user, path]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const student = user as Student | null;
    if (!file || !student?.id) return;
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${student.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = urlData.publicUrl + "?t=" + Date.now();
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", student.id);
      setAvatarUrl(url);
    } catch (err) {
      console.error("avatar upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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

  const avatarCircle = (size: number, fontSize: string) => (
    <>
      <label
        htmlFor="student-avatar-upload"
        className="avatar-upload-label"
        style={{
          width: size, height: size,
          background: avatarUrl ? "transparent" : "var(--charcoal)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize, fontFamily: "Inter, sans-serif", fontWeight: 600,
          color: "var(--white)", flexShrink: 0, letterSpacing: "0.02em",
          cursor: uploading ? "default" : "pointer",
          overflow: "hidden", position: "relative",
        }}
        title="Click to change photo"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={student.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          uploading ? "…" : initials
        )}
        {!uploading && (
          <span className="avatar-camera-overlay" style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size > 30 ? "0.875rem" : "0.5rem",
            opacity: 0, transition: "opacity 0.15s", borderRadius: "50%",
          }}>📷</span>
        )}
      </label>
      <input
        id="student-avatar-upload"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        style={{ display: "none" }}
      />
    </>
  );

  return (
    <PlayerProvider>
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
        <Link href="/" style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "0.875rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--charcoal)",
          textDecoration: "none",
        }}>
          Cadenza
        </Link>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {avatarCircle(28, "0.625rem")}
          <button
            onClick={toggleTheme}
            style={{
              background: "none", border: "1px solid var(--border-strong)", borderRadius: 2,
              padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.625rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
              letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={() => signOut()}
            style={{
              background: "none", border: "1px solid var(--border-strong)", borderRadius: 2,
              padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.625rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
              letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
            }}
          >
            Out
          </button>
        </div>
      </div>

      {/* ── Desktop sidebar (hidden <700px) ── */}
      <aside className="student-sidebar">
        {/* Wordmark → landing page */}
        <Link href="/" style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "0.8125rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--charcoal)",
          marginBottom: "2rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--border)",
          textDecoration: "none",
          display: "block",
        }}>
          Cadenza
        </Link>

        {/* Student profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "2rem" }}>
          {avatarCircle(36, "0.75rem")}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem",
              color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
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
            const showDot = t.href === "/student/chat" && hasUnread && !active;
            return (
              <Link key={t.href} href={t.href} style={{
                display: "flex", alignItems: "center",
                padding: "0.5rem 0.75rem",
                borderLeft: active ? "2px solid var(--charcoal)" : "2px solid transparent",
                background: active ? "var(--cream-deep)" : "transparent",
                color: active ? "var(--charcoal)" : "var(--muted)",
                fontFamily: "Inter, sans-serif", fontWeight: active ? 500 : 400,
                fontSize: "0.875rem", textDecoration: "none",
                transition: "all 0.15s", letterSpacing: "0.005em",
              }}>
                {t.label}
                {showDot && (
                  <span style={{
                    marginLeft: "auto", width: 6, height: 6,
                    borderRadius: "50%", background: "#e85d4a", flexShrink: 0,
                  }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: theme + sign out */}
        <div style={{ paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <button
            onClick={toggleTheme}
            style={{
              width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2,
              padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
              textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
            }}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={() => signOut()}
            style={{
              width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2,
              padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
              textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
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
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--white)", borderTop: "1px solid var(--border)",
        display: "flex", zIndex: 100, padding: "0.5rem 0 0.625rem",
      }}>
        {tabs.map(t => {
          const active = t.href === "/student" ? path === "/student" : path.startsWith(t.href);
          const showDot = t.href === "/student/chat" && hasUnread && !active;
          return (
            <Link key={t.href} href={t.href} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
              textDecoration: "none", padding: "0.375rem 0",
              color: active ? "var(--charcoal)" : "var(--muted)",
              transition: "color 0.15s", position: "relative",
            }}>
              {active && (
                <div style={{
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: 20, height: 1.5, background: "var(--charcoal)",
                }} />
              )}
              <span style={{
                fontSize: "0.5625rem", fontFamily: "Inter, sans-serif",
                fontWeight: active ? 600 : 400, letterSpacing: "0.07em",
                textTransform: "uppercase", marginTop: "0.125rem",
                position: "relative",
              }}>
                {t.label}
                {showDot && (
                  <span style={{
                    position: "absolute", top: -2, right: -7,
                    width: 5, height: 5, borderRadius: "50%", background: "#e85d4a",
                  }} />
                )}
              </span>
            </Link>
          );
        })}
      </nav>
      <MiniPlayer />
    </div>
    </PlayerProvider>
  );
}
