"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";
import type { UserRole } from "@/lib/types";

export default function SignUpPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = AuthService.getInstance(supabase);
      const user = await service.signUp(email, password, role, displayName);
      router.push(user.getHomeRoute());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.75rem" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>
            Cadenza
          </div>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 400, fontSize: "2rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
            Create your account.
          </h1>
        </div>

        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4 }}>

          {/* Role selector */}
          <div style={{ padding: "1.25rem 1.75rem 0" }}>
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
              {(["student", "teacher"] as UserRole[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1,
                    padding: "0.575rem",
                    border: "none",
                    cursor: "pointer",
                    background: role === r ? "var(--charcoal)" : "transparent",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    fontSize: "0.8125rem",
                    color: role === r ? "var(--white)" : "var(--muted)",
                    transition: "all 0.15s",
                    textTransform: "capitalize",
                    letterSpacing: "0.01em",
                  }}
                >
                  {r === "student" ? "Student" : "Teacher"}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1.25rem 1.75rem 1.75rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label htmlFor="name" style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>
                Display Name
              </label>
              <input
                id="name"
                type="text"
                placeholder={role === "student" ? "Emma Chen" : "Ms. Rivera"}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                style={{ borderRadius: 3, border: "1px solid var(--border-strong)", background: "var(--cream)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", padding: "0.625rem 0.875rem", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label htmlFor="email" style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ borderRadius: 3, border: "1px solid var(--border-strong)", background: "var(--cream)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", padding: "0.625rem 0.875rem", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label htmlFor="password" style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ borderRadius: 3, border: "1px solid var(--border-strong)", background: "var(--cream)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", padding: "0.625rem 0.875rem", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {error && (
              <div style={{ border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "var(--charcoal)", fontFamily: "Inter, sans-serif", background: "var(--cream-deep)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ borderRadius: 3, background: loading ? "var(--border-strong)" : "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", padding: "0.75rem", border: "none", cursor: loading ? "default" : "pointer", marginTop: "0.25rem", letterSpacing: "0.01em", transition: "background 0.15s" }}
            >
              {loading ? "Creating account…" : `Create ${role} account`}
            </button>
          </form>

          <div style={{ borderTop: "1px solid var(--border)", padding: "1.25rem 1.75rem" }}>
            <button
              type="button"
              onClick={async () => {
                const supabase = getSupabaseBrowserClient();
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` },
                });
              }}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem",
                border: "1px solid var(--border-strong)", borderRadius: 3, background: "var(--white)",
                padding: "0.625rem", cursor: "pointer", fontFamily: "Inter, sans-serif",
                fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", transition: "background 0.15s",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Continue with Google as {role === "teacher" ? "Teacher" : "Student"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "1rem 1.75rem", textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
              Already have an account?{" "}
              <Link href="/auth/login" style={{ color: "var(--charcoal)", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "2px" }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
