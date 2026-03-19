"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { Teacher } from "../../lib/models/Teacher";
import { RecordingProvider } from "../../lib/context/RecordingContext";
import RecordingIndicator from "../../components/RecordingIndicator";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { useI18n } from "../../lib/context/I18nContext";
import { Camera, Palette, X } from "lucide-react";
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  const studioTabs = [
    { href: "/teacher",              label: t.nav.students },
    { href: "/teacher/schedule",     label: t.nav.schedule },
    { href: "/teacher/billing",      label: t.nav.billing },
    { href: "/teacher/review",       label: t.nav.review },
    { href: "/teacher/chat",         label: t.nav.chat },
    { href: "/teacher/inspirations", label: t.nav.inspire },
  ];

  const practiceTabs = [
    { href: "/student/practice",   label: t.nav.practice },
    { href: "/student/journey",    label: t.nav.profile },
    { href: "/student/studio",     label: "Studio" },
    { href: "/student/store",      label: "Shop" },
    { href: "/student/collection", label: "Composers" },
    { href: "/student/theory",     label: t.nav.games },
    { href: "/student/ai-tutor",   label: t.nav.ai },
    { href: "/student/discover",   label: t.nav.discover },
    { href: "/student/pieces",     label: t.nav.pieces },
    { href: "/student/rewards",    label: t.nav.awards },
  ];

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Mobile: 4 primary tabs, everything else in the "More" sheet
  const primaryMobileTabs = [
    { href: "/teacher",          label: t.nav.students },
    { href: "/teacher/schedule", label: t.nav.schedule },
    { href: "/student/practice", label: t.nav.practice },
    { href: "/student/journey",  label: t.nav.profile },
  ];
  const moreMobileStudioTabs = [
    { href: "/teacher/schedule",     label: t.nav.schedule },
    { href: "/teacher/billing",      label: t.nav.billing },
    { href: "/teacher/review",       label: t.nav.review },
    { href: "/teacher/chat",         label: t.nav.chat },
    { href: "/teacher/inspirations", label: t.nav.inspire },
  ];
  const moreMobilePracticeTabs = [
    { href: "/student/studio",     label: "Studio" },
    { href: "/student/store",      label: "Shop" },
    { href: "/student/collection", label: "Composers" },
    { href: "/student/theory",     label: t.nav.games },
    { href: "/student/ai-tutor",   label: t.nav.ai },
    { href: "/student/discover",   label: t.nav.discover },
    { href: "/student/pieces",     label: t.nav.pieces },
    { href: "/student/rewards",    label: t.nav.awards },
  ];
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
      .then(({ data }: { data: { avatar_url?: string | null } | null }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [(user as Teacher | null)?.id]);

  // Unread chat badge — uses Supabase realtime instead of polling
  useEffect(() => {
    const teacher = user as Teacher | null;
    if (!teacher?.id || !teacher?.studioId) return;

    if (path.startsWith("/teacher/chat")) {
      localStorage.setItem(`chat_last_read_${teacher.id}`, new Date().toISOString());
      setHasUnread(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Initial check on mount
    const lastRead = localStorage.getItem(`chat_last_read_${teacher.id}`) ?? new Date(0).toISOString();
    supabase
      .from("messages")
      .select("id")
      .eq("studio_id", teacher.studioId!)
      .neq("sender_id", teacher.id)
      .gt("created_at", lastRead)
      .limit(1)
      .then(({ data }: { data: { id: string }[] | null }) => setHasUnread((data?.length ?? 0) > 0))
      .catch(() => {});

    // Realtime subscription — badge updates instantly on new message
    const channel = supabase
      .channel(`teacher-unread-${teacher.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `studio_id=eq.${teacher.studioId}`,
        },
        (payload: { new: { sender_id?: string } }) => {
          const msg = payload.new as { sender_id?: string };
          if (msg.sender_id !== teacher.id) setHasUnread(true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, path]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const teacher = user as Teacher | null;
    if (!file || !teacher?.id) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${teacher.id}/avatar.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const url = urlData.publicUrl + "?t=" + Date.now();
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", teacher.id);
      if (updateError) throw updateError;
      setAvatarUrl(url);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "Upload failed";
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await fetch("/api/account/delete", { method: "DELETE" });
      await signOut();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)" }}>
        <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.8125rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.common.loading}</p>
      </div>
    );
  }

  if (!user || user.role !== "teacher") return null;

  const teacher = user as Teacher;
  const initials = teacher.displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

  const avatarCircle = (size: number, fontSize: string) => (
    <>
      <label
        htmlFor="teacher-avatar-upload"
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
        title={t.teacher.photoTooltip}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={teacher.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          uploading ? "…" : initials
        )}
        {!uploading && (
          <span className="avatar-camera-overlay" style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size > 30 ? "0.875rem" : "0.5rem",
            opacity: 0, transition: "opacity 0.15s", borderRadius: "50%",
          }}><Camera size={14} strokeWidth={1.5} /></span>
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
    </>
  );

  return (
    <RecordingProvider>
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
          fontFamily: "Inter, sans-serif", fontWeight: 600,
          fontSize: "0.875rem", letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--charcoal)", textDecoration: "none",
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
              letterSpacing: "0.04em", transition: "all 0.15s",
            }}
          >
            {theme === "light" ? "Light" : theme === "dark" ? "Dark" : <Palette size={14} strokeWidth={1.5} />}
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
        {/* Wordmark */}
        <Link href="/" style={{
          fontFamily: "Inter, sans-serif", fontWeight: 600,
          fontSize: "0.8125rem", letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--charcoal)",
          marginBottom: "2rem", paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--border)",
          textDecoration: "none", display: "block",
        }}>
          Cadenza
        </Link>

        {/* Teacher profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
          {avatarCircle(36, "0.75rem")}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem",
              color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {teacher.displayName}
            </div>
            {teacher.hasStudio() && (
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: "0.5625rem",
                color: "var(--muted)", letterSpacing: "0.03em",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                marginTop: "0.125rem",
              }}>
                {teacher.studioName}
              </div>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", overflowY: "auto" }}>

          {/* Studio section */}
          <div style={{ fontSize: "0.5625rem", fontFamily: "Inter, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", padding: "0 0.75rem 0.375rem" }}>
            Studio
          </div>
          {studioTabs.map(tab => {
            const active = tab.href === "/teacher" ? path === "/teacher" : path.startsWith(tab.href);
            const showDot = tab.href === "/teacher/chat" && hasUnread && !active;
            return (
              <Link key={tab.href} href={tab.href} style={{
                display: "flex", alignItems: "center",
                padding: "0.5rem 0.75rem",
                borderLeft: active ? "2px solid var(--charcoal)" : "2px solid transparent",
                background: active ? "var(--cream-deep)" : "transparent",
                color: active ? "var(--charcoal)" : "var(--muted)",
                fontFamily: "Inter, sans-serif", fontWeight: active ? 500 : 400,
                fontSize: "0.875rem", textDecoration: "none",
                transition: "all 0.15s", letterSpacing: "0.005em",
              }}>
                {tab.label}
                {showDot && (
                  <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#e85d4a", flexShrink: 0 }} />
                )}
              </Link>
            );
          })}

          {/* My Practice section */}
          <div style={{ fontSize: "0.5625rem", fontFamily: "Inter, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", padding: "0 0.75rem 0.375rem", marginTop: "1.25rem" }}>
            My Practice
          </div>
          {practiceTabs.map(tab => {
            const active = path.startsWith(tab.href);
            return (
              <button key={tab.href} onClick={() => { window.location.href = tab.href; }} style={{
                display: "flex", alignItems: "center", width: "100%",
                padding: "0.5rem 0.75rem", border: "none", cursor: "pointer",
                borderLeft: active ? "2px solid var(--charcoal)" : "2px solid transparent",
                background: active ? "var(--cream-deep)" : "transparent",
                color: active ? "var(--charcoal)" : "var(--muted)",
                fontFamily: "Inter, sans-serif", fontWeight: active ? 500 : 400,
                fontSize: "0.875rem", textAlign: "left",
                transition: "all 0.15s", letterSpacing: "0.005em",
              }}>
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
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
            {theme === "light" ? t.common.lightMode : theme === "dark" ? t.common.darkMode : t.common.funMode}
          </button>
          <LanguageSwitcher />
          <Link
            href="/teacher/settings"
            style={{
              width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2,
              padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
              textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
              display: "block", textDecoration: "none",
            }}
          >
            {t.common.settings}
          </Link>
          <button
            onClick={() => signOut()}
            style={{
              width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2,
              padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)",
              textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
            }}
          >
            {t.common.signOut}
          </button>
          <button
            onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText(""); }}
            style={{
              width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2,
              padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#c0392b",
              textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
            }}
          >
            {t.common.deleteAccount}
          </button>
        </div>
      </aside>

      {/* ── Scrollable content area ── */}
      <div className="student-scroll-area">
        <main className="teacher-main">{children}</main>
      </div>

      <RecordingIndicator />

      {/* ── Mobile bottom nav (hidden ≥700px via CSS) ── */}
      <nav className="student-bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--white)", borderTop: "1px solid var(--border)",
        display: "flex", zIndex: 100, padding: "0.5rem 0 0.625rem",
      }}>
        {primaryMobileTabs.map(tab => {
          const active = tab.href === "/teacher" ? path === "/teacher" : path.startsWith(tab.href);
          const sharedStyle = {
            flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "3px",
            textDecoration: "none", padding: "0.375rem 0",
            color: active ? "var(--charcoal)" : "var(--muted)",
            transition: "color 0.15s", position: "relative" as const,
          };
          const inner = (
            <>
              {active && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 1.5, background: "var(--charcoal)" }} />}
              <span style={{ fontSize: "0.5625rem", fontFamily: "Inter, sans-serif", fontWeight: active ? 600 : 400, letterSpacing: "0.07em", textTransform: "uppercase", marginTop: "0.125rem" }}>
                {tab.label}
              </span>
            </>
          );
          if (tab.href.startsWith("/student/")) {
            return (
              <button key={tab.href} onClick={() => { window.location.href = tab.href; }} style={{ ...sharedStyle, background: "none", border: "none", cursor: "pointer" }}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={tab.href} href={tab.href} style={sharedStyle}>
              {inner}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
            background: "none", border: "none", padding: "0.375rem 0", cursor: "pointer",
            color: [...moreMobileStudioTabs, ...moreMobilePracticeTabs].some(tab => path.startsWith(tab.href)) ? "var(--charcoal)" : "var(--muted)",
            position: "relative",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
          </svg>
          <span style={{ fontSize: "0.5625rem", fontFamily: "Inter, sans-serif", fontWeight: 400, letterSpacing: "0.07em", textTransform: "uppercase", position: "relative" }}>
            More
            {hasUnread && !path.startsWith("/teacher/chat") && (
              <span style={{ position: "absolute", top: -2, right: -7, width: 5, height: 5, borderRadius: "50%", background: "#e85d4a" }} />
            )}
          </span>
        </button>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--white)", borderRadius: "16px 16px 0 0", padding: "1rem 0 2rem" }}>
            <div style={{ width: 36, height: 3, borderRadius: 2, background: "var(--border)", margin: "0 auto 1rem" }} />

            <div style={{ padding: "0 1.5rem 0.5rem", fontSize: "0.5625rem", fontFamily: "Inter, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>Studio</div>
            {moreMobileStudioTabs.map(tab => {
              const active = path.startsWith(tab.href);
              const showDot = tab.href === "/teacher/chat" && hasUnread && !active;
              return (
                <Link key={tab.href} href={tab.href} onClick={() => setMoreOpen(false)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.875rem 1.5rem", fontFamily: "Inter, sans-serif", fontSize: "1rem",
                  fontWeight: active ? 600 : 400, color: active ? "var(--charcoal)" : "var(--muted)",
                  textDecoration: "none", borderLeft: active ? "3px solid var(--charcoal)" : "3px solid transparent",
                }}>
                  {tab.label}
                  {showDot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e85d4a" }} />}
                </Link>
              );
            })}

            <div style={{ padding: "1rem 1.5rem 0.5rem", fontSize: "0.5625rem", fontFamily: "Inter, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>My Practice</div>
            {moreMobilePracticeTabs.map(tab => {
              const active = path.startsWith(tab.href);
              return (
                <button key={tab.href} onClick={() => { setMoreOpen(false); window.location.href = tab.href; }} style={{
                  display: "flex", alignItems: "center", width: "100%",
                  padding: "0.875rem 1.5rem", fontFamily: "Inter, sans-serif", fontSize: "1rem",
                  fontWeight: active ? 600 : 400, color: active ? "var(--charcoal)" : "var(--muted)",
                  background: "none", border: "none", borderLeft: active ? "3px solid var(--charcoal)" : "3px solid transparent",
                  cursor: "pointer", textAlign: "left",
                }}>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload error toast */}
      {uploadError && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#c0392b", color: "#fff", padding: "0.625rem 1.125rem",
          borderRadius: 3, fontSize: "0.8125rem", fontFamily: "Inter, sans-serif",
          zIndex: 9999, maxWidth: 340, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        }}>
          {t.teacher.uploadFailed}: {uploadError}
          <button onClick={() => setUploadError(null)} style={{ marginLeft: "0.75rem", background: "none", border: "none", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center" }}><X size={14} strokeWidth={1.5} /></button>
        </div>
      )}

      {/* Delete account modal */}
      {deleteModalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10000, padding: "1.5rem",
        }} onClick={e => { if (e.target === e.currentTarget) { setDeleteModalOpen(false); setDeleteConfirmText(""); } }}>
          <div style={{
            background: "var(--white)", borderRadius: 4, padding: "2rem",
            width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", margin: "0 0 0.75rem" }}>
              {t.teacher.deleteAccountTitle}
            </h2>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
              {t.teacher.deleteAccountBody}
            </p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0 0 0.5rem", fontWeight: 500 }}>
              {t.teacher.deleteAccountConfirmLabel}
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={t.teacher.deleteAccountConfirmPlaceholder}
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                borderRadius: 3, border: "1px solid var(--border-strong)",
                padding: "0.625rem 0.875rem", fontSize: "0.875rem",
                fontFamily: "Inter, sans-serif", outline: "none",
                background: "var(--cream)", color: "var(--charcoal)", marginBottom: "1.25rem",
              }}
            />
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button
                onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText(""); }}
                style={{
                  flex: 1, padding: "0.625rem", borderRadius: 3,
                  border: "1px solid var(--border-strong)", background: "none",
                  fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                  color: "var(--muted)", cursor: "pointer",
                }}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                style={{
                  flex: 1, padding: "0.625rem", borderRadius: 3, border: "none",
                  background: deleteConfirmText === "DELETE" && !deleting ? "#c0392b" : "var(--border)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500,
                  color: "#fff", cursor: deleteConfirmText === "DELETE" && !deleting ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
              >
                {deleting ? t.common.deleting : t.teacher.deleteAccountButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RecordingProvider>
  );
}
