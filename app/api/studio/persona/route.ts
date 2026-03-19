import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin";

const client = new Anthropic();

const PERSONA_TYPES = [
  "The Romantic",
  "The Architect",
  "The Explorer",
  "The Virtuoso",
  "The Storyteller",
  "The Minimalist",
  "The Dreamer",
  "The Maverick",
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const supabase = getSupabaseAdminClient();

    // Fetch data to base the persona on
    const [profileRes, collectiblesRes, piecesRes] = await Promise.all([
      supabase.from("profiles").select("streak_days, total_points, instrument, studio_bio_updated_at").eq("id", userId).single(),
      supabase.from("student_collectibles").select("composer_avatars(composer_name, rarity)").eq("student_id", userId),
      supabase.from("pieces").select("title, composer, status").eq("student_id", userId).limit(10),
    ]);

    const profile = profileRes.data as { streak_days: number; total_points: number; instrument: string | null; studio_bio_updated_at: string | null } | null;

    // Cache check — regenerate at most once per 24h
    if (profile?.studio_bio_updated_at) {
      const lastUpdate = new Date(profile.studio_bio_updated_at).getTime();
      if (Date.now() - lastUpdate < 24 * 60 * 60 * 1000) {
        const cached = await supabase.from("profiles").select("studio_persona, studio_bio").eq("id", userId).single();
        if (cached.data) return NextResponse.json(cached.data);
      }
    }

    const composers = ((collectiblesRes.data ?? []) as Array<{ composer_avatars: { composer_name: string; rarity: string }[] | null }>)
      .map(c => Array.isArray(c.composer_avatars) ? c.composer_avatars[0]?.composer_name : (c.composer_avatars as unknown as { composer_name: string } | null)?.composer_name)
      .filter(Boolean);

    const pieces = ((piecesRes.data ?? []) as Array<{ title: string; composer: string | null; status: string }>)
      .map(p => `${p.title}${p.composer ? ` by ${p.composer}` : ""} (${p.status})`);

    const prompt = `You are helping create a musical identity for a young music student's studio page.

Student profile:
- Instrument: ${profile?.instrument ?? "unknown"}
- Practice streak: ${profile?.streak_days ?? 0} days
- Practice points earned: ${profile?.total_points ?? 0}
- Composer cards collected: ${composers.length > 0 ? composers.join(", ") : "none yet"}
- Pieces in repertoire: ${pieces.length > 0 ? pieces.slice(0, 5).join("; ") : "none yet"}

Based on this, choose ONE of these Musical Persona types that best fits this student:
${PERSONA_TYPES.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Then write a 2-sentence studio bio in second person ("You are...") that captures their musical spirit. Make it warm, encouraging, and specific to their data. Keep it under 50 words.

Respond in JSON: { "persona": "<persona type>", "bio": "<two sentences>" }`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const { persona, bio } = JSON.parse(jsonMatch[0]) as { persona: string; bio: string };

    // Cache in profiles
    await supabase.from("profiles").update({
      studio_persona: persona,
      studio_bio: bio,
      studio_bio_updated_at: new Date().toISOString(),
    }).eq("id", userId);

    return NextResponse.json({ studio_persona: persona, studio_bio: bio });
  } catch (e) {
    console.error("studio/persona error:", e);
    return NextResponse.json({ error: "Failed to generate persona" }, { status: 500 });
  }
}
