import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken } from "@/lib/api";
import { MOCK } from "@/lib/config";
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
};

const AuthCtx = createContext<Ctx | null>(null);
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
    await storage.set(KEY, null);
    setUser(null);
    setStatus("out");
  }, []);

  useEffect(() => {
    (async () => {
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

  const value = useMemo<Ctx>(
    () => ({
      status,
      user,
      signIn: async (t, u, isNew) => {
        setToken(t);
        await storage.set(KEY, t);
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
