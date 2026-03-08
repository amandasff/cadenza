import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

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

    // Build context for the prompt
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
    if (goalTitle) contextLines.push(`Goal: ${goalTitle}`);
    if (segments.length > 0) {
      contextLines.push(`Sections practiced: ${segments.map(s => s.title || s.practice_area).join(", ")}`);
    }
    if (notes) contextLines.push(`Student's notes: ${notes}`);

    const prompt = `You are Cadenza AI — a warm, encouraging music teacher reviewing a student's practice recording.

Context about this session:
${contextLines.join("\n")}

Please listen to the recording and give specific, personalized coaching feedback in 2–3 short paragraphs (no bullet points, no headers).
Cover what you actually hear: rhythm and timing, technical execution, and practice quality.
End with one or two concrete, encouraging next steps.
Keep it under 200 words. Use the student's name.`;

    // Call Gemini with audio
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType: "audio/webm",
        },
      },
      prompt,
    ]);

    const feedback = result.response.text();

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
