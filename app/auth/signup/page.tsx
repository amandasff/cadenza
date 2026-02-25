"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎵</div>
          <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.75rem", color: "var(--charcoal)" }}>Join Cadenza</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>Create your account to get started</p>
        </div>

        <Card style={{ borderRadius: 20, border: "1.5px solid var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <CardHeader style={{ paddingBottom: 0 }}>
            {/* Role selector */}
            <div style={{ display: "flex", gap: "0.5rem", padding: "0.25rem", background: "var(--cream)", borderRadius: 14 }}>
              {(["student", "teacher"] as UserRole[]).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)} style={{
                  flex: 1, padding: "0.6rem", borderRadius: 10, border: "none", cursor: "pointer",
                  background: role === r ? "white" : "transparent",
                  fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem",
                  color: role === r ? "var(--charcoal)" : "var(--muted)",
                  boxShadow: role === r ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s", textTransform: "capitalize"
                }}>
                  {r === "student" ? "🎹 Student" : "👩‍🏫 Teacher"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent style={{ padding: "1.5rem 1.75rem 1.75rem" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <Label htmlFor="name" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)" }}>Display Name</Label>
                <Input id="name" type="text" placeholder={role === "student" ? "Emma Chen" : "Ms. Rivera"} value={displayName} onChange={e => setDisplayName(e.target.value)} required style={{ borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--cream)", fontFamily: "DM Sans, sans-serif" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <Label htmlFor="email" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)" }}>Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--cream)", fontFamily: "DM Sans, sans-serif" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <Label htmlFor="password" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--charcoal)" }}>Password</Label>
                <Input id="password" type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} required style={{ borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--cream)", fontFamily: "DM Sans, sans-serif" }} />
              </div>

              {error && (
                <div style={{ background: "var(--rose-bg)", border: "1.5px solid var(--rose-light)", borderRadius: 12, padding: "0.6rem 0.875rem", fontSize: "0.8rem", color: "var(--rose)", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} style={{ borderRadius: 100, background: "var(--peach)", color: "white", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", padding: "0.85rem", marginTop: "0.25rem" }}>
                {loading ? "Creating account…" : "Create " + role + " account"}
              </Button>
            </form>

            <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--muted)", marginTop: "1.25rem" }}>
              Already have an account?{" "}
              <Link href="/auth/login" style={{ color: "var(--sky)", fontFamily: "Nunito, sans-serif", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}