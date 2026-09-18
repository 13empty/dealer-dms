export const NAV_IDS = [
  "home",
  "workshop",
  "wash",
  "customers",
  "parts",
  "opcodes",
  "vehicles",
  "sales",
  "finance",
  "settings",
  "sql",
  "users",
] as const;

export type NavId = (typeof NAV_IDS)[number];

export const DEFAULT_NAV_ORDER: NavId[] = [...NAV_IDS];

const allowed = new Set<string>(NAV_IDS);

export function normalizeNavOrder(raw: unknown): NavId[] {
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
  for (const id of NAV_IDS) {
    if (seen.has(id)) continue;
    next.push(id);
  }
  return next;
}

export function sortByNavOrder<T extends { id: NavId }>(items: T[], order: NavId[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
}

export function moveNavId(order: NavId[], visible: NavId[], id: NavId, dir: -1 | 1): NavId[] {
  const vis = order.filter((item) => visible.includes(item));
  for (const item of visible) {
    if (!vis.includes(item)) vis.push(item);
  }
  const from = vis.indexOf(id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= vis.length) return order;
  const swapped = [...vis];
  const other = swapped[to];
  swapped[to] = swapped[from];
  swapped[from] = other;
  let i = 0;
  const used = new Set<NavId>();
  const next = order.map((item) => {
    if (!visible.includes(item)) return item;
    const value = swapped[i];
    i += 1;
    used.add(value);
    return value;
  });
  for (const item of swapped) {
    if (used.has(item)) continue;
    next.push(item);
  }
  return normalizeNavOrder(next);
}
