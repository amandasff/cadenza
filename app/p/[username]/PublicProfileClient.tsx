"use client";
import React, { useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import ContributionsGraph, { type DayData } from "@/components/ContributionsGraph";

interface Track {
  id: string;
  title: string;
  description: string | null;
  recording_url: string | null;
  created_at: string;
  collection_count: number | null;
}

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  instrument: string | null;
  streak_days: number | null;
  total_days_practiced: number | null;
  studio_bio: string | null;
  studio_persona: string | null;
  artist_name: string | null;
}

interface Collectible {
  avatar_id: string;
  composer_avatars: {
    composer_name: string;
    era: string;
    rarity: string;
    image_path: string;
  } | null;
}

interface FeaturedComposer {
  composer_name: string;
  era: string;
  rarity: string;
  image_path: string;
}

interface ThemeSong {
  recording_url: string | null;
  title: string;
}

interface RepertoirePiece {
  id: string;
  title: string;
  composer: string | null;
  status: string;
}

// Rarity mapped to the brand's tonal palette — no candy colors on a concert program
const RARITY_COLOR: Record<string, string> = {
  common: "var(--sage, #3D6B55)",
  rare: "var(--sky, #2D5E78)",
  epic: "var(--lavender, #5E5880)",
  legendary: "var(--butter, #7A6318)",
};

const serif: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };

