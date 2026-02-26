"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load avatar from DB on mount
  useEffect(() => {
    const teacher = user as Teacher | null;
    if (!teacher?.id) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", teacher.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const row = data as { avatar_url?: string | null };
          if (row.avatar_url) setAvatarUrl(row.avatar_url);
        }
      });
  }, [(user as Teacher | null)?.id]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const teacher = user as Teacher | null;
    if (!file || !teacher?.id) return;
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${teacher.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const url = urlData.publicUrl + "?t=" + Date.now();
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", teacher.id);
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
        {/* Wordmark → landing page */}
        <Link href="/" style={{
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
          textDecoration: "none",
        }}>
          Cadenza
        </Link>

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

        {/* Right side: studio name + avatar + name + theme (hidden on mobile) */}
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

          {/* Clickable avatar */}
          <label
            htmlFor="teacher-avatar-upload"
            style={{
              width: 28, height: 28,
              background: avatarUrl ? "transparent" : "var(--charcoal)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 600,
              color: "var(--white)", flexShrink: 0, letterSpacing: "0.02em",
              cursor: uploading ? "default" : "pointer",
              overflow: "hidden",
            }}
            title="Click to change photo"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={teacher.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              uploading ? "…" : initials
            )}
          </label>
          <input
            id="teacher-avatar-upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: "none" }}
          />

          <span style={{
            fontFamily: "Inter, sans-serif", fontWeight: 500,
            fontSize: "0.8125rem", color: "var(--charcoal)", whiteSpace: "nowrap",
          }}>
            {teacher.displayName}
          </span>

          <button
            onClick={toggleTheme}
            style={{
              background: "none", border: "1px solid var(--border-strong)", borderRadius: 2,
              padding: "0.25rem 0.625rem", cursor: "pointer", fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
              letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
              marginLeft: "0.25rem",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        {/* Sign out — outside teacher-nav-right so it's always visible on all screen sizes */}
        <button
          onClick={() => signOut()}
          style={{
            flexShrink: 0,
            marginLeft: "0.75rem",
            background: "none", border: "1px solid var(--border-strong)", borderRadius: 2,
            padding: "0.25rem 0.625rem", cursor: "pointer", fontSize: "0.6875rem",
            fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
            letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
          }}
        >
          Sign out
        </button>
      </nav>
      <main className="teacher-main">{children}</main>
    </div>
  );
}
