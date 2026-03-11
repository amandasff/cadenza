"use client";
import React, { useEffect, useState, use } from "react";

interface StudioInfo {
  id: string;
  name: string;
  slug: string;
}

interface Teacher {
  id: string;
  display_name: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function EnrollPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [studio, setStudio] = useState<StudioInfo | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    studentName: "",
    parentName: "",
    contactEmail: "",
    contactPhone: "",
    instrument: "",
    age: "",
    experienceLevel: "",
    preferredTeacherId: "",
    preferredDays: [] as string[],
    notes: "",
  });

  useEffect(() => {
    fetch(`/api/studio/public?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ studio, teachers }) => {
        setStudio(studio);
        setTeachers(teachers);
      })
      .catch(code => {
        if (code === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  function toggleDay(day: string) {
    setForm(f => ({
      ...f,
      preferredDays: f.preferredDays.includes(day)
        ? f.preferredDays.filter(d => d !== day)
        : [...f.preferredDays, day],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studio) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId: studio.id,
          studentName: form.studentName,
          parentName: form.parentName || undefined,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || undefined,
          instrument: form.instrument || undefined,
          age: form.age ? parseInt(form.age) : undefined,
          experienceLevel: form.experienceLevel || undefined,
          preferredTeacherId: form.preferredTeacherId || undefined,
          preferredDays: form.preferredDays.length ? form.preferredDays : undefined,
          notes: form.notes || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Submission failed");
      }

      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d4d0c8",
    borderRadius: 3,
    padding: "0.625rem 0.875rem",
    fontSize: "0.9375rem",
    fontFamily: "Inter, sans-serif",
    background: "#faf9f7",
    color: "#2c2c2c",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#2c2c2c",
    letterSpacing: "0.02em",
    display: "block",
    marginBottom: "0.375rem",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f7" }}>
        <p style={{ fontFamily: "Inter, sans-serif", color: "#888", fontSize: "0.875rem" }}>Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f7" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1.125rem", color: "#2c2c2c", marginBottom: "0.5rem" }}>Studio not found</p>
          <p style={{ fontFamily: "Inter, sans-serif", color: "#888", fontSize: "0.875rem" }}>Check the link and try again.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f7", padding: "2rem" }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✓</div>
          <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.5rem", color: "#2c2c2c", margin: "0 0 0.75rem" }}>
            Application received
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", color: "#666", fontSize: "0.9375rem", lineHeight: 1.6 }}>
            Thank you! {studio?.name} will be in touch at{" "}
            <strong>{form.contactEmail}</strong> to confirm your enrollment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#faf9f7", padding: "2rem 1rem 4rem" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{
            fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "#888",
            marginBottom: "0.5rem",
          }}>
            Cadenza
          </p>
          <h1 style={{
            fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.75rem",
            color: "#2c2c2c", margin: "0 0 0.5rem",
          }}>
            Enroll at {studio?.name}
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", color: "#666", fontSize: "0.9375rem", lineHeight: 1.6 }}>
            Fill out this form and the studio will contact you to confirm your spot.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Student info */}
          <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 4, padding: "1.5rem", marginBottom: "1.25rem" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#888", margin: "0 0 1.25rem" }}>
              Student
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Student name *</label>
              <input
                required
                style={inputStyle}
                value={form.studentName}
                onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))}
                placeholder="Full name"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Instrument</label>
                <input
                  style={inputStyle}
                  value={form.instrument}
                  onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}
                  placeholder="e.g. Piano"
                />
              </div>
              <div>
                <label style={labelStyle}>Age</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={99}
                  value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                  placeholder="e.g. 10"
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Experience level</label>
              <select
                style={inputStyle}
                value={form.experienceLevel}
                onChange={e => setForm(f => ({ ...f, experienceLevel: e.target.value }))}
              >
                <option value="">Select…</option>
                <option value="beginner">Beginner — just starting out</option>
                <option value="intermediate">Intermediate — some experience</option>
                <option value="advanced">Advanced — ready for challenge</option>
              </select>
            </div>
          </div>

          {/* Contact info */}
          <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 4, padding: "1.5rem", marginBottom: "1.25rem" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#888", margin: "0 0 1.25rem" }}>
              Contact
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Parent / guardian name</label>
              <input
                style={inputStyle}
                value={form.parentName}
                onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))}
                placeholder="Full name (if student is a minor)"
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Email *</label>
              <input
                required
                type="email"
                style={inputStyle}
                value={form.contactEmail}
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input
                type="tel"
                style={inputStyle}
                value={form.contactPhone}
                onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Preferences */}
          <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 4, padding: "1.5rem", marginBottom: "1.25rem" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#888", margin: "0 0 1.25rem" }}>
              Preferences
            </p>

            {teachers.length > 1 && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Preferred teacher</label>
                <select
                  style={inputStyle}
                  value={form.preferredTeacherId}
                  onChange={e => setForm(f => ({ ...f, preferredTeacherId: e.target.value }))}
                >
                  <option value="">No preference</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.display_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Preferred lesson days</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      padding: "0.375rem 0.875rem",
                      borderRadius: 20,
                      border: "1px solid",
                      borderColor: form.preferredDays.includes(day) ? "#2c2c2c" : "#d4d0c8",
                      background: form.preferredDays.includes(day) ? "#2c2c2c" : "#fff",
                      color: form.preferredDays.includes(day) ? "#fff" : "#666",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Any other notes</label>
              <textarea
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Goals, scheduling constraints, anything else we should know…"
              />
            </div>
          </div>

          {error && (
            <p style={{
              fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#c0392b",
              margin: "0 0 1rem", padding: "0.75rem 1rem", background: "#fdf0ee",
              border: "1px solid #f5c6c0", borderRadius: 3,
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "0.875rem",
              background: submitting ? "#b0ab9e" : "#2c2c2c",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "0.9375rem",
              cursor: submitting ? "default" : "pointer",
              letterSpacing: "0.02em",
              transition: "background 0.15s",
            }}
          >
            {submitting ? "Submitting…" : "Submit enrollment application"}
          </button>

          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#999", textAlign: "center", marginTop: "0.875rem", lineHeight: 1.5 }}>
            Your information is only shared with {studio?.name}.
          </p>
        </form>
      </div>
    </div>
  );
}
