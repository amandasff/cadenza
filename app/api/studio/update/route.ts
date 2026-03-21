import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    // Authenticate caller — they may only update their own profile
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId, studio_name, studio_tagline, featured_avatar_id, artist_name } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (user.id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = getSupabaseAdminClient();

    const updates: Record<string, string | null> = {};
    if (studio_name !== undefined) updates.studio_name = studio_name ?? null;
    if (studio_tagline !== undefined) updates.studio_tagline = studio_tagline ?? null;
    if (featured_avatar_id !== undefined) updates.featured_avatar_id = featured_avatar_id ?? null;
    if (artist_name !== undefined) updates.artist_name = artist_name ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from("profiles").update(updates).eq("id", userId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("studio/update error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
