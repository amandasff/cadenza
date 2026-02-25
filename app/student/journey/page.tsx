"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PortfolioService, type PortfolioItemRow } from "../../../lib/services/PortfolioService";
import { Student } from "../../../lib/models/Student";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function JourneyPage() {
  const { user } = useAuth();
  const student = user as Student;

  const [items, setItems] = useState<PortfolioItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noTable, setNoTable] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!student?.id) return;
      try {
        const supabase = getSupabaseBrowserClient();
        const data = await PortfolioService.getInstance(supabase).getItems(student.id);
        setItems(data);
      } catch (err) {
        const e = err as { message?: string; code?: string };
        // If the table doesn't exist yet, show a friendly setup message
        if (e?.message?.includes("portfolio_items") || e?.code === "42P01") {
          setNoTable(true);
        }
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
          <div key={i} className="skeleton" style={{ height: 140, borderRadius: "var(--radius-xl)" }} />
        ))}
      </div>
    );
  }

  if (noTable) {
    return (
      <div style={{ padding: "1.5rem 1.25rem" }}>
        <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.4rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
          My Journey
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem", fontFamily: "DM Sans, sans-serif" }}>
          Your documented learning path
        </p>
        <div style={{ background: "var(--butter-bg)", border: "1.5px solid var(--butter-light)", borderRadius: "var(--radius-xl)", padding: "1.5rem" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
            ⚙️ One-time setup needed
          </div>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem", color: "var(--charcoal)", lineHeight: 1.6, marginBottom: "1rem" }}>
            Run this SQL in your Supabase dashboard (SQL Editor) to enable the portfolio:
          </p>
          <pre style={{
            background: "var(--white)",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            padding: "1rem",
            fontSize: "0.72rem",
            fontFamily: "monospace",
            color: "var(--charcoal)",
            overflowX: "auto",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}>{`create table public.portfolio_items (
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
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.875rem", lineHeight: 1.5 }}>
            After running this, reload the page. Your journey is stored in Supabase — it will never be lost when the app is updated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 1rem", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: "1.4rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
          My Journey
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", fontFamily: "DM Sans, sans-serif" }}>
          {items.length === 0 ? "Your recorded pieces will appear here" : `${items.length} piece${items.length !== 1 ? "s" : ""} documented`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: "3rem 1rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎼</div>
          <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--charcoal)", margin: 0, fontSize: "1rem" }}>
            No recordings yet
          </p>
          <p style={{ fontFamily: "DM Sans, sans-serif", color: "var(--muted)", fontSize: "0.875rem", margin: "0.5rem 0 0", textAlign: "center", lineHeight: 1.5 }}>
            After a practice session, tap &ldquo;Save to Journey&rdquo; to add a recording here.
          </p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Timeline line */}
          <div style={{
            position: "absolute",
            left: 19,
            top: 24,
            bottom: 24,
            width: 2,
            background: "linear-gradient(to bottom, var(--peach-light), var(--border))",
            zIndex: 0,
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{ display: "flex", gap: "1rem", position: "relative", zIndex: 1 }}>
                {/* Timeline dot */}
                <div style={{
                  width: 40, height: 40, flexShrink: 0,
                  background: idx === 0 ? "var(--peach)" : "var(--white)",
                  border: `2px solid ${idx === 0 ? "var(--peach)" : "var(--border-strong)"}`,
                  borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: idx === 0 ? "1rem" : "0.85rem",
                  boxShadow: idx === 0 ? "var(--shadow-peach)" : "none",
                }}>
                  {idx === 0 ? "🎵" : "♩"}
                </div>

                {/* Card */}
                <div style={{
                  flex: 1,
                  background: "var(--white)",
                  borderRadius: "var(--radius-xl)",
                  border: "1.5px solid var(--border)",
                  padding: "1rem 1.125rem",
                  boxShadow: idx === 0 ? "var(--shadow-sm)" : "none",
                }}>
                  {editingId === item.id ? (
                    // Edit mode
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        style={{
                          borderRadius: 8, border: "1.5px solid var(--border)", padding: "0.5rem 0.75rem",
                          fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.9rem",
                          background: "var(--cream)", color: "var(--charcoal)", outline: "none", width: "100%", boxSizing: "border-box",
                        }}
                      />
                      <textarea
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Add a note about this recording..."
                        style={{
                          borderRadius: 8, border: "1.5px solid var(--border)", padding: "0.5rem 0.75rem",
                          fontFamily: "DM Sans, sans-serif", fontSize: "0.82rem",
                          background: "var(--cream)", color: "var(--charcoal)", outline: "none",
                          width: "100%", boxSizing: "border-box", resize: "none", minHeight: 60,
                        }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ flex: 1, padding: "0.5rem", borderRadius: 100, border: "1.5px solid var(--border)", background: "var(--cream)", color: "var(--muted)", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={saving || !editTitle.trim()}
                          style={{ flex: 1, padding: "0.5rem", borderRadius: 100, border: "none", background: "var(--peach)", color: "white", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1rem", color: "var(--charcoal)", marginBottom: "0.1rem" }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif" }}>
                            {formatDate(item.created_at)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0, marginLeft: "0.5rem" }}>
                          <button
                            onClick={() => startEdit(item)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.85rem", padding: "0.15rem 0.3rem" }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={deletingId === item.id}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.85rem", padding: "0.15rem 0.3rem", opacity: deletingId === item.id ? 0.5 : 1 }}
                            title="Remove"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {item.description && (
                        <p style={{ fontSize: "0.82rem", color: "var(--charcoal)", lineHeight: 1.55, margin: "0 0 0.75rem", fontFamily: "DM Sans, sans-serif" }}>
                          {item.description}
                        </p>
                      )}

                      {item.recording_url && (
                        <audio
                          controls
                          src={item.recording_url}
                          style={{ width: "100%", borderRadius: 6, marginTop: item.description ? 0 : "0.375rem" }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
