"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ShopService } from "../../../lib/services/ShopService";
import { CollectibleService } from "../../../lib/services/CollectibleService";
import { Student } from "../../../lib/models/Student";
import type { InventoryItemWithDetails, StudentCollectibleWithAvatar, PieceRow, StudioGiftWithDetails } from "../../../lib/types";
import { playComposerAudio } from "../../../lib/composerTunes";
import ContributionsGraph from "../../../components/ContributionsGraph";

// ── Era background tints ───────────────────────────────────────────────────

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

function practiceWeather(streak: number): { label: string; icon: string } {
  if (streak >= 30) return { label: "On a roll", icon: "☀️" };
  if (streak >= 14) return { label: "Shining", icon: "🌤️" };
  if (streak >= 7)  return { label: "Warming up", icon: "🌥️" };
  if (streak >= 3)  return { label: "Building momentum", icon: "🌦️" };
  if (streak >= 1)  return { label: "Getting started", icon: "🌱" };
  return                  { label: "Time to practice", icon: "🌧️" };
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  total_points: number;
  streak_days: number;
  display_name: string;
  instrument: string | null;
  studio_name: string | null;
  studio_tagline: string | null;
  featured_avatar_id: string | null;
  studio_persona: string | null;
  studio_bio: string | null;
  theme_song_item_id: string | null;
  theme_song_title: string | null;
  username: string | null;
  avatar_url: string | null;
  artist_name: string | null;
}

interface PublicTrack {
  id: string;
  title: string;
  description: string | null;
  media_type: string | null;
  collection_count: number;
  price_points: number;
  recording_url: string | null;
  created_at: string;
}

interface CrateItem {
  portfolio_item_id: string;
  portfolio_items: {
    id: string;
    title: string;
    recording_url: string | null;
    student_id: string;
    profiles: {
      display_name: string;
      avatar_url: string | null;
    } | null;
  } | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function StudioPage() {
  const { user } = useAuth();
  const student = user as Student;
  const supabase = getSupabaseBrowserClient();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [inventory, setInventory] = useState<InventoryItemWithDetails[]>([]);
  const [composers, setComposers] = useState<StudentCollectibleWithAvatar[]>([]);
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [gifts, setGifts] = useState<StudioGiftWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"composers" | "items" | "journey" | "repertoire" | "music">("composers");
  const [hoveredComposer, setHoveredComposer] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftTagline, setDraftTagline] = useState("");
  const [draftArtistName, setDraftArtistName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const stopTuneRef = useRef<(() => void) | null>(null);

  // Theme song
  const [themeSongUrl, setThemeSongUrl] = useState<string | null>(null);

  // My Music tab
  const [publicTracks, setPublicTracks] = useState<PublicTrack[]>([]);
  const [crateItems, setCrateItems] = useState<CrateItem[]>([]);
  const [musicLoaded, setMusicLoaded] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [draftTrackTitle, setDraftTrackTitle] = useState("");
  const [draftTrackPrice, setDraftTrackPrice] = useState(0);
  const [savingTrack, setSavingTrack] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);

