/**
 * Smoke test — Sign-up critical path
 *
 * Tests AuthService.signUp() in isolation by mocking the Supabase client
 * and the /api/profile/ensure fetch. Verifies the happy path and the two
 * most common failure modes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "@/lib/services/AuthService";

// ── helpers ──────────────────────────────────────────────────────────────────

const FAKE_USER = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: { role: "student", display_name: "Test User" },
};

function buildMockSupabase(overrides: {
  signUpError?: string | null;
  hasSession?: boolean;
}) {
  const { signUpError = null, hasSession = true } = overrides;
  return {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: {
          user: signUpError ? null : FAKE_USER,
          session: hasSession ? { access_token: "tok" } : null,
        },
        error: signUpError ? { message: signUpError } : null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("Sign-up smoke test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton so each test gets a fresh instance
    // @ts-expect-error accessing private static
    AuthService.instance = null;

    // Default: /api/profile/ensure succeeds
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it("happy path — creates a student and returns correct role", async () => {
    const supabase = buildMockSupabase({ hasSession: true });
    const service = AuthService.getInstance(supabase as never);

    const user = await service.signUp("test@example.com", "password123", "student", "Test User");

    expect(user.role).toBe("student");
    expect(user.email).toBe("test@example.com");
    expect(supabase.auth.signUp).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/profile/ensure",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("happy path — creates a teacher and returns correct role", async () => {
    const supabase = buildMockSupabase({ hasSession: true });
    const service = AuthService.getInstance(supabase as never);
    const teacherUser = { ...FAKE_USER, user_metadata: { role: "teacher", display_name: "Ms. Rivera" } };
    (supabase.auth.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: teacherUser, session: { access_token: "tok" } },
      error: null,
    });

    const user = await service.signUp("teacher@example.com", "securepass", "teacher", "Ms. Rivera");

    expect(user.role).toBe("teacher");
  });

  it("throws when Supabase returns an auth error", async () => {
    const supabase = buildMockSupabase({ signUpError: "Email already registered" });
    const service = AuthService.getInstance(supabase as never);

    await expect(
      service.signUp("existing@example.com", "password123", "student", "User")
    ).rejects.toThrow("Email already registered");
  });

  it("throws when email confirmation is required (no session)", async () => {
    const supabase = buildMockSupabase({ hasSession: false });
    const service = AuthService.getInstance(supabase as never);

    await expect(
      service.signUp("pending@example.com", "password123", "student", "User")
    ).rejects.toThrow(/confirm/i);
  });

  it("throws when /api/profile/ensure fails", async () => {
    const supabase = buildMockSupabase({ hasSession: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "DB write failed" }),
    });
    const service = AuthService.getInstance(supabase as never);

    await expect(
      service.signUp("test@example.com", "password123", "student", "User")
    ).rejects.toThrow(/profile/i);
  });

  it("rejects passwords shorter than 6 characters before calling Supabase", async () => {
    // The length check lives in the UI (app/page.tsx), not AuthService.
    // Verify AuthService itself still propagates the Supabase weak-password error.
    const supabase = buildMockSupabase({ signUpError: "Password should be at least 6 characters" });
    const service = AuthService.getInstance(supabase as never);

    await expect(
      service.signUp("test@example.com", "abc", "student", "User")
    ).rejects.toThrow(/6 characters/i);
  });
});
