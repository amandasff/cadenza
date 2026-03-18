import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { CollectibleService } from '@/lib/services/CollectibleService';
import type { AcquisitionMethod } from '@/lib/types';

/**
 * POST /api/collectibles/award
 *
 * Awards a collectible drop to the authenticated student.
 * Uses admin client so it can write past RLS.
 *
 * Body: {
 *   sessionId:    string   — practice_session id (idempotency key)
 *   composerName: string?  — composer of the piece practiced (for weighted drop)
 *   forceMethod:  string?  — 'welcome_gift' | 'streak_bonus' | 'goal_milestone' (server-trusted)
 *   milestone:    string?  — 'first_session' | 'streak_7' | 'goals_5' | 'sessions_20' | 'ear_training'
 * }
 */
export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { sessionId, composerName, milestone } = body as {
    sessionId: string;
    composerName?: string;
    milestone?: string;
  };

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  // ── Idempotency: check if we already processed this session ──────────────
  // We store a tiny flag in the practice_sessions table status field.
  // If status includes 'collectible_awarded' we skip.
  const admin = getSupabaseAdminClient();

  const { data: session } = await admin
    .from('practice_sessions')
    .select('id, status, student_id, piece_id')
    .eq('id', sessionId)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.student_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Already awarded for this session
  if (typeof session.status === 'string' && session.status.includes('collectible_awarded')) {
    return NextResponse.json({ alreadyAwarded: true });
  }

  // ── Resolve composer name from piece if not provided ─────────────────────
  let resolvedComposer: string | null = composerName ?? null;
  if (!resolvedComposer && session.piece_id) {
    const { data: piece } = await admin
      .from('pieces')
      .select('composer')
      .eq('id', session.piece_id)
      .single();
    resolvedComposer = (piece as { composer?: string | null } | null)?.composer ?? null;
  }

  // ── Run the award logic ───────────────────────────────────────────────────
  const service = CollectibleService.create(admin);

  let result;

  // Milestone awards take priority
  if (milestone) {
    result = await service.tryAwardMilestone(user.id, milestone as Parameters<typeof service.tryAwardMilestone>[1]);
    if (!result) result = await service.tryAwardDrop(user.id, resolvedComposer, sessionId);
  } else {
    // Check if this is the student's very first session ever
    const { count: sessionCount } = await admin
      .from('practice_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', user.id);

    if (sessionCount === 1) {
      // First session — always gift Bach as welcome
      result = await service.tryAwardMilestone(user.id, 'first_session');
      if (!result?.dropped) {
        result = await service.tryAwardDrop(user.id, resolvedComposer, sessionId, 'welcome_gift' as AcquisitionMethod);
      }
    } else {
      result = await service.tryAwardDrop(user.id, resolvedComposer, sessionId);
    }
  }

  // ── Mark session so we don't double-award ─────────────────────────────────
  if (result?.dropped) {
    const currentStatus = typeof session.status === 'string' ? session.status : 'completed';
    await admin
      .from('practice_sessions')
      .update({ status: `${currentStatus}|collectible_awarded` })
      .eq('id', sessionId);
  }

  return NextResponse.json({ ok: true, result });
}
