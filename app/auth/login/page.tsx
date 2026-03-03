"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  // Skip login page if already authenticated
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      if (!session?.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role === "teacher") router.replace("/teacher");
      else router.replace("/student");
    });
  }, [router]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const service = AuthService.getInstance(supabase);
      const user = await service.signIn(email, password);
      router.push(user.getHomeRoute());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.75rem" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>
            Cadenza
          </div>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 400, fontSize: "2rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
            Welcome back.
          </h1>
        </div>

        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1.75rem" }}>
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
                placeholder="••••••"
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div style={{ borderTop: "1px solid var(--border)", padding: "1rem 1.75rem", textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
              New to Cadenza?{" "}
              <Link href="/auth/signup" style={{ color: "var(--charcoal)", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "2px" }}>
                Create account
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
