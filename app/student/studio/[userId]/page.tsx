"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { ShopService } from "../../../../lib/services/ShopService";
import { CollectibleService } from "../../../../lib/services/CollectibleService";
import type { InventoryItemWithDetails, StudentCollectibleWithAvatar } from "../../../../lib/types";

const RARITY_COLORS: Record<string, { border: string; glow: string; label: string }> = {
  common:    { border: "var(--border-strong)", glow: "transparent",    label: "Common"    },
  rare:      { border: "var(--sky)",           glow: "var(--sky)",      label: "Rare"      },
  epic:      { border: "var(--lavender)",      glow: "var(--lavender)", label: "Epic"      },
  legendary: { border: "var(--butter)",        glow: "var(--butter)",   label: "Legendary" },
};

const COMPOSER_QUOTES: Record<string, string> = {
  Bach:         "Order in all things.",
  Beethoven:    "I shall seize fate by the throat.",
  Mozart:       "Music is not in the notes, but in the silence between.",
  Chopin:       "Simplicity is the final achievement.",
  Debussy:      "Music is the silence between the notes.",
  Brahms:       "Without craftsmanship, inspiration is a mere reed shaken in the wind.",
  Tchaikovsky:  "Inspiration is a guest that does not willingly visit the lazy.",
  Schubert:     "The world is like a beautiful book, but of little use to those who cannot read it.",
  Liszt:        "Genuine poetry can communicate before it is understood.",
  Handel:       "Whether I was in my body or out of my body when I wrote it, I know not.",
};

const PRESET_REACTIONS = [
  { id: "note",    emoji: "🎵", label: "Leave a note" },
  { id: "fire",    emoji: "🔥", label: "On fire!" },
  { id: "clap",    emoji: "👏", label: "Bravo!" },
  { id: "star",    emoji: "⭐", label: "Stunning" },
  { id: "love",    emoji: "🎶", label: "Love this" },
];

interface ProfileData {
  display_name: string;
  instrument: string | null;
  streak_days: number;
  total_points: number;
}

