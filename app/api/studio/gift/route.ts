import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { senderId, recipientId, itemId, message } = await req.json();
    if (!senderId || !recipientId || !itemId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (senderId === recipientId) {
      return NextResponse.json({ error: "Cannot gift yourself" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Verify item exists
    const { data: item, error: itemErr } = await supabase
      .from("shop_items")
      .select("id, name")
      .eq("id", itemId)
      .single();
    if (itemErr || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    // Insert gift
    const { error } = await supabase.from("studio_gifts").insert({
      sender_id: senderId,
      recipient_id: recipientId,
      item_id: itemId,
      message: message ?? null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("studio/gift error:", e);
    return NextResponse.json({ error: "Gift failed" }, { status: 500 });
  }
}
