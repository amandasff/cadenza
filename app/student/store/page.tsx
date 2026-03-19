"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { ShopService } from "../../../lib/services/ShopService";
import { Student } from "../../../lib/models/Student";
import type { ShopItemRow, ShopCategory } from "../../../lib/types";

const CATEGORY_LABELS: Record<ShopCategory, string> = {
  instrument: "Instruments",
  furniture:  "Furniture",
  decor:      "Décor",
  plant:      "Plants & Objects",
  trophy:     "Trophies",
};

const RARITY_COLORS = {
  common:    { bg: "var(--border)",      text: "var(--muted)",    label: "Common"    },
  rare:      { bg: "var(--sky-bg)",      text: "var(--sky)",      label: "Rare"      },
  epic:      { bg: "var(--lavender-bg)", text: "var(--lavender)", label: "Epic"      },
  legendary: { bg: "var(--butter-bg)",   text: "var(--butter)",   label: "Legendary" },
};

const ALL_CATEGORIES = ["all", "instrument", "furniture", "decor", "plant", "trophy"] as const;

export default function StorePage() {
  const { user } = useAuth();
  const student = user as Student;
  const supabase = getSupabaseBrowserClient();
  const shop = ShopService.create(supabase);

  const [items, setItems] = useState<ShopItemRow[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof ALL_CATEGORIES[number]>("all");
  const [buying, setBuying] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const [allItems, owned, profile] = await Promise.all([
        shop.getAllItems(),
        shop.getOwnedItemIds(student.id),
        supabase.from("profiles").select("total_points").eq("id", student.id).single(),
      ]);
      setItems(allItems);
      setOwnedIds(owned);
      setPoints((profile.data as { total_points: number } | null)?.total_points ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleBuy(item: ShopItemRow) {
    if (!student?.id || buying) return;
    setError(null);
    setBuying(item.id);
    try {
      await shop.purchaseItem(student.id, item.id);
      setPoints(p => p - item.cost_points);
      setOwnedIds(prev => new Set([...prev, item.id]));
      setJustBought(item.id);
      setTimeout(() => setJustBought(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  const filtered = filter === "all" ? items : items.filter(i => i.category === filter);
  const categorised = ALL_CATEGORIES.slice(1).reduce<Record<string, ShopItemRow[]>>((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length) acc[cat] = catItems;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.125rem", letterSpacing: "-0.01em" }}>
            The Shop
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Furnish your studio with practice points
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--butter-bg)", border: "1px solid var(--butter-light, #f0d080)", borderRadius: 6, padding: "0.5rem 1rem" }}>
          <span style={{ fontSize: "1.125rem" }}>✦</span>
          <span style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1.375rem", color: "var(--charcoal)" }}>{points.toLocaleString()}</span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginLeft: 2 }}>points</span>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--rose-bg)", border: "1px solid var(--rose)", borderRadius: 4, padding: "0.75rem 1rem", marginBottom: "1rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {ALL_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            padding: "0.375rem 0.875rem", borderRadius: 100,
            border: `1px solid ${filter === cat ? "var(--charcoal)" : "var(--border)"}`,
            background: filter === cat ? "var(--charcoal)" : "transparent",
            color: filter === cat ? "var(--white)" : "var(--muted)",
            fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500,
            cursor: "pointer", transition: "all 0.15s",
          }}>
            {cat === "all" ? "All" : CATEGORY_LABELS[cat as ShopCategory]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          ))}
        </div>
      ) : (
        Object.entries(categorised).map(([cat, catItems]) => (
          <div key={cat} style={{ marginBottom: "2.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.875rem" }}>
              {CATEGORY_LABELS[cat as ShopCategory]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "0.75rem" }}>
              {catItems.map(item => {
                const owned = ownedIds.has(item.id);
                const rarity = RARITY_COLORS[item.rarity];
                const canAfford = points >= item.cost_points;
                const isJustBought = justBought === item.id;
                const isBuying = buying === item.id;

                return (
                  <div key={item.id} className="card-base" style={{
                    padding: "1.125rem 1rem 1rem",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: "0.5rem", textAlign: "center",
                    opacity: owned ? 0.6 : 1,
                    position: "relative",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}>
                    {/* Rarity badge */}
                    {item.rarity !== "common" && (
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        background: rarity.bg, color: rarity.text,
                        fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 700,
                        padding: "0.1rem 0.375rem", borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>{rarity.label}</div>
                    )}

                    {/* Emoji */}
                    <div style={{ fontSize: "2.75rem", lineHeight: 1, marginTop: "0.25rem" }}>
                      {item.emoji}
                    </div>

                    {/* Name */}
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.3 }}>
                      {item.name}
                    </div>

                    {/* Description */}
                    {item.description && (
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", lineHeight: 1.4, minHeight: "2.8em" }}>
                        {item.description}
                      </div>
                    )}

                    {/* Buy / Owned */}
                    {owned ? (
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, color: "var(--sage)", marginTop: "auto" }}>
                        ✓ In your studio
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={!canAfford || !!buying}
                        style={{
                          marginTop: "auto",
                          width: "100%",
                          padding: "0.5rem",
                          borderRadius: 4,
                          border: "none",
                          cursor: canAfford && !buying ? "pointer" : "default",
                          background: isJustBought ? "var(--sage)" : canAfford ? "var(--charcoal)" : "var(--border)",
                          color: canAfford ? "var(--white)" : "var(--muted)",
                          fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 600,
                          transition: "background 0.2s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                        }}
                      >
                        {isJustBought ? "✓ Added!" : isBuying ? "…" : (
                          <><span style={{ fontSize: "0.75rem", opacity: 0.8 }}>✦</span>{item.cost_points.toLocaleString()}</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {!loading && Object.keys(categorised).length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>
          Nothing in this category yet.
        </div>
      )}
    </div>
  );
}
