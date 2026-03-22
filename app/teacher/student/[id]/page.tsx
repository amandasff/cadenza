"use client";
import React, { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { GoalService } from "../../../../lib/services/GoalService";
import { PieceService } from "../../../../lib/services/PieceService";
import type { PieceWithGoals } from "../../../../lib/services/PieceService";
import { PracticeService } from "../../../../lib/services/PracticeService";
import { ChatService } from "../../../../lib/services/ChatService";
import { LessonService } from "../../../../lib/services/LessonService";
import { AssignmentService } from "../../../../lib/services/AssignmentService";
import { Teacher } from "../../../../lib/models/Teacher";
import type { ProfileRow, GoalRow, PracticeSessionRow, PieceRecording, YouTubeResult, LessonRow, AssignmentWithContext } from "../../../../lib/types";
import YouTubeSearch from "../../../../components/YouTubeSearch";
import { useLesson } from "../../../../lib/context/LessonContext";
import { useI18n } from "../../../../lib/context/I18nContext";
import { FileText, Music, Hourglass, Bot, Clipboard, Star, Frown, Smile, PartyPopper, Image, X, Check, BookOpen, CreditCard, ChevronUp, ChevronDown, Pencil, Trash2, Flame, Snowflake, Play } from "lucide-react";
import TranscriptionViewer, { type GameData } from "../../../../components/TranscriptionViewer";

const CATEGORIES_BASE: { value: string; colorKey: keyof typeof CATEGORY_COLORS }[] = [
  { value: "technique",    colorKey: "technique" },
  { value: "etude",        colorKey: "etude" },
  { value: "repertoire",   colorKey: "repertoire" },
  { value: "theory",       colorKey: "theory" },
  { value: "ear_training", colorKey: "ear_training" },
  { value: "sight_reading",colorKey: "sight_reading" },
  { value: "free",         colorKey: "free" },
];

const CATEGORY_COLORS: Record<string, string> = {
  technique:    "var(--sage)",
  etude:        "var(--sky)",
  repertoire:   "var(--rose)",
  theory:       "var(--butter)",
  ear_training: "var(--peach)",
  sight_reading:"var(--muted)",
  free:         "var(--muted)",
};

const SECTION_ORDER = CATEGORIES_BASE.map(c => c.value);
const PRESET_AWARDS = [5, 10, 25, 50];

function timeAgo(iso: string, yesterdayLabel: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const emptyPieceForm = () => ({ title: "", composer: "", book: "", category: "repertoire" });
const emptyGoalForm = () => ({ title: "", description: "", points: 20, status: "current" as "locked" | "current", minutesPerDay: "" as string });

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 3, border: "1px solid var(--border-strong)",
  padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem",
  background: "var(--white)", color: "var(--charcoal)", outline: "none",
  boxSizing: "border-box",
};
const primaryBtnStyle: React.CSSProperties = {
  padding: "0.5rem 0.875rem", borderRadius: 3, border: "none",
  background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer", letterSpacing: "0.01em",
};
const ghostBtnStyle: React.CSSProperties = {
  padding: "0.5rem 0.875rem", borderRadius: 3, border: "1px solid var(--border-strong)",
  background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif",
  fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer", letterSpacing: "0.01em",
};

// ── Sub-components ──────────────────────────────────────────────

function GoalForm({
  form, adding, onChange, onSubmit, onCancel,
}: {
  form: ReturnType<typeof emptyGoalForm>;
  adding: boolean;
  onChange: (f: ReturnType<typeof emptyGoalForm>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <form onSubmit={onSubmit} style={{
      padding: "0.875rem", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 4,
      display: "flex", flexDirection: "column", gap: "0.5rem",
    }}>
      <input
        required
        value={form.title}
        onChange={e => onChange({ ...form, title: e.target.value })}
        placeholder={t.goals.goalPlaceholder}
        style={inputStyle}
      />
      <input
        value={form.description}
        onChange={e => onChange({ ...form, description: e.target.value })}
        placeholder={t.goals.instructionsPlaceholder}
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="number" min={5} max={500} value={form.points}
          onChange={e => onChange({ ...form, points: Number(e.target.value) })}
          style={{ ...inputStyle, width: 90 }}
        />
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)" }}>{t.goals.pts}</span>
        <input
          type="number" min={1} max={180} value={form.minutesPerDay}
          onChange={e => onChange({ ...form, minutesPerDay: e.target.value })}
          placeholder="min/day"
          style={{ ...inputStyle, width: 80 }}
        />
        <select
          value={form.status}
          onChange={e => onChange({ ...form, status: e.target.value as "locked" | "current" })}
          style={{ ...inputStyle, flex: 1 }}
        >
          <option value="current">{t.goals.assignThisWeek}</option>
          <option value="locked">{t.goals.keepLocked}</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit" disabled={adding || !form.title.trim()} style={{ ...primaryBtnStyle, flex: 1, opacity: adding || !form.title.trim() ? 0.5 : 1 }}>
          {adding ? t.goals.adding : t.goals.addGoal}
        </button>
        <button type="button" onClick={onCancel} style={ghostBtnStyle}>{t.common.cancel}</button>
      </div>
    </form>
  );
}

function GoalItem({
  goal, color, completingGoalId, togglingGoalId, onComplete, onToggle, onDelete, onEdit,
}: {
  goal: GoalRow;
  color: string;
  completingGoalId: string | null;
  togglingGoalId: string | null;
  onComplete: (g: GoalRow) => void;
  onToggle: (g: GoalRow) => void;
  onDelete: (g: GoalRow) => void;
  onEdit: (g: GoalRow) => void;
}) {
  const { t } = useI18n();
  const isDone = goal.status === "completed";
  const isCurrent = goal.status === "current";
  const isCompleting = completingGoalId === goal.id;
  const isToggling = togglingGoalId === goal.id;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      padding: "0.625rem 0.75rem", borderRadius: 3,
      border: "1px solid var(--border)",
      background: isDone ? "transparent" : "var(--cream)",
      opacity: isDone ? 0.5 : 1,
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: isDone ? "var(--sage)" : isCurrent ? color : "var(--border)",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "0.875rem",
          color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textDecoration: isDone ? "line-through" : "none",
        }}>
          {goal.title}
        </div>
        <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.1rem" }}>
          {goal.points} {t.goals.pts}{goal.target_minutes_per_day ? ` · ${goal.target_minutes_per_day} min/day` : ""} · {isDone ? t.goals.done : isCurrent ? t.goals.thisWeek : t.goals.locked}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
        {!isDone && (
          <>
            <button
              onClick={() => onToggle(goal)}
              disabled={!!togglingGoalId || !!completingGoalId}
              style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", opacity: isToggling ? 0.5 : 1 }}
            >
              {isCurrent ? t.goals.lock : t.goals.assign}
            </button>
            {isCurrent && (
              <button
                onClick={() => onComplete(goal)}
                disabled={!!completingGoalId || !!togglingGoalId}
                style={{ ...primaryBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", opacity: isCompleting ? 0.5 : 1 }}
              >
                {isCompleting ? "…" : t.goals.complete}
              </button>
            )}
            <button
              onClick={() => onEdit(goal)}
              title="Edit goal"
              style={{ ...ghostBtnStyle, padding: "0.25rem 0.375rem", fontSize: "0.6875rem" }}
            >
              <Pencil size={11} strokeWidth={1.5} />
            </button>
          </>
        )}
        <button
          onClick={() => onDelete(goal)}
          title="Delete goal"
          style={{ ...ghostBtnStyle, padding: "0.25rem 0.375rem", fontSize: "0.6875rem", color: "#c0392b" }}
        >
          <Trash2 size={11} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function PieceBlock({
  piece, color, studentId, addGoalFor, goalForm, addingGoal, completingGoalId, togglingGoalId,
  uploadingPdf, uploadingScore, aiConverting, onSetAddGoalFor, onGoalFormChange, onAddGoal, onCompleteGoal, onToggleGoalStatus,
  onUploadSheetMusic, onUploadScore, onAiConvertScore, onAddRecording, onRemoveRecording, onSetPrimaryRecording,
  onDeleteGoal, onEditGoal, deletingGoalId,
}: {
  piece: PieceWithGoals;
  color: string;
  studentId: string;
  addGoalFor: string | "standalone" | null;
  goalForm: ReturnType<typeof emptyGoalForm>;
  addingGoal: boolean;
  completingGoalId: string | null;
  togglingGoalId: string | null;
  uploadingPdf: boolean;
  uploadingScore: boolean;
  aiConverting: boolean;
  onSetAddGoalFor: (v: string | "standalone" | null) => void;
  onGoalFormChange: (f: ReturnType<typeof emptyGoalForm>) => void;
  onAddGoal: (e: React.FormEvent) => void;
  onCompleteGoal: (g: GoalRow) => void;
  onToggleGoalStatus: (g: GoalRow) => void;
  onUploadSheetMusic: (pieceId: string, files: File[]) => void;
  onUploadScore: (pieceId: string, file: File) => void;
  onAiConvertScore: (pieceId: string, file: File) => void;
  onAddRecording: (pieceId: string, video: YouTubeResult) => Promise<void>;
  onRemoveRecording: (recordingId: string, pieceId: string) => void;
  onSetPrimaryRecording: (recordingId: string, pieceId: string) => void;
  onDeleteGoal: (g: GoalRow) => void;
  onEditGoal: (g: GoalRow) => void;
  deletingGoalId: string | null;
}) {
  const { t } = useI18n();
  const [showRecordings, setShowRecordings] = useState(false);
  const [addingRecording, setAddingRecording] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pendingPastes, setPendingPastes] = useState<File[]>([]);
  const [transcription, setTranscription] = useState<GameData | null>(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);

  async function openTranscription() {
    setTranscriptionLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("piece_games")
      .select("notes_json, key_signature, time_signature, bpm_suggestion, omr_confidence")
      .eq("piece_id", piece.id)
      .eq("student_id", studentId)
      .maybeSingle();
    setTranscriptionLoading(false);
    if (data) setTranscription(data as GameData);
  }
  const [pastePreviewUrls, setPastePreviewUrls] = useState<string[]>([]);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);

  // Keep a stable ref so the upload handler doesn't stale-close
  const uploadRef = useRef(onUploadSheetMusic);
  useEffect(() => { uploadRef.current = onUploadSheetMusic; }, [onUploadSheetMusic]);

  useEffect(() => {
    if (!pasteMode) return;
    function onPaste(e: ClipboardEvent) {
      const imageItem = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          setPendingPastes(prev => [...prev, file]);
          setPastePreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pasteMode, piece.id]);

  function cancelPaste() {
    setPasteMode(false);
    setPendingPastes([]);
    setPastePreviewUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
  }

  function uploadPastes() {
    if (pendingPastes.length > 0) uploadRef.current(piece.id, pendingPastes);
    setPasteMode(false);
    setPendingPastes([]);
    setPastePreviewUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
  }

  const sheetInputId = `sheet-${piece.id}`;
  const scoreInputId = `score-${piece.id}`;
  const done = piece.goals.filter(g => g.status === "completed").length;
  const total = piece.goals.length;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
      {/* Piece header */}
      <div style={{
        padding: "0.875rem 1rem", background: "var(--cream)",
        borderBottom: (piece.goals.length > 0 || addGoalFor === piece.id) ? "1px solid var(--border)" : "none",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", lineHeight: 1.25 }}>
            {piece.title}
            {piece.composer && <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {piece.composer}</span>}
          </div>
          {piece.book && (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.2rem" }}>{piece.book}</div>
          )}
          {/* Status */}
          <div style={{
            display: "inline-flex", alignItems: "center",
            padding: "0.1rem 0.4rem", borderRadius: 99, marginTop: "0.25rem",
            background: piece.status === "completed" ? "var(--sage-light)" : piece.status === "performance_ready" ? "#EBF3EE" : "var(--cream-dark, #EDE8DF)",
            border: "1px solid var(--border)",
          }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {piece.status === "learning" ? "Learning" : piece.status === "polishing" ? "Polishing" : piece.status === "performance_ready" ? "Performance Ready" : "Completed"}
            </span>
          </div>
          {total > 0 && (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>{done}/{total} {t.pieces.goalsLabel}</span>
              <div style={{ width: 40, height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${total > 0 ? (done / total) * 100 : 0}%`, background: color, borderRadius: 2 }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, alignItems: "center" }}>
          {/* Sheet music upload */}
          <label
            htmlFor={sheetInputId}
            title={piece.sheet_music_url ? t.pieces.replaceSheetMusic : t.pieces.uploadSheetMusic}
            style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", cursor: uploadingPdf ? "default" : "pointer", opacity: uploadingPdf ? 0.5 : 1 }}
          >
            {uploadingPdf ? "…" : piece.sheet_music_url ? "Sheet ✓" : "Sheet"}
          </label>
          <input
            id={sheetInputId}
            type="file"
            accept=".pdf,application/pdf,image/*"
            multiple
            style={{ display: "none" }}
            onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) onUploadSheetMusic(piece.id, files); e.target.value = ""; }}
          />
          {/* Score file upload (MusicXML / Guitar Pro) */}
          <label
            htmlFor={scoreInputId}
            title={piece.score_url ? t.pieces.replaceScore : t.pieces.uploadScore}
            style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", cursor: uploadingScore ? "default" : "pointer", opacity: uploadingScore ? 0.5 : 1 }}
          >
            {uploadingScore ? "…" : piece.score_url ? "Score ✓" : "Score"}
          </label>
          <input
            id={scoreInputId}
            type="file"
            accept=".gp,.gpx,.gp3,.gp4,.gp5,.xml,.musicxml,application/xml,text/xml"
            style={{ display: "none" }}
            onChange={e => { const file = e.target.files?.[0]; if (file) onUploadScore(piece.id, file); e.target.value = ""; }}
          />
          {/* AI image → MusicXML conversion */}
          <label
            htmlFor={`ai-score-${piece.id}`}
            title="Convert a photo or screenshot of sheet music to a playable score (AI)"
            style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", cursor: aiConverting ? "default" : "pointer", opacity: aiConverting ? 0.5 : 1 }}
          >
            {aiConverting ? "AI…" : "AI"}
          </label>
          <input
            id={`ai-score-${piece.id}`}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={e => { const file = e.target.files?.[0]; if (file) onAiConvertScore(piece.id, file); e.target.value = ""; }}
          />
          <button
            onClick={() => { if (pasteMode) { cancelPaste(); } else { setPasteMode(true); } }}
            title="Paste screenshot from clipboard (Ctrl+V / ⌘V)"
            style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", background: pasteMode ? "var(--charcoal)" : "none", color: pasteMode ? "var(--white)" : "var(--muted)" }}
          >
            Paste
          </button>
          {/* Recordings toggle */}
          <button
            onClick={() => setShowRecordings(v => !v)}
            title="Reference recordings"
            style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem" }}
          >
            {piece.recordings.length > 0 ? `Ref (${piece.recordings.length})` : "Ref +"}
          </button>
          {piece.sheet_music_url && (
            <Link
              href={`/teacher/student/${studentId}/annotate/${piece.id}`}
              style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              title="View student's sheet music annotations"
            >
              Notes
            </Link>
          )}
          {piece.sheet_music_url && (
            <button
              onClick={openTranscription}
              disabled={transcriptionLoading}
              style={{ ...ghostBtnStyle, padding: "0.25rem 0.5rem", fontSize: "0.6875rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              title="View AI-transcribed notes"
            >
              <FileText size={11} strokeWidth={1.5} />
              {transcriptionLoading ? "…" : "Transcription"}
            </button>
          )}
          <button
            onClick={() => onSetAddGoalFor(addGoalFor === piece.id ? null : piece.id)}
            style={{ ...ghostBtnStyle, padding: "0.25rem 0.6rem", fontSize: "0.6875rem", flexShrink: 0 }}
          >
            + {t.goals.addGoal}
          </button>
        </div>
      </div>

      {/* Paste mode banner */}
      {pasteMode && (
        <div style={{ background: "var(--charcoal)" }}>
          <div style={{ padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--white)", flex: 1 }}>
              {pendingPastes.length === 0
                ? <>Press <strong>Ctrl+V</strong> / <strong>⌘V</strong> to paste an image — paste again for more pages</>
                : <>{pendingPastes.length} image{pendingPastes.length > 1 ? "s" : ""} ready — paste more or click Upload</>}
            </span>
            {pendingPastes.length > 0 && (
              <button
                onClick={uploadPastes}
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, cursor: "pointer", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, padding: "0.2rem 0.625rem", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}
              >
                Upload {pendingPastes.length}
              </button>
            )}
            <button onClick={cancelPaste} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", lineHeight: 1, padding: 0 }}><X size={14} strokeWidth={1.5} /></button>
          </div>
          {pastePreviewUrls.length > 0 && (
            <div style={{ display: "flex", gap: "0.375rem", padding: "0 1rem 0.625rem", overflowX: "auto" }}>
              {pastePreviewUrls.map((url, i) => (
                <img key={i} src={url} alt={`Page ${i + 1}`} style={{ height: 64, width: "auto", borderRadius: 3, border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0, objectFit: "cover" }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recordings panel */}
      {showRecordings && (
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", background: "var(--white)" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>
            {t.pieces.recordings}
          </div>
          {piece.recordings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.75rem" }}>
              {piece.recordings.map(rec => (
                <div key={rec.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.5rem", background: "var(--cream)", borderRadius: playingRecordingId === rec.id ? "3px 3px 0 0" : 3, border: "1px solid var(--border)", borderBottom: playingRecordingId === rec.id ? "none" : "1px solid var(--border)" }}>
                    <button
                      onClick={() => setPlayingRecordingId(playingRecordingId === rec.id ? null : rec.id)}
                      title={playingRecordingId === rec.id ? "Close player" : "Play on YouTube"}
                      style={{ width: 36, height: 27, borderRadius: 2, background: playingRecordingId === rec.id ? "var(--charcoal)" : "#FF0000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      {playingRecordingId === rec.id
                        ? <X size={12} strokeWidth={2} color="#fff" />
                        : <Play size={11} strokeWidth={0} fill="#fff" />}
                    </button>
                    <span style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {rec.is_primary && <Star size={10} fill="currentColor" strokeWidth={0} style={{ marginRight: "0.25rem", color: "var(--muted)", verticalAlign: "middle" }} />}
                      {rec.title}
                    </span>
                    <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                      {!rec.is_primary && (
                        <button
                          onClick={() => onSetPrimaryRecording(rec.id, piece.id)}
                          style={{ ...ghostBtnStyle, padding: "0.125rem 0.375rem", fontSize: "0.5625rem" }}
                          title="Set as primary"
                        ><Star size={10} fill="currentColor" strokeWidth={0} /></button>
                      )}
                      <button
                        onClick={() => onRemoveRecording(rec.id, piece.id)}
                        style={{ background: "none", border: "1px solid var(--border)", borderRadius: 2, cursor: "pointer", color: "var(--muted)", fontSize: "0.6875rem", padding: "0.125rem 0.375rem" }}
                        title="Remove"
                      ><X size={12} strokeWidth={1.5} /></button>
                    </div>
                  </div>
                  {playingRecordingId === rec.id && (
                    <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 3px 3px", overflow: "hidden", background: "#000" }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${rec.youtube_id}?autoplay=1`}
                        title={rec.title}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        style={{ width: "100%", height: 180, border: "none", display: "block" }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <YouTubeSearch
            placeholder="Search and add a recording…"
            onSelect={async (video) => {
              setAddingRecording(true);
              await onAddRecording(piece.id, video);
              setAddingRecording(false);
            }}
          />
          {addingRecording && (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.375rem" }}>{t.goals.adding}</div>
          )}
        </div>
      )}

      {/* Goals */}
      {piece.goals.length > 0 && (
        <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {piece.goals.map(g => (
            <GoalItem
              key={g.id} goal={g} color={color}
              completingGoalId={completingGoalId} togglingGoalId={togglingGoalId}
              onComplete={onCompleteGoal} onToggle={onToggleGoalStatus}
              onDelete={onDeleteGoal} onEdit={onEditGoal}
            />
          ))}
        </div>
      )}

      {/* Add goal form */}
      {addGoalFor === piece.id && (
        <div style={{ padding: "0 0.75rem 0.75rem" }}>
          <GoalForm
            form={goalForm} adding={addingGoal}
            onChange={onGoalFormChange} onSubmit={onAddGoal}
            onCancel={() => onSetAddGoalFor(null)}
          />
        </div>
      )}

      {transcription && (
        <TranscriptionViewer
          title={piece.title}
          game={transcription}
          onClose={() => setTranscription(null)}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function StudentProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const teacher = user as Teacher;
  const router = useRouter();
  const { joinLesson } = useLesson();
  const { t } = useI18n();
  const [startingLesson, setStartingLesson] = useState(false);

  const CATEGORIES = [
    { value: "technique",    label: t.teacher.categoryTechnique,    color: CATEGORY_COLORS.technique },
    { value: "etude",        label: t.teacher.categoryEtude,        color: CATEGORY_COLORS.etude },
    { value: "repertoire",   label: t.teacher.categoryRepertoire,   color: CATEGORY_COLORS.repertoire },
    { value: "theory",       label: t.teacher.categoryTheory,       color: CATEGORY_COLORS.theory },
    { value: "ear_training", label: t.teacher.categoryEarTraining,  color: CATEGORY_COLORS.ear_training },
    { value: "sight_reading",label: t.teacher.categorySightReading, color: CATEGORY_COLORS.sight_reading },
    { value: "free",         label: t.teacher.categoryOther,        color: CATEGORY_COLORS.free },
  ];

  const [student, setStudent] = useState<ProfileRow | null>(null);
  const [pieces, setPieces] = useState<PieceWithGoals[]>([]);
  const [standaloneGoals, setStandaloneGoals] = useState<GoalRow[]>([]);
  const [sessions, setSessions] = useState<PracticeSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [customAward, setCustomAward] = useState("");
  const [awardNote, setAwardNote] = useState("");
  const [awarding, setAwarding] = useState(false);

  // Pre-lesson brief
  const [brief, setBrief] = useState<string | null>(null);
  const [briefStats, setBriefStats] = useState<{ sessionCount: number; totalMinutes: number; lastPracticed: string } | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState(false);
  const [awardError, setAwardError] = useState("");
  const [grantingFreeze, setGrantingFreeze] = useState(false);
  const [freezeSuccess, setFreezeSuccess] = useState(false);

  const [showAddPiece, setShowAddPiece] = useState(false);
  const [pieceForm, setPieceForm] = useState(emptyPieceForm());
  const [addingPiece, setAddingPiece] = useState(false);
  const [sheetFiles, setSheetFiles] = useState<File[]>([]);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPdfFor, setUploadingPdfFor] = useState<string | null>(null);
  const [uploadingScoreFor, setUploadingScoreFor] = useState<string | null>(null);
  const [aiConvertingFor, setAiConvertingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formPasteReady, setFormPasteReady] = useState(false);

  useEffect(() => {
    if (!formPasteReady || !showAddPiece) return;
    function onPaste(e: ClipboardEvent) {
      const imageItem = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) { setSheetFiles(prev => [...prev, file]); }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [formPasteReady, showAddPiece]);

  const [addGoalFor, setAddGoalFor] = useState<string | "standalone" | null>(null);
  const [goalForm, setGoalForm] = useState(emptyGoalForm());
  const [addingGoal, setAddingGoal] = useState(false);

  const [completingGoalId, setCompletingGoalId] = useState<string | null>(null);
  const [togglingGoalId, setTogglingGoalId] = useState<string | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalRow | null>(null);
  const [editGoalForm, setEditGoalForm] = useState<{ title: string; description: string; points: number }>({ title: "", description: "", points: 20 });
  const [savingEditGoal, setSavingEditGoal] = useState(false);
  const [nextLesson, setNextLesson] = useState<LessonRow | null>(null);
  const [studentAssignments, setStudentAssignments] = useState<AssignmentWithContext[]>([]);

  // Quick-assign from student profile
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignMins, setAssignMins] = useState("20");
  const [assignTimesPerWeek, setAssignTimesPerWeek] = useState("5");
  const [assignType, setAssignType] = useState<"practice" | "theory">("practice");
  const [assignGame, setAssignGame] = useState<string | null>(null);
  const [addingAssign, setAddingAssign] = useState(false);

  const THEORY_GAMES = [
    { key: "noteId",      icon: "♪",  label: "Note ID" },
    { key: "interval",    icon: "👂", label: "Intervals" },
    { key: "chord",       icon: "🎼", label: "Chords" },
    { key: "solfege",     icon: "🎤", label: "Sight Singing" },
    { key: "terms",       icon: "🗣", label: "Music Terms" },
    { key: "keySig",      icon: "🔑", label: "Key Sigs" },
    { key: "scale",       icon: "🎶", label: "Scales" },
    { key: "fretboard",   icon: "𝄞",  label: "Fretboard" },
    { key: "guitarChord", icon: "🤘", label: "Guitar Chords" },
  ] as const;

  async function addAssignmentFromProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher?.studioId) return;
    if (assignType === "practice" && !assignTitle.trim()) return;
    if (assignType === "theory" && !assignGame) return;
    setAddingAssign(true);
    try {
      const monday = (() => { const d = new Date(); const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); })();
      const gameLabel = assignType === "theory"
        ? THEORY_GAMES.find(g => g.key === assignGame)?.label ?? "Theory Game"
        : null;
      const assignmentSvc = AssignmentService.create(supabase);
      await assignmentSvc.createAssignment({
        studioId: teacher.studioId,
        studentId: id,
        teacherId: teacher.id,
        title: assignType === "theory" ? (assignTitle.trim() || gameLabel!) : assignTitle.trim(),
        instructions: assignInstructions.trim() || undefined,
        type: assignType,
        theoryGame: assignType === "theory" ? (assignGame ?? undefined) : undefined,
        targetMinutesPerDay: assignType === "practice" ? (Number(assignMins) || undefined) : undefined,
        weekStart: monday,
        timesPerWeek: assignType === "practice" ? (Number(assignTimesPerWeek) || undefined) : undefined,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      });
      setAssignTitle(""); setAssignInstructions(""); setAssignGame(null); setAssignType("practice");
      setShowAssignForm(false);
      // Reload assignments
      const updatedAssigns = await AssignmentService.create(supabase).getAssignmentsWithCompletions(teacher.id, id);
      setStudentAssignments(updatedAssigns);
    } finally {
      setAddingAssign(false);
    }
  }

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles").select("*").eq("id", id).single();
        if (profileErr || !profileData) { setNotFound(true); return; }
        setStudent(profileData as ProfileRow);

        const [studentPieces, sessionData] = await Promise.all([
          PieceService.create(supabase).getStudentPieces(id),
          PracticeService.create(supabase).getStudentSessions(id, 8),
        ]);
        setPieces(studentPieces);
        setSessions(sessionData);

        const { data: sgData } = await supabase
          .from("goals").select("*").eq("student_id", id).eq("teacher_id", teacher.id).is("piece_id", null)
          .order("path_order", { ascending: true });
        setStandaloneGoals((sgData ?? []) as GoalRow[]);

        // Load next lesson + active assignments for pre-lesson report
        const lessonService = LessonService.create(supabase);
        const assignmentService = AssignmentService.create(supabase);
        const [lesson, activeAssignments] = await Promise.all([
          lessonService.getLessonsForStudent(teacher?.id ?? "", id).then(ls => ls.find(l => l.status === "scheduled" && new Date(l.scheduled_at) > new Date()) ?? null),
          assignmentService.getAssignmentsWithCompletions(teacher?.id ?? "", id),
        ]);
        setNextLesson(lesson ?? null);
        setStudentAssignments(activeAssignments);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBrief() {
    if (briefLoading) return;
    setBriefLoading(true);
    setBriefOpen(true);
    try {
      const res = await fetch("/api/practice/pre-lesson-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: id }),
      });
      if (res.ok) {
        const data = await res.json() as { brief: string; stats: { sessionCount: number; totalMinutes: number; lastPracticed: string } };
        setBrief(data.brief);
        setBriefStats(data.stats);
      }
    } catch { /* ignore */ } finally {
      setBriefLoading(false);
    }
  }

  async function handleAward(points: number) {
    if (!student || awarding || points <= 0) return;
    setAwarding(true); setAwardError(""); setAwardSuccess(false);
    try {
      await GoalService.create(supabase).awardPoints(student.id, points);
      if (teacher?.studioId) {
        const note = awardNote.trim() ? ` — "${awardNote.trim()}"` : "";
        await ChatService.create(supabase).postSystemMessage(
          teacher.studioId, teacher.id, student.id,
          `Your teacher awarded you ${points} points!${note}`
        ).catch(() => {});
      }
      setStudent(prev => prev ? { ...prev, total_points: prev.total_points + points } : prev);
      setCustomAward(""); setAwardNote("");
      setAwardSuccess(true);
      setTimeout(() => setAwardSuccess(false), 3000);
    } catch (err) {
      setAwardError((err as { message?: string })?.message ?? "Failed to award points");
    } finally {
      setAwarding(false);
    }
  }

  async function handleGrantFreeze() {
    if (!student || grantingFreeze) return;
    setGrantingFreeze(true);
    try {
      await fetch("/api/student/grant-freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id }),
      });
      setStudent(prev => prev ? { ...prev, streak_freeze_count: (prev.streak_freeze_count ?? 0) + 1 } : prev);
      setFreezeSuccess(true);
      setTimeout(() => setFreezeSuccess(false), 3000);
    } finally {
      setGrantingFreeze(false);
    }
  }

  async function handleCompleteGoal(goal: GoalRow) {
    if (completingGoalId) return;
    setCompletingGoalId(goal.id);
    try {
      await GoalService.create(supabase).completeGoal(goal.id, goal.student_id, goal.points);
      if (teacher?.studioId) {
        await ChatService.create(supabase).postSystemMessage(
          teacher.studioId, teacher.id, goal.student_id,
          `Your teacher marked "${goal.title}" complete — you earned ${goal.points} points!`
        ).catch(() => {});
      }
      setStudent(prev => prev ? { ...prev, total_points: prev.total_points + goal.points } : prev);
      setPieces(prev => prev.map(p => ({ ...p, goals: p.goals.map(g => g.id === goal.id ? { ...g, status: "completed" as const } : g) })));
      setStandaloneGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: "completed" as const } : g));
    } catch (err) {
      console.error("complete goal error:", err);
    } finally {
      setCompletingGoalId(null);
    }
  }

  async function handleToggleGoalStatus(goal: GoalRow) {
    if (togglingGoalId) return;
    const next = goal.status === "locked" ? "current" : "locked";
    setTogglingGoalId(goal.id);
    try {
      await GoalService.create(supabase).updateGoalStatus(goal.id, next);
      setPieces(prev => prev.map(p => ({ ...p, goals: p.goals.map(g => g.id === goal.id ? { ...g, status: next } : g) })));
      setStandaloneGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: next } : g));
    } catch (err) {
      console.error("toggle status error:", err);
    } finally {
      setTogglingGoalId(null);
    }
  }

  async function handleAddPiece(e: React.FormEvent) {
    e.preventDefault();
    if (!pieceForm.title.trim() || !teacher?.studioId) return;
    setAddingPiece(true);
    try {
      const pieceService = PieceService.create(supabase);
      const newPiece = await pieceService.createPiece({
        studentId: id, teacherId: teacher.id, studioId: teacher.studioId,
        title: pieceForm.title.trim(),
        composer: pieceForm.composer.trim() || undefined,
        book: pieceForm.book.trim() || undefined,
        category: pieceForm.category,
      });
      let sheetMusicUrl: string | null = null;
      if (sheetFiles.length > 0) {
        const urls: string[] = [];
        for (let i = 0; i < sheetFiles.length; i++) {
          const file = sheetFiles[i];
          const isImage = file.type.startsWith("image/");
          const ext = file.name.split(".").pop() ?? (isImage ? "jpg" : "pdf");
          const path = sheetFiles.length > 1
            ? `${newPiece.id}/img_${i}.${ext}`
            : isImage ? `${newPiece.id}_img.${ext}` : `${newPiece.id}.pdf`;
          const contentType = isImage ? (file.type || "image/jpeg") : "application/pdf";
          const { error: uploadErr } = await supabase.storage
            .from("sheet-music").upload(path, file, { upsert: true, contentType });
          if (uploadErr) {
            setUploadError(`Upload failed: ${uploadErr.message}. Make sure the 'sheet-music' storage bucket exists in Supabase.`);
            break;
          }
          const { data: urlData } = supabase.storage.from("sheet-music").getPublicUrl(path);
          urls.push(urlData.publicUrl);
        }
        if (urls.length > 0) {
          sheetMusicUrl = urls.length === 1 ? urls[0] : JSON.stringify(urls);
          try {
            await pieceService.updatePiece(newPiece.id, { sheet_music_url: sheetMusicUrl });
          } catch (updateErr) {
            setUploadError(`Piece created but sheet music URL save failed: ${(updateErr as Error).message}. Run the Supabase SQL migration to add the sheet_music_url column.`);
            sheetMusicUrl = null;
          }
        }
      }
      setPieces(prev => [...prev, { ...newPiece, sheet_music_url: sheetMusicUrl, goals: [], recordings: [] }]);
      setPieceForm(emptyPieceForm());
      setSheetFiles([]);
      if (sheetInputRef.current) sheetInputRef.current.value = "";
      setShowAddPiece(false);
    } catch (err) {
      console.error("add piece error:", err);
    } finally {
      setAddingPiece(false);
    }
  }

  async function handleUploadSheetMusic(pieceId: string, files: File[]) {
    setUploadingPdfFor(pieceId);
    setUploadError(null);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith("image/");
        const ext = file.name.split(".").pop() ?? (isImage ? "jpg" : "pdf");
        const path = files.length > 1
          ? `${pieceId}/img_${i}.${ext}`
          : isImage ? `${pieceId}_img.${ext}` : `${pieceId}.pdf`;
        const contentType = isImage ? (file.type || "image/jpeg") : "application/pdf";
        const { error: uploadErr } = await supabase.storage
          .from("sheet-music").upload(path, file, { upsert: true, contentType });
        if (uploadErr) {
          setUploadError(`Upload failed: ${uploadErr.message}. Make sure the 'sheet-music' storage bucket exists.`);
          return;
        }
        const { data: urlData } = supabase.storage.from("sheet-music").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
      const sheetMusicUrl = urls.length === 1 ? urls[0] : JSON.stringify(urls);
      try {
        await PieceService.create(supabase).updatePiece(pieceId, { sheet_music_url: sheetMusicUrl });
        setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, sheet_music_url: sheetMusicUrl } : p));
      } catch (updateErr) {
        setUploadError(`Uploaded but URL save failed: ${(updateErr as Error).message}. Run the Supabase SQL migration.`);
      }
    } catch (err) {
      setUploadError(`Upload error: ${(err as Error).message}`);
    } finally {
      setUploadingPdfFor(null);
    }
  }

  async function handleUploadScore(pieceId: string, file: File) {
    setUploadingScoreFor(pieceId);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() ?? "gp";
      const path = `${pieceId}_score.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("score-files").upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (uploadErr) {
        setUploadError(`Score upload failed: ${uploadErr.message}. Make sure the 'score-files' storage bucket exists in Supabase (public).`);
        return;
      }
      const { data: urlData } = supabase.storage.from("score-files").getPublicUrl(path);
      await PieceService.create(supabase).updatePiece(pieceId, { score_url: urlData.publicUrl });
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, score_url: urlData.publicUrl } : p));
    } catch (err) {
      setUploadError(`Score upload error: ${(err as Error).message}`);
    } finally {
      setUploadingScoreFor(null);
    }
  }

  async function handleAiConvertScore(pieceId: string, file: File) {
    setAiConvertingFor(pieceId);
    setUploadError(null);
    try {
      // Read the image as base64
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = file.type || "image/png";

      const res = await fetch("/api/score-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setUploadError(`AI conversion failed: ${json.error ?? "Unknown error"}`);
        return;
      }

      // Upload the returned MusicXML to Supabase
      const xmlBlob = new Blob([json.musicxml], { type: "application/xml" });
      const path = `${pieceId}_score.xml`;
      const { error: uploadErr } = await supabase.storage
        .from("score-files").upload(path, xmlBlob, { upsert: true, contentType: "application/xml" });
      if (uploadErr) {
        setUploadError(`Upload failed: ${uploadErr.message}`);
        return;
      }
      const { data: urlData } = supabase.storage.from("score-files").getPublicUrl(path);
      await PieceService.create(supabase).updatePiece(pieceId, { score_url: urlData.publicUrl });
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, score_url: urlData.publicUrl } : p));
    } catch (err) {
      setUploadError(`AI conversion error: ${(err as Error).message}`);
    } finally {
      setAiConvertingFor(null);
    }
  }

  async function handleAddRecording(pieceId: string, video: YouTubeResult) {
    const svc = PieceService.create(supabase);
    const currentPiece = pieces.find(p => p.id === pieceId);
    const isPrimary = !currentPiece || currentPiece.recordings.length === 0;
    try {
      const rec = await svc.addRecording(pieceId, video, teacher.id, isPrimary);
      setPieces(prev => prev.map(p => {
        if (p.id !== pieceId) return p;
        const updated = isPrimary
          ? p.recordings.map(r => ({ ...r, is_primary: false }))
          : p.recordings;
        return { ...p, recordings: [...updated, rec] };
      }));
    } catch (err) {
      console.error("add recording error:", err);
    }
  }

  async function handleRemoveRecording(recordingId: string, pieceId: string) {
    try {
      await PieceService.create(supabase).removeRecording(recordingId);
      setPieces(prev => prev.map(p => {
        if (p.id !== pieceId) return p;
        const remaining = p.recordings.filter(r => r.id !== recordingId);
        // If we removed the primary and there are others, set first as primary
        if (remaining.length > 0 && !remaining.some(r => r.is_primary)) {
          remaining[0] = { ...remaining[0], is_primary: true };
        }
        return { ...p, recordings: remaining };
      }));
    } catch (err) {
      console.error("remove recording error:", err);
    }
  }

  async function handleSetPrimaryRecording(recordingId: string, pieceId: string) {
    try {
      await PieceService.create(supabase).setPrimaryRecording(pieceId, recordingId);
      setPieces(prev => prev.map(p => {
        if (p.id !== pieceId) return p;
        return { ...p, recordings: p.recordings.map(r => ({ ...r, is_primary: r.id === recordingId })) };
      }));
    } catch (err) {
      console.error("set primary error:", err);
    }
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalForm.title.trim() || !teacher?.studioId || !addGoalFor) return;
    setAddingGoal(true);
    try {
      const pieceId = addGoalFor === "standalone" ? undefined : addGoalFor;
      const practiceArea = pieceId ? (pieces.find(p => p.id === pieceId)?.category ?? "repertoire") : "free";
      const newGoal = await GoalService.create(supabase).createGoal({
        studioId: teacher.studioId, studentId: id, teacherId: teacher.id,
        title: goalForm.title.trim(),
        description: goalForm.description.trim() || undefined,
        practiceArea, points: goalForm.points,
        targetMinutesPerDay: goalForm.minutesPerDay ? parseInt(goalForm.minutesPerDay) : undefined,
        pieceId, initialStatus: goalForm.status,
      });
      if (pieceId) {
        setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, goals: [...p.goals, newGoal] } : p));
      } else {
        setStandaloneGoals(prev => [...prev, newGoal]);
      }
      setGoalForm(emptyGoalForm());
      setAddGoalFor(null);
    } catch (err) {
      console.error("add goal error:", err);
    } finally {
      setAddingGoal(false);
    }
  }

  async function handleDeleteGoal(goal: GoalRow) {
    if (!confirm(`Delete goal "${goal.title}"? This cannot be undone.`)) return;
    setDeletingGoalId(goal.id);
    try {
      await GoalService.create(supabase).deleteGoal(goal.id);
      setPieces(prev => prev.map(p => ({
        ...p,
        goals: p.goals.filter(g => g.id !== goal.id),
      })));
      setStandaloneGoals(prev => prev.filter(g => g.id !== goal.id));
    } catch (err) {
      alert(`Could not delete goal: ${err instanceof Error ? err.message : "Unknown error"}. You may need to run the goals RLS migration in Supabase.`);
    } finally {
      setDeletingGoalId(null);
    }
  }

  function handleStartEditGoal(goal: GoalRow) {
    setEditingGoal(goal);
    setEditGoalForm({ title: goal.title, description: goal.description ?? "", points: goal.points });
  }

  async function handleSaveEditGoal() {
    if (!editingGoal) return;
    setSavingEditGoal(true);
    try {
      await GoalService.create(supabase).updateGoal(editingGoal.id, {
        title: editGoalForm.title,
        description: editGoalForm.description || undefined,
        points: editGoalForm.points,
      });
      const updated = { ...editingGoal, ...editGoalForm, description: editGoalForm.description || null };
      setPieces(prev => prev.map(p => ({
        ...p,
        goals: p.goals.map(g => g.id === editingGoal.id ? updated : g),
      })));
      setStandaloneGoals(prev => prev.map(g => g.id === editingGoal.id ? updated : g));
      setEditingGoal(null);
    } finally {
      setSavingEditGoal(false);
    }
  }

  async function handleStartLesson() {
    if (!student || !teacher?.studioId || startingLesson) return;
    setStartingLesson(true);
    try {
      const res = await fetch("/api/lesson/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          studioId: teacher.studioId,
          studentName: student.display_name,
        }),
      });
      const data = await res.json() as { roomId?: string; roomUrl?: string; error?: string };
      if (!data.roomId || !data.roomUrl) {
        alert(data.error ?? "Could not start lesson");
        return;
      }
      // Get token for teacher
      const tokenRes = await fetch("/api/lesson/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: data.roomId }),
      });
      const tokenData = await tokenRes.json() as { token?: string; error?: string };
      if (!tokenData.token) {
        alert(tokenData.error ?? "Could not get lesson token");
        return;
      }
      await joinLesson({
        roomId: data.roomId,
        roomUrl: data.roomUrl,
        token: tokenData.token,
        studentName: student.display_name,
      });
      router.push(`/lesson/${data.roomId}`);
    } catch (err) {
      console.error("Start lesson error:", err);
      alert("Could not start lesson. Please try again.");
    } finally {
      setStartingLesson(false);
    }
  }

  const allGoals = [...pieces.flatMap(p => p.goals), ...standaloneGoals];
  const completedCount = allGoals.filter(g => g.status === "completed").length;
  const pct = allGoals.length > 0 ? Math.round((completedCount / allGoals.length) * 100) : 0;
  const initials = student ? student.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "?";

  const groupedPieces = SECTION_ORDER
    .map(cat => ({
      cat,
      label: CATEGORIES.find(c => c.value === cat)!.label,
      color: CATEGORIES.find(c => c.value === cat)!.color,
      items: pieces.filter(p => p.category === cat),
    }))
    .filter(g => g.items.length > 0);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: i === 1 ? 60 : 140, borderRadius: 4 }} />)}
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="empty-state" style={{ padding: "3rem 0" }}>
        <div className="empty-state-title">{t.teacher.studentNotFound}</div>
        <Link href="/teacher" style={{ marginTop: "1rem", display: "inline-block", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", textDecoration: "underline" }}>{t.teacher.backToDashboard}</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/teacher" style={{ color: "var(--muted)", textDecoration: "none", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>← {t.common.back}</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flex: 1 }}>
          <div style={{ width: 44, height: 44, background: "var(--charcoal)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--white)", flexShrink: 0, letterSpacing: "0.02em" }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "1.125rem", color: "var(--charcoal)", margin: 0, letterSpacing: "-0.01em" }}>
              {student.display_name}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "0.125rem 0 0", fontFamily: "Inter, sans-serif" }}>
              {pieces.length} piece{pieces.length !== 1 ? "s" : ""} · {allGoals.length} goals · {pct}% done
            </p>
          </div>
        </div>
        <button
          onClick={handleStartLesson}
          disabled={startingLesson}
          style={{
            padding: "0.5rem 0.875rem", borderRadius: 3, border: "none",
            background: "var(--charcoal)", color: "var(--white)",
            fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem",
            cursor: startingLesson ? "default" : "pointer", opacity: startingLesson ? 0.6 : 1,
            whiteSpace: "nowrap", letterSpacing: "0.01em", flexShrink: 0,
          }}
        >
          {startingLesson ? t.teacher.startingLesson : t.teacher.startLesson}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
        {[
          { value: student.total_points.toLocaleString(), label: t.teacher.statPoints, icon: null },
          { value: student.streak_days, label: t.teacher.statDayStreak, icon: student.streak_days > 0 ? <Flame size={18} fill="#E6A817" color="#E6A817" strokeWidth={0} /> : null },
          { value: `${pct}%`, label: t.teacher.statGoalsDone, icon: null },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem", textAlign: "center" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.75rem", color: "var(--charcoal)", letterSpacing: "-0.02em", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
              {stat.icon}{stat.value}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links to sub-pages */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.625rem" }}>
        {[
          { label: t.teacher.lessonLog, href: `/teacher/student/${id}/lesson/log`, icon: <Clipboard size={20} strokeWidth={1.5} /> },
          { label: t.teacher.rcmPrep, href: `/teacher/student/${id}/rcm`, icon: <BookOpen size={20} strokeWidth={1.5} /> },
          { label: t.teacher.reports, href: `/teacher/student/${id}/reports`, icon: <FileText size={20} strokeWidth={1.5} /> },
          { label: t.teacher.billing, href: `/teacher/billing/${id}`, icon: <CreditCard size={20} strokeWidth={1.5} /> },
          { label: "History", href: `/teacher/student/${id}/history`, icon: <Star size={20} strokeWidth={1.5} /> },
        ].map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "0.375rem", padding: "0.875rem 0.5rem",
              background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4,
              textDecoration: "none", color: "var(--charcoal)",
            }}
          >
            <span style={{ fontSize: "1.125rem" }}>{link.icon}</span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.02em" }}>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Pre-lesson AI brief */}
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <button
          onClick={() => briefOpen ? setBriefOpen(false) : loadBrief()}
          style={{
            width: "100%", background: "none", border: "none", cursor: "pointer",
            padding: "0.875rem 1.125rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Bot size={18} strokeWidth={1.5} color="var(--muted)" />
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>
                {t.teacher.preLessonBrief}
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
                {briefStats ? t.teacher.briefStats.replace("{n}", String(briefStats.sessionCount)).replace("{m}", String(briefStats.totalMinutes)) : t.teacher.aiSummaryPractice}
              </div>
            </div>
          </div>
          <span style={{ color: "var(--muted)" }}>
            {briefLoading ? "…" : briefOpen ? <ChevronUp size={16} strokeWidth={1.5} /> : <ChevronDown size={16} strokeWidth={1.5} />}
          </span>
        </button>

        {briefOpen && (
          <div style={{ padding: "0 1.125rem 1rem", borderTop: "1px solid var(--border)" }}>
            {briefLoading ? (
              <div style={{ paddingTop: "0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                {t.teacher.generatingBrief}
              </div>
            ) : brief ? (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.7, margin: "0.875rem 0 0" }}>
                {brief}
              </p>
            ) : (
              <div style={{ paddingTop: "0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                {t.teacher.briefError}
              </div>
            )}
            {brief && (
              <button
                onClick={() => { setBrief(null); setBriefStats(null); loadBrief(); }}
                style={{ marginTop: "0.75rem", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", padding: 0, textDecoration: "underline" }}
              >
                {t.teacher.refresh}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upcoming lesson + pre-lesson report */}
      <div style={{ display: "grid", gridTemplateColumns: nextLesson ? "1fr 1fr" : "1fr", gap: "0.75rem" }}>

        {/* Next lesson */}
        {nextLesson && (
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem 1.25rem" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 0.625rem" }}>
              {t.schedule.nextLessonLabel}
            </p>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)" }}>
              {new Date(nextLesson.scheduled_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              {new Date(nextLesson.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {nextLesson.duration_minutes} {t.schedule.min}
            </div>
            {nextLesson.lesson_notes && (
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.625rem", padding: "0.5rem 0.75rem", background: "var(--cream)", borderRadius: 3, fontStyle: "italic" }}>
                {t.schedule.lastLesson}: {nextLesson.lesson_notes}
              </div>
            )}
          </div>
        )}

        {/* Active assignments */}
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
              {t.teacher.thisWeeksAssignments}
              {studentAssignments.length > 0 && (
                <span style={{ marginLeft: "0.5rem", fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.6875rem" }}>
                  {t.teacher.assignmentCompletion.replace("{done}", String(studentAssignments.filter(a => a.completion).length)).replace("{total}", String(studentAssignments.length))}
                </span>
              )}
            </p>
            <button onClick={() => setShowAssignForm(v => !v)}
              style={{ padding: "0.2rem 0.625rem", borderRadius: 3, border: "1px solid var(--border-strong)", background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", cursor: "pointer" }}>
              + Add
            </button>
          </div>

          {showAssignForm && (() => {
            const INP: React.CSSProperties = { width: "100%", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--white)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" };
            return (
              <form onSubmit={addAssignmentFromProfile} style={{ background: "var(--cream)", borderRadius: 3, padding: "0.75rem", marginBottom: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  {(["practice", "theory"] as const).map(tp => (
                    <button key={tp} type="button" onClick={() => { setAssignType(tp); setAssignGame(null); }}
                      style={{ flex: 1, padding: "0.35rem", borderRadius: 3, border: "1px solid", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500, borderColor: assignType === tp ? "var(--charcoal)" : "var(--border-strong)", background: assignType === tp ? "var(--charcoal)" : "none", color: assignType === tp ? "var(--white)" : "var(--muted)", transition: "all 0.15s" }}>
                      {tp === "practice" ? "Practice" : "Theory Game"}
                    </button>
                  ))}
                </div>
                {assignType === "practice" ? (
                  <>
                    <input required value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="Assignment (e.g. Bars 1–16, slow)" style={INP} />
                    <input value={assignInstructions} onChange={e => setAssignInstructions(e.target.value)} placeholder="Instructions (optional)" style={INP} />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Min/day</label>
                        <input type="number" min="1" value={assignMins} onChange={e => setAssignMins(e.target.value)} style={INP} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Times/week</label>
                        <input type="number" min="1" max="7" value={assignTimesPerWeek} onChange={e => setAssignTimesPerWeek(e.target.value)} style={INP} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.375rem" }}>
                      {THEORY_GAMES.map(g => (
                        <button key={g.key} type="button" onClick={() => setAssignGame(g.key)}
                          style={{ padding: "0.4rem 0.25rem", borderRadius: 3, border: "1.5px solid", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 500, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem", borderColor: assignGame === g.key ? "var(--charcoal)" : "var(--border-strong)", background: assignGame === g.key ? "var(--charcoal)" : "none", color: assignGame === g.key ? "var(--white)" : "var(--charcoal)", transition: "all 0.12s" }}>
                          <span style={{ fontSize: "1rem", lineHeight: 1 }}>{g.icon}</span>
                          {g.label}
                        </button>
                      ))}
                    </div>
                    <input value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="Custom title (optional)" style={INP} />
                    <input value={assignInstructions} onChange={e => setAssignInstructions(e.target.value)} placeholder="Instructions (optional)" style={INP} />
                  </>
                )}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="submit" disabled={addingAssign || (assignType === "theory" && !assignGame)}
                    style={{ flex: 1, padding: "0.5rem", borderRadius: 3, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", opacity: (addingAssign || (assignType === "theory" && !assignGame)) ? 0.4 : 1 }}>
                    {addingAssign ? "Saving…" : "Add Assignment"}
                  </button>
                  <button type="button" onClick={() => { setShowAssignForm(false); setAssignType("practice"); setAssignGame(null); }}
                    style={{ padding: "0.5rem 0.875rem", borderRadius: 3, border: "1px solid var(--border-strong)", background: "none", color: "var(--charcoal)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </form>
            );
          })()}

          {studentAssignments.length === 0 && !showAssignForm && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>No assignments this week.</p>
          )}
          {studentAssignments.map(a => {
            const RATING_COLORS: Record<string, string> = { struggling: "#dc2626", getting_there: "#d97706", nailed_it: "#16a34a" };
            const RATING_ICON: Record<string, React.ReactNode> = { struggling: <Frown size={14} strokeWidth={1.5} />, getting_there: <Smile size={14} strokeWidth={1.5} />, nailed_it: <PartyPopper size={14} strokeWidth={1.5} /> };
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: a.completion ? "#16a34a" : "var(--border-strong)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.title}
                  </div>
                  {a.piece_title && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>
                      {a.piece_title}{a.focus ? ` · ${a.focus}` : ""}
                    </div>
                  )}
                </div>
                {a.completion?.self_rating && (
                  <span style={{ color: RATING_COLORS[a.completion.self_rating], flexShrink: 0, display: "inline-flex" }}>
                    {RATING_ICON[a.completion.self_rating]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main layout */}
      <div className="r-two-col" style={{ gridTemplateColumns: "1fr 280px" }}>

        {/* Left: Pieces + Sessions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Pieces & Goals */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.25rem" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {t.teacher.repertoireGoals}
              </span>
              <button
                onClick={() => { setShowAddPiece(v => !v); setPieceForm(emptyPieceForm()); }}
                style={{ ...ghostBtnStyle, padding: "0.3rem 0.6rem", fontSize: "0.6875rem" }}
              >
                {t.teacher.addPiece}
              </button>
            </div>

            {/* Upload error banner */}
            {uploadError && (
              <div style={{
                marginBottom: "1rem", padding: "0.75rem 1rem", background: "#fff0f0",
                border: "1px solid #f5c6c6", borderRadius: 4, display: "flex",
                alignItems: "flex-start", gap: "0.625rem",
              }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#c0392b", flex: 1, lineHeight: 1.5 }}>
                  {uploadError}
                </span>
                <button onClick={() => setUploadError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c0392b", lineHeight: 1, padding: 0, flexShrink: 0 }}><X size={14} strokeWidth={1.5} /></button>
              </div>
            )}

            {/* Add piece form */}
            {showAddPiece && (
              <form onSubmit={handleAddPiece} style={{ marginBottom: "1.25rem", padding: "1rem", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 4, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>{t.teacher.newPiece}</div>
                <input required value={pieceForm.title} onChange={e => setPieceForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g. Waltz in A minor)" style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <input value={pieceForm.composer} onChange={e => setPieceForm(f => ({ ...f, composer: e.target.value }))} placeholder="Composer (optional)" style={inputStyle} />
                  <input value={pieceForm.book} onChange={e => setPieceForm(f => ({ ...f, book: e.target.value }))} placeholder="Book / collection" style={inputStyle} />
                </div>
                <select value={pieceForm.category} onChange={e => setPieceForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <div>
                  <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                    {t.pieces.uploadSheetMusic}
                  </label>
                  <input
                    ref={sheetInputRef}
                    type="file"
                    accept=".pdf,application/pdf,image/*"
                    multiple
                    onChange={e => setSheetFiles(Array.from(e.target.files ?? []))}
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setFormPasteReady(v => !v)}
                    style={{
                      marginTop: "0.375rem", display: "inline-flex", alignItems: "center", gap: "0.25rem",
                      background: formPasteReady ? "var(--charcoal)" : "none",
                      color: formPasteReady ? "var(--white)" : "var(--muted)",
                      border: `1px solid ${formPasteReady ? "var(--charcoal)" : "var(--border)"}`,
                      borderRadius: 2, padding: "0.25rem 0.625rem",
                      fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", cursor: "pointer",
                    }}
                  >
                    {formPasteReady
                      ? sheetFiles.length > 0 ? `${sheetFiles.length} pasted — paste more or click to stop` : "Ready — Ctrl+V / ⌘V"
                      : <><Clipboard size={12} strokeWidth={1.5} /> Paste screenshots</>}
                  </button>
                  {sheetFiles.length > 0 && (
                    <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {sheetFiles.length === 1
                        ? <><FileText size={12} strokeWidth={1.5} style={{ verticalAlign: "middle" }} /> {sheetFiles[0].name}</>
                        : <><Image size={12} strokeWidth={1.5} style={{ verticalAlign: "middle" }} /> {sheetFiles.length} images selected</>}
                      <button type="button" onClick={() => setSheetFiles([])} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, lineHeight: 1 }}><X size={12} strokeWidth={1.5} /></button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="submit" disabled={addingPiece || !pieceForm.title.trim()} style={{ ...primaryBtnStyle, flex: 1, opacity: addingPiece || !pieceForm.title.trim() ? 0.5 : 1 }}>
                    {addingPiece ? t.goals.adding : t.teacher.addPieceButton}
                  </button>
                  <button type="button" onClick={() => { setShowAddPiece(false); setSheetFiles([]); setFormPasteReady(false); }} style={ghostBtnStyle}>{t.common.cancel}</button>
                </div>
              </form>
            )}

            {pieces.length === 0 && standaloneGoals.length === 0 && !showAddPiece ? (
              <div className="empty-state">
                <div className="empty-state-title">{t.teacher.noPiecesYet}</div>
                <p className="empty-state-desc">{t.teacher.noPiecesDesc.replace("{btn}", t.teacher.addPiece)}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
                {groupedPieces.map(section => (
                  <div key={section.cat}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: section.color }} />
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted)" }}>
                        {section.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {section.items.map(piece => (
                        <PieceBlock
                          key={piece.id}
                          piece={piece} color={section.color} studentId={id}
                          addGoalFor={addGoalFor} goalForm={goalForm} addingGoal={addingGoal}
                          completingGoalId={completingGoalId} togglingGoalId={togglingGoalId}
                          uploadingPdf={uploadingPdfFor === piece.id}
                          uploadingScore={uploadingScoreFor === piece.id}
                          aiConverting={aiConvertingFor === piece.id}
                          onSetAddGoalFor={v => { setAddGoalFor(v); setGoalForm(emptyGoalForm()); }}
                          onGoalFormChange={setGoalForm}
                          onAddGoal={handleAddGoal}
                          onCompleteGoal={handleCompleteGoal}
                          onToggleGoalStatus={handleToggleGoalStatus}
                          onUploadSheetMusic={handleUploadSheetMusic}
                          onUploadScore={handleUploadScore}
                          onAiConvertScore={handleAiConvertScore}
                          onAddRecording={handleAddRecording}
                          onRemoveRecording={handleRemoveRecording}
                          onSetPrimaryRecording={handleSetPrimaryRecording}
                          onDeleteGoal={handleDeleteGoal}
                          onEditGoal={handleStartEditGoal}
                          deletingGoalId={deletingGoalId}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Standalone goals */}
                {standaloneGoals.length > 0 && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--border-strong)" }} />
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted)" }}>{t.teacher.otherGoals}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {standaloneGoals.map(g => (
                        <GoalItem key={g.id} goal={g} color="var(--muted)"
                          completingGoalId={completingGoalId} togglingGoalId={togglingGoalId}
                          onComplete={handleCompleteGoal} onToggle={handleToggleGoalStatus}
                          onDelete={handleDeleteGoal} onEdit={handleStartEditGoal}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {addGoalFor === "standalone" ? (
                  <GoalForm form={goalForm} adding={addingGoal} onChange={setGoalForm} onSubmit={handleAddGoal} onCancel={() => setAddGoalFor(null)} />
                ) : (
                  <button onClick={() => { setAddGoalFor("standalone"); setGoalForm(emptyGoalForm()); }} style={{ ...ghostBtnStyle, fontSize: "0.75rem", width: "fit-content" }}>
                    {t.teacher.addStandaloneGoal}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.25rem" }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
              {t.teacher.recentSessions.replace("{n}", String(sessions.length))}
            </div>
            {sessions.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">{t.teacher.noSessionsYetLabel}</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {sessions.map(s => {
                  const mins = Math.max(1, Math.round(s.duration_seconds / 60));
                  return (
                    <Link key={s.id} href={`/teacher/review/${s.id}`}
                      style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.75rem", borderRadius: 3, textDecoration: "none", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--cream)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>{mins} {t.schedule.min}{s.recording_url ? " · rec" : ""}</div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.125rem" }}>{timeAgo(s.created_at, t.schedule.yesterday)}</div>
                      </div>
                      <span style={{ color: "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500 }}>{t.teacher.reviewArrow}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Award Points */}
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 4, padding: "1.25rem", alignSelf: "start" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
            {t.teacher.awardPoints}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem", marginBottom: "1rem" }}>
            {PRESET_AWARDS.map(pts => (
              <button key={pts} onClick={() => handleAward(pts)} disabled={awarding} style={{ padding: "0.625rem", borderRadius: 3, border: "1px solid var(--border-strong)", background: "var(--cream)", color: "var(--charcoal)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", cursor: awarding ? "default" : "pointer", opacity: awarding ? 0.5 : 1, transition: "all 0.15s", letterSpacing: "0.01em" }}>
                +{pts}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.75rem" }}>
            <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>{t.teacher.customAmount}</label>
            <input type="number" min="1" max="9999" value={customAward} onChange={e => setCustomAward(e.target.value)} placeholder="e.g. 15" style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.875rem" }}>
            <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", letterSpacing: "0.02em" }}>{t.teacher.noteOptional}</label>
            <input type="text" value={awardNote} onChange={e => setAwardNote(e.target.value)} placeholder="Great work on your recital!" style={inputStyle} />
          </div>
          <button
            onClick={() => { const pts = parseInt(customAward, 10); if (!isNaN(pts) && pts > 0) handleAward(pts); }}
            disabled={awarding || !customAward || parseInt(customAward, 10) <= 0}
            style={{ width: "100%", padding: "0.625rem", borderRadius: 3, border: "none", background: awardSuccess ? "var(--sage)" : !customAward || parseInt(customAward, 10) <= 0 ? "var(--border)" : "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", cursor: awarding || !customAward ? "default" : "pointer", transition: "background 0.15s", letterSpacing: "0.01em" }}
          >
            {awardSuccess ? t.teacher.awarded : awarding ? t.teacher.awarding : t.teacher.awardCustomPoints}
          </button>
          {awardError && (
            <div style={{ marginTop: "0.5rem", background: "var(--cream-deep)", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "var(--charcoal)", fontFamily: "Inter, sans-serif" }}>{awardError}</div>
          )}
          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            {t.teacher.pointsNotification.replace("{name}", student.display_name.split(" ")[0])}
          </p>

          {/* Grant streak freeze */}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: "1rem", paddingTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--charcoal)", fontWeight: 500 }}>
                Streak freezes
              </span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--sky)" }}>
                <Snowflake size={11} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                {student.streak_freeze_count ?? 0} banked
              </span>
            </div>
            <button
              onClick={handleGrantFreeze}
              disabled={grantingFreeze}
              style={{ width: "100%", padding: "0.5rem", borderRadius: 3, border: "1px solid var(--border-strong)", background: freezeSuccess ? "var(--sky-bg, #EBF5FB)" : "none", color: freezeSuccess ? "var(--sky)" : "var(--muted)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", cursor: grantingFreeze ? "default" : "pointer", opacity: grantingFreeze ? 0.5 : 1, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
            >
              <Snowflake size={13} strokeWidth={1.5} />
              {freezeSuccess ? "Freeze granted!" : grantingFreeze ? "Granting…" : "Grant streak freeze"}
            </button>
            <p style={{ marginTop: "0.375rem", fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
              Protects their streak if they miss a day.
            </p>
          </div>
        </div>
      </div>

      {/* Edit goal modal */}
      {editingGoal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={e => { if (e.target === e.currentTarget) setEditingGoal(null); }}
        >
          <div style={{ background: "var(--white)", borderRadius: 4, padding: "1.5rem", width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)", margin: "0 0 1.25rem" }}>Edit Goal</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                value={editGoalForm.title}
                onChange={e => setEditGoalForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Goal title"
                style={{ padding: "0.5rem 0.625rem", borderRadius: 3, border: "1px solid var(--border-strong)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", outline: "none" }}
              />
              <textarea
                value={editGoalForm.description}
                onChange={e => setEditGoalForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Instructions (optional)"
                rows={3}
                style={{ padding: "0.5rem 0.625rem", borderRadius: 3, border: "1px solid var(--border-strong)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", resize: "vertical", outline: "none" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>Points</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={editGoalForm.points}
                  onChange={e => setEditGoalForm(f => ({ ...f, points: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={{ width: 70, padding: "0.375rem 0.5rem", borderRadius: 3, border: "1px solid var(--border-strong)", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", outline: "none" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.625rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditingGoal(null)}
                style={{ ...ghostBtnStyle, padding: "0.5rem 1rem" }}
              >Cancel</button>
              <button
                onClick={handleSaveEditGoal}
                disabled={!editGoalForm.title.trim() || savingEditGoal}
                style={{ ...primaryBtnStyle, padding: "0.5rem 1rem", opacity: savingEditGoal || !editGoalForm.title.trim() ? 0.6 : 1 }}
              >
                {savingEditGoal ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
