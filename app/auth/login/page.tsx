"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthService } from "@/lib/services/AuthService";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎵</div>
          <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.75rem", color: "var(--charcoal)" }}>Welcome</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>Sign in to your Cadenza account</p>
        </div>

        <Card style={{ borderRadius: 20, border: "1.5px solid var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <CardContent style={{ padding: "1.75rem 1.75rem 1.75rem" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <Label htmlFor="email" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)" }}>Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--cream)", fontFamily: "DM Sans, sans-serif" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <Label htmlFor="password" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)" }}>Password</Label>
                <Input id="password" type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--cream)", fontFamily: "DM Sans, sans-serif" }} />
              </div>

              {error && (
                <div style={{ background: "var(--rose-bg)", border: "1.5px solid var(--rose-light)", borderRadius: 12, padding: "0.6rem 0.875rem", fontSize: "0.8rem", color: "var(--rose)", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} style={{ borderRadius: 100, background: "var(--peach)", color: "white", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", padding: "0.85rem", marginTop: "0.25rem" }}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--muted)", marginTop: "1.25rem" }}>
              New to Cadenza?{" "}
              <Link href="/auth/signup" style={{ color: "var(--sky)", fontFamily: "Nunito, sans-serif", fontWeight: 700, textDecoration: "none" }}>Create account</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}