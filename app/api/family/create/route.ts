import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export async function POST() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if already in a family
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();

  if (profile?.family_id) {
    return NextResponse.json({ error: "Already in a family. Leave first." }, { status: 400 });
  }

  // Create family row
  const { data: family, error: createErr } = await supabase
    .from("families")
    .insert({})
    .select("id")
    .single();

  if (createErr || !family) {
    return NextResponse.json({ error: "Could not create family" }, { status: 500 });
  }

  // Assign current user
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ family_id: family.id })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Family code = first 8 chars of UUID
  const familyCode = family.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return NextResponse.json({ familyCode, familyId: family.id });
}
