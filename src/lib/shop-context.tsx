import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { call } from "./format";

const FALLBACK = "Dealer DMS";

type ShopValue = {
  name: string;
  refresh: () => Promise<void>;
};

const ShopContext = createContext<ShopValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState(FALLBACK);

  const refresh = useCallback(async () => {
    try {
      const next = await call(window.dms.settings.identity());
      const shopName = String(next?.name || "").trim() || FALLBACK;
      setName(shopName);
      document.title = shopName;
    } catch {
      setName(FALLBACK);
      document.title = FALLBACK;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onShop = () => {
      void refresh();
    };
    window.addEventListener("dms-shop", onShop);
    return () => window.removeEventListener("dms-shop", onShop);
  }, [refresh]);

  const value = useMemo<ShopValue>(() => ({ name, refresh }), [name, refresh]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop outside ShopProvider");
  return ctx;
}
