import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_solo: true })
      .eq("id", userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("solo route error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
