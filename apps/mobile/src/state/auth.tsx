import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { api, setToken } from "@/lib/api";
import { DEMO, MOCK } from "@/lib/config";
import { mock } from "@/lib/mock";
import { storage } from "@/lib/storage";
import type { User } from "@/lib/types";

type Status = "loading" | "out" | "needsHandle" | "in";
type Ctx = {
  status: Status;
  user: User | null;
  signIn: (token: string, user: User, isNew: boolean) => Promise<void>;
  finishHandle: (user: User) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

// The site worker reads em_in to serve the app instead of the landing page at "/".
function markSignedIn(on: boolean) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.cookie = on ? "em_in=1; Path=/; Max-Age=31536000; SameSite=Lax" : "em_in=; Path=/; Max-Age=0; SameSite=Lax";
}
const KEY = "session.token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const apply = useCallback((u: User) => {
    setUser(u);
    setStatus(u.handle ? "in" : "needsHandle");
  }, []);

  const drop = useCallback(async () => {
    setToken(null);
    if (MOCK) mock._setToken(null);
    if (!DEMO) await storage.set(KEY, null);
    setUser(null);
    setStatus("out");
  }, []);

  useEffect(() => {
    (async () => {
      if (DEMO) {
        const d = mock._demoSession();
        setToken(d.token);
        return apply(d.user);
      }
      const t = await storage.get(KEY);
      if (!t) return setStatus("out");
      setToken(t);
      if (MOCK) mock._setToken(t);
      try {
        apply(await api.me());
      } catch {
        await drop();
      }
    })();
  }, [apply, drop]);

  useEffect(() => {
    if (status !== "loading") markSignedIn(status !== "out");
  }, [status]);

  const value = useMemo<Ctx>(
    () => ({
      status,
      user,
      signIn: async (t, u, isNew) => {
        setToken(t);
        if (DEMO) mock._setToken(t);
        else await storage.set(KEY, t);
        setUser(u);
        setStatus(isNew || !u.handle ? "needsHandle" : "in");
      },
      finishHandle: apply,
      signOut: async () => {
        try {
          await api.logout();
        } catch {}
        await drop();
      },
      deleteAccount: async () => {
        await api.deleteAccount();
        await drop();
      },
    }),
    [status, user, apply, drop],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
