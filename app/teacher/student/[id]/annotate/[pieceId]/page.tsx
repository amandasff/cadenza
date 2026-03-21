"use client";
import React, { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../../lib/supabase/client";
import { Pencil, Eraser, Type, X } from "lucide-react";
import type { PieceRow, StrokeData } from "../../../../../../lib/types";

interface TextAnnotation {
  id: string;
  x: number; // 0..1 fraction of canvas width
  y: number; // 0..1 fraction of canvas height
  text: string;
  color: string;
  fontSize: number;
}

type Tool = "pencil" | "eraser" | "text" | "none";

const COLORS = ["#1C1916", "#C0392B", "#2471A3", "#1E8449", "#D35400", "#7D3C98"];
const LINE_WIDTHS = [2, 4, 8];

export default function TeacherAnnotate({
  params,
}: {
  params: Promise<{ id: string; pieceId: string }>;
}) {
  const { id: studentId, pieceId } = use(params);
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const [piece, setPiece] = useState<PieceRow | null>(null);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  // Sheet music
  const [sheetType, setSheetType] = useState<"pdf" | "images">("pdf");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  // PDF
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const pageIndexRef = useRef(0);
  const [scale] = useState(1.0);
  const [pdfLoaded, setPdfLoaded] = useState(0);
  const pdfDocRef = useRef<{ getPage: (n: number) => Promise<unknown> } | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Annotation tools
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState(COLORS[1]); // red default for teacher
  const [lineWidth, setLineWidth] = useState(LINE_WIDTHS[0]);
  const annotationsRef = useRef<Map<number, StrokeData[]>>(new Map());
  const annotCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<[number, number][]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textsRef = useRef<Map<number, TextAnnotation[]>>(new Map());
  const [textBoxes, setTextBoxes] = useState<TextAnnotation[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const draggingTextRef = useRef<{ id: string; startClientX: number; startClientY: number; origX: number; origY: number } | null>(null);

  // Realtime sync indicator
  const [syncLabel, setSyncLabel] = useState("");

  // ── Load piece & student ────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [{ data: pieceData }, { data: profileData }] = await Promise.all([
        supabase.from("pieces").select("*").eq("id", pieceId).single(),
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
      ]);
      setPiece(pieceData as PieceRow ?? null);
      setStudentName(profileData?.display_name ?? "Student");
      setLoading(false);
    })();
  }, [user?.id, pieceId, studentId]);

  // ── Load annotations ────────────────────────────────────────────────────────

  async function loadAnnotations() {
    const { data } = await supabase
      .from("piece_annotations")
      .select("page_index, strokes, texts")
      .eq("piece_id", pieceId)
      .eq("student_id", studentId);
    if (data) {
      const strokeMap = new Map<number, StrokeData[]>();
      const textMap = new Map<number, TextAnnotation[]>();
      for (const row of data as { page_index: number; strokes: StrokeData[]; texts?: TextAnnotation[] }[]) {
        strokeMap.set(row.page_index, row.strokes ?? []);
        textMap.set(row.page_index, row.texts ?? []);
      }
      annotationsRef.current = strokeMap;
      textsRef.current = textMap;
      setTextBoxes([...(textMap.get(pageIndexRef.current) ?? [])]);
    }
  }

  useEffect(() => {
    if (!pieceId || !studentId) return;
    loadAnnotations();
  }, [pieceId, studentId]);

  // ── Supabase Realtime — listen for student updates ─────────────────────────

  useEffect(() => {
    if (!pieceId || !studentId) return;

    const channel = supabase
      .channel(`annot:${pieceId}:${studentId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "piece_annotations",
          filter: `piece_id=eq.${pieceId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          // Ignore if WE just saved (will flicker otherwise)
          const row = (payload.new ?? payload.old) as { page_index: number; strokes: StrokeData[]; texts?: TextAnnotation[]; student_id?: string } | undefined;
          if (!row || row.student_id !== studentId) return;
          if (isDrawingRef.current) return; // don't interrupt active drawing

          annotationsRef.current.set(row.page_index, row.strokes ?? []);
          textsRef.current.set(row.page_index, row.texts ?? []);

          if (row.page_index === pageIndexRef.current) {
            redrawAnnotations();
            setTextBoxes([...(textsRef.current.get(row.page_index) ?? [])]);
          }
          setSyncLabel("Student updated");
          setTimeout(() => setSyncLabel(""), 2000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pieceId, studentId]);

  // ── Load sheet music ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!piece?.sheet_music_url) return;
    const url = piece.sheet_music_url;

    if (url.startsWith("[")) {
      try {
        const urls = JSON.parse(url) as string[];
        setImageUrls(urls);
        setNumPages(urls.length);
        setPageIndex(0);
        setSheetType("images");
        return;
      } catch { /* fall through */ }
    }

    if (/\.(jpg|jpeg|png|gif|webp|avif)/i.test(url) || url.includes("_img.")) {
      setImageUrls([url]);
      setNumPages(1);
      setPageIndex(0);
      setSheetType("images");
      return;
    }

    setSheetType("pdf");
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjsLib.getDocument(url).promise;
      pdfDocRef.current = doc as unknown as { getPage: (n: number) => Promise<unknown> };
      setNumPages(doc.numPages);
      setPageIndex(0);
      setPdfLoaded(n => n + 1);
    })();
  }, [piece?.sheet_music_url]);

  // Keep pageIndexRef in sync
  useEffect(() => { pageIndexRef.current = pageIndex; }, [pageIndex]);

  // ── Render PDF ──────────────────────────────────────────────────────────────

  function refreshTextBoxes() {
    setTextBoxes([...(textsRef.current.get(pageIndex) ?? [])]);
  }

  function redrawAnnotations() {
    const canvas = annotCanvasRef.current;
    if (!canvas) return;
    const pdfCanvas = pdfCanvasRef.current;
    const img = imgRef.current;
    let w: number, h: number;
    if (pdfCanvas && pdfCanvas.width > 0) {
      w = pdfCanvas.width; h = pdfCanvas.height;
    } else if (img && img.complete && img.naturalWidth > 0) {
      w = img.naturalWidth; h = img.naturalHeight;
    } else { return; }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    const strokes = annotationsRef.current.get(pageIndex) ?? [];
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      ctx.stroke();
    }
  }

  const renderPage = useCallback(async () => {
    if (!pdfDocRef.current || !pdfCanvasRef.current) return;
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (pdfDocRef.current as any).getPage(pageIndex + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewport = (page as any).getViewport({ scale });
    const canvas = pdfCanvasRef.current;
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = (page as any).render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
    redrawAnnotations();
    refreshTextBoxes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, scale, pdfLoaded]);

  useEffect(() => { renderPage(); }, [renderPage]);

  useEffect(() => {
    if (sheetType !== "images") return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) redrawAnnotations();
    refreshTextBoxes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, imageUrls, sheetType]);

  // ── Drawing ─────────────────────────────────────────────────────────────────

  function getCanvasPoint(e: React.MouseEvent | React.TouchEvent): [number, number] {
    const canvas = annotCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return [(t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY];
    }
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (tool === "none") return;
    if (tool === "text") {
      e.preventDefault();
      const canvas = annotCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      const id = Math.random().toString(36).slice(2);
      const newText: TextAnnotation = { id, x, y, text: "", color, fontSize: 16 };
      const existing = textsRef.current.get(pageIndex) ?? [];
      textsRef.current.set(pageIndex, [...existing, newText]);
      setTextBoxes([...(textsRef.current.get(pageIndex)!)]);
      setEditingTextId(id);
      return;
    }
    e.preventDefault();
    isDrawingRef.current = true;
    currentStrokeRef.current = [getCanvasPoint(e)];
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current || tool === "none") return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    currentStrokeRef.current.push(pt);
    const canvas = annotCanvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pts = currentStrokeRef.current;
    ctx.beginPath();
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = lineWidth * 4;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.moveTo(pts[pts.length - 2][0], pts[pts.length - 2][1]);
    ctx.lineTo(pt[0], pt[1]);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function onPointerUp(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current || tool === "none") return;
    e.preventDefault();
    isDrawingRef.current = false;
    if (tool === "pencil" && currentStrokeRef.current.length >= 2) {
      const existing = annotationsRef.current.get(pageIndex) ?? [];
      annotationsRef.current.set(pageIndex, [...existing, { color, width: lineWidth, points: currentStrokeRef.current }]);
      scheduleSave(pageIndex);
    } else if (tool === "eraser") {
      redrawAnnotations();
    }
    currentStrokeRef.current = [];
  }

  function clearPage() {
    annotationsRef.current.set(pageIndex, []);
    textsRef.current.set(pageIndex, []);
    setTextBoxes([]);
    redrawAnnotations();
    scheduleSave(pageIndex);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function scheduleSave(pg: number) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAnnotation(pg), 800);
  }

  async function saveAnnotation(pg: number) {
    const strokes = annotationsRef.current.get(pg) ?? [];
    const texts = textsRef.current.get(pg) ?? [];
    await supabase.from("piece_annotations").upsert(
      { piece_id: pieceId, student_id: studentId, page_index: pg, strokes, texts },
      { onConflict: "piece_id,student_id,page_index" }
    );
    setSyncLabel("Saved");
    setTimeout(() => setSyncLabel(""), 1500);
  }

  // ── Text drag ───────────────────────────────────────────────────────────────

  useEffect(() => {
    function onDocMouseMove(e: MouseEvent) {
      const drag = draggingTextRef.current;
      if (!drag) return;
      const canvas = annotCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (e.clientX - drag.startClientX) / rect.width;
      const dy = (e.clientY - drag.startClientY) / rect.height;
      const updated = (textsRef.current.get(pageIndex) ?? []).map(t =>
        t.id === drag.id ? { ...t, x: Math.max(0, Math.min(0.98, drag.origX + dx)), y: Math.max(0, Math.min(0.98, drag.origY + dy)) } : t
      );
      textsRef.current.set(pageIndex, updated);
      setTextBoxes([...updated]);
    }
    function onDocMouseUp() {
      if (draggingTextRef.current) {
        draggingTextRef.current = null;
        scheduleSave(pageIndex);
      }
    }
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
    return () => {
      document.removeEventListener("mousemove", onDocMouseMove);
      document.removeEventListener("mouseup", onDocMouseUp);
    };
  }, [pageIndex]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goNext = useCallback(() => setPageIndex(p => Math.min(p + 1, numPages - 1)), [numPages]);
  const goPrev = useCallback(() => setPageIndex(p => Math.max(p - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editingTextId) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, editingTextId]);

  // ── UI ──────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1C1916", fontFamily: "Inter, sans-serif", color: "rgba(255,255,255,0.4)" }}>
      Loading…
    </div>
  );

  if (!piece?.sheet_music_url) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", background: "#1C1916", fontFamily: "Inter, sans-serif" }}>
      <p style={{ color: "rgba(255,255,255,0.4)" }}>No sheet music uploaded for this piece yet.</p>
      <Link href={`/teacher/student/${studentId}`} style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8125rem", textDecoration: "underline" }}>← Back to {studentName}</Link>
    </div>
  );

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTool(prev => prev === t ? "none" : t)}
      title={label}
      style={{
        width: 36, height: 36, borderRadius: 4, border: "none", cursor: "pointer",
        background: tool === t ? "rgba(255,255,255,0.18)" : "transparent",
        color: tool === t ? "#fff" : "rgba(255,255,255,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      {icon}
    </button>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#1C1916", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{
        padding: "0 1rem", height: 52, display: "flex", alignItems: "center", gap: "0.75rem",
        background: "rgba(28,25,22,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 20,
        flexShrink: 0,
      }}>
        <Link href={`/teacher/student/${studentId}`} style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
          ← {studentName}
        </Link>
        <div style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500, color: "#F8F6F2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {piece.title}
          {piece.composer ? <span style={{ fontWeight: 400, color: "rgba(248,246,242,0.35)", marginLeft: "0.375rem" }}>{piece.composer}</span> : null}
        </div>

        {/* Sync indicator */}
        {syncLabel && (
          <span style={{ fontSize: "0.6875rem", color: "#5B9E79", whiteSpace: "nowrap" }}>{syncLabel}</span>
        )}

        {/* Page nav */}
        {numPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
            <button onClick={goPrev} disabled={pageIndex === 0} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, color: pageIndex === 0 ? "rgba(255,255,255,0.2)" : "#F8F6F2", cursor: pageIndex === 0 ? "default" : "pointer", padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>←</button>
            <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)", minWidth: 36, textAlign: "center" }}>{pageIndex + 1}/{numPages}</span>
            <button onClick={goNext} disabled={pageIndex === numPages - 1} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, color: pageIndex === numPages - 1 ? "rgba(255,255,255,0.2)" : "#F8F6F2", cursor: pageIndex === numPages - 1 ? "default" : "pointer", padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>→</button>
          </div>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 1rem 6rem", overflowY: "auto" }}>
        <div style={{ position: "relative", maxWidth: "100%", display: "inline-block" }}>

          {/* PDF canvas */}
          {sheetType === "pdf" && (
            <canvas ref={pdfCanvasRef} style={{ display: "block", maxWidth: "100%", userSelect: "none" }} />
          )}

          {/* Image */}
          {sheetType === "images" && imageUrls[pageIndex] && (
            <img
              ref={imgRef}
              src={imageUrls[pageIndex]}
              alt={`Page ${pageIndex + 1}`}
              style={{ display: "block", maxWidth: "100%", userSelect: "none" }}
              onLoad={() => { redrawAnnotations(); refreshTextBoxes(); }}
            />
          )}

          {/* Annotation canvas */}
          <canvas
            ref={annotCanvasRef}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              cursor: tool === "eraser" ? "cell" : tool === "pencil" ? "crosshair" : tool === "text" ? "text" : "default",
              zIndex: tool !== "none" ? 10 : 0,
            }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />

          {/* Text annotation overlays */}
          {textBoxes.map(box => (
            <div
              key={box.id}
              style={{
                position: "absolute",
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                zIndex: 15,
                pointerEvents: tool === "text" || editingTextId === box.id ? "auto" : "none",
              }}
              onMouseDown={e => {
                if (tool !== "text" || editingTextId === box.id) return;
                e.stopPropagation(); e.preventDefault();
                draggingTextRef.current = { id: box.id, startClientX: e.clientX, startClientY: e.clientY, origX: box.x, origY: box.y };
              }}
            >
              {editingTextId === box.id ? (
                <textarea
                  autoFocus
                  value={box.text}
                  onChange={ev => {
                    const updated = (textsRef.current.get(pageIndex) ?? []).map(t =>
                      t.id === box.id ? { ...t, text: ev.target.value } : t
                    );
                    textsRef.current.set(pageIndex, updated);
                    setTextBoxes([...updated]);
                  }}
                  onBlur={() => {
                    setEditingTextId(null);
                    const current = textsRef.current.get(pageIndex) ?? [];
                    const thisBox = current.find(t => t.id === box.id);
                    if (thisBox && !thisBox.text.trim()) {
                      const updated = current.filter(t => t.id !== box.id);
                      textsRef.current.set(pageIndex, updated);
                      setTextBoxes([...updated]);
                    }
                    scheduleSave(pageIndex);
                  }}
                  onKeyDown={ev => { if (ev.key === "Escape") { setEditingTextId(null); scheduleSave(pageIndex); } }}
                  style={{
                    background: "rgba(255,255,224,0.92)", border: "1.5px solid #aaa", borderRadius: 2,
                    padding: "2px 5px", fontFamily: "Inter, sans-serif", fontSize: box.fontSize,
                    color: box.color, minWidth: 80, minHeight: 28, resize: "both", outline: "none",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                />
              ) : (
                <div style={{ position: "relative" }}>
                  <div
                    onClick={ev => { if (tool === "text") { ev.stopPropagation(); setEditingTextId(box.id); } }}
                    style={{
                      background: box.text ? "rgba(255,255,224,0.88)" : (tool === "text" ? "rgba(255,255,224,0.4)" : "transparent"),
                      border: tool === "text" ? "1px dashed rgba(255,255,255,0.6)" : "none",
                      padding: "2px 5px", borderRadius: 2,
                      fontFamily: "Inter, sans-serif", fontSize: box.fontSize, color: box.color,
                      cursor: tool === "text" ? "move" : "default",
                      whiteSpace: "pre-wrap", maxWidth: 220, wordBreak: "break-word", userSelect: "none",
                      boxShadow: box.text ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
                      minWidth: box.text ? undefined : (tool === "text" ? 40 : 0),
                      minHeight: box.text ? undefined : (tool === "text" ? 20 : 0),
                    }}
                  >
                    {box.text || (tool === "text" ? <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>T</span> : null)}
                  </div>
                  {tool === "text" && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        const updated = (textsRef.current.get(pageIndex) ?? []).filter(t => t.id !== box.id);
                        textsRef.current.set(pageIndex, updated);
                        setTextBoxes([...updated]);
                        scheduleSave(pageIndex);
                      }}
                      style={{
                        position: "absolute", top: -7, right: -7, width: 15, height: 15,
                        background: "#e74c3c", color: "#fff", border: "none", borderRadius: "50%",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, lineHeight: 1, padding: 0, zIndex: 1,
                      }}
                    >×</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Floating toolbar */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        background: "rgba(28,25,22,0.94)", backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
        padding: "0.5rem 0.75rem",
        display: "flex", alignItems: "center", gap: "0.25rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        zIndex: 30,
      }}>
        {/* Tools */}
        {toolBtn("pencil", <Pencil size={16} strokeWidth={1.5} />, "Draw")}
        {toolBtn("eraser", <Eraser size={16} strokeWidth={1.5} />, "Erase")}
        {toolBtn("text", <Type size={16} strokeWidth={1.5} />, "Text")}

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)", margin: "0 0.25rem" }} />

        {/* Colors */}
        {(tool === "pencil" || tool === "text") && COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 18, height: 18, borderRadius: "50%", border: color === c ? "2px solid #fff" : "2px solid transparent",
              background: c, cursor: "pointer", padding: 0, flexShrink: 0,
            }}
          />
        ))}

        {/* Line widths */}
        {tool === "pencil" && (
          <>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)", margin: "0 0.25rem" }} />
            {LINE_WIDTHS.map(w => (
              <button
                key={w}
                onClick={() => setLineWidth(w)}
                style={{
                  width: 28, height: 28, borderRadius: 3, border: lineWidth === w ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent",
                  background: lineWidth === w ? "rgba(255,255,255,0.1)" : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{ width: w + 4, height: w + 4, borderRadius: "50%", background: color }} />
              </button>
            ))}
          </>
        )}

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)", margin: "0 0.25rem" }} />

        {/* Clear page */}
        <button
          onClick={() => { if (confirm("Clear all annotations on this page?")) clearPage(); }}
          title="Clear page"
          style={{ width: 36, height: 36, borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
