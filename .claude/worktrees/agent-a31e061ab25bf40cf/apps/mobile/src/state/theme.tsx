import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { storage } from "@/lib/storage";
import { palettes, type Mode, type Palette, type Scheme } from "@/lib/tokens";

type Ctx = { mode: Mode; scheme: Scheme; c: Palette; setMode: (m: Mode) => void };

const KEY = "settings.theme";
const ThemeCtx = createContext<Ctx>({ mode: "auto", scheme: "day", c: palettes.day, setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>("auto");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.get(KEY).then((v) => {
      if (v === "day" || v === "night" || v === "auto") setModeState(v);
      setReady(true);
    });
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    void storage.set(KEY, m);
  }, []);

  const scheme: Scheme = mode === "auto" ? (system === "dark" ? "night" : "day") : mode;
  const value = useMemo(() => ({ mode, scheme, c: palettes[scheme], setMode }), [mode, scheme, setMode]);
  if (!ready) return null;
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
