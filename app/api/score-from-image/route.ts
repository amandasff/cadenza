import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert music engraver and MusicXML specialist.
Your job is to read a photo or screenshot of sheet music and output a valid MusicXML 4.0 file.

Rules:
- Output ONLY the raw MusicXML document. No explanation, no markdown, no code fences.
- Start with the XML declaration: <?xml version="1.0" encoding="UTF-8"?>
- Use MusicXML 4.0 schema (DOCTYPE ScorePartwise).
- Include all visible notes, rests, time signatures, key signatures, clefs, and tempo marks.
- If multiple staves are visible (e.g. piano grand staff), include both parts.
- If you cannot read specific notes clearly, make your best guess based on musical context.
- The output must be parseable by alphaTab or MuseScore.`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json() as {
      imageBase64: string;
      mimeType: string;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "Missing imageBase64 or mimeType" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
            },
            {
              type: "text",
              text: "Please transcribe this sheet music into MusicXML format.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from Claude" }, { status: 500 });
    }

    let musicxml = textBlock.text.trim();

    // Strip markdown code fences if Claude added them despite instructions
    musicxml = musicxml.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();

    if (!musicxml.startsWith("<?xml") && !musicxml.startsWith("<score-partwise")) {
      return NextResponse.json({ error: "Claude did not return valid MusicXML" }, { status: 500 });
    }

    return NextResponse.json({ musicxml });
  } catch (err) {
    console.error("score-from-image error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
