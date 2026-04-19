"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { CollectibleService } from "../../../lib/services/CollectibleService";
import type { ComposerAvatarRow, StudentCollectibleWithAvatar, CollectibleEra } from "../../../lib/types";
import { playComposerAudio } from "../../../lib/composerTunes";

// ── Rarity config ─────────────────────────────────────────────────────────────
const RARITY_LABEL: Record<string, string> = {
  common:    "Common",
  rare:      "Rare",
  epic:      "Epic",
  legendary: "Legendary",
};

const RARITY_COLOR: Record<string, string> = {
  common:    "var(--sage)",
  rare:      "var(--sky)",
  epic:      "var(--lavender)",
  legendary: "var(--butter)",
};

const ERA_LABEL: Record<CollectibleEra, string> = {
  baroque:       "Baroque",
  classical:     "Classical",
  romantic:      "Romantic",
  impressionist: "Impressionist",
  student_art:   "Student Art",
};

const ERA_ORDER: CollectibleEra[] = ["baroque", "classical", "romantic", "impressionist", "student_art"];

// Era set definitions — completing a set unlocks a bonus badge label
const ERA_SETS: Record<CollectibleEra, { bonus: string; color: string }> = {
  baroque:       { bonus: "Golden Quill",       color: "var(--butter)" },
  classical:     { bonus: "Prodigy",             color: "var(--sky)" },
  romantic:      { bonus: "Virtuoso of Feeling", color: "var(--lavender)" },
  impressionist: { bonus: "Sound Painter",       color: "var(--peach)" },
  student_art:   { bonus: "Art Collector",       color: "var(--peach)" },
};

// ── Composer birth years & countries ─────────────────────────────────────────
const COMPOSER_COUNTRIES: Record<string, string> = {
  Bach:         "🇩🇪 Germany",
  Handel:       "🇩🇪 Germany",
  Vivaldi:      "🇮🇹 Italy",
  Mozart:       "🇦🇹 Austria",
  Beethoven:    "🇩🇪 Germany",
  Schubert:     "🇦🇹 Austria",
  Chopin:       "🇵🇱 Poland",
  Liszt:        "🇭🇺 Hungary",
  Brahms:       "🇩🇪 Germany",
  Tchaikovsky:  "🇷🇺 Russia",
  Debussy:      "🇫🇷 France",
  "Queenie's Blob": "🇨🇦 Hamilton, Canada",
};

const BIRTH_YEARS: Record<string, number> = {
  Bach:         1685,
  Handel:       1685,
  Vivaldi:      1678,
  Mozart:       1756,
  Beethoven:    1770,
  Schubert:     1797,
  Chopin:       1810,
  Liszt:        1811,
  Brahms:       1833,
  Tchaikovsky:  1840,
  Debussy:      1862,
};

// ── Silhouette overlay (CSS filter) ──────────────────────────────────────────
const LOCKED_FILTER = "grayscale(1) brightness(0.35) contrast(0.6)";

