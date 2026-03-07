import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get profile to check for existing Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, display_name")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;

    // Create Stripe customer if one doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.display_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Save customer ID back to profile
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: `${origin}/student/upgrade?success=1`,
      cancel_url: `${origin}/student/upgrade?canceled=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