  // Self-assigned pieces + sheet music
  const [showAddPiece, setShowAddPiece] = useState(false);
  const [newPieceTitle, setNewPieceTitle] = useState("");
  const [newPieceComposer, setNewPieceComposer] = useState("");
  const [savingPiece, setSavingPiece] = useState(false);
  const [uploadingSheetFor, setUploadingSheetFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      // Phase 1: profile + pieces — render immediately
      const [profileRes, piecesRes] = await Promise.all([
        supabase.from("profiles").select("total_points,streak_days,display_name,instrument,studio_name,studio_tagline,featured_avatar_id,studio_persona,studio_bio,theme_song_item_id,theme_song_title,artist_name,username,avatar_url").eq("id", student.id).single(),
        supabase.from("pieces").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      ]);
      const p = profileRes.data as ProfileData | null;
      if (p) {
        setProfile(p);
        setUsername(p.username ?? null);
        setDraftName(p.studio_name ?? "");
        setDraftTagline(p.studio_tagline ?? "");
      }
      setPieces((piecesRes.data ?? []) as PieceRow[]);
      setLoading(false);

      // Phase 2: inventory, composers, gifts, theme song — load in background
      const shop = ShopService.create(supabase);
      const collectibles = CollectibleService.create(supabase);
      const [inv, comps, giftsRes] = await Promise.all([
        shop.getInventory(student.id),
        collectibles.getCollection(student.id),
        supabase.from("studio_gifts").select("*, shop_items(*), sender:profiles!sender_id(display_name)").eq("recipient_id", student.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setInventory(inv);
      setComposers(comps);
      setGifts((giftsRes.data ?? []) as StudioGiftWithDetails[]);

      if (p?.theme_song_item_id) {
        const { data: songData } = await supabase
          .from("portfolio_items")
          .select("recording_url")
          .eq("id", p.theme_song_item_id)
          .single();
        setThemeSongUrl(songData?.recording_url ?? null);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Clean up tune on unmount
  useEffect(() => () => { stopTuneRef.current?.(); }, []);

  // Load music tab data on first visit
  useEffect(() => {
    if (activeTab !== "music" || musicLoaded || !student?.id) return;
    async function loadMusic() {
      const [tracksRes, crateRes] = await Promise.all([
        supabase
          .from("portfolio_items")
          .select("id,title,description,media_type,collection_count,price_points,recording_url,created_at")
          .eq("student_id", student.id)
          .eq("is_public", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("portfolio_collections")
          .select("portfolio_item_id, portfolio_items(id, title, recording_url, student_id, profiles(display_name, avatar_url))")
          .eq("collector_id", student.id)
          .order("created_at", { ascending: false }),
      ]);
      setPublicTracks((tracksRes.data ?? []) as PublicTrack[]);
      setCrateItems((crateRes.data ?? []) as CrateItem[]);
      setMusicLoaded(true);
    }
    loadMusic();
  }, [activeTab, musicLoaded, student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const featuredComposer = composers.find(c => c.avatar_id === profile?.featured_avatar_id)
    ?? composers[0]
    ?? null;

  function playFeaturedTune() {
    stopTuneRef.current?.();
    if (featuredComposer) {
      stopTuneRef.current = playComposerAudio(featuredComposer.composer_avatars.youtube_id);
    }
  }

  async function saveName() {
    if (!student?.id) return;
    setSavingName(true);
    await fetch("/api/studio/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: student.id, studio_name: draftName.trim() || null, studio_tagline: draftTagline.trim() || null, artist_name: draftArtistName.trim() || null }),
    });
    setProfile(p => p ? { ...p, studio_name: draftName.trim() || null, studio_tagline: draftTagline.trim() || null, artist_name: draftArtistName.trim() || null } : p);
    setSavingName(false);
    setEditingName(false);
  }

  async function setFeatured(avatarId: string) {
    if (!student?.id) return;
    await fetch("/api/studio/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: student.id, featured_avatar_id: avatarId }),
    });
    setProfile(p => p ? { ...p, featured_avatar_id: avatarId } : p);
  }

  async function generatePersona() {
    if (!student?.id || personaLoading) return;
    setPersonaLoading(true);
    setPersonaError(null);
    try {
      const res = await fetch("/api/studio/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: student.id }),
      });
      const data = await res.json() as { studio_persona?: string; studio_bio?: string; error?: string };
      if (data.error) {
        setPersonaError(data.error);
      } else if (data.studio_persona) {
        setProfile(p => p ? { ...p, studio_persona: data.studio_persona ?? null, studio_bio: data.studio_bio ?? null } : p);
      } else {
        setPersonaError("No response — check that ANTHROPIC_API_KEY is set in Vercel.");
      }
    } catch (e) {
      setPersonaError(e instanceof Error ? e.message : "Failed to reach API");
    } finally {
      setPersonaLoading(false);
    }
  }

  function startEditTrack(track: PublicTrack) {
    setEditingTrackId(track.id);
    setDraftTrackTitle(track.title);
    setDraftTrackPrice(track.price_points);
  }

  async function saveTrack(trackId: string) {
    setSavingTrack(true);
    const { data } = await supabase
      .from("portfolio_items")
      .update({ title: draftTrackTitle.trim(), price_points: draftTrackPrice })
      .eq("id", trackId)
      .select("id,title,price_points")
      .single();
    if (data) {
      setPublicTracks(prev => prev.map(t => t.id === trackId ? { ...t, title: data.title, price_points: data.price_points } : t));
    }
    setSavingTrack(false);
    setEditingTrackId(null);
  }

  async function handleAddPiece() {
    if (!newPieceTitle.trim() || !student?.id) return;
    setSavingPiece(true);
    try {
      const { data, error } = await supabase
        .from("pieces")
        .insert({
          student_id: student.id,
          teacher_id: null,
          studio_id: student.studioId ?? null,
          title: newPieceTitle.trim(),
          composer: newPieceComposer.trim() || null,
          category: "repertoire",
          status: "learning",
          sort_order: pieces.length,
          is_self_assigned: true,
        })
        .select()
        .single();
      if (error) throw error;
      setPieces(prev => [...prev, data as PieceRow]);
      setNewPieceTitle("");
      setNewPieceComposer("");
      setShowAddPiece(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPiece(false);
    }
  }

  async function handleUploadSheetMusic(pieceId: string, file: File) {
    setUploadingSheetFor(pieceId);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${pieceId}.${ext}`;
      const contentType = file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg");
      const { error: uploadErr } = await supabase.storage
        .from("sheet-music")
        .upload(path, file, { upsert: true, contentType });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("sheet-music").getPublicUrl(path);
      const { error: updateErr } = await supabase
        .from("pieces")
        .update({ sheet_music_url: urlData.publicUrl })
        .eq("id", pieceId);
      if (updateErr) throw updateErr;
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, sheet_music_url: urlData.publicUrl } : p));
    } catch (e) {
      console.error("Sheet music upload failed:", e);
    } finally {
      setUploadingSheetFor(null);
    }
  }

  const weather = practiceWeather(profile?.streak_days ?? 0);
  const studioTitle = profile?.studio_name || (profile?.display_name ? `${profile.display_name}'s Studio` : "My Studio");
  const eraTint = featuredComposer ? ERA_TINTS[featuredComposer.composer_avatars.era] ?? ERA_TINTS.classical : undefined;

  if (loading) return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem" }}>
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 170, borderRadius: 8 }} />)}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* ── Hero: Featured composer banner ── */}
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
            onClick={playFeaturedTune}
            title="Play motif"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.125rem" }}
          >
            ♪
          </button>
        </div>
      )}

