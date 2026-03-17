"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/context/ThemeContext";
import { Pencil } from "lucide-react";

const DEFAULT_EMOJIS = ["🎵", "🎶", "✨", "⭐", "🎸", "🎹"];

/* ── particle helpers ─────────────────────────────────── */

function spawnEmoji(x: number, y: number, emoji: string) {
  const el = document.createElement("span");
  el.textContent = emoji;
  const size = 20 + Math.random() * 16; // 20–36px — large enough to see
  const angle = (Math.random() - 0.5) * 60;
  const dy = -(30 + Math.random() * 40);
  const dx = (Math.random() - 0.5) * 40;

  el.style.cssText = [
    "position:fixed",
    `left:${x}px`, `top:${y}px`,
    `font-size:${size}px`,
    "pointer-events:none", "z-index:9990",
    `transform:translate(-50%,-50%) rotate(${angle}deg)`,
    "opacity:1", "line-height:1",
    "transition:transform 0.9s cubic-bezier(.1,.85,.3,1),opacity 0.9s ease-out",
    "will-change:transform,opacity",
  ].join(";");
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${angle + (Math.random() - 0.5) * 40}deg) scale(0.15)`;
    el.style.opacity = "0";
  });
  setTimeout(() => el.remove(), 950);
}

function spawnDoodleStamp(x: number, y: number, src: string) {
  const el = document.createElement("img");
  el.src = src;
  const size = 36 + Math.random() * 20; // 36–56px
  const angle = (Math.random() - 0.5) * 50;
  const dy = -(25 + Math.random() * 35);
  const dx = (Math.random() - 0.5) * 40;

  el.style.cssText = [
    "position:fixed",
    `left:${x}px`, `top:${y}px`,
    `width:${size}px`, `height:${size}px`,
    "object-fit:contain",
    "pointer-events:none", "z-index:9990",
    "border-radius:4px",
    "mix-blend-mode:multiply",  // white canvas bg becomes transparent
    `transform:translate(-50%,-50%) rotate(${angle}deg)`,
    "opacity:0.85",
    "transition:transform 0.9s cubic-bezier(.1,.85,.3,1),opacity 0.9s ease-out",
    "will-change:transform,opacity",
  ].join(";");
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${angle + (Math.random() - 0.5) * 30}deg) scale(0.2)`;
    el.style.opacity = "0";
  });
  setTimeout(() => el.remove(), 950);
}

