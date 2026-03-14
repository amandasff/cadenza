"use client";
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/lib/context/ThemeContext";

const NOTES = ["🎵", "🎶", "✨", "⭐", "🎸", "🎹", "🎺", "🎀", "🌟"];

function spawnParticle(x: number, y: number) {
  const el = document.createElement("span");
  el.textContent = NOTES[Math.floor(Math.random() * NOTES.length)];
  const size = 12 + Math.random() * 10;
  const angle = Math.random() * Math.PI * 2;
  const dist  = 25 + Math.random() * 40;
  const dx    = Math.cos(angle) * dist;
  const dy    = Math.sin(angle) * dist - 20; // always drift slightly up

  el.style.cssText = [
    "position:fixed",
    `left:${x}px`,
    `top:${y}px`,
    `font-size:${size}px`,
    "pointer-events:none",
    "z-index:9990",
    "transform:translate(-50%,-50%)",
    "opacity:1",
    "transition:transform 0.7s cubic-bezier(.2,.8,.4,1),opacity 0.7s ease-out",
    "will-change:transform,opacity",
  ].join(";");

  document.body.appendChild(el);

  // Trigger animation on next frame
  requestAnimationFrame(() => {
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`;
    el.style.opacity = "0";
  });

  setTimeout(() => el.remove(), 720);
}

export default function FloatingDrawing() {
  const { theme, openDrawModal } = useTheme();
  const [drawingSrc, setDrawingSrc] = useState<string | null>(null);

  // Refresh drawing from localStorage whenever theme switches to fun or modal closes
  useEffect(() => {
    if (theme === "fun") {
      setDrawingSrc(localStorage.getItem("cadenza-fun-drawing"));
    } else {
      setDrawingSrc(null);
    }
  }, [theme]);

  // Listen for the custom event fired when a new drawing is saved
  useEffect(() => {
    function onDrawSaved() {
      setDrawingSrc(localStorage.getItem("cadenza-fun-drawing"));
    }
    window.addEventListener("cadenza-drawing-saved", onDrawSaved);
    return () => window.removeEventListener("cadenza-drawing-saved", onDrawSaved);
  }, []);

  // Cursor sparkle trail
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    spawnParticle(x, y);
  }, []);

  useEffect(() => {
    if (theme !== "fun") return;

    let last = 0;
    function throttled(e: MouseEvent | TouchEvent) {
      const now = Date.now();
      if (now - last < 90) return;
      last = now;
      handleMove(e);
    }

    document.addEventListener("mousemove", throttled);
    document.addEventListener("touchmove", throttled, { passive: true });
    return () => {
      document.removeEventListener("mousemove", throttled);
      document.removeEventListener("touchmove", throttled);
    };
  }, [theme, handleMove]);

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
