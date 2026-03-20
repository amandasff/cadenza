"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { ShopService } from "../../../../lib/services/ShopService";
import { CollectibleService } from "../../../../lib/services/CollectibleService";
import type { InventoryItemWithDetails, StudentCollectibleWithAvatar, PieceRow, ShopItemRow, StudioGiftWithDetails } from "../../../../lib/types";
import { playComposerAudio } from "../../../../lib/composerTunes";

const ERA_TINTS: Record<string, string> = {
  baroque:      "rgba(180, 140, 60, 0.08)",
  classical:    "rgba(100, 140, 200, 0.08)",
  romantic:     "rgba(180, 80, 100, 0.08)",
  impressionist:"rgba(100, 160, 140, 0.08)",
};

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

const STATUS_LABELS: Record<string, string> = {
  learning:           "Learning",
  polishing:          "Polishing",
  performance_ready:  "Performance Ready",
  completed:          "Completed",
};

const STATUS_COLORS: Record<string, string> = {
  learning:           "var(--sky)",
  polishing:          "var(--lavender)",
  performance_ready:  "var(--sage)",
  completed:          "var(--butter)",
};

const PRESET_REACTIONS = [
  { id: "note",  emoji: "🎵", label: "Leave a note" },
  { id: "fire",  emoji: "🔥", label: "On fire!" },
  { id: "clap",  emoji: "👏", label: "Bravo!" },
  { id: "star",  emoji: "⭐", label: "Stunning" },
  { id: "love",  emoji: "🎶", label: "Love this" },
];

