"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "light" | "dark" | "fun";

export interface FunThemeVars {
  background: string;
  charcoal: string;
  muted: string;
  border: string;
  borderStrong: string;
  cream: string;
  white: string;
  label: string;
  emojis: string[]; // themed characters for cursor trail + ambient effects
}

interface ThemeCtx {
  theme: AppTheme;
  toggleTheme: () => void;
  openDrawModal: () => void;
  showDrawModal: boolean;
  closeDrawModal: () => void;
  funTheme: FunThemeVars | null;
  applyFunTheme: (vars: FunThemeVars) => void;
  resetFunTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "light",
  toggleTheme: () => {},
  openDrawModal: () => {},
  showDrawModal: false,
  closeDrawModal: () => {},
  funTheme: null,
  applyFunTheme: () => {},
  resetFunTheme: () => {},
});

const CYCLE: AppTheme[] = ["light", "dark", "fun"];

function applyFunVarsToDOM(vars: FunThemeVars | null) {
  const root = document.documentElement;
  if (!vars) {
    // Remove overrides
    ["--fun-bg", "--charcoal", "--muted", "--border", "--border-strong", "--cream", "--white"].forEach(k =>
      root.style.removeProperty(k)
    );
    return;
  }
  root.style.setProperty("--fun-bg-override", vars.background);
  root.style.setProperty("--charcoal", vars.charcoal);
  root.style.setProperty("--muted", vars.muted);
  root.style.setProperty("--border", vars.border);
  root.style.setProperty("--border-strong", vars.borderStrong);
  root.style.setProperty("--cream", vars.cream);
  root.style.setProperty("--white", vars.white);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>("light");
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [funTheme, setFunTheme] = useState<FunThemeVars | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cadenza-theme") as AppTheme | null;
    const initial: AppTheme = saved === "dark" ? "dark" : saved === "fun" ? "fun" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
    // Restore saved AI theme if any
    if (initial === "fun") {
      const savedFun = localStorage.getItem("cadenza-fun-theme");
      if (savedFun) {
        try {
          const vars = JSON.parse(savedFun) as FunThemeVars;
          setFunTheme(vars);
          applyFunVarsToDOM(vars);
        } catch { /* ignore */ }
      }
    }
  }, []);

  function toggleTheme() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
    localStorage.setItem("cadenza-theme", next);
    document.documentElement.setAttribute("data-theme", next);
    if (next === "fun") {
      setShowDrawModal(true);
    } else {
      // Clear AI theme overrides when leaving fun mode
      applyFunVarsToDOM(null);
      setFunTheme(null);
    }
  }

  function openDrawModal() { setShowDrawModal(true); }
  function closeDrawModal() { setShowDrawModal(false); }

  function applyFunTheme(vars: FunThemeVars) {
    setFunTheme(vars);
    applyFunVarsToDOM(vars);
    localStorage.setItem("cadenza-fun-theme", JSON.stringify(vars));
  }

  function resetFunTheme() {
    setFunTheme(null);
    applyFunVarsToDOM(null);
    localStorage.removeItem("cadenza-fun-theme");
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, openDrawModal, showDrawModal, closeDrawModal, funTheme, applyFunTheme, resetFunTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
