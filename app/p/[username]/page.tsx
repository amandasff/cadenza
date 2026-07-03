import { cache } from "react";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import PublicProfileClient from "./PublicProfileClient";

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Always render fresh — never serve a cached/static version of a public profile
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ username: string }>;
}

const getProfile = cache(async function getProfile(username: string) {
  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url, instrument, streak_days, total_days_practiced, studio_bio, studio_persona, featured_avatar_id, theme_song_item_id, theme_song_title, artist_name")
    .eq("username", username)
    .single();
  if (!profile) return null;

  const p = profile as {
    id: string; display_name: string | null; avatar_url: string | null;
    instrument: string | null; streak_days: number | null; total_days_practiced: number | null;
    studio_bio: string | null; studio_persona: string | null;
    featured_avatar_id: string | null; theme_song_item_id: string | null; theme_song_title: string | null;
    artist_name: string | null;
  };

  // Compute cutoff date for practice data (past 365 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 364);
  const cutoffStr = formatDate(cutoff);

  // Fetch tracks, raw collectible IDs, featured composer, theme song, practice data,
  // current repertoire, and the student's teacher in parallel
  const [tracksRes, collectiblesRes, featuredComposerRes, themeSongRes, sessionsRes, clipsRes, piecesRes, teacherAssignmentRes] = await Promise.all([
    admin
      .from("portfolio_items")
      .select("id, title, description, recording_url, created_at, collection_count")
      .eq("student_id", p.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("student_collectibles")
      .select("avatar_id")
      .eq("student_id", p.id),
    p.featured_avatar_id
      ? admin.from("composer_avatars").select("composer_name, era, rarity, image_path").eq("id", p.featured_avatar_id).single()
      : Promise.resolve({ data: null }),
    p.theme_song_item_id
      ? admin.from("portfolio_items").select("recording_url, title").eq("id", p.theme_song_item_id).single()
      : Promise.resolve({ data: null }),
    admin.from("practice_sessions").select("created_at").eq("student_id", p.id).gte("created_at", cutoffStr),
    admin.from("practice_clips").select("created_at").eq("student_id", p.id).gte("created_at", cutoffStr),
    admin
      .from("pieces")
      .select("id, title, composer, status")
      .eq("student_id", p.id)
      .in("status", ["learning", "polishing", "performance_ready"])
      .in("category", ["repertoire", "etude", "free"])
      .order("sort_order", { ascending: true })
      .limit(8),
    admin
      .from("teacher_student_assignments")
      .select("teacher_id")
      .eq("student_id", p.id)
      .is("ended_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  // Resolve the teacher's display name for the "Studio of …" line
  let studioTeacherName: string | null = null;
  const teacherId = (teacherAssignmentRes.data as { teacher_id: string } | null)?.teacher_id;
  if (teacherId && teacherId !== p.id) {
    const { data: teacherProfile } = await admin
      .from("profiles").select("display_name").eq("id", teacherId).single();
    const teacherName = (teacherProfile as { display_name: string | null } | null)?.display_name ?? null;
    // Skip when the names match (e.g. a founder testing with linked accounts) —
    // "Amanda Wu · Studio of Amanda Wu" reads as a glitch
    if (teacherName && teacherName.toLowerCase() !== (p.display_name ?? "").toLowerCase()) {
      studioTeacherName = teacherName;
    }
  }

  // Resolve composer details in a separate explicit query — avoids embedded-join null issues
  const avatarIds = (collectiblesRes.data ?? []).map((c: { avatar_id: string }) => c.avatar_id);

  const composerResult = avatarIds.length > 0
    ? await admin.from("composer_avatars").select("id, composer_name, era, rarity, image_path").in("id", avatarIds)
    : { data: [], error: null };
  const composerRows = composerResult.data ?? [];
  const normalizedCollectibles = avatarIds.map(aid => ({
    avatar_id: aid,
    composer_avatars: composerRows.find((ca: { id: string }) => ca.id === aid) ?? null,
  }));

  const featuredComposer = featuredComposerRes.data as { composer_name: string; era: string; rarity: string; image_path: string } | null;
  const themeSong = themeSongRes.data as { recording_url: string | null; title: string } | null;

  // Aggregate practice data by day
  const practiceMap = new Map<string, { date: string; sessions: number; clips: number }>();
  for (const row of sessionsRes.data ?? []) {
    const key = formatDate(new Date(row.created_at));
    const existing = practiceMap.get(key) ?? { date: key, sessions: 0, clips: 0 };
    practiceMap.set(key, { ...existing, sessions: existing.sessions + 1 });
  }
  for (const row of clipsRes.data ?? []) {
    const key = formatDate(new Date(row.created_at));
    const existing = practiceMap.get(key) ?? { date: key, sessions: 0, clips: 0 };
    practiceMap.set(key, { ...existing, clips: existing.clips + 1 });
  }
  const practiceData = Array.from(practiceMap.values());

  return {
    profile: p,
    tracks: tracksRes.data ?? [],
    collectibles: normalizedCollectibles,
    featuredComposer,
    themeSong,
    practiceData,
    repertoire: (piecesRes.data ?? []) as { id: string; title: string; composer: string | null; status: string }[],
    studioTeacherName,
  };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const data = await getProfile(username);
  if (!data) return { title: "Profile not found · Cadenza" };

  const { profile } = data;
  const name = profile.artist_name ?? profile.display_name ?? username;
  const desc = profile.instrument
    ? `${name} plays ${profile.instrument} on Cadenza.`
    : `Listen to ${name}'s music on Cadenza.`;

  return {
    title: `${name} · Cadenza`,
    description: desc,
    openGraph: {
      title: `${name} on Cadenza`,
      description: desc,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : [],
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: `${name} on Cadenza`,
      description: desc,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const data = await getProfile(username);
  return <PublicProfileClient username={username} data={data} />;
}
