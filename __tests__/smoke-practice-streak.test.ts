/**
 * Smoke test — Practice session streak & points logic
 *
 * Inlines the streak calculation from app/api/practice/log/route.ts so
 * we can test it in pure isolation without Next.js or Supabase dependencies.
 * This logic is the most financially meaningful path: it controls streaks
 * and points that drive student retention.
 */
import { describe, it, expect } from "vitest";

// ── Inline the exact streak/points logic from route.ts ───────────────────────

function toUTCDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function computeStreak(params: {
  todayStr: string;
  lastSessionDate: string | null;  // UTC date string "YYYY-MM-DD" of previous session, or null
  currentStreak: number;
  availableFreezes: number;
}): { newStreak: number; freezesConsumed: number } {
  const { todayStr, lastSessionDate, currentStreak, availableFreezes } = params;

  const lastDateMs = lastSessionDate
    ? new Date(lastSessionDate + "T00:00:00Z").getTime()
    : null;
  const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
  const gapDays = lastDateMs !== null
    ? Math.round((todayMs - lastDateMs) / 86_400_000)
    : null;
  const missedDays = gapDays !== null ? gapDays - 1 : null;

  let newStreak: number;
  let freezesConsumed = 0;

  if (gapDays === null) {
    newStreak = 1;
  } else if (gapDays === 0) {
    newStreak = currentStreak;
  } else if (gapDays === 1) {
    newStreak = currentStreak + 1;
  } else if (missedDays! <= availableFreezes && availableFreezes > 0) {
    newStreak = currentStreak + 1;
    freezesConsumed = missedDays!;
  } else {
    newStreak = 1;
  }

  return { newStreak, freezesConsumed };
}

function computePoints(params: {
  newStreak: number;
  gapDays: number | null;  // null = first ever session
  currentPoints: number;
}): { pointsEarned: number; totalPoints: number } {
  const { newStreak, gapDays, currentPoints } = params;
  const isFirstSessionToday = gapDays !== 0;
  const sessionBonus = isFirstSessionToday ? 100 : 0;
  const weekStreakBonus = newStreak > 0 && newStreak % 7 === 0 ? 500 : 0;
  const pointsEarned = sessionBonus + weekStreakBonus;
  return { pointsEarned, totalPoints: currentPoints + pointsEarned };
}

// ── tests ─────────────────────────────────────────────────────────────────────

const TODAY = "2026-01-10";
const YESTERDAY = "2026-01-09";
const TWO_DAYS_AGO = "2026-01-08";
const THREE_DAYS_AGO = "2026-01-07";

