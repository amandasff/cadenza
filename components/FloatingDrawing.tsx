"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/context/ThemeContext";

const DEFAULT_EMOJIS = ["🎵", "🎶", "✨", "⭐", "🎸", "🎹"];

/* ── particle helpers ─────────────────────────────────── */

function spawnEmoji(x: number, y: number, emoji: string, scale = 1) {
  const el = document.createElement("span");
  el.textContent = emoji;
  const size = (14 + Math.random() * 12) * scale;
  const angle = (Math.random() - 0.5) * 50;
  const dy = -(20 + Math.random() * 30);
  const dx = (Math.random() - 0.5) * 36;

  el.style.cssText = [
    "position:fixed",
    `left:${x}px`, `top:${y}px`,
    `font-size:${size}px`,
    "pointer-events:none", "z-index:9990",
    `transform:translate(-50%,-50%) rotate(${angle}deg)`,
    "opacity:0.9", "line-height:1",
    "transition:transform 0.7s cubic-bezier(.1,.8,.3,1),opacity 0.7s ease-out",
    "will-change:transform,opacity",
  ].join(";");
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${angle + (Math.random() - 0.5) * 30}deg) scale(0.2)`;
    el.style.opacity = "0";
  });
  setTimeout(() => el.remove(), 720);
}

function spawnClickBurst(x: number, y: number, emojis: string[]) {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 50 + Math.random() * 50;
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const el = document.createElement("span");
    el.textContent = emoji;
    const size = 16 + Math.random() * 10;
    el.style.cssText = [
      "position:fixed",
      `left:${x}px`, `top:${y}px`,
      `font-size:${size}px`,
      "pointer-events:none", "z-index:9991",
      "transform:translate(-50%,-50%) scale(1)",
      "opacity:1", "line-height:1",
      "transition:transform 0.75s cubic-bezier(.1,.9,.3,1),opacity 0.75s ease-out",
      "will-change:transform,opacity",
    ].join(";");
    document.body.appendChild(el);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0.1)`;
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 780);
  }
}

/* ── ambient drifters ─────────────────────────────────── */

const AMBIENT_STYLE_ID = "cadenza-ambient-style";

function injectAmbientStyles() {
  if (document.getElementById(AMBIENT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = AMBIENT_STYLE_ID;
  style.textContent = `
    @keyframes cadenza-drift-a {
      0%   { transform: translateY(0)   translateX(0)  rotate(0deg);   opacity: 0; }
      10%  { opacity: 0.55; }
      90%  { opacity: 0.55; }
      100% { transform: translateY(-100vh) translateX(40px)  rotate(180deg); opacity: 0; }
    }
    @keyframes cadenza-drift-b {
      0%   { transform: translateY(0)   translateX(0)  rotate(0deg);   opacity: 0; }
      10%  { opacity: 0.45; }
      90%  { opacity: 0.45; }
      100% { transform: translateY(-100vh) translateX(-60px) rotate(-120deg); opacity: 0; }
    }
    @keyframes cadenza-drift-c {
      0%   { transform: translateY(0)   translateX(0)  rotate(0deg);   opacity: 0; }
      15%  { opacity: 0.50; }
      85%  { opacity: 0.50; }
      100% { transform: translateY(-100vh) translateX(20px)  rotate(90deg);  opacity: 0; }
    }
    @keyframes cadenza-drift-d {
      0%   { transform: translateY(0)   translateX(0)  rotate(0deg);   opacity: 0; }
      12%  { opacity: 0.40; }
      88%  { opacity: 0.40; }
      100% { transform: translateY(-100vh) translateX(-30px) rotate(-200deg); opacity: 0; }
    }
    .cadenza-ambient {
      position: fixed; bottom: -40px; pointer-events: none;
      z-index: 1; font-size: 1.75rem; line-height: 1; user-select: none;
    }
  `;
  document.head.appendChild(style);
}

function createAmbientDrifters(emojis: string[]): HTMLSpanElement[] {
  injectAmbientStyles();
  const configs = [
    { left: "8%",  delay: "0s",    dur: "9s",  anim: "cadenza-drift-a", idx: 0 },
    { left: "28%", delay: "2.5s",  dur: "12s", anim: "cadenza-drift-b", idx: 1 },
    { left: "55%", delay: "1s",    dur: "10s", anim: "cadenza-drift-c", idx: 2 },
    { left: "78%", delay: "4s",    dur: "11s", anim: "cadenza-drift-d", idx: 3 },
    { left: "42%", delay: "6.5s",  dur: "13s", anim: "cadenza-drift-a", idx: 4 },
  ];
  return configs.map(({ left, delay, dur, anim, idx }) => {
    const el = document.createElement("span");
    el.className = "cadenza-ambient";
    el.textContent = emojis[idx % emojis.length];
    el.style.left = left;
    el.style.animation = `${anim} ${dur} ${delay} infinite linear`;
    document.body.appendChild(el);
    return el;
  });
}

/* ── component ────────────────────────────────────────── */

export default function FloatingDrawing() {
  const { theme, openDrawModal, funTheme } = useTheme();
  const drawingSrcRef = useRef<string | null>(null);
  const ambientEls = useRef<HTMLSpanElement[]>([]);

  // Keep drawing src ref in sync
  useEffect(() => {
    if (theme === "fun") {
      drawingSrcRef.current = localStorage.getItem("cadenza-fun-drawing");
    } else {
      drawingSrcRef.current = null;
    }
    function onDrawSaved() {
      drawingSrcRef.current = localStorage.getItem("cadenza-fun-drawing");
    }
    window.addEventListener("cadenza-drawing-saved", onDrawSaved);
    return () => window.removeEventListener("cadenza-drawing-saved", onDrawSaved);
  }, [theme]);

  // Ambient drifters — recreate whenever emojis change
  useEffect(() => {
    if (theme !== "fun") return;
    const emojis = funTheme?.emojis ?? DEFAULT_EMOJIS;
    ambientEls.current = createAmbientDrifters(emojis);
    return () => {
      ambientEls.current.forEach(el => el.remove());
      ambientEls.current = [];
    };
  }, [theme, funTheme?.emojis?.join("")]);

  // Cursor trail
  useEffect(() => {
    if (theme !== "fun") return;
    const emojis = () => funTheme?.emojis ?? DEFAULT_EMOJIS;
    let last = 0;

    function onMove(e: MouseEvent | TouchEvent) {
      const now = Date.now();
      if (now - last < 85) return;
      last = now;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const pool = emojis();
      spawnEmoji(x, y, pool[Math.floor(Math.random() * pool.length)]);
    }

    function onClick(e: MouseEvent) {
      spawnClickBurst(e.clientX, e.clientY, emojis());
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("click", onClick);
    };
  }, [theme, funTheme?.emojis?.join("")]);

  if (theme !== "fun") return null;

  return (
    <button
      onClick={openDrawModal}
      title="Open draw pad"
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
  );
}
