export const DASH_WIDGETS = [
  { id: "queues", group: "layout" },
  { id: "openOrders", group: "taller" },
  { id: "inShop", group: "taller" },
  { id: "ready", group: "taller" },
  { id: "waitingParts", group: "taller" },
  { id: "waitingAuth", group: "taller" },
  { id: "estimates", group: "taller" },
  { id: "overdue", group: "taller" },
  { id: "unpaid", group: "taller" },
  { id: "shopRevenue", group: "taller" },
  { id: "shopMargin", group: "taller" },
  { id: "lowParts", group: "taller" },
  { id: "lowTable", group: "taller" },
  { id: "stock", group: "ventas" },
  { id: "salesMonth", group: "ventas" },
  { id: "salesMargin", group: "ventas" },
  { id: "backup", group: "extra" },
  { id: "password", group: "extra" },
] as const;

export type DashWidgetId = (typeof DASH_WIDGETS)[number]["id"];
export type DashWidgetGroup = (typeof DASH_WIDGETS)[number]["group"];

export const DEFAULT_DASH_WIDGETS: DashWidgetId[] = [
  "queues",
  "openOrders",
  "inShop",
  "ready",
  "waitingParts",
  "unpaid",
  "shopRevenue",
  "shopMargin",
  "lowParts",
  "lowTable",
  "password",
];

const KEY = "dms.dash.widgets";
const allowed = new Set<string>(DASH_WIDGETS.map((w) => w.id));

export function readDashWidgets(): DashWidgetId[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DASH_WIDGETS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_DASH_WIDGETS;
    const next = parsed.filter((id): id is DashWidgetId => allowed.has(id));
    return next.length ? next : DEFAULT_DASH_WIDGETS;
  } catch {
    return DEFAULT_DASH_WIDGETS;
  }
}

export function writeDashWidgets(ids: DashWidgetId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function toggleDashWidget(current: DashWidgetId[], id: DashWidgetId, on: boolean) {
  return on ? [...new Set([...current, id])] : current.filter((item) => item !== id);
}