describe("Practice streak smoke tests", () => {
  describe("streak calculation", () => {
    it("first ever session starts streak at 1", () => {
      const { newStreak } = computeStreak({
        todayStr: TODAY,
        lastSessionDate: null,
        currentStreak: 0,
        availableFreezes: 0,
      });
      expect(newStreak).toBe(1);
    });

    it("second session the same day does not change streak", () => {
      const { newStreak } = computeStreak({
        todayStr: TODAY,
        lastSessionDate: TODAY,       // already practiced today
        currentStreak: 5,
        availableFreezes: 0,
      });
      expect(newStreak).toBe(5);      // unchanged
    });

    it("session the day after extends the streak", () => {
      const { newStreak } = computeStreak({
        todayStr: TODAY,
        lastSessionDate: YESTERDAY,
        currentStreak: 7,
        availableFreezes: 0,
      });
      expect(newStreak).toBe(8);
    });

    it("gap of 2 days with no freezes resets streak to 1", () => {
      const { newStreak, freezesConsumed } = computeStreak({
        todayStr: TODAY,
        lastSessionDate: TWO_DAYS_AGO,
        currentStreak: 10,
        availableFreezes: 0,
      });
      expect(newStreak).toBe(1);
      expect(freezesConsumed).toBe(0);
    });

    it("gap of 2 days with 1 freeze protects the streak", () => {
      const { newStreak, freezesConsumed } = computeStreak({
        todayStr: TODAY,
        lastSessionDate: TWO_DAYS_AGO, // missed 1 day
        currentStreak: 10,
        availableFreezes: 1,
      });
      expect(newStreak).toBe(11);
      expect(freezesConsumed).toBe(1);
    });

    it("gap of 3 days with only 1 freeze resets streak (not enough freezes)", () => {
      const { newStreak } = computeStreak({
        todayStr: TODAY,
        lastSessionDate: THREE_DAYS_AGO, // missed 2 days
        currentStreak: 10,
        availableFreezes: 1,             // only 1 freeze, need 2
      });
      expect(newStreak).toBe(1);
    });

    it("gap of 3 days with 2 freezes protects the streak", () => {
      const { newStreak, freezesConsumed } = computeStreak({
        todayStr: TODAY,
        lastSessionDate: THREE_DAYS_AGO, // missed 2 days
        currentStreak: 10,
        availableFreezes: 2,
      });
      expect(newStreak).toBe(11);
      expect(freezesConsumed).toBe(2);
    });
  });

  describe("points calculation", () => {
    it("first session today earns 100 points", () => {
      const { pointsEarned } = computePoints({
        newStreak: 1,
        gapDays: null,  // first ever
        currentPoints: 0,
      });
      expect(pointsEarned).toBe(100);
    });

    it("second session same day earns 0 points", () => {
      const { pointsEarned } = computePoints({
        newStreak: 5,
        gapDays: 0,     // already practiced today
        currentPoints: 500,
      });
      expect(pointsEarned).toBe(0);
    });

    it("7-day streak earns 500 bonus on top of 100 session points", () => {
      const { pointsEarned } = computePoints({
        newStreak: 7,
        gapDays: 1,
        currentPoints: 600,
      });
      expect(pointsEarned).toBe(600); // 100 session + 500 streak
    });

    it("14-day streak also earns the 500 bonus", () => {
      const { pointsEarned } = computePoints({
        newStreak: 14,
        gapDays: 1,
        currentPoints: 0,
      });
      expect(pointsEarned).toBe(600);
    });

    it("6-day streak earns only the regular 100 session points", () => {
      const { pointsEarned } = computePoints({
        newStreak: 6,
        gapDays: 1,
        currentPoints: 0,
      });
      expect(pointsEarned).toBe(100);
    });

    it("total points accumulate correctly", () => {
      const { totalPoints } = computePoints({
        newStreak: 3,
        gapDays: 1,
        currentPoints: 850,
      });
      expect(totalPoints).toBe(950);
    });
  });

  // ── Live streak sync tests ───────────────────────────────────────────────
  // Mirrors the logic in /api/streak/sync and the leaderboard's live
  // computation. Given a stored streak and the last session date, compute
  // the streak value that should be displayed/stored.

  describe("live streak sync (stale DB correction)", () => {
    function computeLiveStreak(params: {
      storedStreak: number;
      lastSessionDate: string | null; // ISO timestamp or null
      freezeCount: number;
      todayStr: string;
    }): number {
      const { storedStreak, lastSessionDate, freezeCount, todayStr } = params;
      if (storedStreak <= 0) return storedStreak;
      if (!lastSessionDate) return 0;

      const lastUTC = toUTCDateStr(new Date(lastSessionDate));
      const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
      const yesterdayUTC = toUTCDateStr(new Date(todayMs - 86_400_000));

      if (lastUTC === todayStr || lastUTC === yesterdayUTC) return storedStreak;

      const lastMs = new Date(lastUTC + "T00:00:00Z").getTime();
      const gapDays = Math.round((todayMs - lastMs) / 86_400_000);
      const missedDays = gapDays - 1;
      if (missedDays >= 1 && missedDays <= freezeCount) return storedStreak;

      return 0;
    }

    it("returns stored streak if last session was today", () => {
      expect(computeLiveStreak({ storedStreak: 10, lastSessionDate: "2026-01-10T15:00:00Z", freezeCount: 0, todayStr: TODAY })).toBe(10);
    });

    it("returns stored streak if last session was yesterday", () => {
      expect(computeLiveStreak({ storedStreak: 10, lastSessionDate: "2026-01-09T20:00:00Z", freezeCount: 0, todayStr: TODAY })).toBe(10);
    });

    it("zeros streak if last session was 2 days ago and no freezes", () => {
      expect(computeLiveStreak({ storedStreak: 10, lastSessionDate: "2026-01-08T12:00:00Z", freezeCount: 0, todayStr: TODAY })).toBe(0);
    });

    it("preserves streak if last session was 2 days ago with 1 freeze", () => {
      expect(computeLiveStreak({ storedStreak: 10, lastSessionDate: "2026-01-08T12:00:00Z", freezeCount: 1, todayStr: TODAY })).toBe(10);
    });

    it("zeros streak if last session was 4 days ago with only 1 freeze", () => {
      expect(computeLiveStreak({ storedStreak: 10, lastSessionDate: "2026-01-06T12:00:00Z", freezeCount: 1, todayStr: TODAY })).toBe(0);
    });

    it("preserves streak if last session was 4 days ago with 3 freezes", () => {
      expect(computeLiveStreak({ storedStreak: 10, lastSessionDate: "2026-01-06T12:00:00Z", freezeCount: 3, todayStr: TODAY })).toBe(10);
    });

    it("zeros streak if no session exists", () => {
      expect(computeLiveStreak({ storedStreak: 5, lastSessionDate: null, freezeCount: 0, todayStr: TODAY })).toBe(0);
    });

    it("returns 0 if stored streak is already 0", () => {
      expect(computeLiveStreak({ storedStreak: 0, lastSessionDate: "2026-01-10T12:00:00Z", freezeCount: 0, todayStr: TODAY })).toBe(0);
    });

    it("manual DB edit without matching session gets zeroed (Adrien's bug)", () => {
      // Teacher manually sets streak_days=15 in DB, but last session is a week old
      expect(computeLiveStreak({ storedStreak: 15, lastSessionDate: "2026-01-03T12:00:00Z", freezeCount: 0, todayStr: TODAY })).toBe(0);
    });

    it("excused absence (inserted backdated session) preserves streak", () => {
      // After teacher excuses yesterday, last session is now yesterday
      expect(computeLiveStreak({ storedStreak: 15, lastSessionDate: "2026-01-09T12:00:00Z", freezeCount: 0, todayStr: TODAY })).toBe(15);
    });
  });
});
