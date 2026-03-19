"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ShopService } from "../../../lib/services/ShopService";
import { CollectibleService } from "../../../lib/services/CollectibleService";
import { Student } from "../../../lib/models/Student";
import type { InventoryItemWithDetails, StudentCollectibleWithAvatar } from "../../../lib/types";

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

export default function StudioPage() {
  const { user } = useAuth();
  const student = user as Student;
  const supabase = getSupabaseBrowserClient();

  const [inventory, setInventory] = useState<InventoryItemWithDetails[]>([]);
  const [composers, setComposers] = useState<StudentCollectibleWithAvatar[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [instrument, setInstrument] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "composers">("composers");
  const [hoveredComposer, setHoveredComposer] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const shop = ShopService.create(supabase);
      const collectibles = CollectibleService.create(supabase);
      const [inv, comps, profile] = await Promise.all([
        shop.getInventory(student.id),
        collectibles.getCollection(student.id),
        supabase.from("profiles").select("total_points,streak_days,display_name,instrument").eq("id", student.id).single(),
      ]);
      setInventory(inv);
      setComposers(comps);
      const p = profile.data as { total_points: number; streak_days: number; display_name: string; instrument: string | null } | null;
      if (p) {
        setPoints(p.total_points);
        setStreak(p.streak_days);
        setDisplayName(p.display_name);
        setInstrument(p.instrument ?? "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Profile card */}
      <div className="card-base" style={{ padding: "1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.25rem", color: "var(--white)", flexShrink: 0 }}>
          {displayName ? displayName[0].toUpperCase() : "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "var(--charcoal)" }}>
            {displayName}&apos;s Studio
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.125rem" }}>
            {instrument && <span>{instrument} · </span>}
            {composers.length} composer{composers.length !== 1 ? "s" : ""} · {inventory.length} item{inventory.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: "1.25rem", flexShrink: 0 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: "var(--charcoal)" }}>{points.toLocaleString()}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Points</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.5rem", color: streak > 0 ? "var(--rose)" : "var(--muted)" }}>{streak}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Day streak</div>
          </div>
        </div>
        <Link href={`/student/studio/${student?.id}`} style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none", flexShrink: 0 }}>
          View as visitor →
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", width: "fit-content", marginBottom: "1.5rem" }}>
        {([["composers", `Composers (${composers.length})`], ["items", `Studio Items (${inventory.length})`]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "0.5rem 1.125rem", border: "none", cursor: "pointer",
            background: activeTab === tab ? "var(--charcoal)" : "transparent",
            color: activeTab === tab ? "var(--white)" : "var(--muted)",
            fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
            transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem" }}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 170, borderRadius: 8 }} />)}
        </div>
      ) : activeTab === "composers" ? (
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
              return (
                <div
                  key={c.avatar_id}
                  onMouseEnter={() => setHoveredComposer(c.avatar_id)}
                  onMouseLeave={() => setHoveredComposer(null)}
                  style={{
                    border: `2px solid ${r.border}`,
                    borderRadius: 8, padding: "1rem 0.75rem",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                    textAlign: "center", cursor: "default",
                    boxShadow: isHovered ? `0 0 12px ${r.glow}40` : "none",
                    transition: "box-shadow 0.2s, transform 0.2s",
                    transform: isHovered ? "translateY(-2px)" : "none",
                    background: "var(--white)",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  {/* Composer image */}
                  <div style={{ width: 72, height: 72, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    <img
                      src={c.composer_avatars.image_path}
                      alt={c.composer_avatars.composer_name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--charcoal)" }}>
                    {c.composer_avatars.composer_name}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: r.border === "var(--border-strong)" ? "var(--muted)" : r.border, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {r.label}
                  </div>
                  {c.shard_count > 0 && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", color: "var(--muted)" }}>
                      +{c.shard_count} ✦
                    </div>
                  )}
                  {/* Quote tooltip on hover */}
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
      )}
    </div>
  );
}
