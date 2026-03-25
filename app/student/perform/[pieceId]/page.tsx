"use client";
import React, { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import { PieceService } from "../../../../lib/services/PieceService";
import { PracticeService } from "../../../../lib/services/PracticeService";
import { Student } from "../../../../lib/models/Student";
import type { PieceRow, StrokeData } from "../../../../lib/types";

interface TextAnnotation {
  id: string;
  x: number; // 0..1 fraction of canvas rendered width
  y: number; // 0..1 fraction of canvas rendered height
  text: string;
  color: string;
  fontSize: number;
}
import { useI18n } from "../../../../lib/context/I18nContext";
import { Pencil, Circle, X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Tool = "pencil" | "eraser" | "text" | "none";
type PageTurnMethod = "tap" | "keyboard" | "device" | "webcam";

const COLORS = ["#1C1916", "#C0392B", "#2471A3", "#1E8449", "#D35400", "#7D3C98"];
const LINE_WIDTHS = [2, 4, 8];

// ── Metronome helpers (copied from practice page) ─────────────────────────────

function useMetronome(
  metronome: boolean, bpm: number, beats: number, accentOn: boolean,
  soundMode: "click" | "voice", audioCtxRef: React.RefObject<AudioContext | null>
) {
  useEffect(() => {
    if (!metronome) return;
    const intervalMs = Math.round((60 / bpm) * 1000);
    let beat = 0;

    if (soundMode === "click") {
      if (!audioCtxRef.current) (audioCtxRef as React.MutableRefObject<AudioContext | null>).current = new AudioContext();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      function playTick(isAccent: boolean) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = isAccent ? 1100 : 800;
        gain.gain.setValueAtTime(isAccent ? 0.8 : 0.45, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      }
      playTick(accentOn);
      const id = setInterval(() => { beat = (beat + 1) % beats; playTick(accentOn && beat === 0); }, intervalMs);
      return () => clearInterval(id);
    } else {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) return;
      function speak(n: number, isAccent: boolean) {
        synth!.cancel();
        const u = new SpeechSynthesisUtterance(String(n));
        u.rate = 3.5; u.volume = 1; u.pitch = isAccent ? 1.4 : 1.0;
        synth!.speak(u);
      }
      speak(1, accentOn);
      const id = setInterval(() => { beat = (beat + 1) % beats; speak(beat + 1, accentOn && beat === 0); }, intervalMs);
      return () => { clearInterval(id); synth.cancel(); };
    }
  }, [metronome, bpm, beats, accentOn, soundMode]);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PerformerMode({ params }: { params: Promise<{ pieceId: string }> }) {
  const { pieceId } = use(params);
  const { user } = useAuth();
  const { t } = useI18n();
  const student = user as Student;
  const supabase = getSupabaseBrowserClient();

  // Piece
  const [piece, setPiece] = useState<PieceRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Sheet music type
  const [sheetType, setSheetType] = useState<"pdf" | "images">("pdf");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  // PDF
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const pdfDocRef = useRef<{ getPage: (n: number) => Promise<unknown> } | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Annotations
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState(COLORS[0]);
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

  // Page turning
  const [enabledMethods, setEnabledMethods] = useState<Set<PageTurnMethod>>(new Set(["tap", "keyboard"]));
  const tiltCooldownRef = useRef(false);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<{ detectForVideo: (video: HTMLVideoElement, time: number) => { faceLandmarks: { x: number; y: number; z: number }[][] } } | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const webcamRafRef = useRef<number>(0);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamStatus, setWebcamStatus] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // Metronome
  const [metronomeOpen, setMetronomeOpen] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [bpm, setBpm] = useState(72);
  const [beats, setBeats] = useState(4);
  const [accentOn, setAccentOn] = useState(true);
  const [soundMode, setSoundMode] = useState<"click" | "voice">("click");
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Recording
  const [recOpen, setRecOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recBlob, setRecBlob] = useState<Blob | null>(null);
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const [recSaving, setRecSaving] = useState(false);
  const [recSaved, setRecSaved] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<Blob[]>([]);

  // Container
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // ── Load piece ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      const pieces = await PieceService.create(supabase).getStudentPieces(student.id);
      const found = pieces.find(p => p.id === pieceId) ?? null;
      setPiece(found);
      setLoading(false);
    })();
  }, [student?.id, pieceId]);

  // ── Load annotations ────────────────────────────────────────────────────────

  // Keep a ref to current pageIndex for use inside realtime callback
  const pageIndexRef = useRef(0);
  useEffect(() => { pageIndexRef.current = pageIndex; }, [pageIndex]);

  useEffect(() => {
    if (!student?.id || !pieceId) return;
    (async () => {
      const { data } = await supabase
        .from("piece_annotations")
        .select("page_index, strokes, texts")
        .eq("piece_id", pieceId)
        .eq("student_id", student.id);
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
  }, [student?.id, pieceId]);

  // ── Realtime: teacher edits show up live ────────────────────────────────────

  useEffect(() => {
    if (!student?.id || !pieceId) return;
    const channel = supabase
      .channel(`annot:${pieceId}:${student.id}:student`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "*",
        schema: "public",
        table: "piece_annotations",
        filter: `piece_id=eq.${pieceId}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const row = (payload.new ?? payload.old) as { page_index: number; strokes: StrokeData[]; texts?: TextAnnotation[]; student_id?: string } | undefined;
        if (!row || row.student_id !== student.id) return;
        if (isDrawingRef.current) return; // don't interrupt active drawing
        annotationsRef.current.set(row.page_index, row.strokes ?? []);
        textsRef.current.set(row.page_index, row.texts ?? []);
        if (row.page_index === pageIndexRef.current) {
          redrawAnnotations();
          setTextBoxes([...(textsRef.current.get(row.page_index) ?? [])]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [student?.id, pieceId]);

  // ── Load sheet music (PDF or images) ───────────────────────────────────────

  useEffect(() => {
    if (!piece?.sheet_music_url) return;
    const url = piece.sheet_music_url;

    // JSON array of image URLs (multiple screenshots)
    if (url.startsWith("[")) {
      try {
        const urls = JSON.parse(url) as string[];
        setImageUrls(urls);
        setNumPages(urls.length);
        setPageIndex(0);
        setSheetType("images");
        return;
      } catch { /* fall through to PDF */ }
    }

    // Single image URL
    if (/\.(jpg|jpeg|png|gif|webp|avif)/i.test(url) || url.includes("_img.")) {
      setImageUrls([url]);
      setNumPages(1);
      setPageIndex(0);
      setSheetType("images");
      return;
    }

    // PDF — fetch as ArrayBuffer first to avoid pdfjs CORS issues with Supabase Storage
    setSheetType("pdf");
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // Fetch through the browser (Supabase public URLs are CORS-allowed for GET)
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = doc as unknown as { getPage: (n: number) => Promise<unknown> };
        setNumPages(doc.numPages);
        setPageIndex(0);
      } catch (err) {
        console.error("PDF load error:", err);
      }
    })();
  }, [piece?.sheet_music_url]);

  // ── Render PDF page ─────────────────────────────────────────────────────────

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
    try {
      await task.promise;
    } catch {
      // cancelled — ignore
    }
    redrawAnnotations();
    refreshTextBoxes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  // For image-based sheet music: redraw annotations whenever the visible page changes.
  // onLoad handles fresh downloads; this handles cached images where onLoad may have
  // already fired before React attached the handler.
  useEffect(() => {
    if (sheetType !== "images") return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      redrawAnnotations();
    }
    refreshTextBoxes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, imageUrls, sheetType]);

  // ── Text annotations: refresh helper ────────────────────────────────────────

  function refreshTextBoxes() { setTextBoxes([...(textsRef.current.get(pageIndex) ?? [])]); }

  // ── Annotations: redraw ─────────────────────────────────────────────────────

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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  // ── Annotations: drawing events ─────────────────────────────────────────────

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
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
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
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
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
      const newStroke: StrokeData = { color, width: lineWidth, points: currentStrokeRef.current };
      annotationsRef.current.set(pageIndex, [...existing, newStroke]);
      scheduleSave(pageIndex);
    } else if (tool === "eraser") {
      // Re-render to apply erasure to the stored strokes via composite
      // Store the current visual as a "free-draw" placeholder — just redraw all
      redrawAnnotations();
    }
    currentStrokeRef.current = [];
  }

  function clearPage() {
    annotationsRef.current.set(pageIndex, []);
    redrawAnnotations();
    scheduleSave(pageIndex);
  }

  // ── Annotations: save to Supabase ───────────────────────────────────────────

  function scheduleSave(pg: number) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAnnotation(pg), 1000);
  }

  async function saveAnnotation(pg: number) {
    if (!student?.id) return;
    const strokes = annotationsRef.current.get(pg) ?? [];
    const texts = textsRef.current.get(pg) ?? [];
    await supabase.from("piece_annotations").upsert(
      { piece_id: pieceId, student_id: student.id, page_index: pg, strokes, texts },
      { onConflict: "piece_id,student_id,page_index" }
    );
  }

  // ── Page navigation ─────────────────────────────────────────────────────────

  const goNext = useCallback(() => setPageIndex(p => Math.min(p + 1, numPages - 1)), [numPages]);
  const goPrev = useCallback(() => setPageIndex(p => Math.max(p - 1, 0)), []);

  // Keyboard
  useEffect(() => {
    if (!enabledMethods.has("keyboard")) return;
    function onKey(e: KeyboardEvent) {
      if (editingTextId) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabledMethods, goNext, goPrev, editingTextId]);

  // Device orientation (mobile tilt)
  useEffect(() => {
    if (!enabledMethods.has("device")) return;

    function triggerCooldown() {
      tiltCooldownRef.current = true;
      setTimeout(() => { tiltCooldownRef.current = false; }, 1200);
    }

    function onOrientation(e: DeviceOrientationEvent) {
      if (tiltCooldownRef.current) return;
      const gamma = e.gamma ?? 0;
      if (gamma > 22) { goNext(); triggerCooldown(); }
      else if (gamma < -22) { goPrev(); triggerCooldown(); }
    }

    // iOS 13+ requires permission
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function") {
      (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission()
        .then(perm => { if (perm === "granted") window.addEventListener("deviceorientation", onOrientation); })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", onOrientation);
    }
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [enabledMethods, goNext, goPrev]);

  // Webcam head tilt (desktop)
  const startWebcam = useCallback(async () => {
    setWebcamStatus("Loading…");
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
      faceLandmarkerRef.current = landmarker as unknown as typeof faceLandmarkerRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      webcamStreamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play();
      }
      setWebcamActive(true);
      setWebcamStatus("Active");

      let lastTime = -1;
      function detect() {
        webcamRafRef.current = requestAnimationFrame(detect);
        const video = webcamVideoRef.current;
        if (!video || video.readyState < 2) return;
        const now = performance.now();
        if (now === lastTime) return;
        lastTime = now;
        const result = faceLandmarkerRef.current!.detectForVideo(video, now);
        if (!result.faceLandmarks?.length) return;
        const lm = result.faceLandmarks[0];
        // Left eye outer: 33, right eye outer: 263
        const leftEye = lm[33];
        const rightEye = lm[263];
        if (!leftEye || !rightEye) return;
        const dy = rightEye.y - leftEye.y;
        const dx = rightEye.x - leftEye.x;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (tiltCooldownRef.current) return;
        if (angle > 12) {
          goPrev();
          tiltCooldownRef.current = true;
          setTimeout(() => { tiltCooldownRef.current = false; }, 1500);
        } else if (angle < -12) {
          goNext();
          tiltCooldownRef.current = true;
          setTimeout(() => { tiltCooldownRef.current = false; }, 1500);
        }
      }
      detect();
    } catch (err) {
      setWebcamStatus("Error — check camera permission");
      console.error("webcam head tilt error:", err);
    }
  }, [goNext, goPrev]);

  const stopWebcam = useCallback(() => {
    cancelAnimationFrame(webcamRafRef.current);
    webcamStreamRef.current?.getTracks().forEach(t => t.stop());
    webcamStreamRef.current = null;
    faceLandmarkerRef.current = null;
    setWebcamActive(false);
    setWebcamStatus("");
  }, []);

  useEffect(() => {
    if (!enabledMethods.has("webcam")) { stopWebcam(); return; }
    startWebcam();
    return stopWebcam;
  }, [enabledMethods]);

  // ── Text annotation drag ────────────────────────────────────────────────────

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

  // ── Recording ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  async function startRec() {
    setElapsed(0);
    setRecBlob(null);
    setRecUrl(null);
    setRecSaved(false);
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000 },
      });
      micStreamRef.current = rawStream;
      // Gentle gain boost (1.5×) — phone/laptop mics are often quiet for instruments
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(rawStream);
      const gain = audioCtx.createGain();
      gain.gain.value = 1.5;
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(gain);
      gain.connect(dest);
      const stream = dest.stream;
      const preferredTypes = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=aac", "audio/webm"];
      const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      const opts: MediaRecorderOptions = { audioBitsPerSecond: 128000 };
      if (mimeType) opts.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, opts);
      recChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: mimeType || "audio/webm" });
        setRecBlob(blob);
        setRecUrl(URL.createObjectURL(blob));
      };
      recorder.start(250);
      mediaRecRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error("mic error:", err);
    }
  }

  function stopRec() {
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
  }

  async function saveRec() {
    if (!recBlob || !student?.id || !student?.studioId) return;
    setRecSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const path = `${student.id}/${Date.now()}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from("practice-recordings").upload(path, recBlob, { contentType: "audio/webm", upsert: false });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("practice-recordings").getPublicUrl(path);
        const logRes = await fetch("/api/practice/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studioId: student.studioId,
            durationSeconds: elapsed,
            recordingUrl: urlData.publicUrl,
            notes: `Performance recording — ${piece?.title ?? "piece"}`,
          }),
        });
        const sessionData = logRes.ok ? (await logRes.json() as { session: { id: string } }).session : null;
        // Fire AI analysis in background
        if (sessionData?.id) {
          fetch("/api/practice/analyze-recording", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sessionData.id }),
          }).catch(() => {});
        }
        setRecSaved(true);
      }
    } catch (err) {
      console.error("save rec error:", err);
    } finally {
      setRecSaving(false);
    }
  }

  // Cleanup
  useEffect(() => () => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop();
    audioCtxRef.current?.close().catch(() => {});
    cancelAnimationFrame(webcamRafRef.current);
    webcamStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Fullscreen ──────────────────────────────────────────────────────────────

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  useEffect(() => {
    function onFsChange() { setFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Metronome hook ──────────────────────────────────────────────────────────
  useMetronome(metronome, bpm, beats, accentOn, soundMode, audioCtxRef);

  // ── Render ──────────────────────────────────────────────────────────────────

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (loading) {
    return (
      <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)" }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)" }}>{t.student.performLoading}</p>
      </div>
    );
  }

  if (!piece?.sheet_music_url) {
    return (
      <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", background: "var(--cream)" }}>
        <p style={{ fontFamily: "Inter, sans-serif", color: "var(--muted)", fontSize: "0.875rem" }}>{t.student.performNoSheetMusic}</p>
        <Link href="/student/pieces" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", textDecoration: "underline" }}>{t.student.performBackToPieces}</Link>
      </div>
    );
  }

  const isTap = enabledMethods.has("tap");

  return (
    <div
      data-perform-page
      ref={containerRef}
      style={{
        position: "relative",
        background: "#111",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* Webcam video — always mounted (needed for MediaPipe detection), shown as PiP when active */}
      <video ref={webcamVideoRef} playsInline muted style={{ position: "absolute", top: -1000, left: -1000, width: 1, height: 1, pointerEvents: "none" }} />

      {/* ── PDF canvas area ── */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", minHeight: 0, paddingBottom: 64 }}>

        {/* Tap zones */}
        {isTap && numPages > 0 && (
          <>
            <div onClick={goPrev} style={{ position: "absolute", left: 0, top: 0, width: "30%", height: "100%", zIndex: 5, cursor: "pointer" }} />
            <div onClick={goNext} style={{ position: "absolute", right: 0, top: 0, width: "30%", height: "100%", zIndex: 5, cursor: "pointer" }} />
          </>
        )}

        {/* Sheet music + annotation canvas stack */}
        <div style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", display: "inline-flex" }}>
          {sheetType === "pdf" ? (
            <canvas ref={pdfCanvasRef} style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 128px)", objectFit: "contain", display: "block", background: "#fff" }} />
          ) : (
            <img
              ref={imgRef}
              src={imageUrls[pageIndex]}
              alt="Sheet music"
              onLoad={() => redrawAnnotations()}
              style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 128px)", objectFit: "contain", display: "block" }}
            />
          )}
          <canvas
            ref={annotCanvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: tool === "eraser" ? "cell" : tool === "pencil" ? "crosshair" : tool === "text" ? "text" : "default", zIndex: tool !== "none" ? 10 : 0 }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
          {/* Text annotations overlay */}
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
                e.stopPropagation();
                e.preventDefault();
                draggingTextRef.current = {
                  id: box.id,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  origX: box.x,
                  origY: box.y,
                };
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
                    const current = (textsRef.current.get(pageIndex) ?? []);
                    const thisBox = current.find(t => t.id === box.id);
                    if (thisBox && !thisBox.text.trim()) {
                      const updated = current.filter(t => t.id !== box.id);
                      textsRef.current.set(pageIndex, updated);
                      setTextBoxes([...updated]);
                    }
                    scheduleSave(pageIndex);
                  }}
                  onKeyDown={ev => {
                    if (ev.key === "Escape") {
                      setEditingTextId(null);
                      scheduleSave(pageIndex);
                    }
                  }}
                  style={{
                    background: "rgba(255,255,224,0.92)",
                    border: "1.5px solid #aaa",
                    borderRadius: 2,
                    padding: "2px 5px",
                    fontFamily: "Inter, sans-serif",
                    fontSize: box.fontSize,
                    color: box.color,
                    minWidth: 80,
                    minHeight: 28,
                    resize: "both",
                    outline: "none",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                />
              ) : (
                <div style={{ position: "relative" }}>
                  <div
                    onClick={ev => {
                      if (tool === "text") {
                        ev.stopPropagation();
                        setEditingTextId(box.id);
                      }
                    }}
                    style={{
                      background: box.text ? "rgba(255,255,224,0.88)" : (tool === "text" ? "rgba(255,255,224,0.4)" : "transparent"),
                      border: tool === "text" ? "1px dashed rgba(255,255,255,0.6)" : "none",
                      padding: "2px 5px",
                      borderRadius: 2,
                      fontFamily: "Inter, sans-serif",
                      fontSize: box.fontSize,
                      color: box.color,
                      cursor: tool === "text" ? "move" : "default",
                      whiteSpace: "pre-wrap",
                      maxWidth: 220,
                      wordBreak: "break-word",
                      userSelect: "none",
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
                        position: "absolute",
                        top: -7, right: -7,
                        width: 15, height: 15,
                        background: "#e74c3c", color: "#fff", border: "none",
                        borderRadius: "50%", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, lineHeight: 1, padding: 0, zIndex: 1,
                      }}
                    >×</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {numPages === 0 && (
          <p style={{ color: "#888", fontFamily: "Inter, sans-serif", fontSize: "0.875rem" }}>{t.student.performLoading}</p>
        )}
      </div>

      {/* ── Floating metronome panel ── */}
      {metronomeOpen && (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 30,
          background: "rgba(28,25,22,0.92)", backdropFilter: "blur(8px)",
          borderRadius: 8, padding: "0.875rem 1rem", width: 200,
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500, color: "#eee", letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.student.performMetronome}</span>
            <button onClick={() => setMetronomeOpen(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center" }}><X size={16} strokeWidth={1.5} /></button>
          </div>

          {/* On/off */}
          <button
            onClick={() => { if (!metronome && !audioCtxRef.current) audioCtxRef.current = new AudioContext(); setMetronome(m => !m); }}
            style={{ width: "100%", padding: "0.375rem", borderRadius: 4, border: "none", marginBottom: "0.75rem", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, background: metronome ? "#4CAF50" : "#333", color: "#fff", letterSpacing: "0.05em" }}
          >
            {metronome ? t.student.performMetronomeOn : t.student.performMetronomeOff}
          </button>

          {/* BPM */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
            <button onClick={() => setBpm(b => Math.max(40, b - 5))} style={{ width: 28, height: 28, borderRadius: 3, border: "1px solid #444", background: "#222", color: "#ddd", cursor: "pointer", fontSize: "1rem" }}>−</button>
            <div style={{ flex: 1, textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.25rem", color: "#fff", letterSpacing: "-0.01em" }}>
              {bpm}<span style={{ fontSize: "0.6rem", color: "#888", marginLeft: 3 }}>BPM</span>
            </div>
            <button onClick={() => setBpm(b => Math.min(220, b + 5))} style={{ width: 28, height: 28, borderRadius: 3, border: "1px solid #444", background: "#222", color: "#ddd", cursor: "pointer", fontSize: "1rem" }}>+</button>
          </div>

          {/* Beats */}
          <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.5rem" }}>
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setBeats(n)} style={{ flex: 1, height: 26, borderRadius: 2, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: beats === n ? 700 : 400, background: beats === n ? "#555" : "#2a2a2a", color: beats === n ? "#fff" : "#888" }}>
                {n}
              </button>
            ))}
          </div>

          {/* Accent + mode */}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <button onClick={() => setAccentOn(a => !a)} style={{ flex: 1, height: 26, borderRadius: 3, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6rem", background: accentOn ? "#2d4a2d" : "#2a2a2a", color: accentOn ? "#7ec87e" : "#666" }}>Accent 1</button>
            {(["click", "voice"] as const).map(m => (
              <button key={m} onClick={() => setSoundMode(m)} style={{ flex: 1, height: 26, borderRadius: 3, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6rem", background: soundMode === m ? "#555" : "#2a2a2a", color: soundMode === m ? "#fff" : "#666", textTransform: "capitalize" }}>{m}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Floating recording panel ── */}
      {recOpen && (
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 30,
          background: "rgba(28,25,22,0.92)", backdropFilter: "blur(8px)",
          borderRadius: 8, padding: "0.875rem 1rem", width: 180,
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 500, color: "#eee", letterSpacing: "0.04em", textTransform: "uppercase" }}>{t.student.performRecord}</span>
            <button onClick={() => setRecOpen(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center" }}><X size={16} strokeWidth={1.5} /></button>
          </div>

          <div style={{ textAlign: "center", fontFamily: "Inter, sans-serif", fontWeight: 300, fontSize: "1.5rem", color: recording ? "#e74c3c" : "#888", letterSpacing: "0.02em", marginBottom: "0.75rem" }}>
            {fmt(elapsed)}
          </div>

          {!recBlob ? (
            <button
              onClick={recording ? stopRec : startRec}
              style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", fontWeight: 600, background: recording ? "#8A3030" : "#c0392b", color: "#fff" }}
            >
              {recording ? t.student.performStop : t.student.performStart}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <audio src={recUrl!} controls style={{ width: "100%", height: 32 }} />
              {!recSaved ? (
                <button onClick={saveRec} disabled={recSaving} style={{ width: "100%", padding: "0.4rem", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", fontWeight: 600, background: "#2471A3", color: "#fff", opacity: recSaving ? 0.6 : 1 }}>
                  {recSaving ? t.common.saving : t.student.performSaveToJourney}
                </button>
              ) : (
                <div style={{ textAlign: "center", fontSize: "0.6875rem", color: "#7ec87e", fontFamily: "Inter, sans-serif" }}>{t.student.performSavedConfirm}</div>
              )}
              <button onClick={() => { setRecBlob(null); setRecUrl(null); setElapsed(0); setRecSaved(false); }} style={{ width: "100%", padding: "0.4rem", borderRadius: 4, border: "1px solid #444", background: "transparent", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#888" }}>{t.student.performDiscard}</button>
            </div>
          )}
        </div>
      )}

      {/* ── Webcam PiP ── */}
      {webcamActive && (
        <div style={{ position: "absolute", bottom: 72, right: 12, zIndex: 30, borderRadius: 6, overflow: "hidden", border: "2px solid #444", background: "#222" }}>
          <div style={{ width: 100, height: 75, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.55rem", color: "#7ec87e", fontFamily: "Inter, sans-serif", textAlign: "center" }}>{t.student.performHeadTiltActive}</span>
          </div>
        </div>
      )}

      {/* ── Settings panel ── */}
      {showSettings && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "flex-end",
        }} onClick={() => setShowSettings(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#1a1a1a", borderRadius: "12px 12px 0 0", padding: "1.5rem", width: "100%", maxHeight: "60vh", overflowY: "auto" }}
          >
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "#eee", marginBottom: "1.25rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>{t.student.performPageTurnSettings}</div>

            {([
              { id: "tap" as PageTurnMethod, label: t.student.performTapZones, desc: t.student.performTapZonesDesc },
              { id: "keyboard" as PageTurnMethod, label: t.student.performKeyboard, desc: t.student.performKeyboardDesc },
              { id: "device" as PageTurnMethod, label: t.student.performDeviceTilt, desc: t.student.performDeviceTiltDesc },
              { id: "webcam" as PageTurnMethod, label: t.student.performHeadTilt, desc: t.student.performHeadTiltDesc },
            ]).map(({ id, label, desc }) => (
              <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid #2a2a2a" }}>
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "#ddd", fontWeight: 500 }}>{label}</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#666", marginTop: "0.125rem" }}>{desc}</div>
                  {id === "webcam" && webcamStatus && (
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6rem", color: webcamActive ? "#7ec87e" : "#e74c3c", marginTop: "0.125rem" }}>{webcamStatus}</div>
                  )}
                </div>
                <button
                  onClick={() => setEnabledMethods(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: enabledMethods.has(id) ? "#4CAF50" : "#333", transition: "background 0.2s", position: "relative" }}
                >
                  <div style={{ position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", left: enabledMethods.has(id) ? 22 : 2 }} />
                </button>
              </div>
            ))}

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
              <Link href="/student/pieces" style={{ flex: 1, padding: "0.625rem", borderRadius: 4, border: "1px solid #333", color: "#888", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", textAlign: "center", textDecoration: "none" }}>{t.student.performBackToPieces}</Link>
              <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: "0.625rem", borderRadius: 4, border: "none", background: "#333", color: "#ddd", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", cursor: "pointer" }}>{t.student.performClose}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom toolbar ── */}
      <div style={{
        position: fullscreen ? "fixed" : "sticky",
        bottom: 0, left: 0, right: 0,
        height: 64, zIndex: 20,
        background: "rgba(16,14,12,0.95)", backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", gap: "0.25rem", padding: "0 0.75rem",
        flexWrap: "nowrap", overflowX: "auto",
      }}>
        {/* Annotation: Pencil */}
        <button
          onClick={() => setTool(t => t === "pencil" ? "none" : "pencil")}
          title="Pencil"
          style={{ ...toolBtnStyle, background: tool === "pencil" ? "#fff" : "transparent", color: tool === "pencil" ? "#111" : "#aaa" }}
        ><Pencil size={18} strokeWidth={1.5} /></button>

        {/* Annotation: Eraser */}
        <button
          onClick={() => setTool(t => t === "eraser" ? "none" : "eraser")}
          title="Eraser"
          style={{ ...toolBtnStyle, background: tool === "eraser" ? "#fff" : "transparent", color: tool === "eraser" ? "#111" : "#aaa" }}
        >⌫</button>

        {/* Text tool */}
        <button
          onClick={() => setTool(t => t === "text" ? "none" : "text")}
          title="Text"
          style={{ ...toolBtnStyle, background: tool === "text" ? "#fff" : "transparent", color: tool === "text" ? "#111" : "#aaa", fontSize: "0.875rem", fontWeight: 700, fontFamily: "serif" }}
        >T</button>

        {/* Colors (only when pencil or text active) */}
        {(tool === "pencil" || tool === "text") && COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{ width: 18, height: 18, borderRadius: "50%", border: color === c ? "2px solid #fff" : "2px solid transparent", background: c, cursor: "pointer", flexShrink: 0 }} />
        ))}

        {/* Line width (only when pencil active) */}
        {tool === "pencil" && LINE_WIDTHS.map(w => (
          <button key={w} onClick={() => setLineWidth(w)} style={{ ...toolBtnStyle, background: lineWidth === w ? "#444" : "transparent", color: "#aaa", fontSize: "0.6rem", padding: "0 6px" }}>
            <div style={{ width: w * 2.5, height: w, background: "#fff", borderRadius: 2 }} />
          </button>
        ))}

        {/* Clear page */}
        {tool !== "none" && (
          <button onClick={clearPage} title="Clear page annotations" style={{ ...toolBtnStyle, color: "#e74c3c", fontSize: "0.65rem", padding: "0 8px" }}>CLR</button>
        )}

        <div style={{ flex: 1 }} />

        {/* Page navigation */}
        <button onClick={goPrev} disabled={pageIndex === 0} style={{ ...toolBtnStyle, opacity: pageIndex === 0 ? 0.3 : 1 }}>‹</button>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#888", whiteSpace: "nowrap", minWidth: 60, textAlign: "center" }}>
          {numPages > 0 ? `${pageIndex + 1} / ${numPages}` : "—"}
        </span>
        <button onClick={goNext} disabled={pageIndex >= numPages - 1} style={{ ...toolBtnStyle, opacity: pageIndex >= numPages - 1 ? 0.3 : 1 }}>›</button>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 0.25rem" }} />

        {/* Zoom */}
        <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))} style={toolBtnStyle} title="Zoom out">−</button>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6rem", color: "#888", minWidth: 32, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)))} style={toolBtnStyle} title="Zoom in">+</button>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 0.25rem" }} />

        {/* Metronome toggle */}
        <button onClick={() => setMetronomeOpen(o => !o)} title="Metronome" style={{ ...toolBtnStyle, color: metronomeOpen ? "#fff" : "#888" }}>♩</button>

        {/* Record toggle */}
        <button onClick={() => setRecOpen(o => !o)} title="Record" style={{ ...toolBtnStyle, color: recOpen || recording ? "#e74c3c" : "#888" }}><Circle size={18} fill={recOpen || recording ? "#e74c3c" : "none"} strokeWidth={recOpen || recording ? 0 : 1.5} /></button>

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} title="Fullscreen" style={toolBtnStyle}>{fullscreen ? "⛶" : "⛶"}</button>

        {/* Settings */}
        <button onClick={() => setShowSettings(true)} title="Settings" style={toolBtnStyle}>⚙</button>
      </div>
    </div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", color: "#aaa",
  width: 36, height: 36, borderRadius: 4, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "1rem", flexShrink: 0,
};
