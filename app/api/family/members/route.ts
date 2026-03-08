import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get own profile (need family_id)
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("family_id, switch_pin")
    .eq("id", user.id)
    .single();

  if (!myProfile?.family_id) {
    return NextResponse.json({ members: [], familyCode: null, hasPin: false });
  }

  const familyId = myProfile.family_id;
  const familyCode = familyId.replace(/-/g, "").slice(0, 8).toUpperCase();

  // Get all other members in the same family (RLS policy allows this)
  const { data: members, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, switch_pin")
    .eq("family_id", familyId)
    .neq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    members: (members ?? []).map(m => ({
      id: m.id,
      displayName: m.display_name,
      avatarUrl: m.avatar_url ?? null,
      hasPin: !!m.switch_pin,
    })),
    familyCode,
    hasPin: !!myProfile.switch_pin,
  });
}
