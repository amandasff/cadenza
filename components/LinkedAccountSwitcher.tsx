"use client";
import React, { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/context/AuthContext";
import { X, UserPlus, ArrowLeftRight, Loader } from "lucide-react";

interface LinkedAccount {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function RoleBadge({ role }: { role: string | null }) {
  const label = role === "teacher" ? "Teacher" : "Student";
  const color = role === "teacher" ? "#2C6E49" : "#1A4E8A";
  const bg   = role === "teacher" ? "#E8F5EE" : "#E5EEFF";
  return (
    <span style={{
      fontFamily: "Inter, sans-serif", fontSize: "0.5rem", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
      background: bg, color, borderRadius: 3, padding: "0.1rem 0.3rem",
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

export default function LinkedAccountSwitcher() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: rows } = await supabase
        .from("linked_accounts")
        .select("linked_user_id")
        .eq("user_id", user.id);

      if (!rows?.length) { setAccounts([]); return; }

      const ids = rows.map((r: { linked_user_id: string }) => r.linked_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, role")
        .in("id", ids);

      setAccounts(profiles ?? []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) loadAccounts();
  }, [open, loadAccounts]);

  async function switchTo(targetId: string) {
    setSwitching(targetId);
    try {
      const res = await fetch("/api/accounts/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      const { token_hash, next, error } = await res.json();
      if (error || !token_hash) { alert(error ?? "Switch failed"); return; }

      // Verify the OTP token directly — no redirect URL config needed in Supabase
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash,
        type: "magiclink",
      });
      if (otpError) { alert("Switch failed: " + otpError.message); return; }

      // Session is now set as the target account — navigate to their dashboard
      window.location.href = next;
    } finally {
      setSwitching(null);
    }
  }

  async function unlink(targetId: string) {
    setUnlinking(targetId);
    try {
      await fetch("/api/accounts/link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedUserId: targetId }),
      });
      setAccounts(prev => prev.filter(a => a.id !== targetId));
    } finally {
      setUnlinking(null);
    }
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkEmail.trim() || !linkPassword) return;
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch("/api/accounts/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: linkEmail.trim(), password: linkPassword }),
      });
      const { linked, error } = await res.json();
      if (error) { setLinkError(error); return; }
      setAccounts(prev => [...prev, linked]);
      setLinkEmail("");
      setLinkPassword("");
      setShowLinkForm(false);
    } finally {
      setLinking(false);
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 2,
            padding: "0.3rem 0.625rem", cursor: "pointer",
            fontSize: "0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 500,
            color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase",
            transition: "all 0.15s", display: "flex", alignItems: "center", gap: "0.3rem",
          }}
        >
          <ArrowLeftRight size={10} strokeWidth={1.5} />
          Switch account
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)",
      background: "var(--cream)", borderRadius: 6, padding: "0.75rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
          Linked accounts
        </span>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: 0, display: "flex" }}>
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "0.5rem 0" }}>
          <Loader size={16} strokeWidth={1.5} style={{ color: "var(--muted)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : accounts.length === 0 && !showLinkForm ? (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginBottom: "0.5rem", lineHeight: 1.5 }}>
          No linked accounts yet.
        </div>
      ) : (
        accounts.map(a => (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "var(--white)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "0.45rem 0.625rem",
            marginBottom: "0.375rem",
          }}>
            {/* Avatar */}
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: a.avatar_url ? "transparent" : "var(--charcoal)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.5rem", fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--white)",
            }}>
              {a.avatar_url ? <img src={a.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(a.display_name)}
            </div>

            {/* Name + role */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.display_name ?? "Account"}
                </span>
                <RoleBadge role={a.role} />
              </div>
            </div>

            {/* Switch */}
            <button
              onClick={() => switchTo(a.id)}
              disabled={switching === a.id}
              title="Switch to this account"
              style={{
                background: "var(--charcoal)", border: "none", borderRadius: 4,
                padding: "0.25rem 0.5rem", cursor: "pointer", flexShrink: 0,
                fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600,
                color: "var(--white)", opacity: switching === a.id ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: "0.2rem",
              }}
            >
              {switching === a.id
                ? <Loader size={10} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
                : <ArrowLeftRight size={10} strokeWidth={1.5} />}
              {switching === a.id ? "" : "Switch"}
            </button>

            {/* Unlink */}
            <button
              onClick={() => unlink(a.id)}
              disabled={unlinking === a.id}
              title="Remove link"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0.1rem", flexShrink: 0, display: "flex", opacity: unlinking === a.id ? 0.4 : 1 }}
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>
        ))
      )}

      {/* Link account form */}
      {showLinkForm ? (
        <form onSubmit={handleLink} style={{ marginTop: "0.5rem" }}>
          <input
            type="email"
            value={linkEmail}
            onChange={e => { setLinkEmail(e.target.value); setLinkError(null); }}
            placeholder="Email"
            autoFocus
            style={{
              width: "100%", boxSizing: "border-box",
              fontFamily: "Inter, sans-serif", fontSize: "0.75rem",
              border: "1px solid var(--border)",
              borderRadius: 6, padding: "0.4rem 0.625rem",
              background: "var(--white)", color: "var(--charcoal)", outline: "none",
              marginBottom: "0.375rem",
            }}
          />
          <input
            type="password"
            value={linkPassword}
            onChange={e => { setLinkPassword(e.target.value); setLinkError(null); }}
            placeholder="Password"
            style={{
              width: "100%", boxSizing: "border-box",
              fontFamily: "Inter, sans-serif", fontSize: "0.75rem",
              border: `1px solid ${linkError ? "#C0392B" : "var(--border)"}`,
              borderRadius: 6, padding: "0.4rem 0.625rem",
              background: "var(--white)", color: "var(--charcoal)", outline: "none",
              marginBottom: "0.375rem",
            }}
          />
          {linkError && (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#C0392B", marginBottom: "0.375rem" }}>
              {linkError}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <button
              type="submit"
              disabled={!linkEmail.trim() || !linkPassword || linking}
              style={{
                flex: 1, padding: "0.375rem 0", borderRadius: 6, border: "none",
                background: "var(--charcoal)", color: "var(--white)",
                fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600,
                cursor: "pointer", opacity: (!linkEmail.trim() || !linkPassword || linking) ? 0.5 : 1,
              }}
            >
              {linking ? "Linking…" : "Link account"}
            </button>
            <button
              type="button"
              onClick={() => { setShowLinkForm(false); setLinkEmail(""); setLinkPassword(""); setLinkError(null); }}
              style={{
                padding: "0.375rem 0.625rem", borderRadius: 6,
                border: "1px solid var(--border)", background: "none",
                fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowLinkForm(true)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: "0.5rem",
            background: "none", border: "1px dashed var(--border-strong)",
            borderRadius: 6, padding: "0.45rem 0.625rem", cursor: "pointer", marginTop: accounts.length > 0 ? "0.25rem" : 0,
          }}
        >
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UserPlus size={12} strokeWidth={1.5} color="var(--muted)" />
          </div>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
            Link another account
          </span>
        </button>
      )}
    </div>
  );
}