function spawnClickBurst(x: number, y: number, emojis: string[], doodleSrc: string | null) {
  const count = 9;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 55 + Math.random() * 55;

    // Every 3rd item is a doodle stamp if available
    if (i % 3 === 0 && doodleSrc) {
      const el = document.createElement("img");
      el.src = doodleSrc;
      const size = 30 + Math.random() * 18;
      const rot = (Math.random() - 0.5) * 60;
      el.style.cssText = [
        "position:fixed",
        `left:${x}px`, `top:${y}px`,
        `width:${size}px`, `height:${size}px`,
        "object-fit:contain", "border-radius:3px",
        "mix-blend-mode:multiply",
        "pointer-events:none", "z-index:9991",
        `transform:translate(-50%,-50%) rotate(${rot}deg) scale(1)`,
        "opacity:1",
        "transition:transform 0.8s cubic-bezier(.1,.9,.3,1),opacity 0.8s ease-out",
        "will-change:transform,opacity",
      ].join(";");
      document.body.appendChild(el);
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      requestAnimationFrame(() => {
        el.style.transform = `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) rotate(${rot + 30}deg) scale(0.1)`;
        el.style.opacity = "0";
      });
      setTimeout(() => el.remove(), 850);
    } else {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const el = document.createElement("span");
      el.textContent = emoji;
      const size = 18 + Math.random() * 12;
      el.style.cssText = [
        "position:fixed",
        `left:${x}px`, `top:${y}px`,
        `font-size:${size}px`,
        "pointer-events:none", "z-index:9991",
        "transform:translate(-50%,-50%) scale(1)",
        "opacity:1", "line-height:1",
        "transition:transform 0.8s cubic-bezier(.1,.9,.3,1),opacity 0.8s ease-out",
        "will-change:transform,opacity",
      ].join(";");
      document.body.appendChild(el);
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      requestAnimationFrame(() => {
        el.style.transform = `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0.1)`;
        el.style.opacity = "0";
      });
      setTimeout(() => el.remove(), 850);
    }
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
      0%   { transform: translateY(0) translateX(0) rotate(0deg);    opacity:0; }
      8%   { opacity:0.65; }
      92%  { opacity:0.65; }
      100% { transform: translateY(-105vh) translateX(40px) rotate(180deg); opacity:0; }
    }
    @keyframes cadenza-drift-b {
      0%   { transform: translateY(0) translateX(0) rotate(0deg);    opacity:0; }
      8%   { opacity:0.55; }
      92%  { opacity:0.55; }
      100% { transform: translateY(-105vh) translateX(-60px) rotate(-140deg); opacity:0; }
    }
    @keyframes cadenza-drift-c {
      0%   { transform: translateY(0) translateX(0) rotate(0deg);    opacity:0; }
      10%  { opacity:0.60; }
      90%  { opacity:0.60; }
      100% { transform: translateY(-105vh) translateX(25px) rotate(100deg);  opacity:0; }
    }
    @keyframes cadenza-drift-d {
      0%   { transform: translateY(0) translateX(0) rotate(0deg);    opacity:0; }
      10%  { opacity:0.50; }
      90%  { opacity:0.50; }
      100% { transform: translateY(-105vh) translateX(-35px) rotate(-210deg); opacity:0; }
    }
    .cadenza-ambient {
      position:fixed; bottom:-48px; pointer-events:none;
      z-index:1; font-size:2rem; line-height:1; user-select:none;
    }
    .cadenza-ambient-img {
      position:fixed; bottom:-48px; pointer-events:none;
      z-index:1; width:44px; height:44px; object-fit:contain;
      border-radius:4px; opacity:0; mix-blend-mode:multiply;
    }
  `;
  document.head.appendChild(style);
}

function createAmbientDrifters(emojis: string[], doodleSrc: string | null): (HTMLSpanElement | HTMLImageElement)[] {
  injectAmbientStyles();
  const configs = [
    { left: "7%",  delay: "0s",   dur: "10s",  anim: "cadenza-drift-a", idx: 0 },
    { left: "25%", delay: "2.2s", dur: "13s",  anim: "cadenza-drift-b", idx: 1 },
    { left: "50%", delay: "1s",   dur: "11s",  anim: "cadenza-drift-c", idx: 2 }, // doodle slot
    { left: "72%", delay: "4.5s", dur: "12s",  anim: "cadenza-drift-d", idx: 3 },
    { left: "88%", delay: "7s",   dur: "9.5s", anim: "cadenza-drift-a", idx: 4 },
  ];
  return configs.map(({ left, delay, dur, anim, idx }) => {
    // Middle slot (idx 2) uses the doodle if available
    if (idx === 2 && doodleSrc) {
      const el = document.createElement("img");
      el.src = doodleSrc;
      el.className = "cadenza-ambient-img";
      el.style.left = left;
      el.style.animation = `${anim} ${dur} ${delay} infinite linear`;
      document.body.appendChild(el);
      return el;
    }
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
  const ambientEls = useRef<(HTMLSpanElement | HTMLImageElement)[]>([]);

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

  // Ambient drifters — recreate when emojis or drawing changes
  const emojiKey = funTheme?.emojis?.join("") ?? "";
  useEffect(() => {
    if (theme !== "fun") return;
    const emojis = funTheme?.emojis ?? DEFAULT_EMOJIS;
    ambientEls.current = createAmbientDrifters(emojis, drawingSrcRef.current);
    return () => {
      ambientEls.current.forEach(el => el.remove());
      ambientEls.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, emojiKey]);

  // Cursor trail + click bursts
  useEffect(() => {
    if (theme !== "fun") return;

    let last = 0;
    function onMove(e: MouseEvent | TouchEvent) {
      const now = Date.now();
      if (now - last < 60) return; // 60ms throttle — responsive but not overwhelming
      last = now;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const pool = funTheme?.emojis ?? DEFAULT_EMOJIS;
      // 25% chance to spawn doodle stamp if drawing exists
      if (drawingSrcRef.current && Math.random() < 0.25) {
        spawnDoodleStamp(x, y, drawingSrcRef.current);
      } else {
        spawnEmoji(x, y, pool[Math.floor(Math.random() * pool.length)]);
      }
    }

    function onClick(e: MouseEvent) {
      spawnClickBurst(e.clientX, e.clientY, funTheme?.emojis ?? DEFAULT_EMOJIS, drawingSrcRef.current);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("click", onClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, emojiKey]);

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
      <Pencil size={16} strokeWidth={1.5} />
    </button>
  );
}
