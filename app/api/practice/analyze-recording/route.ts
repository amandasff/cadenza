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

    // Fetch the session (with joined piece title)
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

    // Build rich context for Claude
    const studentName = profile?.display_name ?? "the student";
    const grade = profile?.grade_level ?? "";
    const pieceTitle = (session.pieces as { title?: string } | null)?.title ?? "";
    const notes = session.notes ?? "";
    const durationMins = Math.max(1, Math.round((session.duration_seconds ?? 0) / 60));
    const segments: Array<{ title: string; practice_area: string }> = session.segments_json ?? [];

    const lines: string[] = [];
    lines.push(`Student: ${studentName}${grade ? ` (${grade})` : ""}`);
    lines.push(`Practice duration: ${durationMins} minute${durationMins !== 1 ? "s" : ""}`);
    if (pieceTitle) lines.push(`Piece being practiced: ${pieceTitle}`);
    if (goalTitle) lines.push(`Current goal: ${goalTitle}`);
    if (segments.length > 0) {
      lines.push(`Sections practiced: ${segments.map(s => s.title || s.practice_area).join(", ")}`);
    }
    if (notes) lines.push(`Student's own notes: ${notes}`);

    const contextBlock = lines.join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `You are Cadenza AI, an encouraging and knowledgeable music teacher inside a practice app.
You are reviewing a student's practice session log (not the audio itself — you don't have access to the audio).
Based on the session information provided, give warm, specific, and actionable coaching feedback.
Write 2-3 short paragraphs. No bullet lists, no headers. Keep it under 180 words.
Be encouraging and personal — use the student's name. Reference what they practiced specifically.
Give at least one concrete technique tip and one motivational next step.`,
      messages: [
        {
          role: "user",
          content: `Here is a student's practice session log:\n\n${contextBlock}\n\nPlease give encouraging, specific coaching feedback for this session.`,
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
