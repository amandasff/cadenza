import { getSupabaseServerClient } from "../../../../lib/supabase/server";

const DAILY_API_KEY = process.env.DAILY_API_KEY!;
const DAILY_BASE = "https://api.daily.co/v1";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { studentId, studioId, studentName } = await request.json() as {
      studentId: string;
      studioId: string;
      studentName: string;
    };

    if (!studentId || !studioId) {
      return Response.json({ error: "studentId and studioId required" }, { status: 400 });
    }

    // Create Daily.co room (expires in 4 hours)
    const exp = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
    const dailyRes = await fetch(`${DAILY_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy: "private",
        properties: {
          enable_prejoin_ui: false,
          exp,
          enable_recording: "cloud",
        },
      }),
    });

    if (!dailyRes.ok) {
      const err = await dailyRes.text();
      console.error("Daily.co room creation failed:", err);
      return Response.json({ error: "Could not create room" }, { status: 500 });
    }

    const room = await dailyRes.json() as { name: string; url: string };

    // Save room to DB
    const { data: videoRoom, error: dbErr } = await supabase
      .from("video_rooms")
      .insert({
        studio_id: studioId,
        teacher_id: user.id,
        student_id: studentId,
        daily_room_name: room.name,
        daily_room_url: room.url,
        status: "waiting",
      })
      .select("id")
      .single();

    if (dbErr || !videoRoom) {
      console.error("DB insert error:", dbErr);
      return Response.json({ error: "Could not save room" }, { status: 500 });
    }

    // Send chat notification to student
    const teacherProfile = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const teacherName = teacherProfile.data?.display_name ?? "Your teacher";
    const joinLink = `/lesson/${videoRoom.id}`;

    await supabase.from("messages").insert({
      studio_id: studioId,
      sender_id: user.id,
      sender_name: teacherName,
      recipient_id: studentId,
      message_type: "system",
      content: `📹 ${teacherName} has started a lesson — tap to join!\nLESSON_ROOM:${videoRoom.id}`,
    });

    return Response.json({
      roomId: videoRoom.id,
      roomUrl: room.url,
      joinLink,
    });
  } catch (err) {
    console.error("Lesson create error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
