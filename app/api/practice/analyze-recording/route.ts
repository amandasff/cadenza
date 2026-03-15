import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await request.json() as { sessionId: string };
    if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

    // Fetch the session
    const { data: session, error: sessionErr } = await supabase
      .from("practice_sessions")
      .select("*, pieces(title)")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    // recording_url is optional — we can still generate text feedback from session context

    // Fetch student profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, grade_level")
      .eq("id", session.student_id)
      .single();

    // Fetch goal if linked
    let goalTitle = "";
    if (session.goal_id) {
      const { data: goal } = await supabase
        .from("goals")
        .select("title")
        .eq("id", session.goal_id)
        .single();
      goalTitle = goal?.title ?? "";
    }

    // Build context
    const studentName = profile?.display_name ?? "the student";
    const grade = profile?.grade_level ?? "";
    const pieceTitle = (session.pieces as { title?: string } | null)?.title ?? "";
    const notes = session.notes ?? "";
    const durationMins = Math.max(1, Math.round((session.duration_seconds ?? 0) / 60));
    const segments: Array<{ title: string; practice_area: string }> = session.segments_json ?? [];

    const contextLines: string[] = [];
    contextLines.push(`Student: ${studentName}${grade ? ` (${grade})` : ""}`);
    contextLines.push(`Session length: ${durationMins} minute${durationMins !== 1 ? "s" : ""}`);
    if (pieceTitle) contextLines.push(`Piece: ${pieceTitle}`);
    if (goalTitle) contextLines.push(`Goal this session: ${goalTitle}`);
    if (segments.length > 0) {
      contextLines.push(`Sections practiced: ${segments.map((s) => s.title || s.practice_area).join(", ")}`);
    }
    if (notes) contextLines.push(`Student's own notes: ${notes}`);

    let audioAnalysis: Record<string, unknown> | null = null;

    // ── Step 1 (optional): Gemini 2.0 Flash listens to the audio ──
    if (session.recording_url) {
      try {
        const audioRes = await fetch(session.recording_url);
        if (audioRes.ok) {
          const audioBuffer = await audioRes.arrayBuffer();
          const base64Audio = Buffer.from(audioBuffer).toString("base64");
          const mimeType = session.recording_url.includes(".ogg")
            ? "audio/ogg"
            : session.recording_url.includes(".mp4")
            ? "audio/mp4"
            : "audio/webm";

          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const analysisPrompt = `Listen carefully to this music practice recording and extract detailed observations as JSON.

Return ONLY a JSON object with these fields:
{
  "tempo_quality": "description of rhythm/timing accuracy and consistency",
  "technical_observations": ["specific observation 1", "specific observation 2"],
  "tone_quality": "description of tone, dynamics, and expression",
  "overall_impression": "1-2 sentence overall summary",
  "improvement_areas": ["specific area 1", "specific area 2"],
  "strengths": ["specific strength 1", "specific strength 2"]
}

Be specific and musical.`;

          const geminiResult = await model.generateContent([
            { inlineData: { data: base64Audio, mimeType } },
            analysisPrompt,
          ]);

          const raw = geminiResult.response.text();
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          audioAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { overall_impression: raw };
        }
      } catch (err) {
        console.error("Gemini audio analysis failed, falling back to text-only:", err);
      }
    }

    // ── Step 2: Claude writes the feedback ──
    const claudePrompt = audioAnalysis
      ? `You are Cadenza AI — a warm, encouraging music teacher giving feedback to a student after their practice session.

Session context:
${contextLines.join("\n")}

Audio analysis (from listening to the recording):
${JSON.stringify(audioAnalysis, null, 2)}

Write personalized coaching feedback in 2–3 short paragraphs. No bullet points, no headers.
- Reference specific details from the audio analysis
- Be encouraging but honest
- End with 1-2 concrete next steps
- Keep it under 200 words
- Use the student's first name`
      : `You are Cadenza AI — a warm, encouraging music teacher giving feedback to a student after their practice session.

Session context:
${contextLines.join("\n")}

Write personalized coaching feedback in 2–3 short paragraphs. No bullet points, no headers.
- Base your feedback on the session context (duration, piece, notes, goals)
- Acknowledge their effort and encourage consistency
- End with 1-2 concrete, specific next steps based on what they practiced
- Keep it under 200 words
- Use the student's first name`;

    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: claudePrompt }],
    });

    const feedback = message.content[0].type === "text" ? message.content[0].text : "";

    // Store feedback in DB
    await supabase
      .from("practice_sessions")
      .update({ ai_feedback: feedback })
      .eq("id", sessionId);

    return Response.json({ feedback });
  } catch (err) {
    console.error("Recording analysis error:", err);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
