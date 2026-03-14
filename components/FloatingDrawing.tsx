"use client";
import { useEffect, useState } from "react";
import { useTheme } from "@/lib/context/ThemeContext";

// Three instances with different drift animations
const INSTANCES = [
  { animClass: "fun-float-a", opacity: 0.12, scale: 0.55, top: "8%",  left: "5%" },
  { animClass: "fun-float-b", opacity: 0.09, scale: 0.40, top: "55%", left: "70%" },
  { animClass: "fun-float-c", opacity: 0.11, scale: 0.30, top: "30%", left: "82%" },
];

export default function FloatingDrawing() {
  const { theme, openDrawModal } = useTheme();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (theme === "fun") {
      setSrc(localStorage.getItem("cadenza-fun-drawing"));
    }
  }, [theme]);

  if (theme !== "fun" || !src) return null;

  return (
    <>
      {INSTANCES.map((inst, i) => (
        <img
          key={i}
          src={src}
          alt=""
          aria-hidden="true"
          className={inst.animClass}
          style={{
            position: "fixed",
            top: inst.top,
            left: inst.left,
            width: `${inst.scale * 480}px`,
            opacity: inst.opacity,
            pointerEvents: "none",
            zIndex: 0,
            borderRadius: 12,
            userSelect: "none",
          }}
        />
      ))}
      {/* Small redraw button */}
      <button
        onClick={openDrawModal}
        title="Redraw"
        style={{
          position: "fixed", bottom: "4.5rem", right: "1.5rem", zIndex: 100,
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--white)", border: "1px solid var(--border-strong)",
          boxShadow: "0 2px 12px rgba(44,40,36,0.12)",
          cursor: "pointer", fontSize: "0.9rem",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        ✏️
      </button>
    </>
  );
}
