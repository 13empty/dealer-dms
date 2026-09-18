import { DEFAULT_NAV_OFFICE, DEFAULT_NAV_OPS, NAV_OFFICE, NAV_OPS, normalizeNavOrder, type NavId } from "./nav";

export const THEMES = ["oro", "bahia", "acero", "bosque", "noche", "cobre", "vino", "pizarra", "marina", "dia", "niebla"] as const;
export type ThemeId = (typeof THEMES)[number];
export type DensityId = "comodo" | "compacto";
export type TypeSizeId = "md" | "lg";

export type AppPrefs = {
  theme: ThemeId;
  density: DensityId;
  typeSize: TypeSizeId;
  showUnitSales: boolean;
  promisedDays: number;
  navOpsOrder: NavId[];
  navOfficeOrder: NavId[];
  navWidth: number;
};

export const NAV_WIDTH_MIN = 200;
export const NAV_WIDTH_MAX = 480;
export const NAV_WIDTH_DEFAULT = 240;

export function clampNavWidth(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NAV_WIDTH_DEFAULT;
  return Math.min(NAV_WIDTH_MAX, Math.max(NAV_WIDTH_MIN, Math.round(n)));
}

export const DEFAULT_PREFS: AppPrefs = {
  theme: "oro",
  density: "comodo",
  typeSize: "md",
  showUnitSales: true,
  promisedDays: 1,
  navOpsOrder: [...DEFAULT_NAV_OPS],
  navOfficeOrder: [...DEFAULT_NAV_OFFICE],
  navWidth: NAV_WIDTH_DEFAULT,
};

const KEY = "dms.prefs";
const themeSet = new Set<string>(THEMES);

export function readPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AppPrefs> & { navOrder?: unknown };
    const theme = themeSet.has(String(parsed.theme)) ? (parsed.theme as ThemeId) : DEFAULT_PREFS.theme;
    const density = parsed.density === "compacto" ? "compacto" : "comodo";
    const typeSize = parsed.typeSize === "lg" ? "lg" : "md";
    const promisedDays = [0, 1, 2, 3, 7].includes(Number(parsed.promisedDays)) ? Number(parsed.promisedDays) : 1;
    return {
      theme,
      density,
      typeSize,
      showUnitSales: parsed.showUnitSales !== false,
      promisedDays,
      navOpsOrder: normalizeNavOrder(parsed.navOpsOrder ?? parsed.navOrder, NAV_OPS),
      navOfficeOrder: normalizeNavOrder(parsed.navOfficeOrder ?? parsed.navOrder, NAV_OFFICE),
      navWidth: clampNavWidth(parsed.navWidth ?? NAV_WIDTH_DEFAULT),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs: AppPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function applyPrefs(prefs: AppPrefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.density = prefs.density;
  root.dataset.type = prefs.typeSize;
}

export function defaultPromisedAt(days: number) {
  if (!days) return "";
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T17:00`;
}

export function bootPrefs() {
  applyPrefs(readPrefs());
}
