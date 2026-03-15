import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await request.json() as { studentId: string };
  if (!studentId) return Response.json({ error: "studentId required" }, { status: 400 });

  // Verify teacher is in the same studio as the student
  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("display_name, studio_id, grade_level")
    .eq("id", studentId)
    .single();
  if (!studentProfile) return Response.json({ error: "Student not found" }, { status: 404 });

  const { data: teacherProfile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();
  if (!teacherProfile || teacherProfile.studio_id !== studentProfile.studio_id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch last 14 days of practice sessions
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("*, pieces(title)")
    .eq("student_id", studentId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch current goals
  const { data: goals } = await supabase
    .from("goals")
    .select("title, status, points")
    .eq("student_id", studentId)
    .in("status", ["current", "completed"])
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch current pieces
  const { data: pieces } = await supabase
    .from("pieces")
    .select("title, composer, status, category")
    .eq("student_id", studentId)
    .neq("status", "completed")
    .limit(10);

  // Build context
  const sessionCount = sessions?.length ?? 0;
  const totalMinutes = Math.round((sessions ?? []).reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / 60);
  const lastPracticed = sessions?.[0]?.created_at
    ? new Date(sessions[0].created_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
    : "not recently";

  const sessionSummaries = (sessions ?? []).slice(0, 8).map(s => {
    const date = new Date(s.created_at).toLocaleDateString([], { month: "short", day: "numeric" });
    const mins = Math.max(1, Math.round((s.duration_seconds ?? 0) / 60));
    const piece = (s.pieces as { title?: string } | null)?.title ?? "";
    const moodMatch = s.notes?.match(/\[mood:(\w+)\]/);
    const mood = moodMatch?.[1] ?? "";
    const wentWell = s.notes?.match(/Well: ([^|]+)/)?.[1]?.trim() ?? "";
    const focusNext = s.notes?.match(/Focus: ([^|]+)/)?.[1]?.trim() ?? "";
    const aiFeedback = s.ai_feedback ? `AI feedback: "${s.ai_feedback.slice(0, 200)}..."` : "";
    return `- ${date}: ${mins} min${piece ? ` on ${piece}` : ""}${mood ? `, felt ${mood}` : ""}${wentWell ? `. Went well: ${wentWell}` : ""}${focusNext ? `. Focus: ${focusNext}` : ""}${aiFeedback ? `\n  ${aiFeedback}` : ""}`;
  }).join("\n");

  const goalsText = (goals ?? []).map(g =>
    `- ${g.title} (${g.status === "completed" ? "✓ completed" : "in progress"}, ${g.points} pts)`
  ).join("\n") || "No active goals";

  const piecesText = (pieces ?? []).map(p =>
    `- ${p.title}${p.composer ? ` — ${p.composer}` : ""} (${p.status?.replace(/_/g, " ")}, ${p.category})`
  ).join("\n") || "No active pieces";

  const prompt = `You are helping a music teacher prepare for their next lesson with a student.

Student: ${studentProfile.display_name}${studentProfile.grade_level ? ` (${studentProfile.grade_level})` : ""}
Practice in the last 14 days: ${sessionCount} session${sessionCount !== 1 ? "s" : ""}, ${totalMinutes} total minutes
Last practiced: ${lastPracticed}

Recent practice sessions:
${sessionSummaries || "No recent sessions"}

Current pieces:
${piecesText}

Active goals:
${goalsText}

Write a concise pre-lesson briefing for the teacher (3–5 sentences max). Cover:
1. How consistent the student has been practicing
2. What they've been struggling with or focusing on (from their notes and AI feedback)
3. One or two specific things to address in today's lesson

Be direct and practical — this is for the teacher to read in 10 seconds before walking in. Don't use bullet points or headers. Write in plain prose.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const brief = message.content[0].type === "text" ? message.content[0].text : "";

  return Response.json({
    brief,
    stats: { sessionCount, totalMinutes, lastPracticed },
  });
}
