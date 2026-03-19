import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/accounts/create-practice-profile
 *
 * Silently creates a linked student account for a teacher so they can
 * track their own practice without making a second account manually.
 *
 * - Creates a new Supabase auth user with an internal email (never used for login)
 * - Creates a student profile with the teacher's display name
 * - Enrolls the student in the teacher's own studio
 * - Creates a bidirectional linked_accounts entry
 *
 * Idempotent: returns the existing student profile if already created.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  // Fetch teacher's profile to get display_name and studio_id
  const { data: teacherProfile } = await admin
    .from('profiles')
    .select('role, display_name, studio_id')
    .eq('id', user.id)
    .single();

  if (!teacherProfile || teacherProfile.role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can create a practice profile' }, { status: 403 });
  }

  // Accept studioId from body (freshly created) or fall back to profile's studio_id
  const body = await request.json().catch(() => ({})) as { studioId?: string };
  const studioId: string | null = body.studioId ?? teacherProfile.studio_id ?? null;

  if (!studioId) {
    return NextResponse.json({ error: 'No studio found — create a studio first' }, { status: 400 });
  }

  // Idempotency: if a linked student already exists, return it
  const { data: existingLinks } = await admin
    .from('linked_accounts')
    .select('linked_user_id')
    .eq('user_id', user.id);

  if (existingLinks && existingLinks.length > 0) {
    const linkedIds = existingLinks.map((r: { linked_user_id: string }) => r.linked_user_id);
    const { data: linkedProfiles } = await admin
      .from('profiles')
      .select('id, display_name, role')
      .in('id', linkedIds)
      .eq('role', 'student');

    if (linkedProfiles && linkedProfiles.length > 0) {
      return NextResponse.json({ ok: true, student: linkedProfiles[0], already_existed: true });
    }
  }

  // Create the student auth user — internal email, random password, pre-confirmed
  const internalEmail = `practice-${user.id}@cadenza.app`;
  const internalPassword = crypto.randomUUID() + crypto.randomUUID(); // 72 chars, never used

  const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password: internalPassword,
    email_confirm: true,
    user_metadata: { practice_account_for: user.id },
  });

  if (createError || !newAuthUser.user) {
    // If email already taken, the account was created before — fetch and link it
    if (createError?.message?.includes('already been registered') || createError?.code === 'email_exists') {
      const { data: existingAuth } = await admin.auth.admin.listUsers();
      const existingUser = existingAuth?.users?.find(u => u.email === internalEmail);
      if (existingUser) {
        await admin.from('linked_accounts').upsert([
          { user_id: user.id, linked_user_id: existingUser.id },
          { user_id: existingUser.id, linked_user_id: user.id },
        ], { onConflict: 'user_id,linked_user_id' });
        const { data: existingProfile } = await admin.from('profiles').select('*').eq('id', existingUser.id).single();
        return NextResponse.json({ ok: true, student: existingProfile, already_existed: true });
      }
    }
    return NextResponse.json({ error: createError?.message ?? 'Failed to create student user' }, { status: 500 });
  }

  const studentId = newAuthUser.user.id;

  // Create student profile + enroll in teacher's studio in parallel
  const [profileResult] = await Promise.all([
    admin.from('profiles').insert({
      id: studentId,
      role: 'student',
      display_name: teacherProfile.display_name,
      studio_id: studioId,
    }).select().single(),
    // Nothing else needed — studio_id on profile is how students are enrolled
  ]);

  if (profileResult.error) {
    // Clean up orphan auth user
    await admin.auth.admin.deleteUser(studentId);
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }

  // Create bidirectional link
  await admin.from('linked_accounts').upsert([
    { user_id: user.id,   linked_user_id: studentId },
    { user_id: studentId, linked_user_id: user.id },
  ], { onConflict: 'user_id,linked_user_id' });

  return NextResponse.json({ ok: true, student: profileResult.data });
}
