import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { call } from "./format";

const FALLBACK = "Dealer DMS";

type ShopValue = {
  name: string;
  offerWash: boolean;
  refresh: () => Promise<void>;
};

const ShopContext = createContext<ShopValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState(FALLBACK);
  const [offerWash, setOfferWash] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await call(window.dms.settings.identity());
      const shopName = String(next?.name || "").trim() || FALLBACK;
      setName(shopName);
      setOfferWash(Boolean(next?.offerWash));
      document.title = shopName;
    } catch {
      setName(FALLBACK);
      setOfferWash(false);
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

  const value = useMemo<ShopValue>(() => ({ name, offerWash, refresh }), [name, offerWash, refresh]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop outside ShopProvider");
  return ctx;
}

export function ShopName({ className = "" }: { className?: string }) {
  const { name } = useShop();
  return <span className={`break-words [overflow-wrap:anywhere] ${className}`.trim()}>{name}</span>;
}
