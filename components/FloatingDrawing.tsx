"use client";
import { useEffect, useState, useRef } from "react";
import { useTheme } from "@/lib/context/ThemeContext";

function spawnDoodleStamp(x: number, y: number, src: string) {
  const el = document.createElement("img");
  el.src = src;
  const size = 28 + Math.random() * 22; // 28–50px
  const angle = (Math.random() - 0.5) * 60; // –30° to +30°
  const dy = -(18 + Math.random() * 24);   // drift upward
  const dx = (Math.random() - 0.5) * 30;   // slight horizontal drift

  el.style.cssText = [
    "position:fixed",
    `left:${x}px`,
    `top:${y}px`,
    `width:${size}px`,
    `height:${size}px`,
    "object-fit:contain",
    "pointer-events:none",
    "z-index:9990",
    `transform:translate(-50%,-50%) rotate(${angle}deg)`,
    "opacity:0.72",
    "border-radius:4px",
    "transition:transform 0.65s cubic-bezier(.15,.8,.35,1),opacity 0.65s ease-out",
    "will-change:transform,opacity",
  ].join(";");

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${angle + (Math.random() - 0.5) * 20}deg) scale(0.35)`;
    el.style.opacity = "0";
  });

  setTimeout(() => el.remove(), 680);
}

function spawnDot(x: number, y: number) {
  const el = document.createElement("div");
  const size = 6 + Math.random() * 6;
  const dy = -(12 + Math.random() * 20);
  const dx = (Math.random() - 0.5) * 24;
  const hue = Math.floor(Math.random() * 360);

  el.style.cssText = [
    "position:fixed",
    `left:${x}px`,
    `top:${y}px`,
    `width:${size}px`,
    `height:${size}px`,
    `background:hsl(${hue},70%,65%)`,
    "border-radius:50%",
    "pointer-events:none",
    "z-index:9990",
    "transform:translate(-50%,-50%)",
    "opacity:0.8",
    "transition:transform 0.6s cubic-bezier(.15,.8,.35,1),opacity 0.6s ease-out",
    "will-change:transform,opacity",
  ].join(";");

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.1)`;
    el.style.opacity = "0";
  });

  setTimeout(() => el.remove(), 640);
}

export default function FloatingDrawing() {
  const { theme, openDrawModal } = useTheme();
  const [drawingSrc, setDrawingSrc] = useState<string | null>(null);
  const drawingSrcRef = useRef<string | null>(null);

  // Refresh drawing from localStorage whenever theme switches to fun or modal closes
  useEffect(() => {
    if (theme === "fun") {
      const src = localStorage.getItem("cadenza-fun-drawing");
      setDrawingSrc(src);
      drawingSrcRef.current = src;
    } else {
      setDrawingSrc(null);
      drawingSrcRef.current = null;
    }
  }, [theme]);

  // Listen for the custom event fired when a new drawing is saved
  useEffect(() => {
    function onDrawSaved() {
      const src = localStorage.getItem("cadenza-fun-drawing");
      setDrawingSrc(src);
      drawingSrcRef.current = src;
    }
    window.addEventListener("cadenza-drawing-saved", onDrawSaved);
    return () => window.removeEventListener("cadenza-drawing-saved", onDrawSaved);
  }, []);

  // Cursor trail — doodle stamps when drawing exists, colorful dots otherwise
  useEffect(() => {
    if (theme !== "fun") return;

    let last = 0;
    function throttled(e: MouseEvent | TouchEvent) {
      const now = Date.now();
      if (now - last < 80) return;
      last = now;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      if (drawingSrcRef.current) {
        spawnDoodleStamp(x, y, drawingSrcRef.current);
      } else {
        spawnDot(x, y);
      }
    }

    document.addEventListener("mousemove", throttled);
    document.addEventListener("touchmove", throttled, { passive: true });
    return () => {
      document.removeEventListener("mousemove", throttled);
      document.removeEventListener("touchmove", throttled);
    };
  }, [theme]);

  if (theme !== "fun") return null;

  return (
    <>
      {/* Drawing as a subtle centered watermark */}
      {drawingSrc && (
        <img
          src={drawingSrc}
          alt=""
          aria-hidden="true"
          style={{
            position: "fixed",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(55vw, 380px)",
            opacity: 0.055,
            pointerEvents: "none",
            zIndex: 0,
            userSelect: "none",
            borderRadius: 12,
          }}
        />
      )}

      {/* Redraw button */}
      <button
        onClick={openDrawModal}
        title="Redraw your doodle"
        style={{
          position: "fixed", bottom: "4.5rem", right: "1.5rem", zIndex: 100,
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--white)", border: "1px solid var(--border-strong)",
          boxShadow: "0 2px 12px rgba(44,40,36,0.12)",
          cursor: "pointer", fontSize: "0.85rem",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        ✏️
      </button>
    </>
  );
}
