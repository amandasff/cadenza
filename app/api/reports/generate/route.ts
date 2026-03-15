import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, term, periodStart, periodEnd } = await request.json() as {
    studentId: string;
    term: string;
    periodStart: string;
    periodEnd: string;
  };

  // Verify teacher in same studio
  const { data: teacherProfile } = await supabase.from("profiles").select("studio_id").eq("id", user.id).single();
  const { data: studentProfile } = await supabase.from("profiles").select("display_name, grade_level, studio_id").eq("id", studentId).single();
  if (!teacherProfile || !studentProfile || teacherProfile.studio_id !== studentProfile.studio_id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = studentProfile as { display_name: string; grade_level: string | null; studio_id: string };

  // Gather data for the period
  const [
    { data: lessons },
    { data: goals },
    { data: pieces },
    { data: sessions },
  ] = await Promise.all([
    supabase.from("lessons")
      .select("scheduled_at, duration_minutes, covered_notes, focus_notes, attendance")
      .eq("student_id", studentId)
      .eq("teacher_id", user.id)
      .eq("status", "completed")
      .gte("scheduled_at", periodStart)
      .lte("scheduled_at", periodEnd)
      .order("scheduled_at", { ascending: true }),
    supabase.from("goals")
      .select("title, status, points, practice_area")
      .eq("student_id", studentId)
      .in("status", ["current", "completed"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("pieces")
      .select("title, composer, status, category")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("practice_sessions")
      .select("duration_seconds, created_at, notes")
      .eq("student_id", studentId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd)
      .order("created_at", { ascending: false }),
  ]);

  const totalLessons = lessons?.length ?? 0;
  const attendedLessons = lessons?.filter((l: { attendance: string | null }) => l.attendance !== "no_show" && l.attendance !== "cancelled").length ?? 0;
  const totalPracticeMinutes = Math.round(((sessions ?? []).reduce((s: number, x: { duration_seconds: number }) => s + (x.duration_seconds ?? 0), 0)) / 60);
  const practiceSessionCount = sessions?.length ?? 0;

  const lessonNotesSummary = (lessons ?? [])
    .filter((l: { covered_notes: string | null }) => l.covered_notes)
    .slice(0, 6)
    .map((l: { scheduled_at: string; covered_notes: string | null; focus_notes: string | null }) => {
      const date = new Date(l.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" });
      return `${date}: ${l.covered_notes}${l.focus_notes ? ` (focus: ${l.focus_notes})` : ""}`;
    }).join("\n");

  const goalsText = (goals ?? []).map((g: { title: string; status: string; practice_area: string }) =>
    `- ${g.title} (${g.status}, ${g.practice_area})`
  ).join("\n") || "No goals recorded";

  const piecesText = (pieces ?? []).map((p2: { title: string; composer: string | null; status: string; category: string }) =>
    `- ${p2.title}${p2.composer ? ` — ${p2.composer}` : ""} (${p2.status?.replace(/_/g, " ")}, ${p2.category})`
  ).join("\n") || "No pieces recorded";

  const prompt = `You are helping a music teacher write a formal progress report for a student.

Student: ${p.display_name}${p.grade_level ? ` (${p.grade_level})` : ""}
Term: ${term}
Period: ${new Date(periodStart).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })} – ${new Date(periodEnd).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}

Lessons: ${attendedLessons} attended out of ${totalLessons} scheduled
Practice sessions: ${practiceSessionCount} sessions, ${totalPracticeMinutes} total minutes

Lesson notes from this term:
${lessonNotesSummary || "No lesson notes recorded"}

Current pieces and repertoire:
${piecesText}

Goals:
${goalsText}

Write a formal music progress report. Return ONLY a JSON object with these exact fields (all strings):
{
  "overall_summary": "2-3 sentence overview of the student's progress this term",
  "strengths": "2-3 specific strengths observed this term, with musical examples",
  "areas_for_growth": "1-2 specific areas to focus on next term, with concrete suggestions",
  "practice_summary": "Assessment of practice consistency and quality",
  "repertoire_summary": "Summary of pieces studied and musical development",
  "goals_summary": "Progress on goals and achievements this term",
  "teacher_comments": "Warm closing comment and encouragement for next term"
}

Use formal but warm language appropriate for a music studio progress report. Reference specific details from the data provided.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  let reportFields: Record<string, string> = {};
  try {
    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) reportFields = JSON.parse(jsonMatch[0]);
  } catch {
    reportFields = { overall_summary: message.content[0].type === "text" ? message.content[0].text : "" };
  }

  // Save draft report to DB
  const { data: report, error } = await supabase.from("progress_reports").insert({
    studio_id: teacherProfile.studio_id,
    student_id: studentId,
    teacher_id: user.id,
    term,
    period_start: periodStart,
    period_end: periodEnd,
    status: "draft",
    ...reportFields,
  }).select().single();

  if (error) return Response.json({ error: "Failed to save report" }, { status: 500 });
  return Response.json({ report });
}
