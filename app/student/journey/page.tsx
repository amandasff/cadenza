"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { PortfolioService, type PortfolioItemRow } from "../../../lib/services/PortfolioService";
import { Student } from "../../../lib/models/Student";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
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
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 4 }} />
        ))}
      </div>
    );
  }

  if (noTable) {
    return (
      <div style={{ padding: "1.5rem 1.25rem" }}>
        <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>My Journey</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "1.5rem", fontFamily: "Inter, sans-serif" }}>Your documented learning path</p>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
            One-time setup needed
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: "1rem" }}>
            Run this SQL in your Supabase dashboard to enable the portfolio:
          </p>
          <pre style={{ background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 3, padding: "1rem", fontSize: "0.7rem", fontFamily: "monospace", color: "var(--charcoal)", overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`create table public.portfolio_items (
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

  return (
    <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
          My Journey
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif" }}>
          {items.length === 0 ? "Recorded pieces will appear here" : `${items.length} piece${items.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No recordings yet</div>
          <p className="empty-state-desc">After a practice session, save it to your Journey to build your portfolio.</p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 19, top: 24, bottom: 24, width: 1, background: "var(--border)", zIndex: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{ display: "flex", gap: "1rem", position: "relative", zIndex: 1 }}>
                {/* Timeline dot */}
                <div style={{
                  width: 38, height: 38, flexShrink: 0,
                  background: idx === 0 ? "var(--charcoal)" : "var(--white)",
                  border: `1px solid ${idx === 0 ? "var(--charcoal)" : "var(--border-strong)"}`,
                  borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.6875rem", color: idx === 0 ? "white" : "var(--muted)",
                  fontFamily: "Inter, sans-serif",
                }}>
                  {idx + 1}
                </div>

                {/* Card */}
                <div style={{ flex: 1, background: "var(--white)", borderRadius: 4, border: "1px solid var(--border)", padding: "1rem 1.125rem" }}>
                  {editingId === item.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        style={{ borderRadius: 3, border: "1px solid var(--border-strong)", padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", width: "100%", boxSizing: "border-box" }}
                      />
                      <textarea
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Add a note about this recording..."
                        style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", minHeight: 56 }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: "0.5rem", borderRadius: 3, border: "1px solid var(--border)", background: "var(--cream)", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer" }}>
                          Cancel
                        </button>
                        <button onClick={() => saveEdit(item.id)} disabled={saving || !editTitle.trim()} style={{ flex: 1, padding: "0.5rem", borderRadius: 3, border: "none", background: "var(--charcoal)", color: "white", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer" }}>
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", marginBottom: "0.125rem" }}>{item.title}</div>
                          <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", letterSpacing: "0.01em" }}>{formatDate(item.created_at)}</div>
                        </div>
                        <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0, marginLeft: "0.5rem" }}>
                          <button onClick={() => startEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", padding: "0.125rem 0.375rem", fontFamily: "Inter, sans-serif" }} title="Edit">Edit</button>
                          <button onClick={() => deleteItem(item.id)} disabled={deletingId === item.id} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", padding: "0.125rem 0.375rem", opacity: deletingId === item.id ? 0.5 : 1, fontFamily: "Inter, sans-serif" }} title="Remove">Remove</button>
                        </div>
                      </div>
                      {item.description && (
                        <p style={{ fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.6, margin: "0 0 0.75rem", fontFamily: "Inter, sans-serif" }}>{item.description}</p>
                      )}
                      {item.recording_url && (
                        <audio controls src={item.recording_url} style={{ width: "100%", borderRadius: 3, marginTop: item.description ? 0 : "0.375rem" }} />
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
