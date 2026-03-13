"use client";
import React, { useEffect, useRef, useState } from "react";
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

function groupByMonth(items: PortfolioItemRow[]): { label: string; items: PortfolioItemRow[] }[] {
  const groups: Map<string, PortfolioItemRow[]> = new Map();
  for (const item of items) {
    const d = new Date(item.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([, items]) => ({
    label: new Date(items[0].created_at).toLocaleDateString([], { year: "numeric", month: "long" }),
    items,
  }));
}

const SETUP_SQL = `-- Run this in your Supabase SQL editor:
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'audio',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instrument TEXT,
  ADD COLUMN IF NOT EXISTS music_since TEXT;

-- Allow studio members to see public covers
CREATE POLICY IF NOT EXISTS "Studio members see public covers"
  ON public.portfolio_items FOR SELECT
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.studio_id = portfolio_items.studio_id
    )
  );`;

type ProfileData = {
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  instrument: string | null;
  music_since: string | null;
  streak_days: number;
  total_points: number;
};

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
  const [togglingPublicId, setTogglingPublicId] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editInstrument, setEditInstrument] = useState("");
  const [editSince, setEditSince] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Video cover modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [coverTab, setCoverTab] = useState<"upload" | "record">("upload");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [sharePublic, setSharePublic] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-app recording
  const [recordMode, setRecordMode] = useState<"video" | "audio">("video");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordError, setRecordError] = useState("");
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!student?.id) return;
      const supabase = getSupabaseBrowserClient();
      try {
        const data = await PortfolioService.create(supabase).getItems(student.id);
        setItems(data);
      } catch (err) {
        const e = err as { message?: string; code?: string };
        if (e?.message?.includes("portfolio_items") || e?.code === "42P01") setNoTable(true);
        console.error("portfolio load error:", e?.message);
      } finally {
        setLoading(false);
      }
      // Load profile data
      try {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, bio, instrument, music_since, streak_days, total_points")
          .eq("id", student.id)
          .single();
        if (p) {
          const pd = p as ProfileData & { instrument?: string | null; music_since?: string | null };
          setProfile({ ...pd, instrument: pd.instrument ?? null, music_since: pd.music_since ?? null });
          setAvatarUrl(pd.avatar_url ?? null);
        }
      } catch { /* profile fields may not exist yet */ }
      // Load follower/following counts
      try {
        const [{ count: fc }, { count: ing }] = await Promise.all([
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", student.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", student.id),
        ]);
        setFollowerCount(fc ?? 0);
        setFollowingCount(ing ?? 0);
      } catch { /* follows table may not exist */ }
    };
    load();
  }, [student?.id]);

  async function saveProfile() {
    if (!student?.id || savingProfile) return;
    setSavingProfile(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from("profiles").update({
        display_name: editName.trim() || profile?.display_name,
        bio: editBio.trim() || null,
        instrument: editInstrument.trim() || null,
        music_since: editSince.trim() || null,
      }).eq("id", student.id);
      setProfile(prev => prev ? { ...prev, display_name: editName.trim() || prev.display_name, bio: editBio.trim() || null, instrument: editInstrument.trim() || null, music_since: editSince.trim() || null } : prev);
      setEditingProfile(false);
    } finally { setSavingProfile(false); }
  }

  async function handleAvatarChange(file: File) {
    if (!student?.id) return;
    const supabase = getSupabaseBrowserClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${student.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", student.id);
      setAvatarUrl(publicUrl);
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev);
    }
  }

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
      await PortfolioService.create(supabase).updateItem(id, {
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
    if (!confirm("Remove this from your journey?")) return;
    setDeletingId(id);
    try {
      const supabase = getSupabaseBrowserClient();
      await PortfolioService.create(supabase).deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error("delete error:", err);
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePublic(item: PortfolioItemRow) {
    if (togglingPublicId) return;
    setTogglingPublicId(item.id);
    const newVal = !item.is_public;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_public: newVal } : i));
    try {
      const supabase = getSupabaseBrowserClient();
      await PortfolioService.create(supabase).updateItem(item.id, { is_public: newVal });
    } catch {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_public: item.is_public } : i));
    } finally {
      setTogglingPublicId(null);
    }
  }

  async function startRecording() {
    setRecordError("");
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordSeconds(0);
    try {
      const constraints = recordMode === "audio"
        ? { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, sampleRate: 48000 } }
        : {
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000, channelCount: 2 },
            video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      recordStreamRef.current = stream;
      if (recordMode === "video" && liveVideoRef.current) { liveVideoRef.current.srcObject = stream; }

      const mimeType = recordMode === "audio"
        ? (["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(m => MediaRecorder.isTypeSupported(m)) ?? "")
        : (["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(m => MediaRecorder.isTypeSupported(m)) ?? "");

      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 256000,
        ...(recordMode === "video" ? { videoBitsPerSecond: 8000000 } : {}),
      });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        const type = recordMode === "audio" ? (mimeType || "audio/webm") : (mimeType || "video/webm");
        const blob = new Blob(chunksRef.current, { type });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach(t => t.stop());
        if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setRecordError(recordMode === "audio"
        ? "Mic access denied. Check your browser permissions."
        : "Camera/mic access denied. Check your browser permissions.");
    }
  }

  function stopRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function discardRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
  }

  function closeModal() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (recording) { mediaRecorderRef.current?.stop(); recordStreamRef.current?.getTracks().forEach(t => t.stop()); setRecording(false); }
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null); setRecordedUrl(null); setRecordError(""); setRecordSeconds(0); setRecordMode("video");
    setUploadFile(null); setUploadError(""); setUploadTitle(""); setUploadDesc(""); setSharePublic(false);
    setShowUploadModal(false);
  }

  async function handleVideoUpload() {
    const fileToUpload = coverTab === "record"
      ? (recordedBlob ? new File([recordedBlob], `recording-${Date.now()}.webm`, { type: recordedBlob.type || "video/webm" }) : null)
      : uploadFile;
    if (!fileToUpload || !uploadTitle.trim() || uploading) return;
    if (!student?.id) return;
    setUploading(true);
    setUploadError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = fileToUpload.name.split(".").pop() ?? "mp4";
      const path = `covers/${student.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("practice-recordings")
        .upload(path, fileToUpload, { contentType: fileToUpload.type, upsert: false });
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from("practice-recordings").getPublicUrl(path);
      const item = await PortfolioService.create(supabase).addItem({
        studentId: student.id,
        studioId: student.studioId ?? undefined,
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || undefined,
        recordingUrl: urlData.publicUrl,
        mediaType: coverTab === "record" ? recordMode : "video",
        isPublic: sharePublic,
      });
      setItems(prev => [item, ...prev]);
      closeModal();
    } catch (err) {
      setUploadError((err as { message?: string })?.message ?? "Upload failed");
    } finally {
      setUploading(false);
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
        <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.75rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>My Profile</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginBottom: "1.5rem", fontFamily: "Inter, sans-serif" }}>Your musical story, one recording at a time</p>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.5rem" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
            One-time setup needed
          </div>
          <pre style={{ background: "var(--cream-deep)", border: "1px solid var(--border)", borderRadius: 6, padding: "1rem", fontSize: "0.7rem", fontFamily: "monospace", color: "var(--charcoal)", overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{SETUP_SQL}</pre>
        </div>
      </div>
    );
  }

  const monthGroups = groupByMonth(items);
  const publicClipCount = items.filter(i => i.is_public).length;
  const initials = (profile?.display_name ?? student?.displayName ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100%", background: "var(--cream)" }}>

      {/* ── Profile header ── */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "1.25rem 1rem 1rem" }}>

        {/* Avatar + name row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "1rem" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              onClick={() => avatarInputRef.current?.click()}
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background: avatarUrl ? "transparent" : "var(--charcoal)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.125rem", fontWeight: 600, color: "var(--white)",
                fontFamily: "Inter, sans-serif", cursor: "pointer", overflow: "hidden",
                border: "1.5px solid var(--border)",
              }}
            >
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: "50%", background: "var(--charcoal)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "1.5px solid var(--white)" }}
              onClick={() => avatarInputRef.current?.click()}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarChange(f); }} />
          </div>

          {/* Name + tags */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--charcoal)", letterSpacing: "-0.01em", lineHeight: 1.25, marginBottom: "0.3rem" }}>
              {profile?.display_name ?? student?.displayName}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: profile?.bio ? "0.4rem" : 0 }}>
              {profile?.instrument && (
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", background: "var(--cream-deep)", borderRadius: 4, padding: "0.15rem 0.5rem", color: "var(--charcoal)", fontWeight: 500, letterSpacing: "0.01em" }}>
                  {profile.instrument}
                </span>
              )}
              {profile?.music_since && (
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", background: "transparent", color: "var(--muted)", letterSpacing: "0.01em" }}>
                  since {profile.music_since}
                </span>
              )}
            </div>
            {profile?.bio && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "0", borderTop: "1px solid var(--border)", margin: "0 -1rem", padding: "0.5rem 1rem 0" }}>
          {[
            { label: "followers", value: followerCount },
            { label: "following", value: followingCount },
            { label: "streak", value: `${profile?.streak_days ?? 0}🔥` },
            { label: "clips", value: publicClipCount },
          ].map(({ label, value }, i, arr) => (
            <div key={label} style={{ flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", padding: "0.375rem 0" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5rem", color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {!editingProfile ? (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.875rem" }}>
            <button onClick={() => { setEditName(profile?.display_name ?? student?.displayName ?? ""); setEditBio(profile?.bio ?? ""); setEditInstrument(profile?.instrument ?? ""); setEditSince(profile?.music_since ?? ""); setEditingProfile(true); }} style={{ flex: 1, padding: "0.4375rem", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", cursor: "pointer", letterSpacing: "0.005em" }}>
              Edit Profile
            </button>
            <button onClick={() => setShowUploadModal(true)} style={{ flex: 1, padding: "0.4375rem", borderRadius: 5, border: "none", background: "var(--charcoal)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", letterSpacing: "0.005em" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              Add Clip
            </button>
          </div>
        ) : (
          <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, display: "block", marginBottom: "0.25rem", letterSpacing: "0.02em" }}>Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "0.4375rem 0.625rem", borderRadius: 5, border: "1px solid var(--border-strong)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }} />
              </div>
              <div>
                <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, display: "block", marginBottom: "0.25rem", letterSpacing: "0.02em" }}>Instrument</label>
                <input value={editInstrument} onChange={e => setEditInstrument(e.target.value)} placeholder="Piano, Guitar…" style={{ width: "100%", boxSizing: "border-box", padding: "0.4375rem 0.625rem", borderRadius: 5, border: "1px solid var(--border-strong)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }} />
              </div>
            </div>
            <div>
              <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, display: "block", marginBottom: "0.25rem", letterSpacing: "0.02em" }}>Bio</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell your musical story…" maxLength={160} rows={2} style={{ width: "100%", boxSizing: "border-box", padding: "0.4375rem 0.625rem", borderRadius: 5, border: "1px solid var(--border-strong)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", resize: "none", lineHeight: 1.5 }} />
            </div>
            <div>
              <label style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", fontWeight: 500, display: "block", marginBottom: "0.25rem", letterSpacing: "0.02em" }}>Practicing since</label>
              <input value={editSince} onChange={e => setEditSince(e.target.value)} placeholder="e.g. 2019, age 6, last year…" style={{ width: "100%", boxSizing: "border-box", padding: "0.4375rem 0.625rem", borderRadius: 5, border: "1px solid var(--border-strong)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={saveProfile} disabled={savingProfile} style={{ flex: 1, padding: "0.4375rem", borderRadius: 5, border: "none", background: "var(--charcoal)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--white)", cursor: "pointer" }}>
                {savingProfile ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingProfile(false)} style={{ flex: 1, padding: "0.4375rem", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--muted)", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Privacy hint */}
        <div style={{ marginTop: "0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.3rem", letterSpacing: "0.01em" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Toggle each clip public or private below. Public clips appear on Discover.
        </div>
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
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.375rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
            No recordings yet
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.65, maxWidth: 280, margin: "0 auto 1.5rem" }}>
            After a practice session, toggle &ldquo;Save to Journey&rdquo; to keep a memento of your progress. Or tap <strong>Add Cover</strong> to upload a video performance.
          </p>
        </div>
      ) : (
        <div style={{ padding: "0 1.25rem 3rem" }}>
          {monthGroups.map((group, gi) => (
            <div key={gi}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0", marginTop: gi > 0 ? "0.5rem" : 0 }}>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {group.label}
                </span>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {group.items.map((item, idx) => {
                  const isExpanded = expandedId === item.id;
                  const isLatest = gi === 0 && idx === 0;
                  const isVideo = item.media_type === "video";
                  const isPublic = item.is_public === true;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--white)",
                        border: `1px solid ${isLatest ? "var(--sage)" : "var(--border)"}`,
                        borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s",
                      }}
                    >
                      {/* Card header */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{ padding: "1rem 1.125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.875rem" }}
                      >
                        {/* Type indicator */}
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: isLatest ? "linear-gradient(135deg, #3D6B55, #2C5242)" : isVideo ? "linear-gradient(135deg, var(--lavender), #3D3499)" : "var(--cream)",
                          border: (isLatest || isVideo) ? "none" : "1px solid var(--border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: isVideo ? "1rem" : "0.75rem", fontWeight: 600,
                          color: (isLatest || isVideo) ? "#fff" : "var(--muted)",
                          fontFamily: "Inter, sans-serif",
                        }}>
                          {isVideo ? "▶" : items.length - items.indexOf(item)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingId === item.id ? (
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: "100%", borderRadius: 4, border: "1px solid var(--border-strong)", padding: "0.4rem 0.625rem", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }}
                            />
                          ) : (
                            <>
                              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "var(--charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "Inter, sans-serif", marginTop: "0.125rem" }}>
                                {formatDate(item.created_at)} · {formatRelative(item.created_at)}
                                {isVideo && <span style={{ marginLeft: "0.4rem", color: "var(--lavender)", fontWeight: 600 }}>· Video cover</span>}
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                          {isLatest && editingId !== item.id && (
                            <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.5rem", borderRadius: 4, background: "rgba(61,107,85,0.1)", color: "var(--sage)", fontFamily: "Inter, sans-serif" }}>
                              Latest
                            </span>
                          )}
                          {isPublic && editingId !== item.id && (
                            <span style={{ fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.2rem 0.5rem", borderRadius: 4, background: "var(--lavender-bg)", color: "var(--lavender)", fontFamily: "Inter, sans-serif" }}>
                              Public
                            </span>
                          )}
                          {editingId !== item.id && (
                            <span style={{ color: "var(--muted)", fontSize: "0.75rem", transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                          )}
                        </div>
                      </div>

                      {/* Expanded content */}
                      {(isExpanded || editingId === item.id) && (
                        <div style={{ padding: "0 1.125rem 1.125rem", borderTop: "1px solid var(--border)" }}>
                          {editingId === item.id ? (
                            <div style={{ paddingTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <textarea
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                placeholder="Add a reflection about this recording..."
                                style={{ borderRadius: 4, border: "1px solid var(--border)", padding: "0.5rem 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", minHeight: 72 }}
                              />
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--cream)", color: "var(--muted)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer" }}>Cancel</button>
                                <button onClick={() => saveEdit(item.id)} disabled={saving || !editTitle.trim()} style={{ flex: 1, padding: "0.5rem", borderRadius: 6, border: "none", background: "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer" }}>
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {item.description && (
                                <p style={{ fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.65, margin: "0.875rem 0 0", fontFamily: "Inter, sans-serif", opacity: 0.85 }}>
                                  {item.description}
                                </p>
                              )}

                              {/* Media player */}
                              {item.recording_url && (
                                <div style={{ marginTop: "0.875rem" }}>
                                  {isVideo ? (
                                    <video
                                      src={item.recording_url}
                                      controls
                                      playsInline
                                      style={{ width: "100%", borderRadius: 8, maxHeight: 320, background: "#000" }}
                                    />
                                  ) : (
                                    <AudioPlayer src={item.recording_url} />
                                  )}
                                </div>
                              )}

                              {/* Actions */}
                              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.875rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)", alignItems: "center" }}>
                                <button onClick={() => startEdit(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 500, padding: 0, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                  Edit
                                </button>
                                <button onClick={() => deleteItem(item.id)} disabled={deletingId === item.id} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 500, padding: 0, opacity: deletingId === item.id ? 0.5 : 1, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                  Remove
                                </button>

                                {/* Public toggle */}
                                <button
                                  onClick={() => togglePublic(item)}
                                  disabled={togglingPublicId === item.id}
                                  style={{
                                    background: isPublic ? "rgba(91,79,207,0.07)" : "transparent",
                                    border: `1px solid ${isPublic ? "var(--lavender)" : "var(--border)"}`,
                                    borderRadius: 4, cursor: "pointer", padding: "0.2rem 0.5rem",
                                    color: isPublic ? "var(--lavender)" : "var(--muted)",
                                    fontSize: "0.6875rem", fontFamily: "Inter, sans-serif", fontWeight: 500,
                                    display: "flex", alignItems: "center", gap: "0.25rem",
                                    opacity: togglingPublicId === item.id ? 0.5 : 1,
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    {isPublic
                                      ? <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>
                                      : <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
                                    }
                                  </svg>
                                  {isPublic ? "Public" : "Private"}
                                </button>

                                {item.recording_url && (
                                  <a href={item.recording_url} download={`${item.title}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", fontWeight: 500, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem", marginLeft: "auto" }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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

      {/* Add Cover Modal */}
      {showUploadModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}
        >
          <div style={{ background: "var(--white)", borderRadius: "16px 16px 0 0", padding: "1.5rem", width: "100%", maxWidth: 520, boxShadow: "0 -4px 40px rgba(0,0,0,0.2)", maxHeight: "90dvh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 500, fontSize: "1.25rem", color: "var(--charcoal)" }}>
                Add Cover
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.375rem", color: "var(--muted)", lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: "1.25rem" }}>
              {([["upload", "📁 Upload file"], ["record", "🎥 Record now"]] as const).map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => { setCoverTab(tab); setRecordError(""); setUploadError(""); }}
                  style={{ flex: 1, padding: "0.5rem", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", transition: "all 0.15s", background: coverTab === tab ? "var(--charcoal)" : "transparent", color: coverTab === tab ? "var(--white)" : "var(--muted)" }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {/* Title + note (shared) */}
              <div>
                <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", display: "block", marginBottom: "0.3rem" }}>Title</label>
                <input type="text" placeholder="e.g. Understand — Keshi cover" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
                  style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border)", padding: "0.625rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.75rem", color: "var(--charcoal)", display: "block", marginBottom: "0.3rem" }}>Note (optional)</label>
                <textarea placeholder="What were you working on? How did it feel?" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} rows={2}
                  style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border)", padding: "0.625rem 0.875rem", fontFamily: "Inter, sans-serif", fontSize: "0.875rem", background: "var(--cream)", color: "var(--charcoal)", outline: "none", boxSizing: "border-box", resize: "none" }} />
              </div>

              {coverTab === "upload" ? (
                <>
                  <div onClick={() => fileInputRef.current?.click()}
                    style={{ border: `2px dashed ${uploadFile ? "var(--sage)" : "var(--border)"}`, borderRadius: 10, padding: "1.5rem", textAlign: "center", cursor: "pointer", background: uploadFile ? "rgba(61,107,85,0.04)" : "var(--cream)", transition: "all 0.15s" }}>
                    {uploadFile ? (
                      <>
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.375rem" }}>🎬</div>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>{uploadFile.name}</div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB · tap to change</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.375rem" }}>📹</div>
                        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.875rem", color: "var(--charcoal)" }}>Tap to choose a video</div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>MP4, MOV, WebM</div>
                      </>
                    )}
                    <input ref={fileInputRef} type="file" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }} style={{ display: "none" }} />
                  </div>
                </>
              ) : (
                /* Record tab */
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Video / Audio toggle */}
                  {!recording && !recordedBlob && (
                    <div style={{ display: "flex", background: "var(--cream)", borderRadius: 8, padding: "0.25rem", gap: "0.25rem" }}>
                      {(["video", "audio"] as const).map(mode => (
                        <button key={mode} onClick={() => setRecordMode(mode)} style={{
                          flex: 1, padding: "0.375rem 0", borderRadius: 6, border: "none",
                          background: recordMode === mode ? "var(--white)" : "transparent",
                          fontFamily: "Inter, sans-serif", fontWeight: recordMode === mode ? 600 : 400,
                          fontSize: "0.8125rem", color: recordMode === mode ? "var(--charcoal)" : "var(--muted)",
                          cursor: "pointer", transition: "all 0.15s",
                          boxShadow: recordMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        }}>
                          {mode === "video" ? "🎥 Video" : "🎙 Audio only"}
                        </button>
                      ))}
                    </div>
                  )}

                  {recordError && (
                    <div style={{ padding: "0.5rem 0.75rem", borderRadius: 6, background: "var(--peach-bg)", border: "1px solid var(--peach-light)", fontSize: "0.8125rem", color: "var(--peach)", fontFamily: "Inter, sans-serif" }}>{recordError}</div>
                  )}

                  {/* Live / review area */}
                  {recordMode === "video" ? (
                    !recordedBlob ? (
                      <div style={{ position: "relative", background: "#111", borderRadius: 10, overflow: "hidden", aspectRatio: "4/3" }}>
                        <video ref={liveVideoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: recording ? "block" : "none" }} />
                        {!recording && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem" }}>
                              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📷</div>
                              Camera preview will appear here
                            </div>
                          </div>
                        )}
                        {recording && (
                          <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: "0.375rem", background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "0.25rem 0.5rem" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--error)", animation: "pulse 1s infinite" }} />
                            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", color: "#fff", fontWeight: 600, letterSpacing: "0.04em" }}>REC {recordSeconds}s</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <video ref={previewVideoRef} src={recordedUrl ?? undefined} controls playsInline style={{ width: "100%", borderRadius: 10, background: "#111", maxHeight: 240 }} />
                        <button onClick={discardRecording} style={{ marginTop: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", padding: 0, textDecoration: "underline" }}>
                          Re-record
                        </button>
                      </div>
                    )
                  ) : (
                    /* Audio-only UI */
                    !recordedBlob ? (
                      <div style={{ background: "var(--cream)", borderRadius: 10, padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ fontSize: "2.5rem" }}>{recording ? "🔴" : "🎙"}</div>
                        {recording ? (
                          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "var(--charcoal)" }}>
                            Recording — {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
                          </div>
                        ) : (
                          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>
                            Ready to record audio
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <audio controls src={recordedUrl ?? undefined} style={{ width: "100%" }} />
                        <button onClick={discardRecording} style={{ marginTop: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", padding: 0, textDecoration: "underline" }}>
                          Re-record
                        </button>
                      </div>
                    )
                  )}

                  {!recordedBlob && (
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      style={{ padding: "0.75rem", borderRadius: 8, border: recording ? "2px solid var(--error)" : "2px solid var(--charcoal)", background: recording ? "var(--error-bg)" : "var(--charcoal)", color: recording ? "var(--error)" : "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                    >
                      {recording ? (
                        <><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--error)", flexShrink: 0 }} /> Stop</>
                      ) : (
                        <>{recordMode === "video" ? "🎥 Start Recording" : "🎙 Start Recording"}</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Share toggle */}
              <button
                type="button"
                onClick={() => setSharePublic(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 0.875rem", borderRadius: 8, border: `1px solid ${sharePublic ? "rgba(91,79,207,0.3)" : "var(--border)"}`, background: sharePublic ? "rgba(91,79,207,0.06)" : "var(--cream)", cursor: "pointer", textAlign: "left", width: "100%" }}
              >
                <div style={{ width: 36, height: 20, borderRadius: 10, background: sharePublic ? "var(--lavender)" : "var(--border)", transition: "background 0.2s", flexShrink: 0, position: "relative" }}>
                  <div style={{ position: "absolute", top: 2, left: sharePublic ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "var(--white)", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>Share to Discover</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "var(--muted)" }}>Let others on Cadenza see and like this cover</div>
                </div>
              </button>

              {(uploadError) && (
                <div style={{ padding: "0.5rem 0.75rem", borderRadius: 6, background: "var(--peach-bg)", border: "1px solid var(--peach-light)", fontSize: "0.8125rem", color: "var(--peach)", fontFamily: "Inter, sans-serif" }}>
                  {uploadError}
                </div>
              )}

              <button
                onClick={handleVideoUpload}
                disabled={(coverTab === "upload" ? !uploadFile : !recordedBlob) || !uploadTitle.trim() || uploading}
                style={{ padding: "0.75rem", borderRadius: 8, border: "none", background: ((coverTab === "upload" ? !uploadFile : !recordedBlob) || !uploadTitle.trim() || uploading) ? "var(--border)" : "var(--charcoal)", color: "var(--white)", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9375rem", cursor: ((coverTab === "upload" ? !uploadFile : !recordedBlob) || !uploadTitle.trim() || uploading) ? "default" : "pointer", transition: "background 0.15s" }}
              >
                {uploading ? "Saving…" : "Save to Journey"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
