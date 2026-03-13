/**
 * Tests for the AI tutor server-side rate limiting logic.
 *
 * The rate limiter queries the ai_calls table and returns true when
 * the user has exceeded HOURLY_LIMIT calls in the last hour.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Inline the rate limit logic so we can test it in isolation ──────────────
// (mirrors app/api/ai-tutor/route.ts)

const HOURLY_LIMIT = 20;

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

function buildMockSupabase(count: number | null, error: unknown = null): MockSupabase {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count, error }),
  };
  return { from: vi.fn().mockReturnValue(chain) };
}

async function checkRateLimit(supabase: MockSupabase, userId: string): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string, o: object) => {
        eq: (k: string, v: string) => {
          gte: (k: string, v: string) => Promise<{ count: number | null; error: unknown }>;
        };
      };
    };
  })
    .from("ai_calls")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourAgo);

  if (error) return false; // fail open when table missing
  return typeof count === "number" && count >= HOURLY_LIMIT;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AI tutor rate limiter", () => {
  const USER_ID = "user-abc-123";

  it("allows request when user has 0 calls in the last hour", async () => {
    const supabase = buildMockSupabase(0);
    expect(await checkRateLimit(supabase, USER_ID)).toBe(false);
  });

  it("allows request when user has 19 calls (one under limit)", async () => {
    const supabase = buildMockSupabase(HOURLY_LIMIT - 1);
    expect(await checkRateLimit(supabase, USER_ID)).toBe(false);
  });

  it("blocks request when user has exactly HOURLY_LIMIT calls", async () => {
    const supabase = buildMockSupabase(HOURLY_LIMIT);
    expect(await checkRateLimit(supabase, USER_ID)).toBe(true);
  });

  it("blocks request when user has exceeded HOURLY_LIMIT calls", async () => {
    const supabase = buildMockSupabase(HOURLY_LIMIT + 5);
    expect(await checkRateLimit(supabase, USER_ID)).toBe(true);
  });

  it("fails open (allows request) when ai_calls table does not exist", async () => {
    // Simulates the table missing — should not block the user
    const supabase = buildMockSupabase(null, { message: 'relation "ai_calls" does not exist' });
    expect(await checkRateLimit(supabase, USER_ID)).toBe(false);
  });

  it("fails open when count is null (unexpected DB response)", async () => {
    const supabase = buildMockSupabase(null, null);
    expect(await checkRateLimit(supabase, USER_ID)).toBe(false);
  });
});
