export const DASH_WIDGETS = [
  { id: "queues", group: "layout" },
  { id: "openOrders", group: "taller" },
  { id: "closedRos", group: "taller" },
  { id: "closedParts", group: "taller" },
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
  "closedRos",
  "closedParts",
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
const ADDED_CLOSED = "dms.dash.added.closedReports";
const CLOSED_WIDGETS: DashWidgetId[] = ["closedRos", "closedParts"];
const allowed = new Set<string>(DASH_WIDGETS.map((w) => w.id));

export function readDashWidgets(): DashWidgetId[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DASH_WIDGETS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_DASH_WIDGETS;
    let next = parsed.filter((id): id is DashWidgetId => allowed.has(id));
    if (!next.length) return DEFAULT_DASH_WIDGETS;
    try {
      if (!localStorage.getItem(ADDED_CLOSED)) {
        const extras = CLOSED_WIDGETS.filter((id) => !next.includes(id));
        if (extras.length) {
          const at = next.indexOf("openOrders");
          next = at >= 0 ? [...next.slice(0, at + 1), ...extras, ...next.slice(at + 1)] : [...extras, ...next];
          writeDashWidgets(next);
        }
        localStorage.setItem(ADDED_CLOSED, "1");
      }
    } catch {
      /* ignore */
    }
    return next;
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
