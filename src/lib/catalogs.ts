import { useCallback, useEffect, useState } from "react";
import { call } from "./format";
import { k, type Translate } from "./i18n";
import type { CatalogItem, ShopCatalogs } from "../vite-env";

export const DEFAULT_OP_CATEGORIES = [
  "mantenimiento",
  "frenos",
  "motor",
  "transmision",
  "electrico",
  "suspension",
  "diagnostico",
  "climatizacion",
  "carroceria",
  "llantas",
  "otros",
] as const;

export const DEFAULT_PART_CATEGORIES = [
  "filtros",
  "frenos",
  "electrico",
  "fluidos",
  "motor",
  "llantas",
  "carroceria",
  "clima",
  "otros",
] as const;

export const DEFAULT_PART_UOMS = ["pza", "juego", "litro", "galon", "metro"] as const;
export const PAY_TYPES = ["cliente", "garantia", "interno", "sublet"] as const;

export function catalogLabel(t: Translate, kind: "op" | "partCat" | "partUom" | "opPay", id: string) {
  const key = `${kind}.${id}`;
  const translated = t(k(key));
  if (!translated || translated === key) return id;
  return translated;
}

export function catalogIds(items?: CatalogItem[] | string[] | null) {
  if (!items || !items.length) return [] as string[];
  return items.map((item) => (typeof item === "string" ? item : item.id)).filter(Boolean);
}

export function useCatalogs() {
  const [catalogs, setCatalogs] = useState<ShopCatalogs | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setCatalogs(await call(window.dms.settings.catalogs()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(data: {
    opcodeCategories?: string[];
    partCategories?: string[];
    partUoms?: string[];
  }) {
    const next = await call(window.dms.settings.saveCatalogs(data));
    setCatalogs(next);
    return next;
  }

  return { catalogs, error, reload, save };
}
