"use client";
import React, { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/context/AuthContext";
import { useTheme } from "../../lib/context/ThemeContext";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { Student } from "../../lib/models/Student";
import { PlayerProvider } from "../../lib/context/PlayerContext";
import MiniPlayer from "../../components/MiniPlayer";

interface SiblingProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  hasPin: boolean;
}

const tabs = [
  { href: "/student",                label: "Home" },
  { href: "/student/practice",       label: "Practice" },
  { href: "/student/pieces",         label: "Pieces" },
  { href: "/student/theory",         label: "Theory" },
  { href: "/student/ai-tutor",       label: "AI" },
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sibling / family state
  const [siblings, setSiblings] = useState<SiblingProfile[]>([]);
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<SiblingProfile | null>(null);
  const [switchPin, setSwitchPin] = useState("");
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [setPinLoading, setSetPinLoading] = useState(false);
  const [setPinError, setSetPinError] = useState<string | null>(null);
  const [setPinSuccess, setSetPinSuccess] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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

  // Load sibling family members
  const loadSiblings = useCallback(async () => {
    try {
      const res = await fetch("/api/family/members");
      if (!res.ok) return;
      const json = await res.json() as { members: SiblingProfile[]; familyCode: string | null; hasPin: boolean };
      setSiblings(json.members ?? []);
      setFamilyCode(json.familyCode ?? null);
      setHasPin(json.hasPin ?? false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const student = user as Student | null;
    if (!student?.id) return;
    loadSiblings();
  }, [(user as Student | null)?.id, loadSiblings]);

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
    setUploadError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${student.id}/avatar.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const url = urlData.publicUrl + "?t=" + Date.now();
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", student.id);
      if (updateError) throw updateError;
      setAvatarUrl(url);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "Upload failed";
      setUploadError(msg);
      console.error("avatar upload error:", err);
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

  async function handleCreateFamily() {
    const res = await fetch("/api/family/create", { method: "POST" });
    const json = await res.json() as { familyCode?: string; error?: string };
    if (json.familyCode) { setFamilyCode(json.familyCode); await loadSiblings(); }
    else setJoinError(json.error ?? "Failed to create family");
  }

  async function handleJoinFamily() {
    if (!joinCode.trim()) return;
    setJoinLoading(true); setJoinError(null);
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (json.success) { setJoinCode(""); await loadSiblings(); }
      else setJoinError(json.error ?? "Failed to join family");
    } finally { setJoinLoading(false); }
  }

  async function handleLeaveFamily() {
    if (!confirm("Leave this family? Your switch PIN will be cleared.")) return;
    await fetch("/api/family/leave", { method: "POST" });
    setSiblings([]); setFamilyCode(null); setHasPin(false);
  }

  async function handleSetPin() {
    if (!/^\d{4}$/.test(newPin)) { setSetPinError("Enter exactly 4 digits"); return; }
    setSetPinLoading(true); setSetPinError(null); setSetPinSuccess(false);
    try {
      const res = await fetch("/api/family/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (json.success) { setHasPin(true); setSetPinSuccess(true); setNewPin(""); }
      else setSetPinError(json.error ?? "Failed to set PIN");
    } finally { setSetPinLoading(false); }
  }

  async function handleSwitch() {
    if (!switchTarget || !/^\d{4}$/.test(switchPin)) { setSwitchError("Enter 4-digit PIN"); return; }
    setSwitchLoading(true); setSwitchError(null);
    try {
      const res = await fetch("/api/family/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: switchTarget.id, pin: switchPin }),
      });
      const json = await res.json() as { actionLink?: string; error?: string };
      if (json.actionLink) { window.location.href = json.actionLink; }
      else setSwitchError(json.error ?? "Switch failed");
    } catch { setSwitchError("Switch failed"); }
    finally { setSwitchLoading(false); }
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

        {/* Sibling switcher */}
        {(siblings.length > 0 || familyCode) && (
          <div style={{ marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
                Family
              </span>
              <button onClick={() => { setFamilyModalOpen(true); setSetPinSuccess(false); setSetPinError(null); setJoinError(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.04em", textTransform: "uppercase", padding: 0 }}>
                Manage
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {siblings.map(s => {
                const initials2 = s.displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
                return (
                  <button key={s.id} onClick={() => { setSwitchTarget(s); setSwitchPin(""); setSwitchError(null); }} title={`Switch to ${s.displayName}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.avatarUrl ? "transparent" : "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 600, color: "var(--white)", overflow: "hidden", border: "2px solid var(--border)" }}>
                      {s.avatarUrl ? <img src={s.avatarUrl} alt={s.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials2}
                    </div>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", maxWidth: 36, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.displayName.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!familyCode && siblings.length === 0 && (
          <div style={{ marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => { setFamilyModalOpen(true); setJoinError(null); }} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "0.3rem 0.625rem", cursor: "pointer", fontSize: "0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 500, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s" }}>
              + Add siblings
            </button>
          </div>
        )}

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
          <button
            onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText(""); }}
            style={{
              width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 2,
              padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.6875rem",
              fontFamily: "Inter, sans-serif", fontWeight: 500, color: "#c0392b",
              textAlign: "left", letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
            }}
          >
            Delete account
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

    {/* Upload error toast */}
    {uploadError && (
      <div style={{
        position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
        background: "#c0392b", color: "#fff", padding: "0.625rem 1.125rem",
        borderRadius: 3, fontSize: "0.8125rem", fontFamily: "Inter, sans-serif",
        zIndex: 9999, maxWidth: 340, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      }}>
        Photo upload failed: {uploadError}
        <button onClick={() => setUploadError(null)} style={{ marginLeft: "0.75rem", background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>×</button>
      </div>
    )}

    {/* Family manage modal */}
    {familyModalOpen && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "1.5rem" }}
        onClick={e => { if (e.target === e.currentTarget) setFamilyModalOpen(false); }}>
        <div style={{ background: "var(--white)", borderRadius: 4, padding: "2rem", width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", margin: 0 }}>Family</h2>
            <button onClick={() => setFamilyModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--muted)", lineHeight: 1 }}>×</button>
          </div>

          {familyCode ? (
            <>
              {/* Family code */}
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Family code</p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <code style={{ fontFamily: "monospace", fontSize: "1.25rem", fontWeight: 700, color: "var(--charcoal)", letterSpacing: "0.15em", flex: 1, background: "var(--cream)", padding: "0.5rem 0.75rem", borderRadius: 3 }}>{familyCode}</code>
                  <button onClick={() => { navigator.clipboard.writeText(familyCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }} style={{ padding: "0.5rem 0.75rem", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 3, cursor: "pointer", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
                    {codeCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0.5rem 0 0" }}>Share this code with siblings so they can join your family.</p>
              </div>

              {/* Set/update switch PIN */}
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{hasPin ? "Update your switch PIN" : "Set a switch PIN"}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.625rem" }}>Siblings enter this 4-digit PIN to switch into your account.</p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="password" inputMode="numeric" maxLength={4} placeholder="1234" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "Inter, sans-serif", fontSize: "1rem", letterSpacing: "0.2em", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }} />
                  <button onClick={handleSetPin} disabled={setPinLoading || newPin.length !== 4} style={{ padding: "0.5rem 1rem", background: newPin.length === 4 ? "var(--charcoal)" : "var(--border)", color: "var(--white)", border: "none", borderRadius: 3, cursor: newPin.length === 4 ? "pointer" : "default", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", transition: "background 0.15s" }}>
                    {setPinLoading ? "Saving…" : "Save"}
                  </button>
                </div>
                {setPinError && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#c0392b", margin: "0.375rem 0 0" }}>{setPinError}</p>}
                {setPinSuccess && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#4CAF84", margin: "0.375rem 0 0" }}>PIN saved!</p>}
              </div>

              {/* Leave family */}
              <button onClick={handleLeaveFamily} style={{ width: "100%", padding: "0.5rem", background: "none", border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#c0392b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Leave family
              </button>
            </>
          ) : (
            <>
              {/* Create a family */}
              <div style={{ marginBottom: "1.25rem" }}>
                <button onClick={handleCreateFamily} style={{ width: "100%", padding: "0.625rem", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 3, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>
                  Create a new family
                </button>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0.5rem 0 0", textAlign: "center" }}>Creates a family and gives you a code to share with siblings.</p>
              </div>

              <div style={{ textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0.5rem 0" }}>or</div>

              {/* Join a family */}
              <div>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Join with a code</p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="text" placeholder="8-character code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8} style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "monospace", fontSize: "0.875rem", letterSpacing: "0.1em", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }} />
                  <button onClick={handleJoinFamily} disabled={joinLoading || joinCode.length < 8} style={{ padding: "0.5rem 1rem", background: joinCode.length >= 8 ? "var(--charcoal)" : "var(--border)", color: "var(--white)", border: "none", borderRadius: 3, cursor: joinCode.length >= 8 ? "pointer" : "default", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif", transition: "background 0.15s" }}>
                    {joinLoading ? "Joining…" : "Join"}
                  </button>
                </div>
                {joinError && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#c0392b", margin: "0.375rem 0 0" }}>{joinError}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* Sibling PIN switch modal */}
    {switchTarget && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "1.5rem" }}
        onClick={e => { if (e.target === e.currentTarget) { setSwitchTarget(null); setSwitchPin(""); setSwitchError(null); } }}>
        <div style={{ background: "var(--white)", borderRadius: 4, padding: "2rem", width: "100%", maxWidth: 320, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: switchTarget.avatarUrl ? "transparent" : "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontFamily: "Inter, sans-serif", fontWeight: 600, color: "var(--white)", overflow: "hidden", margin: "0 auto 1rem" }}>
            {switchTarget.avatarUrl ? <img src={switchTarget.avatarUrl} alt={switchTarget.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : switchTarget.displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase()}
          </div>
          <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", margin: "0 0 0.25rem" }}>Switch to {switchTarget.displayName}</h2>
          {switchTarget.hasPin ? (
            <>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>Enter {switchTarget.displayName.split(" ")[0]}&apos;s 4-digit PIN</p>
              <input
                type="password" inputMode="numeric" maxLength={4} placeholder="· · · ·"
                value={switchPin} onChange={e => { setSwitchPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setSwitchError(null); }}
                onKeyDown={e => e.key === "Enter" && handleSwitch()}
                autoFocus
                style={{ width: "100%", boxSizing: "border-box", padding: "0.75rem", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "Inter, sans-serif", fontSize: "1.5rem", letterSpacing: "0.3em", textAlign: "center", background: "var(--cream)", color: "var(--charcoal)", outline: "none", marginBottom: "0.75rem" }}
              />
              {switchError && <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#c0392b", margin: "0 0 0.75rem" }}>{switchError}</p>}
              <button onClick={handleSwitch} disabled={switchLoading || switchPin.length !== 4} style={{ width: "100%", padding: "0.75rem", background: switchPin.length === 4 ? "var(--charcoal)" : "var(--border)", color: "var(--white)", border: "none", borderRadius: 3, cursor: switchPin.length === 4 ? "pointer" : "default", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 500, transition: "background 0.15s" }}>
                {switchLoading ? "Switching…" : "Switch account"}
              </button>
            </>
          ) : (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
              {switchTarget.displayName.split(" ")[0]} hasn&apos;t set a switch PIN yet. Ask them to set one in their Family settings.
            </p>
          )}
        </div>
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
            Delete account
          </h2>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
            This will permanently delete your account and all your data — practice sessions, recordings, and progress. <strong>This cannot be undone.</strong>
          </p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0 0 0.5rem", fontWeight: 500 }}>
            Type <strong>DELETE</strong> to confirm
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
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
              Cancel
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
              {deleting ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </div>
      </div>
    )}
    </PlayerProvider>
  );
}
