"use client";
import React, { useState } from "react";
import Link from "next/link";
import AudioPlayer from "@/components/AudioPlayer";

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
}

interface Props {
  username: string;
  data: { profile: Profile; tracks: Track[] } | null;
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

export default function PublicProfileClient({ username, data }: Props) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = `https://cadenza.social/${username}`;
    if (navigator.share) {
      navigator.share({ title: data?.profile.display_name ?? username, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F8F6F2", fontFamily: "Inter, sans-serif", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎵</div>
        <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "#2C2824", marginBottom: "0.5rem" }}>Profile not found</div>
        <div style={{ fontSize: "0.875rem", color: "#9A9590", marginBottom: "2rem" }}>cadenza.social/{username} doesn't exist yet.</div>
        <a href="/" style={{ padding: "0.75rem 1.5rem", borderRadius: 8, background: "#2C2824", color: "#FDFCFA", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600 }}>
          Make your own on Cadenza
        </a>
      </div>
    );
  }

  const { profile, tracks } = data;
  const name = profile.display_name ?? username;
  const initials = name.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100dvh", background: "#F8F6F2", fontFamily: "Inter, sans-serif" }}>
      {/* Header bar */}
      <div style={{ background: "#FDFCFA", borderBottom: "1px solid #E8E3D9", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.125rem", color: "#2C2824", letterSpacing: "-0.01em" }}>Cadenza</span>
        <a href="/" style={{ fontSize: "0.75rem", color: "#9A9590", textDecoration: "none", border: "1px solid #E8E3D9", borderRadius: 6, padding: "0.3rem 0.75rem", fontWeight: 500 }}>
          Make your own
        </a>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
        {/* Profile card */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "2rem" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "#2C2824", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.375rem", fontWeight: 700, color: "#FDFCFA" }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.625rem", fontWeight: 600, color: "#2C2824", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{name}</div>
            {profile.instrument && (
              <div style={{ fontSize: "0.875rem", color: "#9A9590", marginTop: "0.25rem" }}>{profile.instrument}</div>
            )}
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              {(profile.streak_days ?? 0) > 0 && (
                <span style={{ fontSize: "0.6875rem", color: "#9A9590" }}>🔥 {profile.streak_days} day streak</span>
              )}
              {(profile.total_days_practiced ?? 0) > 0 && (
                <span style={{ fontSize: "0.6875rem", color: "#9A9590" }}>{profile.total_days_practiced} days practiced</span>
              )}
            </div>
          </div>
          <button
            onClick={handleShare}
            style={{ flexShrink: 0, background: "none", border: "1px solid #E8E3D9", borderRadius: 8, padding: "0.5rem 0.875rem", cursor: "pointer", fontSize: "0.8125rem", color: "#2C2824", fontWeight: 500, fontFamily: "Inter, sans-serif" }}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>

        {/* Tracks */}
        {tracks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#9A9590", fontSize: "0.875rem" }}>
            No public recordings yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9A9590", marginBottom: "0.25rem" }}>
              Recordings · {tracks.length}
            </div>
            {tracks.map(track => (
              <div key={track.id} style={{ background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 10, padding: "1rem 1.125rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#2C2824", marginBottom: "0.25rem" }}>{track.title}</div>
                {track.description && (
                  <div style={{ fontSize: "0.8125rem", color: "#9A9590", marginBottom: "0.625rem", lineHeight: 1.5 }}>{track.description}</div>
                )}
                {track.recording_url && (
                  <div style={{ marginBottom: "0.625rem" }}>
                    <AudioPlayer src={track.recording_url} />
                  </div>
                )}
                <div style={{ fontSize: "0.6875rem", color: "#C0BBC0" }}>{timeAgo(track.created_at)}</div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: "3rem", textAlign: "center", padding: "2rem", background: "#FDFCFA", border: "1px solid #E8E3D9", borderRadius: 12 }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.375rem", fontWeight: 500, color: "#2C2824", marginBottom: "0.5rem" }}>
            Share your music too
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#9A9590", marginBottom: "1.25rem", lineHeight: 1.6 }}>
            Record covers, track your practice, and get your own Cadenza profile.
          </div>
          <a href="/" style={{ display: "inline-block", padding: "0.75rem 1.75rem", borderRadius: 8, background: "#2C2824", color: "#FDFCFA", textDecoration: "none", fontSize: "0.9375rem", fontWeight: 600 }}>
            Get started free
          </a>
        </div>
      </div>
    </div>
  );
}
