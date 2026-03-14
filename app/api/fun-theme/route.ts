import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { description } = await req.json();
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  const prompt = `You are a creative UI theme designer for a kids' music app called Cadenza.
The user has described a visual theme: "${description.slice(0, 200)}"

Return ONLY a valid JSON object (no markdown, no explanation) with these exact keys:
{
  "background": "<CSS gradient string — vivid, beautiful, evocative of the theme. Use multiple color stops.>",
  "charcoal": "<dark hex color for main text — must be very dark, legible on white>",
  "muted": "<hex color for secondary text — warm neutral, never purple or bright>",
  "border": "<rgba CSS color for subtle borders — tinted to match theme>",
  "borderStrong": "<rgba CSS color for stronger borders>",
  "cream": "<rgba CSS color for card surfaces — semi-transparent white, slightly tinted to theme>",
  "white": "<rgba CSS color for panels — mostly white, very subtly tinted>",
  "label": "<2–3 word poetic name for this theme>",
  "emojis": ["<emoji 1>", "<emoji 2>", "<emoji 3>", "<emoji 4>", "<emoji 5>", "<emoji 6>"]
}

Guidelines:
- background: animate-able gradient (will use background-size 400% with CSS animation). Be creative and vivid.
- charcoal + muted: always stay dark/neutral — these are text colors on white backgrounds
- cream + white: translucent so the background shows through
- emojis: pick 6 emojis that perfectly evoke the theme (e.g. galaxy → ⭐🌙🪐✨💫🌌). They float around the screen and trail the cursor, so make them delightful.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const theme = JSON.parse(json);
    // Ensure emojis is always an array
    if (!Array.isArray(theme.emojis) || theme.emojis.length === 0) {
      theme.emojis = ["✨", "🌟", "⭐", "💫", "🎵", "🎶"];
    }
    return NextResponse.json({ theme });
  } catch (err) {
    console.error("fun-theme error:", err);
    return NextResponse.json({ error: "Failed to generate theme" }, { status: 500 });
  }
}
