import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { userId, studio_name, studio_tagline, featured_avatar_id } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const supabase = getSupabaseAdminClient();

    const updates: Record<string, string | null> = {};
    if (studio_name !== undefined) updates.studio_name = studio_name ?? null;
    if (studio_tagline !== undefined) updates.studio_tagline = studio_tagline ?? null;
    if (featured_avatar_id !== undefined) updates.featured_avatar_id = featured_avatar_id ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("studio/update error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
