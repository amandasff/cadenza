"use client";
import React, { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../../../lib/supabase/client";
import type { PieceRow, StrokeData } from "../../../../../../lib/types";

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export default function TeacherAnnotationView({
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
  const [noSheet, setNoSheet] = useState(false);

  // Sheet music
  const [sheetType, setSheetType] = useState<"pdf" | "images">("pdf");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  // PDF
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scale] = useState(1.0);
  const pdfDocRef = useRef<{ getPage: (n: number) => Promise<unknown> } | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Annotations (read-only)
  const annotationsRef = useRef<Map<number, StrokeData[]>>(new Map());
  const annotCanvasRef = useRef<HTMLCanvasElement>(null);
  const textsRef = useRef<Map<number, TextAnnotation[]>>(new Map());
  const [textBoxes, setTextBoxes] = useState<TextAnnotation[]>([]);

  // ── Load piece & student name ───────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [{ data: pieceData }, { data: profileData }] = await Promise.all([
        supabase.from("pieces").select("*").eq("id", pieceId).single(),
        supabase.from("profiles").select("display_name").eq("id", studentId).single(),
      ]);
      if (!pieceData) { setLoading(false); setNoSheet(true); return; }
      setPiece(pieceData as PieceRow);
      setStudentName(profileData?.display_name ?? "Student");
      if (!pieceData.sheet_music_url) setNoSheet(true);
      setLoading(false);
    })();
  }, [user?.id, pieceId, studentId]);

  // ── Load annotations ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!pieceId || !studentId) return;
    (async () => {
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
        setTextBoxes([...(textMap.get(0) ?? [])]);
      }
    })();
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
    })();
  }, [piece?.sheet_music_url]);

  // ── Render PDF page ─────────────────────────────────────────────────────────

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
    } else {
      return;
    }
    canvas.width = w;
    canvas.height = h;
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
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = (page as any).render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
    redrawAnnotations();
    refreshTextBoxes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  useEffect(() => {
    if (sheetType !== "images") return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) redrawAnnotations();
    refreshTextBoxes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, imageUrls, sheetType]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goNext = useCallback(() => setPageIndex(p => Math.min(p + 1, numPages - 1)), [numPages]);
  const goPrev = useCallback(() => setPageIndex(p => Math.max(p - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // ── UI ──────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "var(--muted)" }}>
      Loading…
    </div>
  );

  if (noSheet) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", fontFamily: "Inter, sans-serif" }}>
      <p style={{ color: "var(--muted)", fontSize: "0.9375rem" }}>No sheet music uploaded for this piece yet.</p>
      <Link href={`/teacher/student/${studentId}`} style={{ color: "var(--charcoal)", fontSize: "0.8125rem", textDecoration: "underline" }}>
        ← Back to {studentName}
      </Link>
    </div>
  );

  const hasAnnotations = annotationsRef.current.size > 0 || Array.from(textsRef.current.values()).some(t => t.length > 0);

  return (
    <div style={{ minHeight: "100dvh", background: "#1C1916", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{
        padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem",
        background: "rgba(28,25,22,0.92)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <Link href={`/teacher/student/${studentId}`} style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          ← {studentName}
        </Link>
        <div style={{ flex: 1, fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "#F8F6F2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {piece?.title ?? "Sheet Music"}
          {piece?.composer ? <span style={{ fontWeight: 400, color: "rgba(248,246,242,0.4)", marginLeft: "0.5rem" }}>{piece.composer}</span> : null}
        </div>
        <div style={{ fontSize: "0.6875rem", color: "rgba(248,246,242,0.3)", whiteSpace: "nowrap" }}>
          {hasAnnotations ? "Has annotations" : "No annotations yet"}
        </div>
        {numPages > 1 && (
          <div style={{ fontSize: "0.6875rem", color: "rgba(248,246,242,0.4)", whiteSpace: "nowrap" }}>
            {pageIndex + 1} / {numPages}
          </div>
        )}
      </div>

      {/* Sheet music + annotation overlay */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 1rem", gap: "1rem", overflowY: "auto" }}>
        <div style={{ position: "relative", maxWidth: "100%", display: "inline-block" }}>

          {/* PDF canvas */}
          {sheetType === "pdf" && (
            <canvas
              ref={pdfCanvasRef}
              style={{ display: "block", maxWidth: "100%", userSelect: "none" }}
            />
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

          {/* Annotation overlay (strokes) */}
          <canvas
            ref={annotCanvasRef}
            style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%",
              pointerEvents: "none",
            }}
          />

          {/* Text annotation overlays */}
          {textBoxes.map(box => {
            const pdfCanvas = pdfCanvasRef.current;
            const img = imgRef.current;
            const refW = (pdfCanvas && pdfCanvas.getBoundingClientRect().width) || (img && img.getBoundingClientRect().width) || 0;
            const refH = (pdfCanvas && pdfCanvas.getBoundingClientRect().height) || (img && img.getBoundingClientRect().height) || 0;
            if (!refW || !refH) return null;
            return (
              <div
                key={box.id}
                style={{
                  position: "absolute",
                  left: box.x * 100 + "%",
                  top: box.y * 100 + "%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <div style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: box.fontSize,
                  color: box.color,
                  whiteSpace: "pre-wrap",
                  background: "rgba(255,255,255,0.85)",
                  padding: "2px 6px",
                  borderRadius: 3,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                  minWidth: 40,
                }}>
                  {box.text || " "}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nav controls */}
      {numPages > 1 && (
        <div style={{
          padding: "0.75rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem",
          background: "rgba(28,25,22,0.85)", borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <button
            onClick={goPrev}
            disabled={pageIndex === 0}
            style={{ padding: "0.5rem 1.25rem", borderRadius: 3, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: pageIndex === 0 ? "rgba(255,255,255,0.2)" : "#F8F6F2", cursor: pageIndex === 0 ? "default" : "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem" }}
          >
            ← Prev
          </button>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "rgba(248,246,242,0.5)" }}>
            {pageIndex + 1} / {numPages}
          </span>
          <button
            onClick={goNext}
            disabled={pageIndex === numPages - 1}
            style={{ padding: "0.5rem 1.25rem", borderRadius: 3, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: pageIndex === numPages - 1 ? "rgba(255,255,255,0.2)" : "#F8F6F2", cursor: pageIndex === numPages - 1 ? "default" : "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.8125rem" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
