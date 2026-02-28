"use client";
import React, { useState, useEffect, useRef } from "react";
import type { YouTubeResult } from "../lib/types";

export default function YouTubeSearch({
  onSelect,
  placeholder = "Search YouTube…",
}: {
  onSelect: (video: YouTubeResult) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Search failed"); setResults([]); }
        else setResults(data as YouTubeResult[]);
      } catch {
        setError("Search failed");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "0.5rem 0.75rem", borderRadius: 3,
          border: "1px solid var(--border-strong)",
          background: "var(--white)", color: "var(--charcoal)",
          fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", outline: "none",
        }}
      />
      {loading && (
        <div style={{ padding: "0.5rem", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>
          Searching…
        </div>
      )}
      {error && (
        <div style={{ padding: "0.5rem", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#c0392b" }}>
          {error}
        </div>
      )}
      {results.length > 0 && (
        <div style={{
          marginTop: "0.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "0.5rem",
        }}>
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => { onSelect(r); setQuery(""); setResults([]); }}
              style={{
                background: "var(--cream)", border: "1px solid var(--border)",
                borderRadius: 3, cursor: "pointer", padding: 0, textAlign: "left",
                overflow: "hidden", transition: "border-color 0.15s",
              }}
              title={r.title}
            >
              <img
                src={r.thumbnail}
                alt={r.title}
                style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
              />
              <div style={{
                padding: "0.375rem 0.5rem",
                fontFamily: "Inter, sans-serif", fontSize: "0.625rem",
                color: "var(--charcoal)", lineHeight: 1.4,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {r.title}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