interface ProfileData {
  display_name: string;
  instrument: string | null;
  streak_days: number;
  total_points: number;
  studio_name: string | null;
  studio_tagline: string | null;
  featured_avatar_id: string | null;
  studio_persona: string | null;
  studio_bio: string | null;
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
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [gifts, setGifts] = useState<StudioGiftWithDetails[]>([]);
  const [shopItems, setShopItems] = useState<ShopItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"composers" | "items" | "journey">("composers");
  const [hoveredComposer, setHoveredComposer] = useState<string | null>(null);
  const [reactionSent, setReactionSent] = useState<string | null>(null);
  const [floatingNotes, setFloatingNotes] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [selectedGiftItem, setSelectedGiftItem] = useState<ShopItemRow | null>(null);
  const [giftMessage, setGiftMessage] = useState("");
  const [sendingGift, setSendingGift] = useState(false);
  const [giftSent, setGiftSent] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      try {
        const shop = ShopService.create(supabase);
        const collectibles = CollectibleService.create(supabase);
        const [profileRes, inv, comps, piecesRes, giftsRes, allItems] = await Promise.all([
          supabase.from("profiles").select("display_name,instrument,streak_days,total_points,studio_name,studio_tagline,featured_avatar_id,studio_persona,studio_bio").eq("id", userId).maybeSingle(),
          shop.getInventory(userId),
          collectibles.getCollection(userId),
          supabase.from("pieces").select("*").eq("student_id", userId).order("created_at", { ascending: false }),
          supabase.from("studio_gifts").select("*, shop_items(*), sender:profiles!sender_id(display_name)").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(20),
          shop.getAllItems(),
        ]);
        if (!profileRes.data) { setNotFound(true); return; }
        setProfile(profileRes.data as ProfileData);
        setInventory(inv);
        setComposers(comps);
        setPieces((piecesRes.data ?? []) as PieceRow[]);
        setGifts((giftsRes.data ?? []) as StudioGiftWithDetails[]);
        setShopItems(allItems);
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
    const count = 3 + Math.floor(Math.random() * 3);
    const notes = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      emoji: reaction.emoji,
      x: 10 + Math.random() * 80,
    }));
    setFloatingNotes(prev => [...prev, ...notes]);
    setTimeout(() => setFloatingNotes(prev => prev.filter(n => !notes.find(nn => nn.id === n.id))), 3000);
  }

  async function sendGift() {
    if (!user?.id || !selectedGiftItem || sendingGift) return;
    setSendingGift(true);
    try {
      await fetch("/api/studio/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          recipientId: userId,
          itemId: selectedGiftItem.id,
          message: giftMessage.trim() || null,
        }),
      });
      setGiftSent(true);
      setTimeout(() => { setGiftSheetOpen(false); setGiftSent(false); setSelectedGiftItem(null); setGiftMessage(""); }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSendingGift(false);
    }
  }

  const featuredComposer = composers.find(c => c.avatar_id === profile?.featured_avatar_id) ?? composers[0] ?? null;
  const eraTint = featuredComposer ? ERA_TINTS[featuredComposer.composer_avatars.era] ?? ERA_TINTS.classical : undefined;
  const studioTitle = profile?.studio_name || (profile?.display_name ? `${profile.display_name}'s Studio` : "");

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

      {/* ── Featured composer banner ── */}
      {featuredComposer && (
        <div style={{
          background: eraTint ?? "var(--cream)",
          border: `2px solid ${RARITY_COLORS[featuredComposer.composer_avatars.rarity]?.border ?? "var(--border)"}`,
          borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", gap: "1.25rem",
        }}>
          <div style={{ width: 72, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: `1px solid ${RARITY_COLORS[featuredComposer.composer_avatars.rarity]?.border}` }}>
            <img src={featuredComposer.composer_avatars.image_path} alt={featuredComposer.composer_avatars.composer_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.2rem" }}>Featured Composer</div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)" }}>{featuredComposer.composer_avatars.composer_name}</div>
            {COMPOSER_QUOTES[featuredComposer.composer_avatars.composer_name] && (
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontStyle: "italic", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.2rem", lineHeight: 1.4 }}>
                &ldquo;{COMPOSER_QUOTES[featuredComposer.composer_avatars.composer_name]}&rdquo;
              </div>
            )}
          </div>
          <button
            onClick={() => playComposerAudio(featuredComposer.composer_avatars.youtube_id)}
            title="Play motif"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.125rem" }}
          >
            ♪
          </button>
        </div>
      )}

      {/* ── Profile card ── */}
      <div className="card-base" style={{ padding: "1.5rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.25rem", color: "var(--white)", flexShrink: 0 }}>
          {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "var(--charcoal)" }}>
            {studioTitle}
          </div>
          {profile?.studio_tagline && (
            <div style={{ fontFamily: "Inter, sans-serif", fontStyle: "italic", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem" }}>
              {profile.studio_tagline}
            </div>
          )}
          {profile?.studio_persona && (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)", marginTop: "0.2rem" }}>
              ✦ {profile.studio_persona}
            </div>
          )}
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
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

      {/* ── AI Bio ── */}
      {profile?.studio_bio && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontStyle: "italic", fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.6 }}>
            {profile.studio_bio}
          </div>
        </div>
      )}

      {/* ── Gifts shelf (visible to all) ── */}
      {gifts.length > 0 && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            🎁 Gifts
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {gifts.map(g => (
              <div key={g.id} title={g.message ?? undefined} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", padding: "0.5rem 0.75rem", background: "var(--cream)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "1.5rem" }}>{g.shop_items?.emoji ?? "🎁"}</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)" }}>{g.sender?.display_name ?? "Someone"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Reactions — only for visitors ── */}
      {!isOwnStudio && user && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Leave a reaction
            </div>
            <button onClick={() => setGiftSheetOpen(true)} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, padding: "0.375rem 0.875rem", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 100, cursor: "pointer" }}>
              🎁 Send a gift
            </button>
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

      {/* ── Repertoire Book button ── */}
      {pieces.length > 0 && (
        <button
          onClick={() => setBookOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.875rem 1.25rem", marginBottom: "1.25rem", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", width: "100%", textAlign: "left" }}
        >
          <span style={{ fontSize: "1.25rem" }}>📖</span>
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>Repertoire Book</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>{pieces.length} piece{pieces.length !== 1 ? "s" : ""}</div>
          </div>
          <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: "0.875rem" }}>→</span>
        </button>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "0", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", width: "fit-content", marginBottom: "1.5rem" }}>
        {([["composers", `Composers (${composers.length})`], ["items", `Items (${inventory.length})`], ["journey", "Journey"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "0.5rem 1.125rem", border: "none", cursor: "pointer",
            background: activeTab === tab ? "var(--charcoal)" : "transparent",
            color: activeTab === tab ? "var(--white)" : "var(--muted)",
            fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
            transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ── Content ── */}
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
      ) : activeTab === "items" ? (
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
      ) : (
        /* Journey tab */
        pieces.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎵</div>
            No pieces shared yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pieces.map(piece => (
              <div key={piece.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>{piece.title}</div>
                  {piece.composer && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>{piece.composer}</div>}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: STATUS_COLORS[piece.status] ?? "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                  {STATUS_LABELS[piece.status] ?? piece.status}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Gift sheet ── */}
      {giftSheetOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setGiftSheetOpen(false)}>
          <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", maxHeight: "80dvh", width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "0.875rem 1.25rem 0.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.125rem", color: "var(--charcoal)" }}>Send a gift</div>
              <button onClick={() => setGiftSheetOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem" }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "1rem 1.25rem", flex: 1 }}>
              {giftSent ? (
                <div style={{ textAlign: "center", padding: "2rem", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)" }}>
                  🎁 Gift sent!
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Choose an item</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                    {shopItems.slice(0, 20).map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedGiftItem(item)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem",
                          padding: "0.75rem 0.5rem", borderRadius: 8, border: `2px solid ${selectedGiftItem?.id === item.id ? "var(--charcoal)" : "var(--border)"}`,
                          background: selectedGiftItem?.id === item.id ? "var(--cream)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "1.5rem" }}>{item.emoji}</span>
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--charcoal)", textAlign: "center", lineHeight: 1.3 }}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ marginBottom: "1rem" }}>
                    <textarea
                      value={giftMessage}
                      onChange={e => setGiftMessage(e.target.value)}
                      placeholder="Add a message (optional)..."
                      maxLength={120}
                      rows={2}
                      style={{ width: "100%", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6, resize: "none", outline: "none", background: "var(--cream)", boxSizing: "border-box" }}
                    />
                  </div>
                  <button
                    onClick={sendGift}
                    disabled={!selectedGiftItem || sendingGift}
                    style={{
                      width: "100%", padding: "0.75rem", borderRadius: 8, border: "none",
                      background: selectedGiftItem ? "var(--charcoal)" : "var(--border)",
                      color: selectedGiftItem ? "var(--white)" : "var(--muted)",
                      fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem",
                      cursor: selectedGiftItem && !sendingGift ? "pointer" : "default",
                    }}
                  >
                    {sendingGift ? "Sending…" : "Send gift"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Repertoire Book modal ── */}
      {bookOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setBookOpen(false)}>
          <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", maxHeight: "85dvh", width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "0.875rem 1.25rem 0.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)" }}>📖 Repertoire</div>
              <button onClick={() => setBookOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem" }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "1rem 1.25rem", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {pieces.map(piece => (
                  <div key={piece.id} style={{ padding: "0.875rem", background: "var(--cream)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.3 }}>{piece.title}</div>
                    {piece.composer && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>{piece.composer}</div>}
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: STATUS_COLORS[piece.status] ?? "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.5rem" }}>
                      {STATUS_LABELS[piece.status] ?? piece.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
