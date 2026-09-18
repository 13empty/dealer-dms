import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { applyPrefs, readPrefs, writePrefs, type AppPrefs } from "./prefs";

type PrefsValue = {
  prefs: AppPrefs;
  setPref: <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => void;
};

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPrefs>(() => {
    const next = readPrefs();
    applyPrefs(next);
    return next;
  });

  const value = useMemo<PrefsValue>(
    () => ({
      prefs,
      setPref(key, value) {
        setPrefs((current) => {
          const next = { ...current, [key]: value };
          writePrefs(next);
          applyPrefs(next);
          return next;
        });
      },
    }),
    [prefs]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs outside PrefsProvider");
  return ctx;
}
