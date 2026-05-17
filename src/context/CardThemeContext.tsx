import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CardTheme = "obsidian" | "aurora" | "signal";

const STORAGE_KEY = "pop:card-theme";

interface Ctx {
  theme: CardTheme;
  setTheme: (t: CardTheme) => void;
}

const CardThemeContext = createContext<Ctx>({
  theme: "obsidian",
  setTheme: () => {},
});

function readInitial(): CardTheme {
  if (typeof window === "undefined") return "obsidian";
  const v = window.localStorage.getItem(STORAGE_KEY) as CardTheme | null;
  return v === "aurora" || v === "signal" || v === "obsidian" ? v : "obsidian";
}

export function CardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<CardTheme>(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute("data-card-theme", theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore quota / private mode
    }
  }, [theme]);

  return (
    <CardThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </CardThemeContext.Provider>
  );
}

export function useCardTheme() {
  return useContext(CardThemeContext);
}
