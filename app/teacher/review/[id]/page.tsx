"use client";
import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { GoalService } from "../../../../lib/services/GoalService";
import { ChatService } from "../../../../lib/services/ChatService";
import { Teacher } from "../../../../lib/models/Teacher";
import type { PracticeSessionRow, GoalRow, ProfileRow, PracticeSegment } from "../../../../lib/types";
import AudioPlayer from "../../../../components/AudioPlayer";

const AREAS: Record<string, { label: string; color: string; icon: string }> = {
  technique:    { label: "Technique",    color: "var(--sage)",   icon: "🌿" },
  repertoire:   { label: "Repertoire",   color: "var(--rose)",   icon: "🌸" },
  ear_training: { label: "Ear Training", color: "var(--sky)",    icon: "🎧" },
  theory:       { label: "Theory",       color: "var(--butter)", icon: "⭐" },
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function RecordingReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const teacher = user as Teacher;

  const [session, setSession] = useState<PracticeSessionRow | null>(null);
  const [student, setStudent] = useState<ProfileRow | null>(null);
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [feedback, setFeedback] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  // Teacher voice note recording
  const [recording, setRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [voiceSent, setVoiceSent] = useState(false);
  const [recordError, setRecordError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        const { data: sessionData, error: sessionError } = await supabase
          .from("practice_sessions")
          .select("*")
          .eq("id", id)
          .single();

        if (sessionError || !sessionData) { setNotFound(true); return; }
        const s = sessionData as PracticeSessionRow;
        setSession(s);

        // Load student profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", s.student_id)
          .single();
        if (profileData) setStudent(profileData as ProfileRow);

        // Load associated goal if any
        if (s.goal_id) {
          const { data: goalData } = await supabase
            .from("goals")
            .select("*")
            .eq("id", s.goal_id)
            .single();
          if (goalData) {
            const g = goalData as GoalRow;
            setGoal(g);
            setApproved(g.status === "completed");
            if (g.teacher_feedback) setFeedback(g.teacher_feedback);
          }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setRecordError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setRecordError("Microphone access denied. Check your browser permissions.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function discardRecording() {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingBlob(null);
    setRecordingUrl(null);
    setVoiceSent(false);
  }

  async function sendVoiceNote() {
    if (!recordingBlob || !session || !student || sendingVoice) return;
    setSendingVoice(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const path = `teacher-notes/${teacher.id}/${Date.now()}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from("practice-recordings")
        .upload(path, recordingBlob, { contentType: "audio/webm", upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("practice-recordings").getPublicUrl(path);
      const audioUrl = urlData.publicUrl;

      await ChatService.getInstance(supabase).sendPrivateMessage(
        session.studio_id, teacher.id, teacher.displayName, student.id,
        `🎙 Voice note from ${teacher.displayName}\nAUDIO:${audioUrl}`
      );

      setVoiceSent(true);
    } catch (err) {
      console.error("voice note error:", err);
      setRecordError("Failed to send voice note. Please try again.");
    } finally {
      setSendingVoice(false);
    }
  }

  async function handleApprove() {
    if (!session || !goal || !student || approving || approved) return;
    setApproving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await GoalService.getInstance(supabase).completeGoal(goal.id, student.id, goal.points);

      // Notify student via system message (recipient = student)
      await ChatService.getInstance(supabase).postSystemMessage(
        session.studio_id, teacher.id, student.id,
        `🎉 Goal approved by your teacher!\n📌 ${goal.title}\n⭐ +${goal.points} stars awarded`
      ).catch(() => {});

      setApproved(true);
      setGoal((prev) => prev ? { ...prev, status: "completed" } : prev);
    } catch (err) {
      console.error("approve error:", err);
    } finally {
      setApproving(false);
    }
  }

  async function handleSaveFeedback() {
    if (!goal || !feedback.trim() || savingFeedback) return;
    setSavingFeedback(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await GoalService.getInstance(supabase).addFeedback(goal.id, feedback.trim());

      // Send feedback as chat message to student
      if (session && student) {
        await ChatService.getInstance(supabase).sendPrivateMessage(
          session.studio_id, teacher.id, teacher.displayName, student.id,
          `📝 Feedback on "${goal.title}":\n${feedback.trim()}`
        ).catch(() => {});
      }

      setFeedbackSaved(true);
      setTimeout(() => setFeedbackSaved(false), 3000);
    } catch (err) {
      console.error("feedback error:", err);
    } finally {
      setSavingFeedback(false);
    }
  }

  const segments = (session?.segments_json ?? []) as PracticeSegment[];
  const mins = session ? Math.max(1, Math.round(session.duration_seconds / 60)) : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="skeleton" style={{ height: 32, width: "50%", borderRadius: 100 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 20 }} />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="empty-state" style={{ padding: "3rem 0" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>😕</div>
        <p style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, color: "var(--charcoal)", margin: 0 }}>Session not found</p>
        <Link href="/teacher/review" style={{ marginTop: "1rem", display: "inline-block", color: "var(--peach)", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none" }}>
          ← Back to queue
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link href="/teacher/review" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "1.1rem" }}>←</Link>
        <div>
          <h1 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "var(--charcoal)", margin: 0 }}>
            {student?.display_name ?? "Student"} — Session Review
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.125rem 0 0" }}>
            {new Date(session.created_at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · {mins} minutes
          </p>
        </div>
      </div>

      <div className="r-two-col" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Goal info */}
          {goal && (
            <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Goal Being Practiced
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--charcoal)" }}>{goal.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", marginTop: 2 }}>⭐ {goal.points} stars</div>
                </div>
                <span style={{
                  padding: "0.25rem 0.75rem", borderRadius: 100, fontSize: "0.72rem",
                  fontFamily: "Nunito, sans-serif", fontWeight: 700,
                  background: goal.status === "completed" ? "var(--sage-bg)" : "var(--peach-bg)",
                  color: goal.status === "completed" ? "var(--sage)" : "var(--peach)",
                }}>
                  {goal.status === "completed" ? "✓ Completed" : "In Progress"}
                </span>
              </div>
            </div>
          )}

          {/* Recording */}
          <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
              Student Recording
            </div>
            {session.recording_url ? (
              <AudioPlayer src={session.recording_url} />
            ) : (
              <div style={{ background: "var(--cream)", borderRadius: 12, padding: "1.25rem", textAlign: "center", color: "var(--muted)", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem" }}>
                No recording for this session
              </div>
            )}
          </div>

          {/* AI Analysis */}
          {session.recording_url && (
            <div style={{ background: "var(--cream)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                AI Analysis
              </div>
              {session.ai_feedback ? (
                <p style={{ fontSize: "0.875rem", lineHeight: 1.75, color: "var(--charcoal)", fontFamily: "DM Sans, sans-serif", margin: 0, whiteSpace: "pre-wrap" }}>
                  {session.ai_feedback}
                </p>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: "0.8125rem", fontFamily: "DM Sans, sans-serif" }}>
                  Analyzing recording… check back shortly.
                </div>
              )}
            </div>
          )}

          {/* Segments */}
          {segments.length > 0 && (
            <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
                Segments ({segments.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {segments.map((seg, i) => {
                  const area = AREAS[seg.practice_area] ?? AREAS["technique"];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0", borderBottom: i < segments.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: "1rem" }}>{area.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--charcoal)" }}>{seg.title}</div>
                        <div style={{ fontSize: "0.7rem", color: area.color, fontFamily: "DM Sans, sans-serif" }}>{area.label} · {fmt(seg.start_seconds)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Student notes */}
          {session.notes && (
            <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Student Notes
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--charcoal)", lineHeight: 1.6, margin: 0, fontFamily: "DM Sans, sans-serif" }}>
                {session.notes}
              </p>
            </div>
          )}

          {/* Teacher Voice Note */}
          <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
              Record Voice Note
            </div>

            {!recordingBlob ? (
              <div>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  style={{
                    width: "100%",
                    padding: "0.85rem",
                    borderRadius: 100,
                    border: recording ? "2px solid var(--rose)" : "2px solid var(--sky)",
                    background: recording ? "var(--rose-bg)" : "var(--sky-bg)",
                    color: recording ? "var(--rose)" : "var(--sky)",
                    fontFamily: "Nunito, sans-serif",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  {recording ? (
                    <>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--rose)", animation: "pulse 1s infinite" }} />
                      Stop Recording
                    </>
                  ) : (
                    <>🎙 Start Recording</>
                  )}
                </button>
                {recordError && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--rose)", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                    {recordError}
                  </div>
                )}
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.5rem", margin: "0.5rem 0 0" }}>
                  Record a voice note to send directly to {student?.display_name?.split(" ")[0] ?? "the student"} via chat.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {recordingUrl && <AudioPlayer src={recordingUrl} />}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <button
                    onClick={discardRecording}
                    style={{
                      padding: "0.65rem",
                      borderRadius: 100,
                      border: "1.5px solid var(--border)",
                      background: "var(--cream)",
                      color: "var(--muted)",
                      fontFamily: "Nunito, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={sendVoiceNote}
                    disabled={sendingVoice || voiceSent}
                    style={{
                      padding: "0.65rem",
                      borderRadius: 100,
                      border: "none",
                      background: voiceSent ? "var(--sage)" : "var(--sky)",
                      color: "white",
                      fontFamily: "Nunito, sans-serif",
                      fontWeight: 800,
                      fontSize: "0.85rem",
                      cursor: sendingVoice || voiceSent ? "default" : "pointer",
                      opacity: sendingVoice ? 0.7 : 1,
                      transition: "background 0.15s",
                    }}
                  >
                    {voiceSent ? "✓ Sent!" : sendingVoice ? "Sending…" : "Send to Student"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Approve goal button */}
          {goal && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleApprove}
                disabled={approving || approved}
                style={{
                  flex: 1, padding: "0.85rem", borderRadius: 100, border: "none", cursor: approved || approving ? "default" : "pointer",
                  background: approved ? "var(--sage)" : "var(--sage-bg)",
                  color: approved ? "white" : "var(--sage)",
                  fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: "0.9rem",
                  transition: "all 0.15s", opacity: approving ? 0.7 : 1,
                }}
              >
                {approved ? "✓ Goal Approved" : approving ? "Approving…" : "✓ Approve Goal"}
              </button>
            </div>
          )}
        </div>

        {/* Right column — feedback */}
        <div style={{ background: "var(--white)", borderRadius: 20, padding: "1.25rem", border: "1.5px solid var(--border)" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
            {goal ? "Feedback on Goal" : "Notes"}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={goal ? `Leave feedback on "${goal.title}"…` : "Leave a note about this session…"}
            style={{
              width: "100%", borderRadius: 12, border: "1.5px solid var(--border)",
              padding: "0.75rem", fontFamily: "DM Sans, sans-serif", fontSize: "0.85rem",
              background: "var(--cream)", color: "var(--charcoal)", resize: "none",
              minHeight: 140, outline: "none", boxSizing: "border-box", lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleSaveFeedback}
            disabled={!feedback.trim() || savingFeedback || !goal}
            style={{
              width: "100%", marginTop: "0.75rem", padding: "0.65rem", borderRadius: 100,
              border: "none", cursor: !feedback.trim() || !goal ? "default" : "pointer",
              background: feedbackSaved ? "var(--sage)" : !feedback.trim() || !goal ? "var(--border)" : "var(--sky)",
              color: "white", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem",
              transition: "background 0.15s",
            }}
          >
            {feedbackSaved ? "✓ Sent!" : savingFeedback ? "Sending…" : "Send Feedback"}
          </button>
          {!goal && (
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.5rem", textAlign: "center" }}>
              No goal linked to this session
            </p>
          )}

          {/* Link to student profile */}
          {student && (
            <Link
              href={`/teacher/student/${student.id}`}
              style={{
                display: "block",
                marginTop: "1rem",
                padding: "0.6rem",
                borderRadius: 100,
                border: "1.5px solid var(--border)",
                textAlign: "center",
                fontFamily: "Nunito, sans-serif",
                fontWeight: 700,
                fontSize: "0.8rem",
                color: "var(--charcoal)",
                textDecoration: "none",
              }}
            >
              View {student.display_name.split(" ")[0]}&apos;s Profile →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
