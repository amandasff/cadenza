import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { PortfolioService } from "../../../../lib/services/PortfolioService";

export async function POST(req: NextRequest) {
  try {
    const { collectorId, itemId } = await req.json() as { collectorId: string; itemId: string };
    if (!collectorId || !itemId) {
      return NextResponse.json({ error: "Missing collectorId or itemId" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const service = PortfolioService.create(supabase);
    await service.collectItem(collectorId, itemId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to collect";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
