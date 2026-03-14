"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "light" | "dark" | "fun";

interface ThemeCtx {
  theme: AppTheme;
  toggleTheme: () => void;
  openDrawModal: () => void;
  showDrawModal: boolean;
  closeDrawModal: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "light",
  toggleTheme: () => {},
  openDrawModal: () => {},
  showDrawModal: false,
  closeDrawModal: () => {},
});

const CYCLE: AppTheme[] = ["light", "dark", "fun"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>("light");
  const [showDrawModal, setShowDrawModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cadenza-theme") as AppTheme | null;
    const initial: AppTheme = saved === "dark" ? "dark" : saved === "fun" ? "fun" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
    localStorage.setItem("cadenza-theme", next);
    document.documentElement.setAttribute("data-theme", next);
    if (next === "fun") setShowDrawModal(true);
  }

  function openDrawModal() {
    setShowDrawModal(true);
  }

  function closeDrawModal() {
    setShowDrawModal(false);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, openDrawModal, showDrawModal, closeDrawModal }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
