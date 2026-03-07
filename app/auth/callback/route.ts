import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const role = searchParams.get('role') ?? 'student';

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile) {
          // New Google user — create profile using name from Google
          const displayName =
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email?.split('@')[0] ??
            'User';
          await supabase.from('profiles').insert({
            id: user.id,
            role,
            display_name: displayName,
          });
          return NextResponse.redirect(
            `${origin}/${role === 'teacher' ? 'teacher' : 'student'}`
          );
        }

        // Existing user — redirect to their home
        return NextResponse.redirect(
          `${origin}/${profile.role === 'teacher' ? 'teacher' : 'student'}`
        );
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}
