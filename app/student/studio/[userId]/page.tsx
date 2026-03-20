"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { ShopService } from "../../../../lib/services/ShopService";
import { CollectibleService } from "../../../../lib/services/CollectibleService";
import type { InventoryItemWithDetails, StudentCollectibleWithAvatar, PieceRow, ShopItemRow, StudioGiftWithDetails } from "../../../../lib/types";
import { playComposerAudio } from "../../../../lib/composerTunes";
import type { PortfolioItemRow } from "../../../../lib/services/PortfolioService";

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


function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

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
  theme_song_item_id: string | null;
  theme_song_title: string | null;
}

interface ShoutoutRow {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

type CrateItem = PortfolioItemRow & { display_name?: string; avatar_url?: string | null };

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
  const [tabsLoading, setTabsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"composers" | "items" | "journey" | "music">("composers");
  const [hoveredComposer, setHoveredComposer] = useState<string | null>(null);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [selectedGiftItem, setSelectedGiftItem] = useState<ShopItemRow | null>(null);
  const [giftMessage, setGiftMessage] = useState("");
  const [sendingGift, setSendingGift] = useState(false);
  const [giftSent, setGiftSent] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  // Theme song
  const audioRef = useRef<HTMLAudioElement>(null);
  const [themeSongUrl, setThemeSongUrl] = useState<string | null>(null);
  const [themeSongTitle, setThemeSongTitle] = useState<string | null>(null);
  const [themeMuted, setThemeMuted] = useState(false);

  // Music tab
  const [discography, setDiscography] = useState<PortfolioItemRow[]>([]);
  const [crate, setCrate] = useState<CrateItem[]>([]);
  const [myCollectedIds, setMyCollectedIds] = useState<Set<string>>(new Set());
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [justCollected, setJustCollected] = useState<Set<string>>(new Set());

  // Follow
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);


