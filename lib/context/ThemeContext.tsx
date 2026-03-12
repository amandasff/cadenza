"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "light" | "dark" | "fun";

interface ThemeCtx {
  theme: AppTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggleTheme: () => {} });

const CYCLE: AppTheme[] = ["light", "fun", "dark"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>("light");

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
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
