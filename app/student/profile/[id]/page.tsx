"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePlayer } from "@/lib/context/PlayerContext";
import AudioPlayer from "@/components/AudioPlayer";
import { Flame, ArrowLeft, X } from "lucide-react";
import type { PortfolioItemRow } from "@/lib/services/PortfolioService";

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  streak_days: number;
  total_days_practiced: number;
  role: string | null;
  instrument: string | null;
};

type EnrichedItem = PortfolioItemRow & {
  like_count: number;
  user_liked: boolean;
  view_count: number;
};

const initials = (name?: string | null) =>
  (name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

function Avatar({ url, name, size }: { url?: string | null; name?: string | null; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.28, fontWeight: 700, color: "var(--white)", flexShrink: 0, fontFamily: "Inter, sans-serif", overflow: "hidden" }}>
      {url ? <img src={url} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(name)}
    </div>
  );
}

function VideoThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video ref={ref} src={src} preload="metadata" muted playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      onLoadedMetadata={e => { const v = e.target as HTMLVideoElement; v.currentTime = Math.min(1.5, v.duration * 0.1); }}
    />
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.id as string;
  const supabase = getSupabaseBrowserClient();
  const { playDiscover, setSuppressMiniPlayer } = usePlayer();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [iFollow, setIFollow] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<EnrichedItem | null>(null);

  useEffect(() => {
    return () => setSuppressMiniPlayer(false);
  }, [setSuppressMiniPlayer]);

  useEffect(() => {
    if (!profileId) return;
    load();
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);

      const [profileRes, followerRes, followingRes, itemsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, bio, streak_days, total_days_practiced, role, instrument").eq("id", profileId).single(),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileId),
        supabase.from("portfolio_items").select("*").eq("student_id", profileId).eq("is_public", true).order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      setFollowerCount(followerRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);

      // Check if current user follows this profile
      if (uid && uid !== profileId) {
        const { data: followRow } = await supabase.from("follows").select("id").eq("follower_id", uid).eq("following_id", profileId).single();
        setIFollow(!!followRow);
      }

      // Enrich items
      const rows = (itemsRes.data ?? []) as PortfolioItemRow[];
      if (rows.length > 0) {
        const ids = rows.map(r => r.id);
        const { data: likesData } = await supabase.from("portfolio_likes").select("portfolio_item_id, user_id").in("portfolio_item_id", ids);
        const likes = (likesData ?? []) as { portfolio_item_id: string; user_id: string }[];
        setItems(rows.map(r => ({
          ...r,
          like_count: likes.filter(l => l.portfolio_item_id === r.id).length,
          user_liked: likes.some(l => l.portfolio_item_id === r.id && l.user_id === uid),
          view_count: (r as PortfolioItemRow & { view_count?: number }).view_count ?? 0,
        })));
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow() {
    if (!currentUserId || followLoading || currentUserId === profileId) return;
    setFollowLoading(true);
    const wasFollowing = iFollow;
    setIFollow(!wasFollowing);
    setFollowerCount(c => c + (wasFollowing ? -1 : 1));
    try {
      if (wasFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profileId);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: profileId });
      }
    } catch {
      setIFollow(wasFollowing);
      setFollowerCount(c => c + (wasFollowing ? 1 : -1));
    } finally {
      setFollowLoading(false);
    }
  }

  function openItem(item: EnrichedItem) {
    setExpandedItem({ ...item, view_count: item.view_count + 1 });
    fetch("/api/portfolio/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }) }).catch(() => {});
    if (item.recording_url) {
      playDiscover({ id: item.id, title: item.title, displayName: profile?.display_name, mediaType: item.media_type === "video" ? "video" : "audio", recordingUrl: item.recording_url });
    }
    setSuppressMiniPlayer(true);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100%", background: "var(--cream)" }}>
        <div style={{ background: "var(--white)", padding: "1rem 1rem 0", borderBottom: "1px solid var(--border)" }}>
          <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 4, marginBottom: "1rem" }} />
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", paddingBottom: "1.25rem" }}>
            <div className="skeleton" style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 18, width: "50%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: "70%", borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100%", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem", padding: "2rem" }}>
        <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.5rem", color: "var(--charcoal)" }}>Profile not found</div>
        <Link href="/student/discover" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)" }}>← Back to Discover</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)" }}>

      {/* Header */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ padding: "0.875rem 1rem 0" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", padding: 0, marginBottom: "1rem" }}>
            <ArrowLeft size={16} strokeWidth={1.5} /> Back
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", paddingBottom: "1.25rem" }}>
            <Avatar url={profile.avatar_url} name={profile.display_name} size={72} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.25rem", color: "var(--charcoal)", lineHeight: 1.2, marginBottom: "0.375rem" }}>
                {profile.display_name}
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.875rem", marginBottom: "0.5rem" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                  <strong style={{ color: "var(--charcoal)" }}>{followerCount}</strong> followers
                </span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                  <strong style={{ color: "var(--charcoal)" }}>{followingCount}</strong> following
                </span>
                {profile.streak_days > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", background: "rgba(230,168,23,0.12)", border: "1px solid rgba(230,168,23,0.25)", borderRadius: 99, padding: "0.15rem 0.5rem", color: "#c47d10", fontWeight: 700, fontSize: "0.75rem" }}>
                    <Flame size={12} color="#E6A817" fill="#E6A817" strokeWidth={0} />{profile.streak_days} day streak
                  </span>
                )}
                {(profile.total_days_practiced ?? 0) > 0 && (
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                    <strong style={{ color: "var(--charcoal)" }}>{profile.total_days_practiced}</strong> days practiced
                  </span>
                )}
              </div>

              {/* Instrument */}
              {profile.instrument && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.375rem" }}>
                  {profile.instrument}
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: 0, lineHeight: 1.55 }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Follow button */}
        {currentUserId && currentUserId !== profileId && (
          <div style={{ padding: "0 1rem 1rem" }}>
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              style={{
                width: "100%", padding: "0.625rem", borderRadius: 8,
                fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem",
                cursor: followLoading ? "default" : "pointer", transition: "all 0.15s",
                border: iFollow ? "1.5px solid var(--border-strong)" : "none",
                background: iFollow ? "transparent" : "var(--charcoal)",
                color: iFollow ? "var(--charcoal)" : "var(--white)",
                opacity: followLoading ? 0.7 : 1,
              }}
            >
              {followLoading ? "…" : iFollow ? "Following" : "Follow"}
            </button>
          </div>
        )}
      </div>

      {/* Portfolio grid */}
      {items.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", fontStyle: "italic" }}>
            Nothing shared yet
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, background: "#111", marginTop: 2 }}>
          {items.map(item => (
            <div key={item.id} onClick={() => openItem(item)} style={{ cursor: "pointer", position: "relative", background: "#1a1a1a", overflow: "hidden", aspectRatio: "9/14" }}>
              {item.media_type === "video" && item.recording_url ? (
                <VideoThumbnail src={item.recording_url} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                </div>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.375rem" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.5625rem", color: "#fff", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                  {item.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded item sheet */}
      {expandedItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column" }}>
          <div onClick={() => { setExpandedItem(null); setSuppressMiniPlayer(false); }} style={{ flex: 1, background: "rgba(0,0,0,0.7)", minHeight: 40 }} />
          <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", maxHeight: "88dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem 0.5rem" }}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: "var(--border)" }} />
              <button onClick={() => { setExpandedItem(null); setSuppressMiniPlayer(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: "0 0 0 1rem", display: "flex", alignItems: "center" }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {expandedItem.media_type === "video" && expandedItem.recording_url && (
                <div style={{ background: "#0d0d0d", aspectRatio: "16/9", width: "100%" }}>
                  <video src={expandedItem.recording_url} controls autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              )}
              {expandedItem.media_type !== "video" && (
                <div style={{ background: "linear-gradient(135deg, #2C2824 0%, #4a3f38 100%)", padding: "1.5rem 1rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "#fff" }}>{expandedItem.title}</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>{profile.display_name}</div>
                  </div>
                </div>
              )}
              {expandedItem.media_type !== "video" && expandedItem.recording_url && (
                <div style={{ padding: "0.875rem 1rem 0" }}><AudioPlayer src={expandedItem.recording_url} /></div>
              )}
              <div style={{ padding: "0.875rem 1rem 1.5rem" }}>
                {expandedItem.media_type === "video" && (
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--charcoal)", marginBottom: "0.375rem" }}>{expandedItem.title}</div>
                )}
                {expandedItem.description && (
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{expandedItem.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
