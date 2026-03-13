import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/messages/upload-media
 * Uploads an audio or video blob to the chat-voice-notes bucket using the
 * admin client (bypasses storage RLS) and returns the public URL.
 *
 * Body: multipart/form-data
 *   file     - the Blob
 *   filename - e.g. "1234567890.webm"
 *   path     - storage path e.g. "{studioId}/{userId}/{ts}.webm"
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const path = form.get('path') as string | null;

  if (!file || !path) {
    return NextResponse.json({ error: 'file and path are required' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage
    .from('chat-voice-notes')
    .upload(path, buffer, { upsert: true, contentType: file.type || 'video/webm' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from('chat-voice-notes').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
