import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120; // Allow up to 2 minutes for OMR processing

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CLAUDE_SYSTEM_PROMPT = `You are an expert music engraver and MusicXML specialist.
Your job is to read a photo or screenshot of sheet music and output a valid MusicXML 4.0 file.

Rules:
- Output ONLY the raw MusicXML document. No explanation, no markdown, no code fences.
- Start with the XML declaration: <?xml version="1.0" encoding="UTF-8"?>
- Use MusicXML 4.0 schema (DOCTYPE ScorePartwise).
- Include all visible notes, rests, time signatures, key signatures, clefs, and tempo marks.
- If multiple staves are visible (e.g. piano grand staff), include both parts.
- If you cannot read specific notes clearly, make your best guess based on musical context.
- The output must be parseable by alphaTab or MuseScore.`;

/**
 * Try the dedicated OMR microservice (oemer) first.
 * Returns MusicXML string on success, null on failure.
 */
async function tryOmrService(imageBase64: string, mimeType: string): Promise<string | null> {
  const omrUrl = process.env.OMR_SERVICE_URL;
  if (!omrUrl) return null;

  try {
    // Convert base64 to a Blob for multipart upload
    const binaryStr = atob(imageBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const ext = mimeType.includes("pdf") ? "pdf"
      : mimeType.includes("png") ? "png"
      : mimeType.includes("webp") ? "webp"
      : "jpg";

    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: mimeType }), `sheet.${ext}`);

    const res = await fetch(`${omrUrl}/recognize`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(90_000), // 90s timeout
    });

    if (!res.ok) return null;

    const json = await res.json() as { success: boolean; musicxml?: string };
    if (!json.success || !json.musicxml) return null;

    // Validate it looks like real MusicXML
    if (!json.musicxml.includes("<score-partwise") && !json.musicxml.includes("<score-timewise")) {
      return null;
    }

    return json.musicxml;
  } catch (err) {
    console.warn("OMR service unavailable, falling back to Claude:", (err as Error).message);
    return null;
  }
}

/**
 * Fall back to Claude Vision for MusicXML extraction.
 * Used when: OMR service is down, not configured, or returns bad results.
 * Also the primary path for guitar TAB (OMR engines don't handle TAB).
 */
async function claudeFallback(imageBase64: string, mimeType: string): Promise<string> {
  const isPdf = mimeType === "application/pdf" || mimeType === "application/octet-stream";
  const fileContent = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: imageBase64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 } };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: CLAUDE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          fileContent,
          { type: "text", text: "Please transcribe this sheet music into MusicXML format." },
        ],
      },
    ],
  });

  const textBlock = response.content.find(b => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let musicxml = textBlock.text.trim();
  musicxml = musicxml.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();

  if (!musicxml.startsWith("<?xml") && !musicxml.startsWith("<score-partwise")) {
    throw new Error("Claude did not return valid MusicXML");
  }

  return musicxml;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json() as {
      imageBase64: string;
      mimeType: string;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "Missing imageBase64 or mimeType" }, { status: 400 });
    }

    // Strategy:
    // 1. Try dedicated OMR service (oemer) — better accuracy for standard notation
    // 2. Fall back to Claude Vision — works for TAB, handwritten, or when OMR is down
    let musicxml: string;
    let source: "omr" | "claude";

    const omrResult = await tryOmrService(imageBase64, mimeType);

    if (omrResult) {
      musicxml = omrResult;
      source = "omr";
    } else {
      musicxml = await claudeFallback(imageBase64, mimeType);
      source = "claude";
    }

    return NextResponse.json({ musicxml, source });
  } catch (err) {
    console.error("score-from-image error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
