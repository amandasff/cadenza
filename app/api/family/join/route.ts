import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await request.json() as { code?: string };
  if (!code || code.trim().length === 0) {
    return NextResponse.json({ error: "Family code is required" }, { status: 400 });
  }

  // Normalize: strip dashes, uppercase
  const normalized = code.replace(/-/g, "").toUpperCase().slice(0, 8);

  // Find family whose id starts with this code (hex prefix of UUID without dashes)
  const admin = getSupabaseAdminClient();
  const { data: families, error: findErr } = await admin
    .from("families")
    .select("id")
    .ilike("id", normalized.slice(0, 8).toLowerCase().split("").join("") + "%");

  // UUIDs look like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // First 8 hex chars = first segment of UUID
  // We match families where replace(id::text, '-', '') ILIKE 'XXXXXXXX%'
  // Supabase .ilike doesn't support functions, so we do a range query instead:
  // Find by checking all families and filtering in JS (small dataset)
  if (findErr) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });

  const match = (families ?? []).find(f => {
    const code8 = f.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    return code8 === normalized;
  });

  if (!match) {
    return NextResponse.json({ error: "Family not found. Check the code and try again." }, { status: 404 });
  }

  // Check not already in this family
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();

  if (myProfile?.family_id === match.id) {
    return NextResponse.json({ error: "Already in this family." }, { status: 400 });
  }

  if (myProfile?.family_id) {
    return NextResponse.json({ error: "Already in a family. Leave first." }, { status: 400 });
  }

  const { error: joinErr } = await supabase
    .from("profiles")
    .update({ family_id: match.id })
    .eq("id", user.id);

  if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
