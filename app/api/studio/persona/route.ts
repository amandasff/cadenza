import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const supabase = getSupabaseAdminClient();

    // Fetch all studio data in parallel
    const [profileRes, collectiblesRes, piecesRes, inventoryRes] = await Promise.all([
      supabase.from("profiles").select("streak_days, total_points, instrument, studio_bio_updated_at").eq("id", userId).single(),
      supabase.from("student_collectibles").select("composer_avatars(composer_name, rarity)").eq("student_id", userId),
      supabase.from("pieces").select("title, composer, status").eq("student_id", userId).limit(10),
      supabase.from("student_inventory").select("shop_items(name, category, emoji)").eq("student_id", userId),
    ]);

    const profile = profileRes.data as { streak_days: number; total_points: number; instrument: string | null; studio_bio_updated_at: string | null } | null;

    // Cache check — regenerate at most once per 6h
    if (profile?.studio_bio_updated_at) {
      const lastUpdate = new Date(profile.studio_bio_updated_at).getTime();
      if (Date.now() - lastUpdate < 6 * 60 * 60 * 1000) {
        const cached = await supabase.from("profiles").select("studio_persona, studio_bio").eq("id", userId).single();
        if (cached.data) return NextResponse.json(cached.data);
      }
    }

    const composers = ((collectiblesRes.data ?? []) as Array<{ composer_avatars: { composer_name: string; rarity: string }[] | null }>)
      .map(c => Array.isArray(c.composer_avatars) ? c.composer_avatars[0]?.composer_name : (c.composer_avatars as unknown as { composer_name: string } | null)?.composer_name)
      .filter(Boolean) as string[];

    const pieces = ((piecesRes.data ?? []) as Array<{ title: string; composer: string | null; status: string }>)
      .map(p => `${p.title}${p.composer ? ` by ${p.composer}` : ""} (${p.status})`);

    const items = ((inventoryRes.data ?? []) as Array<{ shop_items: { name: string; category: string; emoji: string } | null }>)
      .map(i => i.shop_items ? `${i.shop_items.emoji} ${i.shop_items.name}` : null)
      .filter(Boolean) as string[];

    const prompt = `You are a panel of three experts writing a young musician's studio legend card — the kind of profile that feels so cool and specific that the student wants to show it to everyone.

PANEL:
- GAME DESIGNER: thinks about RPG character archetypes, what makes an identity feel rare and earned
- BRAND STRATEGIST: thinks about what makes a profile memorable and shareable
- MUSIC PSYCHOLOGIST: reads what a student's collected composers, repertoire, and studio items reveal about their inner musical personality

Student's studio data:
- Instrument: ${profile?.instrument ?? "not specified"}
- Practice streak: ${profile?.streak_days ?? 0} days
- Total points earned: ${profile?.total_points ?? 0}
- Composer cards collected: ${composers.length > 0 ? composers.join(", ") : "none yet"}
- Current repertoire: ${pieces.length > 0 ? pieces.slice(0, 6).join("; ") : "none yet"}
- Studio items & decorations: ${items.length > 0 ? items.join(", ") : "none yet"}

GAME DESIGNER: What rare archetype does this data suggest? (e.g. "The Storm Weaver", "The Clockwork Prodigy", "The Velvet Architect" — something vivid and specific to THEIR data, never generic)
BRAND STRATEGIST: What one detail in their studio is the most interesting hook?
MUSIC PSYCHOLOGIST: What do their collected composers and studio items reveal about what moves them?

Now synthesize into the final output:
1. "persona": A 2-4 word archetype title that feels legendary and specific to this student (NOT generic like "The Dreamer")
2. "bio": Exactly 2 sentences, written in THIRD PERSON like a character card in a music RPG. Sentence 1 paints who they are right now using their actual data. Sentence 2 is an electrifying one-liner about where they're headed. Under 60 words total. Vivid, specific, zero clichés.

Respond ONLY in JSON: { "persona": "...", "bio": "..." }`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("studio/persona: no JSON in response:", text);
      throw new Error("Model did not return valid JSON");
    }

    const { persona, bio } = JSON.parse(jsonMatch[0]) as { persona: string; bio: string };
    if (!persona || !bio) throw new Error("Missing persona or bio in response");

    // Cache in profiles
    await supabase.from("profiles").update({
      studio_persona: persona,
      studio_bio: bio,
      studio_bio_updated_at: new Date().toISOString(),
    }).eq("id", userId);

    return NextResponse.json({ studio_persona: persona, studio_bio: bio });
  } catch (e) {
    console.error("studio/persona error:", e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Failed to generate persona") }, { status: 500 });
  }
}
