"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { useTheme } from "../../../lib/context/ThemeContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Student } from "../../../lib/models/Student";
import { useI18n } from "../../../lib/context/I18nContext";

export default function StudentSettings() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const student = user as Student;
  const supabase = getSupabaseBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [instrument, setInstrument] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student?.id) return;
    supabase
      .from("profiles")
      .select("display_name, instrument, avatar_url")
      .eq("id", student.id)
      .single()
      .then(({ data }: { data: { display_name: string | null; instrument: string | null; avatar_url: string | null } | null }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setInstrument(data.instrument ?? "");
          setAvatarUrl(data.avatar_url ?? null);
        }
      });
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveProfile() {
    if (!student?.id) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), instrument: instrument || null })
      .eq("id", student.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAvatarUpload(file: File) {
    if (!student?.id) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${student.id}.${ext}`;
    await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", student.id);
    setAvatarUrl(url);
    setUploading(false);
  }

  async function handleBillingPortal() {
    setBillingLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const json = await res.json();
    setBillingLoading(false);
    if (json.url) window.location.href = json.url;
    else setError("No billing subscription found.");
  }

  async function handleDelete() {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    await fetch("/api/account/delete", { method: "POST" });
    await signOut();
    router.replace("/");
  }

  const themeLabel = theme === "light" ? t.settings.themeLight : theme === "dark" ? t.settings.themeDark : t.settings.themeFun;
  const initials = displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", padding: "1.5rem 1.25rem 6rem", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 500, color: "var(--charcoal)", letterSpacing: "-0.01em" }}>{t.settings.title}</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>{t.settings.accountSubtitle}</div>
        </div>

        {error && (
          <div style={{ background: "rgba(192,80,80,0.08)", border: "1px solid rgba(192,80,80,0.25)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "#b05050" }}>
            {error}
          </div>
        )}

        {/* ── Profile ── */}
        <Section title={t.settings.profile}>
          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: 64, height: 64, borderRadius: "50%", background: avatarUrl ? "transparent" : "var(--charcoal)", border: "2px solid var(--border)", cursor: "pointer", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", color: "var(--white)", fontWeight: 700 }}
            >
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
            </button>
            <div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: 6, padding: "0.375rem 0.75rem", cursor: "pointer", fontSize: "0.8125rem", color: "var(--charcoal)", fontWeight: 500 }}>
                {uploading ? t.student.uploadingLabel : t.settings.changePhoto}
              </button>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>{t.settings.photoHint}</div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleAvatarUpload(f); }} />
          </div>

          <Field label={t.settings.displayName}>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </Field>

          <Field label={t.student.labelInstrument}>
            <input
              value={instrument}
              onChange={e => setInstrument(e.target.value)}
              placeholder="e.g. Piano, Guitar, Violin…"
              style={inputStyle}
            />
          </Field>

          <button onClick={handleSaveProfile} disabled={saving} style={{ ...btnPrimary, marginTop: "0.25rem" }}>
            {saved ? t.settings.savedSuccess : saving ? t.common.saving : t.settings.saveChanges}
          </button>
        </Section>

        {/* ── Account ── */}
        <Section title={t.settings.account}>
          <Field label={t.auth.labelEmail}>
            <input value={student?.email ?? ""} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "default" }} />
          </Field>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {t.settings.emailChangeNote}
          </div>
          <button
            onClick={async () => {
              if (!student?.email) return;
              await supabase.auth.resetPasswordForEmail(student.email, { redirectTo: `${window.location.origin}/auth/reset-password` });
              alert(t.settings.passwordResetSent);
            }}
            style={{ ...btnOutline, marginTop: "0.75rem" }}
          >
            {t.settings.sendPasswordReset}
          </button>
        </Section>

        {/* ── Appearance ── */}
        <Section title={t.settings.appearance}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "0.875rem", color: "var(--charcoal)", fontWeight: 500 }}>{t.settings.theme}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>{t.settings.currentlyTheme.replace("{label}", themeLabel)}</div>
            </div>
            <button onClick={toggleTheme} style={btnOutline}>
              {t.settings.switchTo.replace("{mode}", theme === "light" ? t.settings.themeDark : theme === "dark" ? t.settings.themeFun : t.settings.themeLight)}
            </button>
          </div>
        </Section>

        {/* ── Billing ── */}
        <Section title={t.nav.billing}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.875rem", lineHeight: 1.6 }}>
            {t.settings.billingDesc}
          </div>
          <button onClick={handleBillingPortal} disabled={billingLoading} style={btnOutline}>
            {billingLoading ? t.settings.openingBillingPortal : t.settings.openBillingPortal}
          </button>
        </Section>

        {/* ── Danger zone ── */}
        <Section title={t.settings.dangerZone} danger>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.875rem", lineHeight: 1.6 }}>
            {t.settings.dangerZoneDesc}
          </div>
          <button onClick={() => setDeleteModalOpen(true)} style={{ ...btnOutline, borderColor: "rgba(192,80,80,0.4)", color: "#b05050" }}>
            {t.common.deleteAccount}
          </button>
        </Section>

      </div>

      {/* Delete modal */}
      {deleteModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ background: "var(--white)", borderRadius: 12, padding: "2rem", maxWidth: 380, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", marginBottom: "0.75rem" }}>{t.common.deleteAccount}</div>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              {t.settings.deleteModalBody}
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem", fontWeight: 500 }}>{t.teacher.deleteAccountConfirmLabel}</p>
            <input
              value={deleteText}
              onChange={e => setDeleteText(e.target.value)}
              placeholder="DELETE"
              style={{ ...inputStyle, marginBottom: "1rem", letterSpacing: "0.1em" }}
            />
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button onClick={() => { setDeleteModalOpen(false); setDeleteText(""); }} style={{ ...btnOutline, flex: 1 }}>{t.common.cancel}</button>
              <button onClick={handleDelete} disabled={deleteText !== "DELETE" || deleting} style={{ flex: 2, padding: "0.7rem", borderRadius: 8, border: "none", background: deleteText === "DELETE" ? "#b05050" : "var(--border)", color: "var(--white)", cursor: deleteText === "DELETE" ? "pointer" : "default", fontWeight: 600, fontSize: "0.875rem" }}>
                {deleting ? t.common.deleting : t.settings.deleteForever}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{ background: "var(--white)", border: `1px solid ${danger ? "rgba(192,80,80,0.2)" : "var(--border)"}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.6875rem", letterSpacing: "0.08em", textTransform: "uppercase", color: danger ? "#b05050" : "var(--muted)", marginBottom: "1rem" }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.875rem" }}>
      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "var(--charcoal)", marginBottom: "0.375rem" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "0.625rem 0.75rem", border: "1px solid var(--border-strong)",
  borderRadius: 8, fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
  color: "var(--charcoal)", background: "var(--cream)", outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "0.625rem 1.25rem", borderRadius: 8, border: "none",
  background: "var(--charcoal)", color: "var(--white)",
  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem",
  cursor: "pointer",
};

const btnOutline: React.CSSProperties = {
  padding: "0.625rem 1.25rem", borderRadius: 8,
  border: "1px solid var(--border-strong)", background: "transparent",
  color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.875rem", cursor: "pointer",
};
