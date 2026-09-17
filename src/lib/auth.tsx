import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { call } from "./format";
import type { AppUser, AuthStatus } from "../vite-env";

type AuthContextValue = {
  loading: boolean;
  needsSetup: boolean;
  bootError: string | null;
  user: AppUser | null;
  roles: AuthStatus["roles"] | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setup: (name: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: AppUser["permissions"];
};

const emptyPerms: AppUser["permissions"] = {
  users: false,
  finance: false,
  destructive: false,
  demo: false,
  options: false,
  assignableRoles: [],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<AuthStatus["roles"] | null>(null);

  const refresh = useCallback(async () => {
    const status = await call(window.dms.auth.status());
    setBootError(null);
    setNeedsSetup(status.needsSetup);
    setUser(status.user);
    setRoles(status.roles);
  }, []);

  useEffect(() => {
    void refresh()
      .catch((e) => setBootError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function login(username: string, password: string) {
    const next = await call(window.dms.auth.login({ username, password }));
    setUser(next);
    setNeedsSetup(false);
  }

  async function setup(name: string, username: string, password: string) {
    const next = await call(window.dms.auth.setup({ name, username, password }));
    setUser(next);
    setNeedsSetup(false);
  }

  async function logout() {
    await call(window.dms.auth.logout());
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        needsSetup,
        bootError,
        user,
        roles,
        refresh,
        login,
        setup,
        logout,
        can: user?.permissions || emptyPerms,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}

