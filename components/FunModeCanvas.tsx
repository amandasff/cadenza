"use client";
import { useRef, useEffect, useState } from "react";

interface Props {
  onClose: () => void;
}

const COLORS = ["#1A1714", "#B85C3A", "#3D6B55", "#2D5E78", "#7A4858", "#7A6318", "#E8A87C"];
const SIZES  = [3, 7, 14];

export default function FunModeCanvas({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("#1A1714");
  const [size,  setSize]  = useState(1);

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

  function pos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const c = canvasRef.current; if (!c) return;
    drawing.current  = true;
    lastPos.current  = pos(e, c);
  }

  function onMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const p = pos(e, c);
    ctx.strokeStyle = color;
    ctx.lineWidth   = SIZES[size];
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPos.current = p;
  }

  function onUp() { drawing.current = false; lastPos.current = null; }

  function clear() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, c.width, c.height);
  }

  function save() {
    const c = canvasRef.current; if (!c) return;
    localStorage.setItem("cadenza-fun-drawing", c.toDataURL("image/png"));
    window.dispatchEvent(new Event("cadenza-drawing-saved"));
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(26,23,20,0.55)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#FFFFFF", borderRadius: 20, padding: "1.5rem",
        display: "flex", flexDirection: "column", gap: "1rem",
        width: "min(500px, 100%)", boxShadow: "0 32px 80px rgba(26,23,20,0.35)",
        border: "1px solid #E8E3D9",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#1A1714", letterSpacing: "-0.01em" }}>
              Draw your doodle ✏️
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9A9590", marginTop: 2 }}>
              It'll float in the background as you use the app
            </div>
          </div>
          <button onClick={clear} style={{
            background: "none", border: "1px solid #E8E3D9", borderRadius: 6,
            padding: "0.3rem 0.625rem", cursor: "pointer", fontSize: "0.75rem", color: "#9A9590",
          }}>
            Clear
          </button>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={800} height={500}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          style={{
            width: "100%", aspectRatio: "8/5", borderRadius: 12,
            border: "1.5px solid #E8E3D9", cursor: "crosshair",
            touchAction: "none", background: "#FFFFFF", display: "block",
          }}
        />

        {/* Tools */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                border: color === c ? "2.5px solid #1A1714" : "2px solid transparent",
                outline: color === c ? "2px solid #FFFFFF" : "none",
                outlineOffset: "-1px",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            {SIZES.map((s, i) => (
              <button key={s} onClick={() => setSize(i)} style={{
                width: 30, height: 30, borderRadius: "50%",
                background: size === i ? "#1A1714" : "#F1EDE5",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  width: s * 1.4, height: s * 1.4, borderRadius: "50%",
                  background: size === i ? "#FFFFFF" : "#1A1714", display: "block",
                }} />
              </button>
            ))}
          </div>
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
    </div>
  );
}
