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
    .select("id, display_name, avatar_url, instrument, streak_days, total_days_practiced")
    .eq("username", username)
    .single();
  if (!profile) return null;

  const [{ data: tracks }, { data: collectibles }] = await Promise.all([
    admin
      .from("portfolio_items")
      .select("id, title, description, recording_url, created_at, collection_count")
      .eq("student_id", profile.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("student_collectibles")
      .select("avatar_id, composer_avatars(composer_name, era, rarity, image_path)")
      .eq("student_id", profile.id),
  ]);

  // Supabase returns the foreign-key join as an array; cast to the shape the client expects
  type RawCollectible = { avatar_id: string; composer_avatars: { composer_name: string; era: string; rarity: string; image_path: string }[] | null };
  const normalizedCollectibles = (collectibles ?? []).map((c: RawCollectible) => ({
    avatar_id: c.avatar_id,
    composer_avatars: Array.isArray(c.composer_avatars) ? (c.composer_avatars[0] ?? null) : c.composer_avatars,
  }));

  return { profile, tracks: tracks ?? [], collectibles: normalizedCollectibles };
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
