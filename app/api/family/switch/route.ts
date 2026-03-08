import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetId, pin } = await request.json() as { targetId?: string; pin?: string };
  if (!targetId || !pin) {
    return NextResponse.json({ error: "targetId and pin required" }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
  }

  // Verify both users are in the same family
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, family_id, switch_pin")
    .in("id", [user.id, targetId]);

  const myProfile = profiles?.find(p => p.id === user.id);
  const targetProfile = profiles?.find(p => p.id === targetId);

  if (!myProfile?.family_id || !targetProfile?.family_id) {
    return NextResponse.json({ error: "Users not in a family" }, { status: 403 });
  }
  if (myProfile.family_id !== targetProfile.family_id) {
    return NextResponse.json({ error: "Not in the same family" }, { status: 403 });
  }
  if (!targetProfile.switch_pin) {
    return NextResponse.json({ error: "Sibling hasn't set a switch PIN yet" }, { status: 400 });
  }

  // Verify PIN
  const hashed = crypto.createHash("sha256").update(pin + targetId).digest("hex");
  if (hashed !== targetProfile.switch_pin) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }

  // Look up target user's email via admin API
  const admin = getSupabaseAdminClient();
  const { data: { user: targetUser }, error: adminErr } = await admin.auth.admin.getUserById(targetId);
  if (adminErr || !targetUser?.email) {
    return NextResponse.json({ error: "Could not look up sibling account" }, { status: 500 });
  }

  // Generate a magic link for the sibling
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectTo = `${protocol}://${host}/auth/callback`;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: "Could not generate switch link" }, { status: 500 });
  }

  return NextResponse.json({ actionLink: linkData.properties.action_link });
}
