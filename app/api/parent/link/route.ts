import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is a teacher
  const { data: callerProfile } = await supabase.from("profiles").select("role, studio_id").eq("id", user.id).single();
  if (!callerProfile || callerProfile.role !== "teacher") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, studentId } = await request.json() as { email: string; studentId: string };
  if (!email || !studentId) return Response.json({ error: "Missing email or studentId" }, { status: 400 });

  // Look up user by email using admin client (service role key needed)
  // For now, look up by matching profile display name approach won't work.
  // Instead: look up auth users by email (requires service role)
  // We'll use a workaround: the parent must have an account and their profile
  // We store the email in a separate field by having the user update their profile, or
  // we query by matching the auth email from the profiles table via a join.

  // Look up by matching email in auth.users via supabase admin API
  // Since we don't have direct access, look up via a join on auth.users email
  const { data: matchedUsers } = await supabase.rpc("get_user_id_by_email", { email_input: email.trim().toLowerCase() });

  let parentId: string | null = null;
  if (matchedUsers && matchedUsers.length > 0) {
    parentId = matchedUsers[0].id;
  }

  if (!parentId) {
    return Response.json({ error: "No account found with that email. The parent must sign up first with the Parent role." }, { status: 404 });
  }

  // Verify the found user is a parent
  const { data: parentProfile } = await supabase.from("profiles").select("role").eq("id", parentId).single();
  if (!parentProfile || parentProfile.role !== "parent") {
    return Response.json({ error: "That account is not registered as a parent." }, { status: 400 });
  }

  // Verify the student belongs to this teacher's studio
  const { data: studentProfile } = await supabase.from("profiles").select("studio_id").eq("id", studentId).single();
  if (!studentProfile || studentProfile.studio_id !== callerProfile.studio_id) {
    return Response.json({ error: "Student not in your studio." }, { status: 403 });
  }

  // Create the link (ignore duplicate)
  const { error } = await supabase.from("parent_student_links").insert({
    parent_id: parentId,
    student_id: studentId,
    studio_id: callerProfile.studio_id,
  });

  if (error && error.code !== "23505") {
    return Response.json({ error: "Failed to link: " + error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
