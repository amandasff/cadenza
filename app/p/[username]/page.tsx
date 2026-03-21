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

  const { data: tracks } = await admin
    .from("portfolio_items")
    .select("id, title, description, recording_url, created_at, collection_count")
    .eq("student_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  return { profile, tracks: tracks ?? [] };
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
