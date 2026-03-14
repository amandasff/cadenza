"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/context/AuthContext";
import { useTheme } from "../../../lib/context/ThemeContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Student } from "../../../lib/models/Student";

const INSTRUMENTS = ["Piano", "Guitar", "Violin", "Viola", "Cello", "Bass", "Flute", "Clarinet", "Saxophone", "Trumpet", "Drums", "Voice", "Other"];

export default function StudentSettings() {
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

  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "🎨 Fun";
  const initials = displayName.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)", padding: "1.5rem 1.25rem 6rem", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.75rem", fontWeight: 500, color: "var(--charcoal)", letterSpacing: "-0.01em" }}>Settings</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>Manage your account and preferences</div>
        </div>

        {error && (
          <div style={{ background: "rgba(192,80,80,0.08)", border: "1px solid rgba(192,80,80,0.25)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "#b05050" }}>
            {error}
          </div>
        )}

        {/* ── Profile ── */}
        <Section title="Profile">
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
                {uploading ? "Uploading…" : "Change photo"}
              </button>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>JPG or PNG, shown in your profile</div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleAvatarUpload(f); }} />
          </div>

          <Field label="Display name">
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </Field>

          <Field label="Instrument">
            <select value={instrument} onChange={e => setInstrument(e.target.value)} style={inputStyle}>
              <option value="">Not set</option>
              {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>

          <button onClick={handleSaveProfile} disabled={saving} style={{ ...btnPrimary, marginTop: "0.25rem" }}>
            {saved ? "Saved!" : saving ? "Saving…" : "Save changes"}
          </button>
        </Section>

        {/* ── Account ── */}
        <Section title="Account">
          <Field label="Email">
            <input value={student?.email ?? ""} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "default" }} />
          </Field>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            To change your email or password, use the link below.
          </div>
          <button
            onClick={async () => {
              if (!student?.email) return;
              await supabase.auth.resetPasswordForEmail(student.email, { redirectTo: `${window.location.origin}/auth/reset-password` });
              alert("Password reset email sent!");
            }}
            style={{ ...btnOutline, marginTop: "0.75rem" }}
          >
            Send password reset email
          </button>
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "0.875rem", color: "var(--charcoal)", fontWeight: 500 }}>Theme</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>Currently: {themeLabel}</div>
            </div>
            <button onClick={toggleTheme} style={btnOutline}>
              Switch to {theme === "light" ? "Dark" : theme === "dark" ? "🎨 Fun" : "Light"}
            </button>
          </div>
        </Section>

        {/* ── Billing ── */}
        <Section title="Billing">
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.875rem", lineHeight: 1.6 }}>
            Manage your subscription, view invoices, and update your payment method through the billing portal.
          </div>
          <button onClick={handleBillingPortal} disabled={billingLoading} style={btnOutline}>
            {billingLoading ? "Opening…" : "Open billing portal →"}
          </button>
        </Section>

        {/* ── Danger zone ── */}
        <Section title="Danger zone" danger>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.875rem", lineHeight: 1.6 }}>
            Permanently delete your account and all data — practice sessions, recordings, and progress. This cannot be undone.
          </div>
          <button onClick={() => setDeleteModalOpen(true)} style={{ ...btnOutline, borderColor: "rgba(192,80,80,0.4)", color: "#b05050" }}>
            Delete account
          </button>
        </Section>

      </div>

      {/* Delete modal */}
      {deleteModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ background: "var(--white)", borderRadius: 12, padding: "2rem", maxWidth: 380, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", marginBottom: "0.75rem" }}>Delete account</div>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              This will permanently delete your account and all your data. <strong>This cannot be undone.</strong>
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem", fontWeight: 500 }}>Type DELETE to confirm</p>
            <input
              value={deleteText}
              onChange={e => setDeleteText(e.target.value)}
              placeholder="DELETE"
              style={{ ...inputStyle, marginBottom: "1rem", letterSpacing: "0.1em" }}
            />
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button onClick={() => { setDeleteModalOpen(false); setDeleteText(""); }} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteText !== "DELETE" || deleting} style={{ flex: 2, padding: "0.7rem", borderRadius: 8, border: "none", background: deleteText === "DELETE" ? "#b05050" : "var(--border)", color: "var(--white)", cursor: deleteText === "DELETE" ? "pointer" : "default", fontWeight: 600, fontSize: "0.875rem" }}>
                {deleting ? "Deleting…" : "Delete forever"}
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
