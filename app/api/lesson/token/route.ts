import { getSupabaseServerClient } from "../../../../lib/supabase/server";

const DAILY_API_KEY = process.env.DAILY_API_KEY!;
const DAILY_BASE = "https://api.daily.co/v1";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { roomId } = await request.json() as { roomId: string };
    if (!roomId) return Response.json({ error: "roomId required" }, { status: 400 });

    // Fetch room and verify access
    const { data: room, error: roomErr } = await supabase
      .from("video_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const isTeacher = room.teacher_id === user.id;
    const isStudent = room.student_id === user.id;

    if (!isTeacher && !isStudent) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate Daily.co meeting token
    const tokenRes = await fetch(`${DAILY_BASE}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: room.daily_room_name,
          is_owner: isTeacher,
          enable_recording_ui: isTeacher,
        },
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Daily.co token error:", err);
      return Response.json({ error: "Could not create token" }, { status: 500 });
    }

    const { token } = await tokenRes.json() as { token: string };

    // Mark room as live when teacher joins
    if (isTeacher && room.status === "waiting") {
      await supabase
        .from("video_rooms")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", roomId);
    }

    return Response.json({
      token,
      roomUrl: room.daily_room_url,
      isTeacher,
      teacherId: room.teacher_id,
      studentId: room.student_id,
    });
  } catch (err) {
    console.error("Lesson token error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