  // Guestbook
  const [shoutouts, setShoutouts] = useState<ShoutoutRow[]>([]);
  const [shoutoutText, setShoutoutText] = useState("");
  const [postingShoutout, setPostingShoutout] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      setTabsLoading(true);
      try {
        const collectibles = CollectibleService.create(supabase);

        // ── Phase 1: above-fold content (profile + composers) ──
        const [profileRes, comps] = await Promise.all([
          supabase.from("profiles").select("display_name,instrument,streak_days,total_points,studio_name,studio_tagline,featured_avatar_id,studio_persona,studio_bio,theme_song_item_id,theme_song_title").eq("id", userId).maybeSingle(),
          collectibles.getCollection(userId),
        ]);

        if (!profileRes.data) { setNotFound(true); setLoading(false); return; }
        const profileData = profileRes.data as ProfileData;
        setProfile(profileData);
        setComposers(comps);
        setLoading(false); // show the page now

        // ── Phase 2: tab content in background ──
        const shop = ShopService.create(supabase);
        const [inv, piecesRes, giftsRes, allItems, followCountRes, shoutoutsRes, discRes, crateRes] = await Promise.all([
          shop.getInventory(userId),
          supabase.from("pieces").select("*").eq("student_id", userId).order("created_at", { ascending: false }),
          supabase.from("studio_gifts").select("*, shop_items(*), sender:profiles!sender_id(display_name)").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(20),
          shop.getAllItems(),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
          supabase.from("studio_shoutouts").select("*").eq("studio_owner_id", userId).order("created_at", { ascending: false }).limit(20),
          supabase.from("portfolio_items").select("*").eq("student_id", userId).eq("is_public", true).order("created_at", { ascending: false }),
          supabase.from("portfolio_collections").select("portfolio_item_id, portfolio_items(*, profiles(display_name, avatar_url))").eq("collector_id", userId).order("created_at", { ascending: false }),
        ]);

        setInventory(inv);
        setPieces((piecesRes.data ?? []) as PieceRow[]);
        setGifts((giftsRes.data ?? []) as StudioGiftWithDetails[]);
        setShopItems(allItems);
        setFollowerCount(followCountRes.count ?? 0);
        setShoutouts((shoutoutsRes.data ?? []) as ShoutoutRow[]);
        setDiscography((discRes.data ?? []) as PortfolioItemRow[]);
        const crateItems = ((crateRes.data ?? []) as unknown as Array<{
          portfolio_item_id: string;
          portfolio_items: PortfolioItemRow & { profiles?: { display_name: string; avatar_url: string | null } };
        }>).map(r => ({
          ...r.portfolio_items,
          display_name: r.portfolio_items?.profiles?.display_name,
          avatar_url: r.portfolio_items?.profiles?.avatar_url ?? null,
        }));
        setCrate(crateItems);

        // Theme song (parallel with phase 2 above would be ideal but depends on profileData)
        if (profileData.theme_song_item_id) {
          const { data: songItem } = await supabase
            .from("portfolio_items")
            .select("recording_url, title")
            .eq("id", profileData.theme_song_item_id)
            .maybeSingle();
          if (songItem?.recording_url) {
            setThemeSongUrl(songItem.recording_url as string);
            setThemeSongTitle((profileData.theme_song_title ?? (songItem as { title?: string }).title) ?? null);
          }
        }

        // Current user's data
        if (user?.id) {
          const [followRes, myCollectionsRes] = await Promise.all([
            supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle(),
            supabase.from("portfolio_collections").select("portfolio_item_id").eq("collector_id", user.id),
          ]);
          setIsFollowing(!!followRes.data);
          setMyCollectedIds(new Set((myCollectionsRes.data ?? []).map((r: { portfolio_item_id: string }) => r.portfolio_item_id)));
        }
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
        setTabsLoading(false);
      }
    }
    load();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Audio volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = 0.25;
  }, [themeSongUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = themeMuted;
  }, [themeMuted]);

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  // ── Follow / Unfollow ───────────────────────────────────────────────────────

  async function toggleFollow() {
    if (!user?.id || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
        setIsFollowing(false);
        setFollowerCount(c => Math.max(0, c - 1));
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
        setIsFollowing(true);
        setFollowerCount(c => c + 1);
      }
    } finally {
      setFollowLoading(false);
    }
  }

  // ── Guestbook ───────────────────────────────────────────────────────────────

  async function postShoutout() {
    if (!user?.id || !shoutoutText.trim() || postingShoutout) return;
    setPostingShoutout(true);
    try {
      const { data: me } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      const authorName = (me as { display_name: string } | null)?.display_name ?? "Someone";
      const { data: newShoutout } = await supabase.from("studio_shoutouts").insert({
        studio_owner_id: userId,
        author_id: user.id,
        author_name: authorName,
        content: shoutoutText.trim(),
      }).select().single();
      if (newShoutout) setShoutouts(prev => [newShoutout as ShoutoutRow, ...prev]);
      setShoutoutText("");
    } finally {
      setPostingShoutout(false);
    }
  }

  // ── Gift ────────────────────────────────────────────────────────────────────

  async function sendGift() {
    if (!user?.id || !selectedGiftItem || sendingGift) return;
    setSendingGift(true);
    try {
      await fetch("/api/studio/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id, recipientId: userId,
          itemId: selectedGiftItem.id, message: giftMessage.trim() || null,
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

  // ── Collect track ───────────────────────────────────────────────────────────

  async function collectItem(item: PortfolioItemRow) {
    if (!user?.id || collectingId) return;
    setCollectingId(item.id);
    try {
      await fetch("/api/portfolio/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectorId: user.id, itemId: item.id }),
      });
      setMyCollectedIds(prev => new Set([...prev, item.id]));
      setJustCollected(prev => new Set([...prev, item.id]));
      setDiscography(prev => prev.map(d => d.id === item.id ? { ...d, collection_count: (d.collection_count ?? 0) + 1 } : d));
    } catch (e) {
      console.error(e);
    } finally {
      setCollectingId(null);
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

      {/* Theme song */}
      {themeSongUrl && <audio ref={audioRef} src={themeSongUrl} autoPlay loop style={{ display: "none" }} />}


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
          >♪</button>
        </div>
      )}

      {/* ── Profile card ── */}
      <div className="card-base" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.125rem", color: "var(--white)", flexShrink: 0 }}>
            {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "var(--charcoal)" }}>
                {studioTitle}
              </div>
              {themeSongUrl && themeSongTitle && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.1875rem 0.625rem", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 100, flexShrink: 0 }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)" }}>♫ {themeSongTitle}</span>
                  <button
                    onClick={() => setThemeMuted(m => !m)}
                    title={themeMuted ? "Unmute" : "Mute"}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: "0.75rem", color: "var(--muted)" }}
                  >
                    {themeMuted ? "🔇" : "🔊"}
                  </button>
                </div>
              )}
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
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {profile?.instrument && <span>{profile.instrument}</span>}
              <span>{profile?.streak_days ?? 0} day streak</span>
              <span>{followerCount} follower{followerCount !== 1 ? "s" : ""}</span>
              <span>{composers.length} composer{composers.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, flexWrap: "wrap" }}>
            {!isOwnStudio && user && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                style={{
                  padding: "0.4375rem 1rem", borderRadius: 100,
                  border: isFollowing ? "1.5px solid var(--charcoal)" : "1.5px solid var(--border)",
                  background: isFollowing ? "var(--charcoal)" : "transparent",
                  color: isFollowing ? "var(--white)" : "var(--charcoal)",
                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 600,
                  cursor: followLoading ? "default" : "pointer", transition: "all 0.15s",
                  opacity: followLoading ? 0.6 : 1,
                }}
              >
                {isFollowing ? "✓ Following" : "+ Follow"}
              </button>
            )}
            {!isOwnStudio && user && (
              <button
                onClick={() => setGiftSheetOpen(true)}
                style={{
                  padding: "0.4375rem 1rem", borderRadius: 100,
                  border: "1.5px solid var(--border)", background: "transparent",
                  color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
                  fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                🎁 Gift
              </button>
            )}
            {isOwnStudio && (
              <Link href="/student/studio" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none", padding: "0.4375rem 0" }}>
                ← My studio
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Bio ── */}
      {profile?.studio_bio && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontStyle: "italic", fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.6 }}>
            {profile.studio_bio}
          </div>
        </div>
      )}

      {/* ── Guestbook ── */}
      <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
          Guestbook
        </div>

        {/* Write a note */}
        {!isOwnStudio && user && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: shoutouts.length > 0 ? "0.875rem" : 0 }}>
            <input
              value={shoutoutText}
              onChange={e => setShoutoutText(e.target.value.slice(0, 120))}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && postShoutout()}
              placeholder="Leave a note…"
              maxLength={120}
              style={{
                flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
                padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 8,
                outline: "none", background: "var(--cream)",
              }}
            />
            <button
              onClick={postShoutout}
              disabled={!shoutoutText.trim() || postingShoutout}
              style={{
                padding: "0.5rem 0.875rem", borderRadius: 8, border: "none",
                background: shoutoutText.trim() ? "var(--charcoal)" : "var(--border)",
                color: shoutoutText.trim() ? "var(--white)" : "var(--muted)",
                fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 600,
                cursor: shoutoutText.trim() && !postingShoutout ? "pointer" : "default",
                flexShrink: 0,
              }}
            >
              {postingShoutout ? "…" : "Post"}
            </button>
          </div>
        )}

        {/* Notes list */}
        {shoutouts.length === 0 ? (
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", padding: "0.5rem 0" }}>
            No notes yet — be the first to leave one!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {shoutouts.map(s => (
              <div key={s.id} style={{ display: "flex", gap: "0.625rem", padding: "0.625rem 0.75rem", background: "var(--cream)", borderRadius: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "var(--white)", flexShrink: 0 }}>
                  {s.author_name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "var(--charcoal)" }}>{s.author_name}</span>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)" }}>{timeAgo(s.created_at)}</span>
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", marginTop: "0.125rem", lineHeight: 1.4 }}>{s.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Gifts shelf ── */}
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
        {([["composers", `Composers (${composers.length})`], ["items", `Items (${inventory.length})`], ["journey", "Journey"], ["music", "Music"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "0.5rem 1.125rem", border: "none", cursor: "pointer",
            background: activeTab === tab ? "var(--charcoal)" : "transparent",
            color: activeTab === tab ? "var(--white)" : "var(--muted)",
            fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
            transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tabsLoading && activeTab !== "composers" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 8 }} />)}
        </div>
      )}
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
                    border: `2px solid ${r.border}`, borderRadius: 8, padding: "1rem 0.75rem",
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
                  {c.shard_count > 0 && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)" }}>+{c.shard_count} ✦</div>}
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
                <div key={inv.id} style={{ border: `2px solid ${r.border}`, borderRadius: 8, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", textAlign: "center", background: "var(--white)" }}>
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
      ) : activeTab === "journey" ? (
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
      ) : (
        /* Music tab */
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.875rem" }}>Discography</div>
            {discography.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎙️</div>
                No published tracks yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {discography.map(track => {
                  const collected = myCollectedIds.has(track.id) || justCollected.has(track.id);
                  const isOwn = track.student_id === user?.id;
                  const price = track.price_points ?? 0;
                  return (
                    <div key={track.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>{track.title}</div>
                        {track.description && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.description}</div>}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                          {track.media_type && <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--sky)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.125rem 0.375rem", background: "rgba(100,180,220,0.12)", borderRadius: 4 }}>{track.media_type}</span>}
                          {(track.collection_count ?? 0) > 0 && <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>{track.collection_count} collected</span>}
                          {price > 0 && <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--butter)" }}>{price} pts</span>}
                        </div>
                      </div>
                      {!isOwn && user && (
                        <button
                          onClick={() => !collected && collectItem(track)}
                          disabled={collected || collectingId === track.id}
                          style={{
                            padding: "0.4375rem 0.875rem", borderRadius: 100, border: "none", flexShrink: 0,
                            background: collected ? "var(--cream)" : "var(--charcoal)",
                            color: collected ? "var(--muted)" : "var(--white)",
                            fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600,
                            cursor: collected || collectingId === track.id ? "default" : "pointer", transition: "all 0.15s",
                          }}
                        >
                          {collected ? "✓ In Crate" : collectingId === track.id ? "…" : price === 0 ? "Collect" : `Collect · ${price} pts`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.875rem" }}>Their Crate</div>
            {crate.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", borderRadius: 8, border: "1px solid var(--border)" }}>
                Their Crate is empty.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
                {crate.map(track => (
                  <div key={track.id} style={{ padding: "0.875rem 1rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>{track.title}</div>
                    {track.display_name && (
                      <Link href={`/student/studio/${track.student_id}`} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", textDecoration: "none" }}>
                        {track.display_name} →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
                <div style={{ textAlign: "center", padding: "2rem", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)" }}>🎁 Gift sent!</div>
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
                          padding: "0.75rem 0.5rem", borderRadius: 8,
                          border: `2px solid ${selectedGiftItem?.id === item.id ? "var(--charcoal)" : "var(--border)"}`,
                          background: selectedGiftItem?.id === item.id ? "var(--cream)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "1.5rem" }}>{item.emoji}</span>
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--charcoal)", textAlign: "center", lineHeight: 1.3 }}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={giftMessage}
                    onChange={e => setGiftMessage(e.target.value)}
                    placeholder="Add a message (optional)…"
                    maxLength={120}
                    rows={2}
                    style={{ width: "100%", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6, resize: "none", outline: "none", background: "var(--cream)", boxSizing: "border-box", marginBottom: "1rem" }}
                  />
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