interface Props {
  username: string;
  data: {
    profile: Profile;
    tracks: Track[];
    collectibles: Collectible[];
    featuredComposer: FeaturedComposer | null;
    themeSong: ThemeSong | null;
    practiceData?: DayData[];
    repertoire?: RepertoirePiece[];
    studioTeacherName?: string | null;
  } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} month${m !== 1 ? "s" : ""} ago`;
  return `${Math.floor(m / 12)} year${Math.floor(m / 12) !== 1 ? "s" : ""} ago`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.06em", color: "#9A9590", marginBottom: "0.75rem" }}>
      {children}
    </div>
  );
}

export default function PublicProfileClient({ username, data }: Props) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = `https://cadenza.social/${username}`;
    if (navigator.share) {
      navigator.share({ title: publicName, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  const publicName = data?.profile.artist_name ?? data?.profile.display_name ?? username;

  if (!data) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F8F6F2", fontFamily: "Inter, sans-serif", padding: "2rem", textAlign: "center" }}>
        <img src="/logo.svg" alt="" style={{ height: "2.5rem", width: "auto", marginBottom: "1rem", opacity: 0.5 }} />
        <div style={{ ...serif, fontSize: "1.5rem", fontWeight: 500, color: "#2C2824", marginBottom: "0.5rem" }}>Profile not found</div>
        <div style={{ fontSize: "0.875rem", color: "#9A9590", marginBottom: "2rem" }}>cadenza.social/{username} doesn&apos;t exist yet.</div>
        <a href="https://cadenza.social" style={{ padding: "0.75rem 1.5rem", borderRadius: 8, background: "#2C2824", color: "#FDFCFA", textDecoration: "none", fontSize: "0.875rem", fontWeight: 500 }}>
          Make your own on Cadenza
        </a>
      </div>
    );
  }

  const { profile, tracks, collectibles, featuredComposer, themeSong, repertoire = [], studioTeacherName } = data;
  const initials = publicName.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const validCollectibles = collectibles.filter(c => c.composer_avatars !== null);

  const subtitleParts = [
    profile.instrument,
    studioTeacherName ? `Studio of ${studioTeacherName}` : null,
  ].filter(Boolean);

  return (
    <div style={{ minHeight: "100dvh", background: "#F8F6F2", fontFamily: "Inter, sans-serif", color: "#2C2824" }}>
      {/* Header bar */}
      <div style={{ background: "#FDFCFA", borderBottom: "1px solid #E8E3D9", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="https://cadenza.social" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <img src="/logo.svg" alt="" style={{ height: "1.125rem", width: "auto" }} />
          <span style={{ ...serif, fontWeight: 500, fontSize: "1.125rem", color: "#2C2824" }}>Cadenza</span>
        </a>
        <a href="https://cadenza.social" style={{ fontSize: "0.75rem", color: "#9A9590", textDecoration: "none", border: "1px solid #E8E3D9", borderRadius: 6, padding: "0.3rem 0.75rem", fontWeight: 500 }}>
          Make your own
        </a>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2.5rem 1.25rem 4rem" }}>

        {/* ── Program header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.25rem", marginBottom: "0.75rem" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "#2C2824", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.375rem", fontWeight: 500, color: "#FDFCFA" }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={publicName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ ...serif, fontSize: "2rem", fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15, margin: 0 }}>{publicName}</h1>
            {subtitleParts.length > 0 && (
              <div style={{ fontSize: "0.875rem", color: "#9A9590", marginTop: "0.375rem" }}>
                {subtitleParts.join(" · ")}
              </div>
            )}
          </div>
          <button
            onClick={handleShare}
            style={{ flexShrink: 0, background: "none", border: "1px solid #D0CBC0", borderRadius: 8, padding: "0.5rem 0.875rem", cursor: "pointer", fontSize: "0.8125rem", color: "#2C2824", fontWeight: 500, fontFamily: "Inter, sans-serif" }}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>

        {/* ── Practice year chip ── */}
        {(profile.total_days_practiced ?? 0) > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", color: "#3D6B55", background: "#EBF3EE", border: "1px solid #B4D0C4", borderRadius: 999, padding: "0.25rem 0.75rem" }}>
              {profile.total_days_practiced} days of practice
            </span>
            {(profile.streak_days ?? 0) > 2 && (
              <span style={{ fontSize: "0.75rem", color: "#7A6318", background: "#F3EFDC", border: "1px solid #D4C490", borderRadius: 999, padding: "0.25rem 0.75rem" }}>
                {profile.streak_days}-day streak
              </span>
            )}
          </div>
        )}

        {/* ── Bio ── */}
        {(profile.studio_persona || profile.studio_bio) && (
          <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "1.25rem", marginBottom: "2rem" }}>
            {profile.studio_persona && (
              <div style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.06em", color: "#9A9590", marginBottom: "0.375rem" }}>
                {profile.studio_persona}
              </div>
            )}
            {profile.studio_bio && (
              <div style={{ ...serif, fontSize: "1.125rem", color: "#2C2824", lineHeight: 1.55, fontStyle: "italic" }}>
                {profile.studio_bio}
              </div>
            )}
          </div>
        )}

        {/* ── Current repertoire ── */}
        {repertoire.length > 0 && (
          <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "1.25rem", marginBottom: "2rem" }}>
            <SectionLabel>Current repertoire</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {repertoire.map(piece => (
                <div key={piece.id} style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ ...serif, fontSize: "1.0625rem", fontWeight: 500 }}>{piece.title}</span>
                  {piece.composer && (
                    <span style={{ fontSize: "0.8125rem", color: "#9A9590" }}>— {piece.composer}</span>
                  )}
                  {piece.status === "performance_ready" && (
                    <span style={{ fontSize: "0.625rem", color: "#3D6B55", background: "#EBF3EE", borderRadius: 999, padding: "0.125rem 0.5rem", fontWeight: 500 }}>
                      performance ready
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recordings ── */}
        {tracks.length > 0 && (
          <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "1.25rem", marginBottom: "2rem" }}>
            <SectionLabel>Recordings · {tracks.length}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {tracks.map(track => (
                <div key={track.id} style={{ background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 10, padding: "1rem 1.125rem" }}>
                  <div style={{ ...serif, fontWeight: 500, fontSize: "1.0625rem", marginBottom: "0.25rem" }}>{track.title}</div>
                  {track.description && (
                    <div style={{ fontSize: "0.8125rem", color: "#9A9590", marginBottom: "0.625rem", lineHeight: 1.5 }}>{track.description}</div>
                  )}
                  {track.recording_url && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <AudioPlayer src={track.recording_url} />
                    </div>
                  )}
                  <div style={{ fontSize: "0.6875rem", color: "#B4B0A8" }}>{timeAgo(track.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Practice ── */}
        {data.practiceData && data.practiceData.length > 0 && (
          <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "1.25rem", marginBottom: "2rem" }}>
            <SectionLabel>Practice</SectionLabel>
            <div style={{ background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 10, padding: "1rem 1.125rem" }}>
              <ContributionsGraph studentId={profile.id} initialData={data.practiceData} />
            </div>
          </div>
        )}

        {/* ── Theme song ── */}
        {themeSong?.recording_url && (
          <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "1.25rem", marginBottom: "2rem" }}>
            <SectionLabel>Theme song</SectionLabel>
            <div style={{ background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 10, padding: "1rem 1.125rem" }}>
              <div style={{ ...serif, fontWeight: 500, fontSize: "1rem", marginBottom: "0.625rem" }}>{themeSong.title}</div>
              <AudioPlayer src={themeSong.recording_url} />
            </div>
          </div>
        )}

        {/* ── Composer collection ── */}
        {(featuredComposer || validCollectibles.length > 0) && (
          <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "1.25rem", marginBottom: "2rem" }}>
            <SectionLabel>Composer collection{validCollectibles.length > 0 ? ` · ${validCollectibles.length}` : ""}</SectionLabel>

            {featuredComposer && (
              <div style={{ background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 10, padding: "1rem 1.125rem", display: "flex", alignItems: "center", gap: "1rem", marginBottom: validCollectibles.length > 0 ? "0.875rem" : 0 }}>
                {featuredComposer.image_path ? (
                  <img src={featuredComposer.image_path} alt={featuredComposer.composer_name}
                    style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${RARITY_COLOR[featuredComposer.rarity] ?? "#D0CBC0"}`, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F1EDE5", border: `2px solid ${RARITY_COLOR[featuredComposer.rarity] ?? "#D0CBC0"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...serif, fontSize: "1.125rem", color: "#9A9590" }}>
                    {featuredComposer.composer_name[0]}
                  </div>
                )}
                <div>
                  <div style={{ ...serif, fontWeight: 500, fontSize: "1.0625rem" }}>{featuredComposer.composer_name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#9A9590", marginTop: "0.125rem" }}>
                    {featuredComposer.era} · <span style={{ color: RARITY_COLOR[featuredComposer.rarity] ?? "#9A9590" }}>{featuredComposer.rarity}</span> · featured
                  </div>
                </div>
              </div>
            )}

            {validCollectibles.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: "0.625rem" }}>
                {validCollectibles.map((c) => {
                  const avatar = c.composer_avatars!;
                  const rarityColor = RARITY_COLOR[avatar.rarity] ?? "#D0CBC0";
                  return (
                    <div
                      key={c.avatar_id}
                      style={{ background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 10, padding: "0.625rem 0.5rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}
                    >
                      {avatar.image_path ? (
                        <img
                          src={avatar.image_path}
                          alt={avatar.composer_name}
                          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: `2px solid ${rarityColor}` }}
                        />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F1EDE5", border: `2px solid ${rarityColor}`, display: "flex", alignItems: "center", justifyContent: "center", ...serif, fontSize: "1rem", color: "#9A9590" }}>
                          {avatar.composer_name[0]}
                        </div>
                      )}
                      <div style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#2C2824", lineHeight: 1.2 }}>{avatar.composer_name}</div>
                      <div style={{ fontSize: "0.5625rem", color: rarityColor, fontWeight: 500, letterSpacing: "0.04em" }}>{avatar.rarity}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {tracks.length === 0 && repertoire.length === 0 && (!data.practiceData || data.practiceData.length === 0) && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#9A9590", fontSize: "0.875rem" }}>
            Nothing shared here yet.
          </div>
        )}

        {/* ── CTA ── */}
        <div style={{ marginTop: "2rem", textAlign: "center", padding: "2rem", background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 12 }}>
          <div style={{ ...serif, fontSize: "1.375rem", fontWeight: 500, color: "#2C2824", marginBottom: "0.5rem" }}>
            Share your music too
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#9A9590", marginBottom: "1.25rem", lineHeight: 1.6 }}>
            Track your practice, build your repertoire, and get your own Cadenza profile.
          </div>
          <a href="https://cadenza.social" style={{ display: "inline-block", padding: "0.75rem 1.75rem", borderRadius: 8, background: "#2C2824", color: "#FDFCFA", textDecoration: "none", fontSize: "0.9375rem", fontWeight: 500 }}>
            Get started free
          </a>
        </div>
      </div>
    </div>
  );
}
