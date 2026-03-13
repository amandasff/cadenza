"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Teacher } from "../../../lib/models/Teacher";
import type { EnrollmentApplicationRow, ProfileRow } from "../../../lib/types";

interface StudioTeacherMember {
  id: string;
  teacher_id: string;
  role: "director" | "teacher";
  joined_at: string;
  display_name: string;
  avatar_url?: string | null;
}

interface StudentAssignment {
  id: string;
  student_id: string;
  teacher_id: string;
  started_at: string;
  student_name: string;
  teacher_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--warning)",
  approved: "var(--success)",
  waitlisted: "var(--sky)",
  denied: "var(--error)",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  waitlisted: "Waitlisted",
  denied: "Denied",
};

export default function StudioManagementPage() {
  const { user } = useAuth();
  const teacher = user as Teacher | null;

  const [studioSlug, setStudioSlug] = useState<string | null>(null);
  const [teacherInviteCode, setTeacherInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<StudioTeacherMember[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [applications, setApplications] = useState<EnrollmentApplicationRow[]>([]);
  const [allStudents, setAllStudents] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirector, setIsDirector] = useState(false);

  // Invite teacher state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Reassign state
  const [reassigningStudent, setReassigningStudent] = useState<string | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState("");
  const [reassigning, setReassigning] = useState(false);

  const studioId = teacher?.studioId;

  useEffect(() => {
    if (!studioId) return;
    loadAll();
  }, [studioId]);

  async function loadAll() {
    if (!studioId) return;
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    try {
      // Get studio info (slug, invite code)
      const { data: studio } = await supabase
        .from("studios")
        .select("slug, teacher_invite_code")
        .eq("id", studioId)
        .single();

      setStudioSlug(studio?.slug ?? null);
      setTeacherInviteCode(studio?.teacher_invite_code ?? null);

      // Check if current user is a director
      const { data: membership } = await supabase
        .from("studio_teachers")
        .select("role")
        .eq("studio_id", studioId)
        .eq("teacher_id", teacher?.id ?? "")
        .maybeSingle();

      const director = membership?.role === "director";
      setIsDirector(director);

      // Load co-teachers (everyone in studio_teachers)
      const { data: teacherRows } = await supabase
        .from("studio_teachers")
        .select("id, teacher_id, role, joined_at")
        .eq("studio_id", studioId)
        .order("role");

      if (teacherRows?.length) {
        const teacherIds = teacherRows.map((t: { teacher_id: string }) => t.teacher_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", teacherIds);

        const profileMap: Record<string, { display_name: string; avatar_url?: string | null }> = {};
        for (const p of profiles ?? []) {
          profileMap[(p as { id: string }).id] = p as { display_name: string; avatar_url?: string | null };
        }

        setMembers(teacherRows.map((t: { id: string; teacher_id: string; role: "director" | "teacher"; joined_at: string }) => ({
          ...t,
          display_name: profileMap[t.teacher_id]?.display_name ?? "Unknown",
          avatar_url: profileMap[t.teacher_id]?.avatar_url ?? null,
        })));
      }

      if (director) {
        // Load all student assignments
        const { data: asgns } = await supabase
          .from("teacher_student_assignments")
          .select("id, student_id, teacher_id, started_at")
          .eq("studio_id", studioId)
          .is("ended_at", null);

        if (asgns?.length) {
          const userIds = [...new Set([
            ...asgns.map((a: { student_id: string }) => a.student_id),
            ...asgns.map((a: { teacher_id: string }) => a.teacher_id),
          ])];

          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", userIds);

          const nameMap: Record<string, string> = {};
          for (const p of profiles ?? []) {
            nameMap[(p as { id: string }).id] = (p as { display_name: string }).display_name;
          }

          setAssignments(asgns.map((a: { id: string; student_id: string; teacher_id: string; started_at: string }) => ({
            ...a,
            student_name: nameMap[a.student_id] ?? "Unknown",
            teacher_name: nameMap[a.teacher_id] ?? "Unknown",
          })));
        }

        // Load all students in studio for reassignment dropdown
        const { data: students } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("studio_id", studioId)
          .eq("role", "student")
          .order("display_name");

        setAllStudents((students ?? []) as ProfileRow[]);

        // Load enrollment applications
        const res = await fetch(`/api/enrollment?studioId=${studioId}`);
        if (res.ok) {
          const { applications: apps } = await res.json() as { applications: EnrollmentApplicationRow[] };
          setApplications(apps);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!studioId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);

    try {
      const res = await fetch("/api/studio/invite-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioId, email: inviteEmail.trim() }),
      });
      const body = await res.json() as { teacherName?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setInviteMsg({ type: "ok", text: `${body.teacherName} has been added as a co-teacher.` });
      setInviteEmail("");
      loadAll();
    } catch (err) {
      setInviteMsg({ type: "err", text: (err as Error).message });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveTeacher(teacherId: string, name: string) {
    if (!studioId) return;
    if (!confirm(`Remove ${name} as a co-teacher?`)) return;

    await fetch("/api/studio/invite-teacher", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioId, teacherId }),
    });
    loadAll();
  }

  async function handleReassign(studentId: string) {
    if (!studioId || !reassignTeacherId) return;
    setReassigning(true);

    try {
      const res = await fetch("/api/studio/assign-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioId, studentId, newTeacherId: reassignTeacherId }),
      });
      if (!res.ok) throw new Error("Failed to reassign");
      setReassigningStudent(null);
      setReassignTeacherId("");
      loadAll();
    } finally {
      setReassigning(false);
    }
  }

  async function handleApplicationStatus(id: string, status: string) {
    const res = await fetch(`/api/enrollment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) loadAll();
  }

  const s: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
  };

  const card: React.CSSProperties = {
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "1.5rem",
    marginBottom: "1.5rem",
  };

  const sectionTitle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontWeight: 600,
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--muted)",
    margin: "0 0 1.25rem",
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem" }}>Loading…</p>
      </div>
    );
  }

  const pendingCount = applications.filter(a => a.status === "pending").length;
  const coTeachers = members.filter(m => m.role === "teacher");
  const enrollmentLink = studioSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/enroll/${studioSlug}`
    : null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <h1 style={{ ...s, fontWeight: 700, fontSize: "1.375rem", color: "var(--charcoal)", margin: "0 0 0.25rem" }}>
        Studio Management
      </h1>
      <p style={{ ...s, color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 2.5rem" }}>
        {isDirector ? "You are the director of this studio." : "You are a co-teacher in this studio."}
      </p>

      {/* Enrollment link */}
      {studioSlug && (
        <div style={card}>
          <p style={sectionTitle}>Public Enrollment Form</p>
          <p style={{ ...s, fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.75rem", lineHeight: 1.6 }}>
            Share this link with prospective students. They can fill out an enrollment form and you&apos;ll see it below.
          </p>
          <div style={{
            display: "flex", gap: "0.625rem", alignItems: "center",
            background: "var(--cream)", border: "1px solid var(--border)",
            borderRadius: 4, padding: "0.625rem 0.875rem",
          }}>
            <span style={{ ...s, fontSize: "0.875rem", color: "var(--charcoal)", flex: 1, wordBreak: "break-all" }}>
              {enrollmentLink}
            </span>
            <button
              onClick={() => { if (enrollmentLink) navigator.clipboard.writeText(enrollmentLink); }}
              style={{
                ...s, flexShrink: 0, background: "var(--charcoal)", color: "#fff",
                border: "none", borderRadius: 4, padding: "0.375rem 0.75rem",
                fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", letterSpacing: "0.04em",
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Enrollment Applications */}
      {isDirector && (
        <div style={card}>
          <p style={sectionTitle}>
            Enrollment Applications {pendingCount > 0 && (
              <span style={{
                background: "var(--error)", color: "#fff", borderRadius: 10,
                padding: "0.125rem 0.5rem", fontSize: "0.6875rem", marginLeft: "0.5rem",
              }}>
                {pendingCount} new
              </span>
            )}
          </p>

          {applications.length === 0 ? (
            <p style={{ ...s, fontSize: "0.875rem", color: "var(--muted)" }}>No applications yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {applications.map(app => (
                <div key={app.id} style={{
                  border: "1px solid var(--border)", borderRadius: 4, padding: "1rem",
                  background: app.status === "pending" ? "var(--cream)" : "transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <p style={{ ...s, fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", margin: 0 }}>
                        {app.student_name}
                      </p>
                      <p style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                        {app.instrument && `${app.instrument} · `}
                        {app.age && `Age ${app.age} · `}
                        {app.experience_level && `${app.experience_level} · `}
                        {app.contact_email}
                      </p>
                      {app.parent_name && (
                        <p style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                          Parent: {app.parent_name}
                          {app.contact_phone && ` · ${app.contact_phone}`}
                        </p>
                      )}
                      {app.preferred_days?.length ? (
                        <p style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", margin: "0.125rem 0 0" }}>
                          Preferred days: {app.preferred_days.join(", ")}
                        </p>
                      ) : null}
                      {app.notes && (
                        <p style={{ ...s, fontSize: "0.8125rem", color: "var(--charcoal)", margin: "0.375rem 0 0", fontStyle: "italic" }}>
                          &ldquo;{app.notes}&rdquo;
                        </p>
                      )}
                    </div>
                    <span style={{
                      ...s,
                      fontSize: "0.75rem", fontWeight: 500,
                      color: STATUS_COLORS[app.status],
                      letterSpacing: "0.04em", textTransform: "uppercase",
                      flexShrink: 0,
                    }}>
                      {STATUS_LABELS[app.status]}
                    </span>
                  </div>

                  {app.status === "pending" && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleApplicationStatus(app.id, "approved")}
                        style={{ ...s, padding: "0.375rem 0.875rem", borderRadius: 4, border: "none", background: "var(--success)", color: "#fff", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApplicationStatus(app.id, "waitlisted")}
                        style={{ ...s, padding: "0.375rem 0.875rem", borderRadius: 4, border: "1px solid var(--border-strong)", background: "none", color: "var(--muted)", fontSize: "0.8125rem", cursor: "pointer" }}
                      >
                        Waitlist
                      </button>
                      <button
                        onClick={() => handleApplicationStatus(app.id, "denied")}
                        style={{ ...s, padding: "0.375rem 0.875rem", borderRadius: 4, border: "1px solid var(--error)", background: "none", color: "var(--error)", fontSize: "0.8125rem", cursor: "pointer" }}
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Co-teachers */}
      <div style={card}>
        <p style={sectionTitle}>Teachers</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: isDirector ? "1.5rem" : 0 }}>
          {members.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: m.avatar_url ? "transparent" : "var(--charcoal)",
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.6875rem", fontWeight: 600, color: "#fff",
              }}>
                {m.avatar_url
                  ? <img src={m.avatar_url} alt={m.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : m.display_name.slice(0, 2).toUpperCase()
                }
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ ...s, fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", margin: 0 }}>
                  {m.display_name}
                  {m.teacher_id === teacher?.id && " (you)"}
                </p>
                <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", margin: 0, textTransform: "capitalize" }}>
                  {m.role}
                </p>
              </div>
              {isDirector && m.role !== "director" && (
                <button
                  onClick={() => handleRemoveTeacher(m.teacher_id, m.display_name)}
                  style={{ ...s, background: "none", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "0.25rem 0.625rem", fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer" }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {isDirector && (
          <form onSubmit={handleInviteTeacher} style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="teacher@email.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              style={{
                flex: 1, minWidth: 200, border: "1px solid var(--border-strong)", borderRadius: 4,
                padding: "0.5rem 0.875rem", fontSize: "0.875rem", fontFamily: "Inter, sans-serif",
                background: "var(--cream)", color: "var(--charcoal)", outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              style={{
                ...s, padding: "0.5rem 1rem", borderRadius: 4, border: "none",
                background: inviting || !inviteEmail.trim() ? "var(--border)" : "var(--charcoal)",
                color: "#fff", fontSize: "0.875rem", fontWeight: 500,
                cursor: inviting || !inviteEmail.trim() ? "default" : "pointer",
              }}
            >
              {inviting ? "Adding…" : "Invite co-teacher"}
            </button>
          </form>
        )}

        {inviteMsg && (
          <p style={{
            ...s, fontSize: "0.8125rem", marginTop: "0.625rem",
            color: inviteMsg.type === "ok" ? "var(--success)" : "var(--error)",
          }}>
            {inviteMsg.text}
          </p>
        )}

        <p style={{ ...s, fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.75rem", lineHeight: 1.5 }}>
          Co-teachers must already have a Cadenza teacher account.
        </p>
      </div>

      {/* Student assignments */}
      {isDirector && allStudents.length > 0 && (
        <div style={card}>
          <p style={sectionTitle}>Student Assignments</p>
          <p style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem", lineHeight: 1.5 }}>
            Reassign students between teachers. The full lesson history is preserved.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {allStudents.map(student => {
              const asgn = assignments.find(a => a.student_id === student.id);
              return (
                <div key={student.id} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
                  padding: "0.75rem", border: "1px solid var(--border)", borderRadius: 4,
                }}>
                  <span style={{ ...s, flex: 1, fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
                    {student.display_name}
                  </span>
                  <span style={{ ...s, fontSize: "0.8125rem", color: "var(--muted)" }}>
                    {asgn ? asgn.teacher_name : "Unassigned"}
                  </span>

                  {reassigningStudent === student.id ? (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <select
                        value={reassignTeacherId}
                        onChange={e => setReassignTeacherId(e.target.value)}
                        style={{
                          border: "1px solid var(--border-strong)", borderRadius: 4,
                          padding: "0.375rem 0.625rem", fontSize: "0.8125rem",
                          fontFamily: "Inter, sans-serif", background: "var(--cream)", color: "var(--charcoal)",
                        }}
                      >
                        <option value="">Select teacher…</option>
                        {members.map(m => (
                          <option key={m.teacher_id} value={m.teacher_id}>{m.display_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleReassign(student.id)}
                        disabled={!reassignTeacherId || reassigning}
                        style={{
                          ...s, padding: "0.375rem 0.75rem", borderRadius: 4, border: "none",
                          background: !reassignTeacherId || reassigning ? "var(--border)" : "var(--charcoal)",
                          color: "#fff", fontSize: "0.8125rem", fontWeight: 500,
                          cursor: !reassignTeacherId || reassigning ? "default" : "pointer",
                        }}
                      >
                        {reassigning ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setReassigningStudent(null); setReassignTeacherId(""); }}
                        style={{ ...s, background: "none", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "0.375rem 0.625rem", fontSize: "0.8125rem", color: "var(--muted)", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReassigningStudent(student.id); setReassignTeacherId(asgn?.teacher_id ?? ""); }}
                      style={{ ...s, background: "none", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "0.25rem 0.625rem", fontSize: "0.75rem", color: "var(--muted)", cursor: "pointer" }}
                    >
                      Reassign
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
