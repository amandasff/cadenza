"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PortfolioService, type PortfolioItemRow } from "../../../lib/services/PortfolioService";
import { Student } from "../../../lib/models/Student";
import AudioPlayer from "../../../components/AudioPlayer";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
}

// Group items by month
function groupByMonth(items: PortfolioItemRow[]): { label: string; items: PortfolioItemRow[] }[] {
  const groups: Map<string, PortfolioItemRow[]> = new Map();
  for (const item of items) {
    const d = new Date(item.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const label = d.toLocaleDateString([], { year: "numeric", month: "long" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([, items]) => ({
    label: new Date(items[0].created_at).toLocaleDateString([], { year: "numeric", month: "long" }),
    items,
  }));
}

export default function JourneyPage() {
  const { user } = useAuth();
  const student = user as Student;

  const [items, setItems] = useState<PortfolioItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noTable, setNoTable] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!student?.id) return;
      try {
        const supabase = getSupabaseBrowserClient();
        const data = await PortfolioService.getInstance(supabase).getItems(student.id);
        setItems(data);
      } catch (err) {
        const e = err as { message?: string; code?: string };
        if (e?.message?.includes("portfolio_items") || e?.code === "42P01") setNoTable(true);
        console.error("portfolio load error:", e?.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [student?.id]);

  function startEdit(item: PortfolioItemRow) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.description ?? "");
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || saving) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await PortfolioService.getInstance(supabase).updateItem(id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
      });
      setItems(prev => prev.map(i => i.id === id
        ? { ...i, title: editTitle.trim(), description: editDesc.trim() || null }
        : i
      ));
      setEditingId(null);
    } catch (err) {
      console.error("edit error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (deletingId) return;
    if (!confirm("Remove this recording from your journey?")) return;
    setDeletingId(id);
    try {
      const supabase = getSupabaseBrowserClient();
      await PortfolioService.getInstance(supabase).deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error("delete error:", err);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (noTable) {
    return (
      <div style={{ padding: "1.5rem 1.25rem" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.75rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>My Journey</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "1.5rem", fontFamily: "Inter, sans-serif" }}>Your musical story, one recording at a time</p>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
            One-time setup needed
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: "1rem" }}>
            Run this SQL in your Supabase dashboard to enable the portfolio:
          </p>
          <pre style={{ background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 6, padding: "1rem", fontSize: "0.7rem", fontFamily: "monospace", color: "var(--charcoal)", overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id)
    on delete cascade not null,
  studio_id uuid references public.studios(id),
  title text not null,
  description text,
  recording_url text,
  session_id uuid references public.practice_sessions(id)
    on delete set null,
  created_at timestamptz default now()
);

alter table public.portfolio_items
  enable row level security;

create policy "Students manage own portfolio"
  on public.portfolio_items for all
  using (auth.uid() = student_id);

create policy "Teachers read studio portfolio"
  on public.portfolio_items for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'teacher'
        and p.studio_id = portfolio_items.studio_id
    )
  );`}</pre>
        </div>
      </div>
    );
  }

  const monthGroups = groupByMonth(items);

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)" }}>
      {/* Hero header */}
      <div style={{
        padding: "2rem 1.5rem 1.75rem",
        background: "linear-gradient(180deg, var(--white) 0%, var(--cream) 100%)",
      }}>
        <h1 style={{
          fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
          fontSize: "2rem", color: "var(--charcoal)", marginBottom: "0.25rem",
          letterSpacing: "-0.01em",
        }}>
          My Journey
        </h1>
        <p style={{
          color: "var(--muted)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif",
          marginBottom: "1rem",
        }}>
          {items.length === 0 ? "Your musical story starts here" : "Your musical story, one recording at a time"}
        </p>

        {/* Stats row */}
        {items.length > 0 && (
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div>
              <div style={{
                fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
                fontSize: "1.75rem", color: "var(--charcoal)", lineHeight: 1,
              }}>
                {items.length}
              </div>
              <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>
                Recording{items.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div>
              <div style={{
                fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
                fontSize: "1.75rem", color: "var(--charcoal)", lineHeight: 1,
              }}>
                {monthGroups.length}
              </div>
              <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>
                Month{monthGroups.length !== 1 ? "s" : ""}
              </div>
            </div>
            {items.length > 0 && (
              <div>
                <div style={{
                  fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
                  fontSize: "1.75rem", color: "var(--charcoal)", lineHeight: 1,
                }}>
                  {formatRelative(items[items.length - 1].created_at).replace(" ago", "")}
                </div>
                <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>
                  Since first
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "var(--white)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.25rem", fontSize: "2rem",
          }}>
            🎵
          </div>
          <div style={{
            fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500,
            fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.5rem",
          }}>
            No recordings yet
          </div>
          <p style={{
            fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
            color: "var(--muted)", lineHeight: 1.65, maxWidth: 280, margin: "0 auto",
          }}>
            After a practice session, toggle &ldquo;Save to Journey&rdquo; to keep a memento of your progress. Listen back and see how far you&apos;ve come.
          </p>
        </div>
      ) : (
        <div style={{ padding: "0 1.25rem 3rem" }}>
          {monthGroups.map((group, gi) => (
            <div key={gi}>
              {/* Month header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.75rem 0", marginTop: gi > 0 ? "0.5rem" : 0,
              }}>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600,
                  color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  {group.label}
                </span>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
              </div>

              {/* Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {group.items.map((item, idx) => {
                  const isExpanded = expandedId === item.id;
                  const isLatest = gi === 0 && idx === 0;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--white)",
                        border: `1px solid ${isLatest ? "var(--sage)" : "var(--border)"}`,
                        borderRadius: 12,
                        overflow: "hidden",
                        transition: "border-color 0.15s",
                      }}
                    >
                      {/* Card header — always visible */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{
                          padding: "1rem 1.125rem",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "0.875rem",
                        }}
                      >
                        {/* Index circle */}
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: isLatest
                            ? "linear-gradient(135deg, #3D6B55, #2C5242)"
                            : "var(--cream)",
                          border: isLatest ? "none" : "1px solid var(--border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.75rem", fontWeight: 600,
                          color: isLatest ? "#fff" : "var(--muted)",
                          fontFamily: "Inter, sans-serif",
                        }}>
                          {items.length - items.indexOf(item)}
                        </div>

                        {/* Title + date */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingId === item.id ? (
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{
                                width: "100%", borderRadius: 4,
                                border: "1px solid var(--border-strong)",
                                padding: "0.4rem 0.625rem",
                                fontFamily: "Inter, sans-serif", fontWeight: 500,
                                fontSize: "0.875rem", background: "var(--cream)",
                                color: "var(--charcoal)", outline: "none",
                                boxSizing: "border-box",
                              }}
                            />
                          ) : (
                            <>
                              <div style={{
                                fontFamily: "Inter, sans-serif", fontWeight: 500,
                                fontSize: "0.9375rem", color: "var(--charcoal)",
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {item.title}
                              </div>
                              <div style={{
                                fontSize: "0.6875rem", color: "var(--muted)",
                                fontFamily: "Inter, sans-serif", marginTop: "0.125rem",
                              }}>
                                {formatDate(item.created_at)} · {formatRelative(item.created_at)}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Latest badge */}
                        {isLatest && editingId !== item.id && (
                          <span style={{
                            fontSize: "0.5625rem", fontWeight: 600,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            padding: "0.2rem 0.5rem", borderRadius: 4,
                            background: "rgba(61,107,85,0.1)", color: "var(--sage)",
                            fontFamily: "Inter, sans-serif", flexShrink: 0,
                          }}>
                            Latest
                          </span>
                        )}

                        {/* Expand chevron */}
                        {editingId !== item.id && (
                          <span style={{
                            color: "var(--muted)", fontSize: "0.75rem",
                            transition: "transform 0.2s", display: "inline-block",
                            transform: isExpanded ? "rotate(180deg)" : "none",
                            flexShrink: 0,
                          }}>
                            ▾
                          </span>
                        )}
                      </div>

                      {/* Expanded content */}
                      {(isExpanded || editingId === item.id) && (
                        <div style={{
                          padding: "0 1.125rem 1.125rem",
                          borderTop: "1px solid var(--border)",
                        }}>
                          {editingId === item.id ? (
                            <div style={{ paddingTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <textarea
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                placeholder="Add a reflection about this recording..."
                                style={{
                                  borderRadius: 4, border: "1px solid var(--border)",
                                  padding: "0.5rem 0.75rem",
                                  fontFamily: "Inter, sans-serif", fontSize: "0.8125rem",
                                  background: "var(--cream)", color: "var(--charcoal)",
                                  outline: "none", width: "100%", boxSizing: "border-box",
                                  resize: "none", minHeight: 72,
                                }}
                              />
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                  onClick={() => setEditingId(null)}
                                  style={{
                                    flex: 1, padding: "0.5rem", borderRadius: 6,
                                    border: "1px solid var(--border)",
                                    background: "var(--cream)", color: "var(--muted)",
                                    fontFamily: "Inter, sans-serif", fontWeight: 500,
                                    fontSize: "0.8125rem", cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveEdit(item.id)}
                                  disabled={saving || !editTitle.trim()}
                                  style={{
                                    flex: 1, padding: "0.5rem", borderRadius: 6,
                                    border: "none", background: "var(--charcoal)",
                                    color: "var(--white)",
                                    fontFamily: "Inter, sans-serif", fontWeight: 500,
                                    fontSize: "0.8125rem", cursor: "pointer",
                                  }}
                                >
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Description / reflection */}
                              {item.description && (
                                <p style={{
                                  fontSize: "0.8125rem", color: "var(--charcoal)",
                                  lineHeight: 1.65, margin: "0.875rem 0 0",
                                  fontFamily: "Inter, sans-serif",
                                  fontStyle: "italic", opacity: 0.85,
                                }}>
                                  &ldquo;{item.description}&rdquo;
                                </p>
                              )}

                              {/* Audio player */}
                              {item.recording_url && (
                                <div style={{ marginTop: "0.875rem" }}>
                                  <AudioPlayer src={item.recording_url} />
                                </div>
                              )}

                              {/* Actions */}
                              <div style={{
                                display: "flex", gap: "0.75rem", marginTop: "0.875rem",
                                paddingTop: "0.75rem", borderTop: "1px solid var(--border)",
                              }}>
                                <button
                                  onClick={() => startEdit(item)}
                                  style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "var(--muted)", fontSize: "0.75rem",
                                    fontFamily: "Inter, sans-serif", fontWeight: 500,
                                    padding: 0, display: "flex", alignItems: "center", gap: "0.3rem",
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  disabled={deletingId === item.id}
                                  style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "var(--muted)", fontSize: "0.75rem",
                                    fontFamily: "Inter, sans-serif", fontWeight: 500,
                                    padding: 0, opacity: deletingId === item.id ? 0.5 : 1,
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                  Remove
                                </button>
                                {item.recording_url && (
                                  <a
                                    href={item.recording_url}
                                    download={`${item.title}.webm`}
                                    style={{
                                      background: "none", border: "none", cursor: "pointer",
                                      color: "var(--muted)", fontSize: "0.75rem",
                                      fontFamily: "Inter, sans-serif", fontWeight: 500,
                                      textDecoration: "none",
                                      display: "flex", alignItems: "center", gap: "0.3rem",
                                      marginLeft: "auto",
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                      <polyline points="7 10 12 15 17 10" />
                                      <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Download
                                  </a>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
