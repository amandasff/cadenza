"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Teacher } from "../../../lib/models/Teacher";
import type { StudentContactRow, ProfileRow } from "../../../lib/types";

// ── Styles ───────────────────────────────────────────────────
const s = { fontFamily: "Inter, sans-serif" } as const;
const card: React.CSSProperties = {
  background: "var(--white)", border: "1px solid var(--border)",
  borderRadius: 4, padding: "1.25rem 1.5rem", marginBottom: "1rem",
};
const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border-strong)", borderRadius: 3,
  padding: "0.5rem 0.75rem", fontSize: "0.875rem", fontFamily: "Inter, sans-serif",
  background: "var(--cream)", color: "var(--charcoal)", outline: "none",
  width: "100%", boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 3, border: "none",
  background: "var(--charcoal)", color: "#fff",
  fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 3,
  border: "1px solid var(--border-strong)", background: "none",
  color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", cursor: "pointer",
};

interface ContactWithStudent extends StudentContactRow {
  student_name: string;
}

const RELATIONSHIP_OPTIONS = ["parent", "guardian", "grandparent", "sibling", "self", "other"];

// ── Page ─────────────────────────────────────────────────────
export default function ContactsPage() {
  const { user } = useAuth();
  const teacher = user as Teacher | null;
  const studioId = teacher?.studioId;

  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [contacts, setContacts] = useState<ContactWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add contact modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    studentId: "", name: "", email: "", phone: "", relationship: "parent", isPrimary: false, notes: "",
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit contact
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<typeof addForm>>({});

  const load = useCallback(async () => {
    if (!studioId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: studentData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("studio_id", studioId)
        .eq("role", "student")
        .order("display_name");
      setStudents((studentData ?? []) as ProfileRow[]);

      const res = await fetch(`/api/contacts?studioId=${studioId}`);
      if (res.ok) {
        const { contacts: raw } = await res.json() as { contacts: StudentContactRow[] };
        const nameMap: Record<string, string> = {};
        for (const s of studentData ?? []) nameMap[(s as { id: string }).id] = (s as { display_name: string }).display_name;
        setContacts(raw.map(c => ({ ...c, student_name: nameMap[c.student_id] ?? "Unknown" })));
      }
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!studioId) return;
    setAdding(true); setAddError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioId, ...addForm, isPrimary: addForm.isPrimary }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      setShowAdd(false);
      setAddForm({ studentId: "", name: "", email: "", phone: "", relationship: "parent", isPrimary: false, notes: "" });
      load();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    load();
  }

  async function handleEditSave(id: string) {
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    load();
  }

  // Group contacts by student
  const filteredStudents = students.filter(st => {
    const term = search.toLowerCase();
    if (!term) return true;
    const studentContacts = contacts.filter(c => c.student_id === st.id);
    return st.display_name.toLowerCase().includes(term) ||
      studentContacts.some(c =>
        c.name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term)
      );
  });

  if (loading) return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem" }}>Loading…</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 style={{ ...s, fontWeight: 700, fontSize: "1.375rem", color: "var(--charcoal)", margin: 0 }}>Contacts</h1>
        <button onClick={() => setShowAdd(true)} style={btnPrimary}>+ Add Contact</button>
      </div>

      <input
        style={{ ...inputStyle, marginBottom: "1.5rem", maxWidth: 320 }}
        placeholder="Search by student or contact name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {filteredStudents.length === 0 && (
        <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem" }}>No students found.</p>
      )}

      {filteredStudents.map(student => {
        const studentContacts = contacts.filter(c => c.student_id === student.id);
        return (
          <div key={student.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: studentContacts.length ? "1rem" : 0 }}>
              <p style={{ ...s, fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", margin: 0 }}>
                {student.display_name}
              </p>
              <button
                onClick={() => { setShowAdd(true); setAddForm(f => ({ ...f, studentId: student.id })); }}
                style={{ ...s, background: "none", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.25rem 0.625rem", fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer" }}
              >
                + Contact
              </button>
            </div>

            {studentContacts.length === 0 && (
              <p style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)" }}>No contacts added yet.</p>
            )}

            {studentContacts.map(contact => (
              <div key={contact.id} style={{
                padding: "0.75rem", background: "var(--cream)", borderRadius: 3,
                marginBottom: "0.5rem", border: "1px solid var(--border)",
              }}>
                {editingId === contact.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <input style={inputStyle} placeholder="Name" value={editForm.name ?? contact.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      <select style={inputStyle} value={editForm.relationship ?? contact.relationship ?? "parent"} onChange={e => setEditForm(f => ({ ...f, relationship: e.target.value }))}>
                        {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <input style={inputStyle} type="email" placeholder="Email" value={editForm.email ?? contact.email ?? ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                      <input style={inputStyle} type="tel" placeholder="Phone" value={editForm.phone ?? contact.phone ?? ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => handleEditSave(contact.id)} style={{ ...btnPrimary, fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ ...btnSecondary, fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <p style={{ ...s, fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", margin: 0 }}>
                          {contact.name}
                        </p>
                        <span style={{ ...s, fontSize: "0.6875rem", background: "var(--border)", color: "var(--muted)", borderRadius: 10, padding: "0.125rem 0.5rem", textTransform: "capitalize" }}>
                          {contact.relationship}
                        </span>
                        {contact.is_primary && (
                          <span style={{ ...s, fontSize: "0.6875rem", background: "#dcfce7", color: "#16a34a", borderRadius: 10, padding: "0.125rem 0.5rem" }}>
                            Primary
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none" }}>
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", textDecoration: "none" }}>
                            {contact.phone}
                          </a>
                        )}
                      </div>
                      {contact.notes && (
                        <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0", fontStyle: "italic" }}>{contact.notes}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                      <button
                        onClick={() => { setEditingId(contact.id); setEditForm({}); }}
                        style={{ ...s, background: "none", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        style={{ ...s, background: "none", border: "1px solid #fca5a5", borderRadius: 3, padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#dc2626", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* ── ADD CONTACT MODAL ─────────────────────────────────── */}
      {showAdd && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setAddForm({ studentId: "", name: "", email: "", phone: "", relationship: "parent", isPrimary: false, notes: "" }); } }}
        >
          <div style={{ background: "var(--white)", borderRadius: 4, padding: "2rem", width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <h2 style={{ ...s, fontWeight: 600, fontSize: "1.0625rem", color: "var(--charcoal)", margin: "0 0 1.5rem" }}>Add Contact</h2>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>Student *</label>
                <select required style={inputStyle} value={addForm.studentId} onChange={e => setAddForm(f => ({ ...f, studentId: e.target.value }))}>
                  <option value="">Select student…</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>Name *</label>
                  <input required style={inputStyle} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>Relationship</label>
                  <select style={inputStyle} value={addForm.relationship} onChange={e => setAddForm(f => ({ ...f, relationship: e.target.value }))}>
                    {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>Email</label>
                  <input type="email" style={inputStyle} value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div>
                  <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>Phone</label>
                  <input type="tel" style={inputStyle} value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ ...s, fontSize: "0.8125rem", fontWeight: 500, display: "block", marginBottom: "0.375rem" }}>Notes</label>
                <input style={inputStyle} value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any extra notes…" />
              </div>

              <label style={{ ...s, display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "1.25rem", cursor: "pointer" }}>
                <input type="checkbox" checked={addForm.isPrimary} onChange={e => setAddForm(f => ({ ...f, isPrimary: e.target.checked }))} />
                Primary contact
              </label>

              {addError && <p style={{ ...s, color: "#dc2626", fontSize: "0.8125rem", margin: "0 0 0.75rem" }}>{addError}</p>}

              <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
                <button type="button" style={btnSecondary} onClick={() => { setShowAdd(false); setAddForm({ studentId: "", name: "", email: "", phone: "", relationship: "parent", isPrimary: false, notes: "" }); }}>Cancel</button>
                <button type="submit" style={{ ...btnPrimary, opacity: adding ? 0.6 : 1 }} disabled={adding}>{adding ? "Adding…" : "Add Contact"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