export default function VisitorStudioPage() {
  const params = useParams();
  const userId = params.userId as string;
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const isOwnStudio = user?.id === userId;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [inventory, setInventory] = useState<InventoryItemWithDetails[]>([]);
  const [composers, setComposers] = useState<StudentCollectibleWithAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"composers" | "items">("composers");
  const [hoveredComposer, setHoveredComposer] = useState<string | null>(null);
  const [reactionSent, setReactionSent] = useState<string | null>(null);
  const [floatingNotes, setFloatingNotes] = useState<{ id: number; emoji: string; x: number }[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      try {
        const shop = ShopService.create(supabase);
        const collectibles = CollectibleService.create(supabase);
        const [profileRes, inv, comps] = await Promise.all([
          supabase.from("profiles").select("display_name,instrument,streak_days,total_points").eq("id", userId).maybeSingle(),
          shop.getInventory(userId),
          collectibles.getCollection(userId),
        ]);
        if (!profileRes.data) { setNotFound(true); return; }
        setProfile(profileRes.data as ProfileData);
        setInventory(inv);
        setComposers(comps);
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function sendReaction(reaction: typeof PRESET_REACTIONS[number]) {
    if (reactionSent) return;
    setReactionSent(reaction.id);
    // Spawn 3–5 floating notes
    const count = 3 + Math.floor(Math.random() * 3);
    const notes = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      emoji: reaction.emoji,
      x: 10 + Math.random() * 80,
    }));
    setFloatingNotes(prev => [...prev, ...notes]);
    setTimeout(() => setFloatingNotes(prev => prev.filter(n => !notes.find(nn => nn.id === n.id))), 3000);
  }

  if (loading) return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem" }}>
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 170, borderRadius: 8 }} />)}
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", fontFamily: "Inter, sans-serif", color: "var(--muted)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎼</div>
      This studio doesn&apos;t exist yet.
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem", position: "relative" }}>

      {/* Floating reaction notes */}
      {floatingNotes.map(note => (
        <div key={note.id} style={{
          position: "fixed", bottom: "30%", left: `${note.x}%`,
          fontSize: "1.75rem", zIndex: 100, pointerEvents: "none",
          animation: "floatUp 3s ease-out forwards",
        }}>
          {note.emoji}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 1; }
          100% { transform: translateY(-180px) scale(0.6); opacity: 0; }
        }
      `}</style>

      {/* Profile card */}
      <div className="card-base" style={{ padding: "1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.25rem", color: "var(--white)", flexShrink: 0 }}>
          {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "var(--charcoal)" }}>
            {profile?.display_name}&apos;s Studio
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem" }}>
            {profile?.instrument && <span>{profile.instrument} · </span>}
            {composers.length} composer{composers.length !== 1 ? "s" : ""} · {inventory.length} item{inventory.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "1.25rem", flexShrink: 0 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: (profile?.streak_days ?? 0) > 0 ? "var(--rose)" : "var(--muted)" }}>{profile?.streak_days ?? 0}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Day streak</div>
          </div>
        </div>
        {isOwnStudio && (
          <Link href="/student/studio" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none", flexShrink: 0 }}>
            ← My studio
          </Link>
        )}
      </div>

      {/* Reactions — only for visitors */}
      {!isOwnStudio && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            Leave a reaction
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {PRESET_REACTIONS.map(r => (
              <button
                key={r.id}
                onClick={() => sendReaction(r)}
                disabled={!!reactionSent}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.5rem 0.875rem", borderRadius: 100,
                  border: `1px solid ${reactionSent === r.id ? "var(--charcoal)" : "var(--border)"}`,
                  background: reactionSent === r.id ? "var(--charcoal)" : "transparent",
                  color: reactionSent === r.id ? "var(--white)" : "var(--charcoal)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                  cursor: reactionSent ? "default" : "pointer",
                  opacity: reactionSent && reactionSent !== r.id ? 0.4 : 1,
                  transition: "all 0.15s",
                }}
              >
                <span>{r.emoji}</span>
                <span>{reactionSent === r.id ? "Sent!" : r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", width: "fit-content", marginBottom: "1.5rem" }}>
        {([["composers", `Composers (${composers.length})`], ["items", `Items (${inventory.length})`]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "0.5rem 1.125rem", border: "none", cursor: "pointer",
            background: activeTab === tab ? "var(--charcoal)" : "transparent",
            color: activeTab === tab ? "var(--white)" : "var(--muted)",
            fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
            transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "composers" ? (
        composers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎼</div>
            No composers collected yet.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: "0.75rem" }}>
            {composers.map(c => {
              const r = RARITY_COLORS[c.composer_avatars.rarity] ?? RARITY_COLORS.common;
              const quote = COMPOSER_QUOTES[c.composer_avatars.composer_name];
              const isHovered = hoveredComposer === c.avatar_id;
              return (
                <div
                  key={c.avatar_id}
                  onMouseEnter={() => setHoveredComposer(c.avatar_id)}
                  onMouseLeave={() => setHoveredComposer(null)}
                  style={{
                    border: `2px solid ${r.border}`,
                    borderRadius: 8, padding: "1rem 0.75rem",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                    textAlign: "center", cursor: "default", background: "var(--white)",
                    boxShadow: isHovered ? `0 0 12px ${r.glow}40` : "none",
                    transition: "box-shadow 0.2s, transform 0.2s",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  <div style={{ width: 72, height: 72, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    <img src={c.composer_avatars.image_path} alt={c.composer_avatars.composer_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--charcoal)" }}>{c.composer_avatars.composer_name}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: r.border === "var(--border-strong)" ? "var(--muted)" : r.border, textTransform: "uppercase", letterSpacing: "0.05em" }}>{r.label}</div>
                  {c.shard_count > 0 && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)" }}>+{c.shard_count} ✦</div>
                  )}
                  {isHovered && quote && (
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "rgba(0,0,0,0.82)", padding: "0.5rem 0.625rem",
                      fontFamily: "Cormorant Garamond, Georgia, serif", fontStyle: "italic",
                      fontSize: "0.625rem", color: "var(--white)", lineHeight: 1.4, textAlign: "center",
                    }}>
                      &ldquo;{quote}&rdquo;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        inventory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🛋️</div>
            Nothing in the studio yet.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem" }}>
            {inventory.map(inv => {
              const item = inv.shop_items;
              const r = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
              return (
                <div key={inv.id} style={{
                  border: `2px solid ${r.border}`,
                  borderRadius: 8, padding: "1rem 0.75rem",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                  textAlign: "center", background: "var(--white)",
                }}>
                  <div style={{ fontSize: "2.25rem", lineHeight: 1 }}>{item.emoji}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--charcoal)" }}>{item.name}</div>
                  {item.rarity !== "common" && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: r.border, textTransform: "uppercase", letterSpacing: "0.05em" }}>{r.label}</div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
