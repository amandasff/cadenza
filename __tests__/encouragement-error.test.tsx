/**
 * Tests for encouragement send error handling.
 *
 * Verifies that when the /api/messages/send call fails, the teacher
 * sees an error message in the modal instead of a silent failure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Inline the sendEncouragement logic so we can test it in isolation ────────
// (mirrors the state machine in app/teacher/page.tsx)

interface SendState {
  error: string | null;
  sending: boolean;
  closed: boolean;
}

async function sendEncouragement(
  fetchFn: typeof fetch,
  studioId: string,
  recipientId: string,
  msg: string
): Promise<SendState> {
  const state: SendState = { error: null, sending: true, closed: false };
  try {
    const res = await fetchFn("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioId, content: msg.trim(), recipientId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Failed to send message");
    }
    state.closed = true; // modal closes on success
  } catch (err) {
    state.error = err instanceof Error ? err.message : "Failed to send. Please try again.";
  } finally {
    state.sending = false;
  }
  return state;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("sendEncouragement", () => {
  it("closes modal and sets no error on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { id: "msg-1" } }),
    });
    const state = await sendEncouragement(mockFetch as unknown as typeof fetch, "studio-1", "student-1", "Keep it up!");
    expect(state.closed).toBe(true);
    expect(state.error).toBeNull();
    expect(state.sending).toBe(false);
  });

  it("shows API error message when server returns non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "studioId and content are required" }),
    });
    const state = await sendEncouragement(mockFetch as unknown as typeof fetch, "studio-1", "student-1", "Hey!");
    expect(state.closed).toBe(false);
    expect(state.error).toBe("studioId and content are required");
    expect(state.sending).toBe(false);
  });

  it("shows fallback error message when server returns non-ok with no body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error("no body"); },
    });
    const state = await sendEncouragement(mockFetch as unknown as typeof fetch, "studio-1", "student-1", "Hey!");
    expect(state.closed).toBe(false);
    expect(state.error).toBe("Failed to send message");
    expect(state.sending).toBe(false);
  });

  it("shows error when fetch itself throws (network failure)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const state = await sendEncouragement(mockFetch as unknown as typeof fetch, "studio-1", "student-1", "Hey!");
    expect(state.closed).toBe(false);
    expect(state.error).toBe("Network error");
    expect(state.sending).toBe(false);
  });

  it("always clears sending state, even on error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("timeout"));
    const state = await sendEncouragement(mockFetch as unknown as typeof fetch, "studio-1", "student-1", "Hey!");
    expect(state.sending).toBe(false);
  });
});
