import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ── Same formulas as the client ──────────────────────────────────────────────
function streakMult(s: number) { return s >= 10 ? 3 : s >= 5 ? 2 : s >= 3 ? 1.5 : 1; }
function speedPts(ms: number)  { return ms < 1000 ? 75 : ms < 2000 ? 50 : ms < 3500 ? 25 : 0; }

function toLogicalGame(gameKey: string): string {
  if (gameKey.startsWith("nid_"))          return "noteId";
  if (gameKey.startsWith("interval_"))     return "interval";
  if (gameKey.startsWith("chord_finder_")) return "guitarChord";
  if (gameKey.startsWith("chord_"))        return "chord";
  if (gameKey.startsWith("terms_"))        return "terms";
  if (gameKey.startsWith("keysig_"))       return "keySig";
  if (gameKey.startsWith("scale_"))        return "scale";
  if (gameKey.startsWith("fret_"))         return "fretboard";
  return gameKey;
}

// Sanity bounds
const MAX_ANSWERS     = 35;   // max questions physically possible in 30s
const MIN_ANSWER_MS   = 400;  // minimum human reaction time (ms)
const MAX_ANSWER_MS   = 40000; // no single answer can take longer than the round
const MAX_SCORE       = 20000; // theoretical ceiling with a generous buffer

export async function POST(req: NextRequest) {
  // Authenticate the caller
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    gameKey: string;
    answers: { correct: boolean; ms: number }[];
  };

  const { gameKey, answers } = body;

  if (!gameKey || !Array.isArray(answers)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // ── Validate answers ──────────────────────────────────────────────────────

  if (answers.length > MAX_ANSWERS) {
    return NextResponse.json({ error: "Too many answers for a 30-second round" }, { status: 400 });
  }

  for (const a of answers) {
    if (typeof a.correct !== "boolean" || typeof a.ms !== "number") {
      return NextResponse.json({ error: "Malformed answer" }, { status: 400 });
    }
    if (a.ms < MIN_ANSWER_MS) {
      return NextResponse.json({ error: "Answer time too fast to be human" }, { status: 400 });
    }
    if (a.ms > MAX_ANSWER_MS) {
      return NextResponse.json({ error: "Answer time implausibly large" }, { status: 400 });
    }
  }

  // ── Recompute score server-side ───────────────────────────────────────────

  let score = 0;
  let streak = 0;

  for (const a of answers) {
    if (a.correct) {
      streak += 1;
      const mult = streakMult(streak);
      score += Math.round((100 + speedPts(a.ms)) * mult);
    } else {
      streak = 0;
    }
  }

  if (score > MAX_SCORE) {
    return NextResponse.json({ error: "Score exceeds maximum possible" }, { status: 400 });
  }

  if (score <= 0) {
    return NextResponse.json({ score: 0 });
  }

  // ── Persist to leaderboard (admin client, no RLS) ─────────────────────────

  const admin = getSupabaseAdminClient();
  const logicalGame = toLogicalGame(gameKey);

  const { data: existing } = await admin
    .from("game_leaderboard")
    .select("score")
    .eq("user_id", user.id)
    .eq("logical_game", logicalGame)
    .maybeSingle();

  const currentBest = (existing as { score: number } | null)?.score ?? 0;

  if (score > currentBest) {
    await admin.from("game_leaderboard").upsert(
      { user_id: user.id, logical_game: logicalGame, score, updated_at: new Date().toISOString() },
      { onConflict: "user_id,logical_game" }
    );
  }

  return NextResponse.json({ score });
}
