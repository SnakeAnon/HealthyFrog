import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Mode = "dark" | "light";

interface ThemeCtx {
  mode: Mode;
  toggleMode: () => void;
}

const Ctx = createContext<ThemeCtx>({ mode: "dark", toggleMode: () => {} });

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const s = localStorage.getItem("hf-theme");
      return s === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try { localStorage.setItem("hf-theme", mode); } catch {}
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === "dark" ? "light" : "dark"));

  return <Ctx.Provider value={{ mode, toggleMode }}>{children}</Ctx.Provider>;
}

export const useThemeMode = () => useContext(Ctx);
