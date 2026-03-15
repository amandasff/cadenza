"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { useTheme, FunThemeVars } from "@/lib/context/ThemeContext";

interface Props {
  onClose: () => void;
}

const PRESET_COLORS = [
  "#1A1714", "#FFFFFF", "#B85C3A", "#E05252",
  "#3D6B55", "#2D5E78", "#7A4858", "#7A6318",
  "#E8A87C", "#A78BCA", "#5BA4CF", "#F9C74F",
];
const SIZES = [2, 6, 14, 24];
const MAX_UNDO = 20;

export default function FunModeCanvas({ onClose }: Props) {
  const { applyFunTheme, resetFunTheme, funTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [color, setColor] = useState("#1A1714");
  const [size, setSize] = useState(1);
  const [isEraser, setIsEraser] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // AI image generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI theme
  const [themeInput, setThemeInput] = useState("");
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const saved = localStorage.getItem("cadenza-fun-drawing");
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = saved;
    }
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = [...historyRef.current.slice(-MAX_UNDO + 1), snap];
    setCanUndo(true);
  }

  function undo() {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    ctx.putImageData(prev, 0, 0);
    setCanUndo(historyRef.current.length > 0);
  }

  function onDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    pushHistory();
    drawing.current = true;
    lastPos.current = getPos(e, c);
  }

  function onMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = getPos(e, c);
    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = SIZES[size];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    lastPos.current = p;
  }

  function onUp() { drawing.current = false; lastPos.current = null; }

  function clear() {
    pushHistory();
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);
  }

  function save() {
    const c = canvasRef.current;
    if (!c) return;
    localStorage.setItem("cadenza-fun-drawing", c.toDataURL("image/png"));
    window.dispatchEvent(new Event("cadenza-drawing-saved"));
    onClose();
  }

  const generateAiImage = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setAiLoading(true);
    setAiError(null);
    pushHistory();

    try {
      // Route through our server-side proxy to avoid CORS entirely
      const seed = Math.floor(Math.random() * 99999);
      const proxyUrl = `/api/generate-image?seed=${seed}&prompt=${encodeURIComponent(aiPrompt + ", colorful, music themed, digital art")}`;

      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image failed to load"));
        img.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch {
      setAiError("Couldn't generate image — the AI server may be busy, try again in a moment.");
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt]);

  async function generateTheme() {
    if (!themeInput.trim()) return;
    setThemeLoading(true);
    setThemeError(null);
    try {
      const res = await fetch("/api/fun-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: themeInput }),
      });
      if (!res.ok) throw new Error("Failed");
      const { theme } = await res.json() as { theme: FunThemeVars };
      applyFunTheme(theme);
    } catch {
      setThemeError("Couldn't generate theme — try again!");
    } finally {
      setThemeLoading(false);
    }
  }

  const activeColor = isEraser ? "#F1EDE5" : color;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(26,23,20,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#FFFFFF", borderRadius: 20, padding: "1.25rem",
        display: "flex", flexDirection: "column", gap: "0.875rem",
        width: "min(540px, 100%)", maxHeight: "calc(100dvh - 2rem)", overflowY: "auto",
        boxShadow: "0 32px 80px rgba(26,23,20,0.35)",
        border: "1px solid #E8E3D9",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1A1714", letterSpacing: "-0.01em" }}>
              Draw your doodle ✏️
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#9A9590", marginTop: 2 }}>
              It'll float in the background as you use the app
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo"
              style={{
                background: "none", border: "1px solid #E8E3D9", borderRadius: 6,
                padding: "0.3rem 0.625rem", cursor: canUndo ? "pointer" : "default",
                fontSize: "0.75rem", color: canUndo ? "#1A1714" : "#C8C3B9",
                transition: "all 0.12s",
              }}
            >
              ↩ Undo
            </button>
            <button onClick={clear} style={{
              background: "none", border: "1px solid #E8E3D9", borderRadius: 6,
              padding: "0.3rem 0.625rem", cursor: "pointer", fontSize: "0.75rem", color: "#9A9590",
            }}>
              Clear
            </button>
          </div>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={800} height={500}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          style={{
            width: "100%", aspectRatio: "8/5", borderRadius: 12,
            border: "1.5px solid #E8E3D9",
            cursor: isEraser ? "cell" : "crosshair",
            touchAction: "none", background: "#FFFFFF", display: "block",
          }}
        />

        {/* Tools row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
          {/* Color swatches */}
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", flex: 1 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setIsEraser(false); }}
                style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: c, cursor: "pointer",
                  border: !isEraser && color === c ? "2.5px solid #1A1714" : "1.5px solid #E8E3D9",
                  outline: !isEraser && color === c ? "2px solid #FFFFFF" : "none",
                  outlineOffset: "-1px",
                  boxShadow: c === "#FFFFFF" ? "inset 0 0 0 1px #E8E3D9" : "none",
                  transition: "transform 0.1s",
                }}
              />
            ))}
            {/* Custom color picker */}
            <label
              title="Custom color"
              style={{
                width: 24, height: 24, borderRadius: "50%", cursor: "pointer",
                background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                border: "1.5px solid #E8E3D9", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <input
                type="color"
                value={color}
                onChange={e => { setColor(e.target.value); setIsEraser(false); }}
                style={{ opacity: 0, width: 1, height: 1, position: "absolute" }}
              />
            </label>
          </div>

          {/* Eraser */}
          <button
            onClick={() => setIsEraser(e => !e)}
            title="Eraser"
            style={{
              padding: "0.3rem 0.625rem", borderRadius: 6, fontSize: "0.8125rem",
              border: isEraser ? "2px solid #1A1714" : "1px solid #E8E3D9",
              background: isEraser ? "#F1EDE5" : "transparent",
              cursor: "pointer", fontWeight: isEraser ? 600 : 400, color: "#1A1714",
            }}
          >
            ⬜ Erase
          </button>

          {/* Brush sizes */}
          <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
            {SIZES.map((s, i) => (
              <button
                key={s}
                onClick={() => setSize(i)}
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: size === i ? "#1A1714" : "#F1EDE5",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.1s",
                }}
              >
                <span style={{
                  width: Math.max(3, s * 0.9), height: Math.max(3, s * 0.9),
                  borderRadius: "50%",
                  background: size === i ? "#FFFFFF" : "#1A1714",
                  display: "block",
                }} />
              </button>
            ))}
          </div>
        </div>

        {/* AI Image Generator */}
        <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "0.875rem" }}>
          <div style={{ fontSize: "0.7rem", color: "#9A9590", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            🤖 AI image — describe anything!
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generateAiImage()}
              placeholder="cats playing piano, galaxy, dragon, anything..."
              disabled={aiLoading}
              style={{
                flex: 1, padding: "0.5rem 0.75rem", borderRadius: 8,
                border: "1px solid #E8E3D9", fontSize: "0.8125rem",
                fontFamily: "Inter, sans-serif", outline: "none", color: "#1A1714",
                background: "#FDFCFA",
              }}
            />
            <button
              onClick={generateAiImage}
              disabled={aiLoading || !aiPrompt.trim()}
              style={{
                padding: "0.5rem 1rem", borderRadius: 8, border: "none",
                background: aiPrompt.trim() && !aiLoading ? "#3D6B55" : "#E8E3D9",
                color: aiPrompt.trim() && !aiLoading ? "#FFFFFF" : "#9A9590",
                cursor: aiPrompt.trim() && !aiLoading ? "pointer" : "default",
                fontSize: "0.8125rem", fontWeight: 600, whiteSpace: "nowrap",
                transition: "all 0.15s", minWidth: 80,
              }}
            >
              {aiLoading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "0.875rem" }}>⟳</span>
                  <span>Gen...</span>
                </span>
              ) : "✨ Generate"}
            </button>
          </div>
          {aiError && <div style={{ fontSize: "0.7rem", color: "#B85C3A", marginTop: "0.375rem" }}>{aiError}</div>}
          {aiLoading && (
            <div style={{ fontSize: "0.7rem", color: "#9A9590", marginTop: "0.375rem" }}>
              Generating your image — this takes ~10 seconds...
            </div>
          )}
          <div style={{ fontSize: "0.6875rem", color: "#B8B3A9", marginTop: "0.375rem" }}>
            Free AI • draw on top of it after!
          </div>
        </div>

        {/* AI Theme Generator */}
        <div style={{ borderTop: "1px solid #E8E3D9", paddingTop: "0.875rem" }}>
          <div style={{ fontSize: "0.7rem", color: "#9A9590", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            ✨ AI theme magic
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={themeInput}
              onChange={e => setThemeInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generateTheme()}
              placeholder="Describe a vibe — galaxy, cherry blossom, ocean..."
              style={{
                flex: 1, padding: "0.5rem 0.75rem", borderRadius: 8,
                border: "1px solid #E8E3D9", fontSize: "0.8125rem",
                fontFamily: "Inter, sans-serif", outline: "none", color: "#1A1714",
                background: "#FDFCFA",
              }}
            />
            <button
              onClick={generateTheme}
              disabled={themeLoading || !themeInput.trim()}
              style={{
                padding: "0.5rem 0.875rem", borderRadius: 8,
                border: "none", background: themeInput.trim() ? "#1A1714" : "#E8E3D9",
                color: themeInput.trim() ? "#FFFFFF" : "#9A9590",
                cursor: themeInput.trim() ? "pointer" : "default",
                fontSize: "0.8125rem", fontWeight: 600, whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {themeLoading ? "..." : "Apply"}
            </button>
            {funTheme && (
              <button
                onClick={resetFunTheme}
                title="Reset theme"
                style={{
                  padding: "0.5rem 0.625rem", borderRadius: 8,
                  border: "1px solid #E8E3D9", background: "transparent",
                  cursor: "pointer", fontSize: "0.8125rem", color: "#9A9590",
                }}
              >
                ↺
              </button>
            )}
          </div>
          {funTheme && <div style={{ fontSize: "0.7rem", color: "#3D6B55", marginTop: "0.375rem" }}>Theme active: {funTheme.label}</div>}
          {themeError && <div style={{ fontSize: "0.7rem", color: "#B85C3A", marginTop: "0.375rem" }}>{themeError}</div>}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "0.7rem", borderRadius: 10,
            border: "1px solid #E8E3D9", background: "transparent",
            cursor: "pointer", fontSize: "0.875rem", color: "#9A9590", fontWeight: 500,
          }}>
            Cancel
          </button>
          <button onClick={save} style={{
            flex: 2, padding: "0.7rem", borderRadius: 10,
            border: "none", background: "#1A1714", color: "#FFFFFF",
            cursor: "pointer", fontSize: "0.875rem", fontWeight: 600,
          }}>
            Done — use as my wallpaper 🎨
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
