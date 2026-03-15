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
    if (!session.recording_url) {
      return Response.json({ error: "No recording" }, { status: 400 });
    }

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

    // Fetch audio from Supabase storage
    const audioRes = await fetch(session.recording_url);
    if (!audioRes.ok) {
      return Response.json({ error: "Could not fetch audio" }, { status: 500 });
    }
    const audioBuffer = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    // Build context
    const studentName = profile?.display_name ?? "the student";
    const grade = profile?.grade_level ?? "";
    const pieceTitle = (session.pieces as { title?: string } | null)?.title ?? "";
    const notes = session.notes ?? "";
    const durationMins = Math.max(1, Math.round((session.duration_seconds ?? 0) / 60));
    const segments: Array<{ title: string; practice_area: string }> = session.segments_json ?? [];

    // ── Step 1: Gemini 2.0 Flash listens to the audio and extracts observations ──
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const analysisPrompt = `Listen carefully to this music practice recording and extract detailed observations as JSON.

Return ONLY a JSON object with these fields:
{
  "tempo_quality": "description of rhythm/timing accuracy and consistency",
  "technical_observations": ["specific observation 1", "specific observation 2", ...],
  "tone_quality": "description of tone, dynamics, and expression",
  "notable_moments": ["any standout moments — good or needs work"],
  "overall_impression": "1-2 sentence overall summary of the performance",
  "improvement_areas": ["specific area 1", "specific area 2"],
  "strengths": ["specific strength 1", "specific strength 2"]
}

Be specific and musical. Note actual musical details you hear.`;

    const geminiResult = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType: "audio/webm",
        },
      },
      analysisPrompt,
    ]);

    let audioAnalysis: Record<string, unknown> = {};
    try {
      const raw = geminiResult.response.text();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        audioAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        audioAnalysis = { overall_impression: raw };
      }
    } catch {
      audioAnalysis = { overall_impression: geminiResult.response.text() };
    }

    // ── Step 2: Claude writes the actual feedback using the audio analysis ──
    const contextLines: string[] = [];
    contextLines.push(`Student: ${studentName}${grade ? ` (${grade})` : ""}`);
    contextLines.push(`Session length: ${durationMins} minute${durationMins !== 1 ? "s" : ""}`);
    if (pieceTitle) contextLines.push(`Piece: ${pieceTitle}`);
    if (goalTitle) contextLines.push(`Goal this session: ${goalTitle}`);
    if (segments.length > 0) {
      contextLines.push(`Sections practiced: ${segments.map((s) => s.title || s.practice_area).join(", ")}`);
    }
    if (notes) contextLines.push(`Student's own notes: ${notes}`);

    const claudePrompt = `You are Cadenza AI — a warm, encouraging music teacher giving feedback to a student after their practice session.

Session context:
${contextLines.join("\n")}

Audio analysis (from listening to the recording):
${JSON.stringify(audioAnalysis, null, 2)}

Write personalized coaching feedback in 2–3 short paragraphs. No bullet points, no headers.
- Address what you actually heard (reference specific details from the audio analysis)
- Be encouraging but honest
- End with 1-2 concrete next steps they can work on
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
