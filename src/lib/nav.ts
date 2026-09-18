export const NAV_OPS = ["home", "workshop", "wash", "customers", "parts", "opcodes", "vehicles", "sales"] as const;
export const NAV_OFFICE = ["finance", "settings", "sql", "users"] as const;
export const NAV_IDS = [...NAV_OPS, ...NAV_OFFICE] as const;

export type NavOpsId = (typeof NAV_OPS)[number];
export type NavOfficeId = (typeof NAV_OFFICE)[number];
export type NavId = (typeof NAV_IDS)[number];

export const DEFAULT_NAV_OPS: NavId[] = [...NAV_OPS];
export const DEFAULT_NAV_OFFICE: NavId[] = [...NAV_OFFICE];

function allowedSet(catalog: readonly NavId[]) {
  return new Set<string>(catalog);
}

export function normalizeNavOrder(raw: unknown, catalog: readonly NavId[]): NavId[] {
  const allowed = allowedSet(catalog);
  const seen = new Set<NavId>();
  const next: NavId[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id = String(item);
      if (!allowed.has(id) || seen.has(id as NavId)) continue;
      seen.add(id as NavId);
      next.push(id as NavId);
    }
  }
  for (const id of catalog) {
    if (seen.has(id)) continue;
    next.push(id);
  }
  return next;
}

export function sortByNavOrder<T extends { id: NavId }>(items: T[], order: NavId[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
}

export function reorderNav(order: NavId[], visible: NavId[], fromId: NavId, toId: NavId, catalog: readonly NavId[]): NavId[] {
  if (fromId === toId) return order;
  const vis = order.filter((item) => visible.includes(item));
  for (const item of visible) {
    if (!vis.includes(item)) vis.push(item);
  }
  const from = vis.indexOf(fromId);
  const to = vis.indexOf(toId);
  if (from < 0 || to < 0) return order;
  const nextVis = [...vis];
  nextVis.splice(from, 1);
  nextVis.splice(to, 0, fromId);
  let i = 0;
  const used = new Set<NavId>();
  const next = order.map((item) => {
    if (!visible.includes(item)) return item;
    const value = nextVis[i];
    i += 1;
    used.add(value);
    return value;
  });
  for (const item of nextVis) {
    if (used.has(item)) continue;
    next.push(item);
  }
  return normalizeNavOrder(next, catalog);
}