      {/* ── Theme Song ── */}
      <div className="card-base" style={{ padding: "0.75rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "1rem", flexShrink: 0 }}>♫</span>
        {profile?.theme_song_title ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>Your theme: </span>
              <span style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontStyle: "italic", fontSize: "0.9375rem", color: "var(--charcoal)" }}>&ldquo;{profile.theme_song_title}&rdquo;</span>
            </div>
            {themeSongUrl && (
              <audio
                controls
                src={themeSongUrl}
                style={{ height: 28, minWidth: 0, maxWidth: 180, flexShrink: 1 }}
              />
            )}
          </>
        ) : (
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
            No theme set —{" "}
            <Link href="/student/discover" style={{ color: "var(--charcoal)", fontWeight: 600, textDecoration: "none" }}>find one in Discover</Link>
          </span>
        )}
      </div>

      {/* ── Profile card ── */}
      <div className="card-base" style={{ padding: "1.5rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", gap: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.25rem", color: "var(--white)", flexShrink: 0, overflow: "hidden" }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={profile.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : profile?.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder={`${profile?.display_name ?? "My"}'s Studio`}
                maxLength={40}
                style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.25rem", color: "var(--charcoal)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.5rem", outline: "none", background: "var(--cream)" }}
              />
              <input
                value={draftTagline}
                onChange={e => setDraftTagline(e.target.value)}
                placeholder="Add a tagline..."
                maxLength={80}
                style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.5rem", outline: "none", background: "var(--cream)" }}
              />
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>🎭 Artist name (optional)</div>
                <input
                  value={draftArtistName}
                  onChange={e => setDraftArtistName(e.target.value)}
                  placeholder="e.g. MidnightPianist"
                  maxLength={40}
                  style={{ width: "100%", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.5rem", outline: "none", background: "var(--cream)", boxSizing: "border-box" }}
                />
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.2rem" }}>Post recordings anonymously or under this name in Discover</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={saveName} disabled={savingName} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.75rem", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 4, cursor: "pointer" }}>
                  {savingName ? "…" : "Save"}
                </button>
                <button onClick={() => setEditingName(false)} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "var(--charcoal)" }}>
                  {studioTitle}
                </div>
                <button onClick={() => { setDraftName(profile?.studio_name ?? ""); setDraftTagline(profile?.studio_tagline ?? ""); setDraftArtistName((profile as { artist_name?: string | null } | null)?.artist_name ?? ""); setEditingName(true); }} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "0.125rem 0.375rem", borderRadius: 3, transition: "background 0.15s" }}>
                  Edit
                </button>
              </div>
              {profile?.studio_tagline && (
                <div style={{ fontFamily: "Inter, sans-serif", fontStyle: "italic", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                  {profile.studio_tagline}
                </div>
              )}
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                {profile?.instrument && <span>{profile.instrument} · </span>}
                {weather.icon} {weather.label}
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: "1.25rem", flexShrink: 0 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: "var(--charcoal)" }}>{(profile?.total_points ?? 0).toLocaleString()}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Points</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: (profile?.streak_days ?? 0) > 0 ? "var(--rose)" : "var(--muted)" }}>{profile?.streak_days ?? 0}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Day streak</div>
          </div>
        </div>
        <Link href={`/student/studio/${student?.id}`} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none", flexShrink: 0 }}>
          View as visitor →
        </Link>
      </div>

      {/* ── AI Musical Persona ── */}
      {(profile?.studio_persona || !personaLoading) && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
          <div style={{ fontSize: "1.5rem", flexShrink: 0 }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {profile?.studio_persona ? (
              <>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                  {profile.studio_persona}
                </div>
                {profile.studio_bio && (
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontStyle: "italic", fontSize: "0.9375rem", color: "var(--charcoal)", lineHeight: 1.5 }}>
                    {profile.studio_bio}
                  </div>
                )}
                <button onClick={generatePersona} disabled={personaLoading} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", marginTop: "0.375rem", padding: 0 }}>
                  {personaLoading ? "Generating…" : "Regenerate"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.375rem" }}>Discover your musical persona</div>
                <button onClick={generatePersona} disabled={personaLoading} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, padding: "0.375rem 0.875rem", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 4, cursor: personaLoading ? "default" : "pointer" }}>
                  {personaLoading ? "Generating…" : "Generate my persona"}
                </button>
              </>
            )}
            {personaError && (
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--rose)", marginTop: "0.375rem" }}>{personaError}</div>
            )}
          </div>
        </div>
      )}

      {/* ── Gifts shelf ── */}
      {gifts.length > 0 && (
        <div className="card-base" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
            🎁 Gifts received
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
      <button
        onClick={() => setBookOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.875rem 1.25rem", marginBottom: "1.25rem", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", width: "100%", textAlign: "left" }}
      >
        <span style={{ fontSize: "1.25rem" }}>📖</span>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>Repertoire Book</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>{pieces.length} piece{pieces.length !== 1 ? "s" : ""} in your library</div>
        </div>
        <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: "0.875rem" }}>→</span>
      </button>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "0", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", width: "fit-content", marginBottom: "1.5rem" }}>
        {([["composers", `Composers (${composers.length})`], ["items", `Studio (${inventory.length})`], ["journey", "Journey"], ["music", "My Music"]] as const).map(([tab, label]) => (
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
      {activeTab === "composers" ? (
        composers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎼</div>
            No composers yet — practice to earn your first card.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: "0.75rem" }}>
            {composers.map(c => {
              const r = RARITY_COLORS[c.composer_avatars.rarity] ?? RARITY_COLORS.common;
              const quote = COMPOSER_QUOTES[c.composer_avatars.composer_name];
              const isHovered = hoveredComposer === c.avatar_id;
              const isFeatured = profile?.featured_avatar_id === c.avatar_id;
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
                    outline: isFeatured ? `2px solid var(--butter)` : "none",
                    outlineOffset: 2,
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
                  {isHovered && (
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", justifyContent: "center" }}>
                      <button onClick={() => setFeatured(c.avatar_id)} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", padding: "0.2rem 0.5rem", borderRadius: 3, border: "1px solid var(--border)", background: isFeatured ? "var(--butter)" : "transparent", color: "var(--charcoal)", cursor: "pointer" }}>
                        {isFeatured ? "★ Featured" : "Set featured"}
                      </button>
                    </div>
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
            Your studio is empty.{" "}
            <Link href="/student/store" style={{ color: "var(--charcoal)", fontWeight: 600 }}>Visit the shop →</Link>
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
                  {inv.gifted_by && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)" }}>🎁 Gift</div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === "music" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* ── A. Published tracks ── */}
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
              Your Discography
            </div>
            {!musicLoaded ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />)}
              </div>
            ) : publicTracks.length === 0 ? (
              <div style={{ padding: "1.5rem 1rem", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center" }}>
                Your recordings appear here when you publish them from the Practice page
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {publicTracks.map(track => (
                  <div key={track.id} style={{ padding: "0.875rem 1rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    {editingTrackId === track.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <input
                          value={draftTrackTitle}
                          onChange={e => setDraftTrackTitle(e.target.value)}
                          maxLength={80}
                          style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "var(--charcoal)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.5rem", outline: "none", background: "var(--cream)" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>Price (pts):</label>
                          <input
                            type="number"
                            min={0}
                            value={draftTrackPrice}
                            onChange={e => setDraftTrackPrice(Math.max(0, parseInt(e.target.value) || 0))}
                            style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.5rem", outline: "none", background: "var(--cream)", width: 72 }}
                          />
                          <button onClick={() => saveTrack(track.id)} disabled={savingTrack} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.75rem", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 4, cursor: "pointer" }}>
                            {savingTrack ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditingTrackId(null)} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>{track.title}</span>
                            {track.media_type && (
                              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 3, padding: "0.1rem 0.35rem" }}>{track.media_type}</span>
                            )}
                            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--charcoal)", background: "var(--butter)", borderRadius: 3, padding: "0.1rem 0.35rem" }}>
                              {track.price_points === 0 ? "Free" : `${track.price_points} pts`}
                            </span>
                          </div>
                          {track.description && (
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.description}</div>
                          )}
                          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", marginTop: "0.25rem" }}>{track.collection_count} collected</div>
                        </div>
                        {username && (
                          <button
                            onClick={() => {
                              const url = `https://cadenza.social/p/${username}`;
                              if (navigator.share) {
                                navigator.share({ title: track.title, url }).catch(() => {});
                              } else {
                                navigator.clipboard.writeText(url).then(() => {
                                  setCopiedTrackId(track.id);
                                  setTimeout(() => setCopiedTrackId(null), 2000);
                                });
                              }
                            }}
                            title="Share"
                            style={{ flexShrink: 0, background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: copiedTrackId === track.id ? "var(--charcoal)" : "var(--muted)", fontSize: "0.6875rem", fontWeight: 600, padding: "0.25rem 0.5rem", fontFamily: "Inter, sans-serif" }}
                          >
                            {copiedTrackId === track.id ? "Copied!" : "Share"}
                          </button>
                        )}
                        <button
                          onClick={() => startEditTrack(track)}
                          title="Edit"
                          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.875rem", padding: "0.25rem" }}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── B. The Crate ── */}
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
              The Crate
            </div>
            {!musicLoaded ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />)}
              </div>
            ) : crateItems.length === 0 ? (
              <div style={{ padding: "1.5rem 1rem", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center" }}>
                Your Crate is empty — collect tracks from other artists in{" "}
                <Link href="/student/discover" style={{ color: "var(--charcoal)", fontWeight: 600, textDecoration: "none" }}>Discover</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {crateItems.map(item => {
                  const pi = item.portfolio_items;
                  if (!pi) return null;
                  return (
                    <div key={item.portfolio_item_id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>{pi.title}</div>
                        {pi.profiles?.display_name && (
                          <Link href={`/student/studio/${pi.student_id}`} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", textDecoration: "none" }}>
                            {pi.profiles.display_name}
                          </Link>
                        )}
                      </div>
                      {pi.recording_url && (
                        <audio
                          controls
                          src={pi.recording_url}
                          style={{ height: 28, minWidth: 0, maxWidth: 160, flexShrink: 1 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Journey tab */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Contributions graph */}
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              Practice History
            </div>
            <ContributionsGraph studentId={student.id} />
          </div>

          {/* Pieces */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Repertoire
              </div>
              <button
                onClick={() => setShowAddPiece(v => !v)}
                style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--charcoal)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.2rem 0.6rem", cursor: "pointer" }}
              >
                + Add piece
              </button>
            </div>

            {showAddPiece && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.875rem 1rem", marginBottom: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input
                  placeholder="Title *"
                  value={newPieceTitle}
                  onChange={e => setNewPieceTitle(e.target.value)}
                  style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, outline: "none", background: "var(--white)", color: "var(--charcoal)" }}
                />
                <input
                  placeholder="Composer (optional)"
                  value={newPieceComposer}
                  onChange={e => setNewPieceComposer(e.target.value)}
                  style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, outline: "none", background: "var(--white)", color: "var(--charcoal)" }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={handleAddPiece}
                    disabled={savingPiece || !newPieceTitle.trim()}
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 600, padding: "0.35rem 0.875rem", background: "var(--charcoal)", color: "var(--white)", border: "none", borderRadius: 6, cursor: "pointer", opacity: savingPiece || !newPieceTitle.trim() ? 0.5 : 1 }}
                  >
                    {savingPiece ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setShowAddPiece(false); setNewPieceTitle(""); setNewPieceComposer(""); }}
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {pieces.length === 0 && !showAddPiece ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎵</div>
                No pieces yet — your teacher will assign pieces, or add your own above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {pieces.map(piece => (
                  <div key={piece.id} style={{ padding: "0.875rem 1rem", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>{piece.title}</span>
                          {piece.is_self_assigned && (
                            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--muted)", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 3, padding: "0.1rem 0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>self assigned</span>
                          )}
                        </div>
                        {piece.composer && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>{piece.composer}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        {/* Sheet music upload */}
                        <label style={{ cursor: "pointer" }} title={piece.sheet_music_url ? "Replace sheet music" : "Upload sheet music"}>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            style={{ display: "none" }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadSheetMusic(piece.id, f); e.target.value = ""; }}
                          />
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: uploadingSheetFor === piece.id ? "var(--muted)" : piece.sheet_music_url ? "var(--sky)" : "var(--muted)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.2rem 0.5rem", background: "var(--cream)" }}>
                            {uploadingSheetFor === piece.id ? "…" : piece.sheet_music_url ? "Sheet ✓" : "Sheet"}
                          </span>
                        </label>
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: STATUS_COLORS[piece.status] ?? "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {STATUS_LABELS[piece.status] ?? piece.status}
                        </div>
                      </div>
                    </div>
                    {piece.sheet_music_url && (
                      <a href={piece.sheet_music_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "0.5rem", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--sky)", textDecoration: "none" }}>
                        View sheet music ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              {pieces.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>No pieces yet.</div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