// ── Avatar card ───────────────────────────────────────────────────────────────
function ComposerCard({
  avatar,
  owned,
  shards,
  isFavorite,
  isFeatured,
  onToggleFavorite,
  onSetFeatured,
}: {
  avatar: ComposerAvatarRow;
  owned: boolean;
  shards: number;
  isFavorite: boolean;
  isFeatured: boolean;
  onToggleFavorite: (avatarId: string, current: boolean) => void;
  onSetFeatured: (avatarId: string) => void;
}) {
  const [showFact, setShowFact] = useState(false);

  function handleCardClick() {
    if (!owned) return;
    setShowFact(f => !f);
    if (avatar.youtube_id) {
      playComposerAudio(avatar.youtube_id);
    }
  }

  return (
    <div
      onClick={handleCardClick}
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        border: owned
          ? `2px solid ${RARITY_COLOR[avatar.rarity]}`
          : "2px solid var(--border)",
        background: "var(--white)",
        cursor: owned ? "pointer" : "default",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        boxShadow: owned ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
      }}
    >
      {/* Composer image */}
      <div style={{ position: "relative", aspectRatio: "1", background: "var(--cream-deep)" }}>
        <img
          src={avatar.image_path}
          alt={owned ? avatar.composer_name : ""}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            filter: owned ? "none" : LOCKED_FILTER,
            transition: "filter 0.3s ease",
          }}
        />

        {/* Rarity pip */}
        {owned && (
          <div style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: RARITY_COLOR[avatar.rarity],
            boxShadow: `0 0 4px ${RARITY_COLOR[avatar.rarity]}`,
          }} />
        )}

        {/* Shard badge */}
        {owned && shards > 0 && (
          <div style={{
            position: "absolute",
            bottom: 5,
            left: 5,
            background: "rgba(0,0,0,0.6)",
            borderRadius: 4,
            padding: "1px 5px",
            fontSize: "0.5rem",
            color: "white",
            fontFamily: "Inter, sans-serif",
          }}>
            +{shards} ✦
          </div>
        )}

        {/* Audio badge — shown when a YouTube video is linked */}
        {owned && avatar.youtube_id && (
          <div style={{
            position: "absolute",
            bottom: 5,
            right: 5,
            background: "rgba(0,0,0,0.55)",
            borderRadius: 4,
            padding: "1px 5px",
            fontSize: "0.5rem",
            color: "white",
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.4,
          }}>
            ♪
          </div>
        )}

        {/* Favourite star */}
        {owned && (
          <button
            onClick={e => { e.stopPropagation(); onToggleFavorite(avatar.id, isFavorite); }}
            style={{
              position: "absolute",
              top: 5,
              left: 5,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              lineHeight: 1,
              color: isFavorite ? "var(--butter)" : "rgba(255,255,255,0.4)",
              padding: 0,
            }}
          >
            ★
          </button>
        )}

        {/* Lock icon for unowned */}
        {!owned && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{
              fontSize: "1.25rem",
              color: "rgba(255,255,255,0.5)",
            }}>
              🔒
            </div>
          </div>
        )}
      </div>

      {/* Label row */}
      <div style={{ padding: "0.375rem 0.5rem 0.4rem" }}>
        <div style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "0.5625rem",
          fontWeight: owned ? 600 : 400,
          color: owned ? "var(--charcoal)" : "var(--muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {owned ? avatar.composer_name : "???"}
        </div>
        {owned && (BIRTH_YEARS[avatar.composer_name] || COMPOSER_COUNTRIES[avatar.composer_name]) && (
          <div style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.4375rem",
            color: "var(--muted)",
            marginTop: "0.05rem",
            display: "flex",
            gap: "0.3rem",
            flexWrap: "wrap",
          }}>
            {BIRTH_YEARS[avatar.composer_name] && <span>b. {BIRTH_YEARS[avatar.composer_name]}</span>}
            {COMPOSER_COUNTRIES[avatar.composer_name] && <span>{COMPOSER_COUNTRIES[avatar.composer_name]}</span>}
          </div>
        )}
        <div style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "0.4375rem",
          color: owned ? RARITY_COLOR[avatar.rarity] : "var(--border-strong)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginTop: "0.1rem",
        }}>
          {owned ? RARITY_LABEL[avatar.rarity] : avatar.unlock_hint?.split("—")[0] ?? "???"}
        </div>
      </div>

      {/* Featured crown badge */}
      {owned && isFeatured && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "1rem",
          pointerEvents: "none",
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))",
        }}>
          👑
        </div>
      )}

      {/* Fun fact overlay */}
      {owned && showFact && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(30,26,26,0.88)",
          backdropFilter: "blur(2px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.75rem",
          gap: "0.5rem",
        }}>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.5625rem",
            color: "white",
            lineHeight: 1.6,
            margin: 0,
            textAlign: "center",
          }}>
            {avatar.fun_fact}
          </p>
          <button
            onClick={e => { e.stopPropagation(); onSetFeatured(avatar.id); }}
            style={{
              marginTop: "0.25rem",
              padding: "0.25rem 0.625rem",
              borderRadius: 3,
              border: "none",
              background: isFeatured ? "var(--butter)" : "rgba(255,255,255,0.15)",
              color: isFeatured ? "var(--charcoal)" : "white",
              fontFamily: "Inter, sans-serif",
              fontSize: "0.5rem",
              fontWeight: 600,
              cursor: isFeatured ? "default" : "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {isFeatured ? "👑 Featured" : "Set as featured"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CollectionPage() {
  const { user } = useAuth();
  const [allAvatars, setAllAvatars] = useState<ComposerAvatarRow[]>([]);
  const [collection, setCollection] = useState<StudentCollectibleWithAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsUntilGuaranteed, setSessionsUntilGuaranteed] = useState<number | null>(null);
  const [featuredAvatarId, setFeaturedAvatarId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const service = CollectibleService.create(supabase);
    const [avatars, coll, sessions, profile] = await Promise.all([
      service.getAllAvatars(),
      service.getCollection(user.id),
      service.getSessionsUntilGuaranteed(user.id),
      supabase.from("profiles").select("featured_avatar_id").eq("id", user.id).single(),
    ]);
    setAllAvatars(avatars);
    setCollection(coll);
    setSessionsUntilGuaranteed(sessions);
    setFeaturedAvatarId((profile.data as { featured_avatar_id: string | null } | null)?.featured_avatar_id ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFavorite = async (avatarId: string, current: boolean) => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    await CollectibleService.create(supabase).setFavorite(user.id, avatarId, !current);
    setCollection(prev =>
      prev.map(c => c.avatar_id === avatarId ? { ...c, is_favorite: !current } : c)
    );
  };

  const handleSetFeatured = async (avatarId: string) => {
    if (!user?.id) return;
    await fetch("/api/studio/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, featured_avatar_id: avatarId }),
    });
    setFeaturedAvatarId(avatarId);
  };

  if (!user) return null;

  // Build lookup maps
  const ownedMap = new Map(collection.map(c => [c.avatar_id, c]));
  const totalOwned = collection.length;
  const totalAvatars = allAvatars.length;

  // Group avatars by era
  const byEra = new Map<CollectibleEra, ComposerAvatarRow[]>();
  for (const era of ERA_ORDER) byEra.set(era, []);
  for (const avatar of allAvatars) {
    byEra.get(avatar.era as CollectibleEra)?.push(avatar);
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%" }}>

      {/* Header */}
      <div style={{ padding: "1.5rem 1.5rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Composers
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>
      </div>

      <div style={{ padding: "1rem 1.5rem 5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Collection summary card */}
        <div className="card-base" style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "2.5rem", color: "var(--charcoal)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {loading ? "—" : totalOwned}
                <span style={{ fontSize: "1.25rem", color: "var(--muted)", marginLeft: "0.25rem" }}>/ {totalAvatars}</span>
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "0.25rem" }}>
                Composers collected
              </div>
            </div>
            {sessionsUntilGuaranteed !== null && sessionsUntilGuaranteed > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)", lineHeight: 1 }}>
                  {sessionsUntilGuaranteed}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "0.25rem", maxWidth: 72, textAlign: "right" }}>
                  sessions to guaranteed drop
                </div>
              </div>
            )}
            {sessionsUntilGuaranteed === 0 && (
              <div style={{
                background: "var(--butter)",
                color: "var(--charcoal)",
                borderRadius: 6,
                padding: "0.375rem 0.625rem",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.5625rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}>
                Drop guaranteed!
              </div>
            )}
          </div>

          {/* Overall progress bar */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ height: 5, background: "var(--cream-deep)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: loading ? "0%" : `${(totalOwned / Math.max(totalAvatars, 1)) * 100}%`,
                background: "var(--sage)",
                borderRadius: 3,
                transition: "width 0.8s ease",
              }} />
            </div>
          </div>
        </div>

        {/* Era sections */}
        {ERA_ORDER.map(era => {
          const eraAvatars = byEra.get(era) ?? [];
          if (!eraAvatars.length) return null;

          const eraOwned = eraAvatars.filter(a => ownedMap.has(a.id)).length;
          const eraComplete = eraOwned === eraAvatars.length;
          const eraConfig = ERA_SETS[era];

          return (
            <div key={era}>
              {/* Era header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--charcoal)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {ERA_LABEL[era]}
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)" }}>
                    {eraOwned}/{eraAvatars.length}
                  </span>
                </div>
                {eraComplete && (
                  <div style={{
                    background: eraConfig.color,
                    borderRadius: 4,
                    padding: "0.2rem 0.5rem",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "0.5rem",
                    fontWeight: 600,
                    color: "var(--charcoal)",
                    letterSpacing: "0.03em",
                  }}>
                    ✦ {eraConfig.bonus}
                  </div>
                )}
              </div>

              {/* Era progress bar */}
              <div style={{ height: 3, background: "var(--cream-deep)", borderRadius: 2, overflow: "hidden", marginBottom: "0.75rem" }}>
                <div style={{
                  height: "100%",
                  width: `${(eraOwned / eraAvatars.length) * 100}%`,
                  background: eraConfig.color,
                  borderRadius: 2,
                  transition: "width 0.6s ease",
                }} />
              </div>

              {/* Avatar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                {eraAvatars.map(avatar => {
                  const owned = ownedMap.get(avatar.id);
                  return (
                    <ComposerCard
                      key={avatar.id}
                      avatar={avatar}
                      owned={!!owned}
                      shards={owned?.shard_count ?? 0}
                      isFavorite={owned?.is_favorite ?? false}
                      isFeatured={featuredAvatarId === avatar.id}
                      onToggleFavorite={handleToggleFavorite}
                      onSetFeatured={handleSetFeatured}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Tap to reveal hint */}
        {!loading && totalOwned > 0 && (
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.5rem",
            color: "var(--muted)",
            textAlign: "center",
            letterSpacing: "0.04em",
            marginTop: "0.5rem",
          }}>
            Tap any composer to read their story
          </p>
        )}

        {/* Empty state */}
        {!loading && totalOwned === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎹</div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
              Start your collection
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6 }}>
              Log your first practice session to unlock your first composer.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
