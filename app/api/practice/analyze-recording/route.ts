import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    // Fetch student profile for name + grade
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

    // Build context string
    const studentName = profile?.display_name ?? "the student";
    const grade = profile?.grade_level ?? "";
    const pieceTitle = (session.pieces as { title?: string } | null)?.title ?? "";
    const notes = session.notes ?? "";

    const contextParts: string[] = [];
    if (studentName) contextParts.push(`Student: ${studentName}`);
    if (grade) contextParts.push(`Level: ${grade}`);
    if (pieceTitle) contextParts.push(`Piece: ${pieceTitle}`);
    if (goalTitle) contextParts.push(`Goal: ${goalTitle}`);
    const contextLine = contextParts.join(" | ");

    // Call Claude with audio
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: `You are Cadenza AI, a warm and encouraging music teacher reviewing a student's practice recording.
Be specific, positive, and practical. Keep your response under 200 words total.
Use short paragraphs — no bullet lists, no headers.
If the audio is unclear or background noise makes it hard to assess, acknowledge this warmly and still give useful encouragement based on the context provided.
Focus on what you can actually hear.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "audio" as const,
              source: {
                type: "base64" as const,
                media_type: "audio/webm",
                data: base64Audio,
              },
            },
            {
              type: "text",
              text: `${contextLine}${notes ? `\nStudent's practice notes: ${notes}` : ""}

Please listen to this practice recording and give warm, specific feedback covering: rhythm & timing, technical execution, practice quality, and one or two encouraging next steps.`,
            },
          ],
        },
      ],
    });

    const feedback = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

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
