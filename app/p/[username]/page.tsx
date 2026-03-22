import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import PublicProfileClient from "./PublicProfileClient";

interface Props {
  params: Promise<{ username: string }>;
}

async function getProfile(username: string) {
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

  // Fetch tracks, raw collectible IDs, featured composer, and theme song in parallel
  const [tracksRes, collectiblesRes, featuredComposerRes, themeSongRes] = await Promise.all([
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
  ]);

  // Resolve composer details in a separate explicit query — avoids embedded-join null issues
  const avatarIds = (collectiblesRes.data ?? []).map((c: { avatar_id: string }) => c.avatar_id);
  const { data: composerRows } = avatarIds.length > 0
    ? await admin.from("composer_avatars").select("id, composer_name, era, rarity, image_path").in("id", avatarIds)
    : { data: [] };

  const normalizedCollectibles = avatarIds.map(aid => ({
    avatar_id: aid,
    composer_avatars: (composerRows ?? []).find((ca: { id: string }) => ca.id === aid) ?? null,
  }));

  const featuredComposer = featuredComposerRes.data as { composer_name: string; era: string; rarity: string; image_path: string } | null;
  const themeSong = themeSongRes.data as { recording_url: string | null; title: string } | null;

  return {
    profile: p,
    tracks: tracksRes.data ?? [],
    collectibles: normalizedCollectibles,
    featuredComposer,
    themeSong,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const data = await getProfile(username);
  if (!data) return { title: "Profile not found · Cadenza" };

  const { profile } = data;
  const name = profile.display_name ?? username;
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
