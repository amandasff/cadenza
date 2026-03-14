"use client";
import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  onClose: () => void;
}

const COLORS = ["#2C2824", "#B85C3A", "#3D6B55", "#2D5E78", "#7A4858", "#7A6318", "#5E5880"];
const SIZES = [3, 6, 12];

export default function FunModeCanvas({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("#2C2824");
  const [size, setSize] = useState(1); // index into SIZES

  // Pre-fill existing drawing if any
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FDFCFA";
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

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.strokeStyle = color;
    ctx.lineWidth = SIZES[size];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw() {
    drawing.current = false;
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FDFCFA";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function saveAndClose() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    localStorage.setItem("cadenza-fun-drawing", canvas.toDataURL("image/png"));
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(44,40,36,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#FDFCFA", borderRadius: 20, padding: "1.5rem",
        display: "flex", flexDirection: "column", gap: "1rem",
        width: "min(480px, 100%)", boxShadow: "0 24px 64px rgba(44,40,36,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#2C2824", letterSpacing: "-0.01em" }}>Draw something ✏️</div>
            <div style={{ fontSize: "0.75rem", color: "#9A9590", marginTop: 2 }}>It'll float in the background while you use the app</div>
          </div>
          <button onClick={clearCanvas} style={{ background: "none", border: "1px solid #E8E3D9", borderRadius: 6, padding: "0.3rem 0.625rem", cursor: "pointer", fontSize: "0.75rem", color: "#9A9590" }}>
            Clear
          </button>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          style={{
            width: "100%", aspectRatio: "8/5", borderRadius: 12,
            border: "1.5px solid #E8E3D9", cursor: "crosshair", touchAction: "none",
            background: "#FDFCFA",
          }}
        />

        {/* Tools */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          {/* Colors */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 24, height: 24, borderRadius: "50%", background: c,
                  border: color === c ? "2.5px solid #2C2824" : "2px solid transparent",
                  outline: color === c ? "2px solid #FDFCFA" : "none",
                  outlineOffset: "-1px",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
          {/* Brush sizes */}
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            {SIZES.map((s, i) => (
              <button
                key={s}
                onClick={() => setSize(i)}
                style={{
                  width: 28, height: 28, borderRadius: "50%", background: size === i ? "#2C2824" : "#F1EDE5",
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <span style={{ width: s * 1.5, height: s * 1.5, borderRadius: "50%", background: size === i ? "#FDFCFA" : "#2C2824", display: "block" }} />
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "0.7rem", borderRadius: 10, border: "1px solid #E8E3D9", background: "transparent", cursor: "pointer", fontSize: "0.875rem", color: "#9A9590", fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={saveAndClose}
            style={{ flex: 2, padding: "0.7rem", borderRadius: 10, border: "none", background: "#2C2824", color: "#FDFCFA", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}
          >
            Done — float it! 🎨
          </button>
        </div>
      </div>
    </div>
  );
}
