import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { description } = await req.json();
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  const prompt = `You are a creative UI theme designer for a kids' music app called Cadenza.
The user has described a visual theme they want: "${description.slice(0, 200)}"

Return ONLY a valid JSON object (no markdown, no explanation) with these exact keys:
{
  "background": "<CSS gradient string for the animated page background — make it vivid and beautiful>",
  "charcoal": "<dark hex color for text — must be very dark and legible on white>",
  "muted": "<medium hex color for secondary text — warm neutral, not purple>",
  "border": "<rgba CSS color for subtle borders>",
  "borderStrong": "<rgba CSS color for stronger borders>",
  "cream": "<rgba CSS color for card/surface backgrounds — translucent white>",
  "white": "<rgba CSS color for panels — mostly white but slightly tinted>",
  "label": "<2–3 word name for this theme>"
}

Guidelines:
- Make the background gradient evocative and colorful (like the aurora effect but for this theme)
- Text colors (charcoal, muted) must stay dark/neutral so they're readable — don't make them colorful
- Surfaces (cream, white) should be semi-transparent white so the background shows through
- Keep border colors subtle and matching the theme's accent color`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    // Strip markdown fences if present
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const theme = JSON.parse(json);
    return NextResponse.json({ theme });
  } catch (err) {
    console.error("fun-theme error:", err);
    return NextResponse.json({ error: "Failed to generate theme" }, { status: 500 });
  }
}
