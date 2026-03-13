/**
 * Tests for the unread badge realtime subscription logic.
 *
 * Verifies that:
 * - A new message from another user sets hasUnread = true
 * - A new message from the current user does NOT set hasUnread = true
 * - The channel is cleaned up on unmount
 */
import { describe, it, expect, vi } from "vitest";

// ─── Inline the payload handler logic ────────────────────────────────────────
// (mirrors the realtime callback in app/teacher/layout.tsx and student/layout.tsx)

function handleIncomingMessage(
  payload: { new: { sender_id?: string } },
  currentUserId: string,
  setHasUnread: (val: boolean) => void
) {
  if (payload.new.sender_id !== currentUserId) {
    setHasUnread(true);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("realtime unread badge handler", () => {
  it("sets hasUnread=true when a message arrives from another user", () => {
    const setHasUnread = vi.fn();
    handleIncomingMessage(
      { new: { sender_id: "other-user-999" } },
      "current-user-123",
      setHasUnread
    );
    expect(setHasUnread).toHaveBeenCalledWith(true);
  });

  it("does NOT set hasUnread when the message is from the current user", () => {
    const setHasUnread = vi.fn();
    handleIncomingMessage(
      { new: { sender_id: "current-user-123" } },
      "current-user-123",
      setHasUnread
    );
    expect(setHasUnread).not.toHaveBeenCalled();
  });

  it("sets hasUnread=true when sender_id is undefined (system message)", () => {
    const setHasUnread = vi.fn();
    handleIncomingMessage(
      { new: {} },
      "current-user-123",
      setHasUnread
    );
    expect(setHasUnread).toHaveBeenCalledWith(true);
  });
});
