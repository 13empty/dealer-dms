import { localeConfig } from "./locale";
import { phoneLabel, type Translate } from "./i18n";

export async function call<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> {
  const result = await p;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export function money(n: number | null | undefined) {
  const { intl, currency } = localeConfig();
  try {
    return new Intl.NumberFormat(intl, { style: "currency", currency }).format(Number(n) || 0);
  } catch {
    return `$${Number(n || 0).toFixed(2)}`;
  }
}

export function dateEs(iso?: string | null) {
  if (!iso) return "—";
  const raw = String(iso);
  const dayOnly = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
  const value = dayOnly ? new Date(`${dayOnly[1]}T12:00:00`) : new Date(iso);
  if (Number.isNaN(value.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(localeConfig().intl, { dateStyle: "medium" }).format(value);
  } catch {
    return "—";
  }
}

export function dateTimeEs(iso?: string | null) {
  if (!iso) return "—";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(localeConfig().intl, { dateStyle: "medium", timeStyle: "short" }).format(value);
  } catch {
    return iso;
  }
}

export function toDateTimeLocal(iso?: string | null) {
  if (!iso) return "";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return String(iso).slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function fromDateTimeLocal(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

export function formatNumber(n: number) {
  return Number(n || 0).toLocaleString(localeConfig().intl);
}

export function formatPhones(
  customer: { phone?: string; phones?: { label: string; number: string }[] },
  t?: Translate
) {
  if (customer.phones && customer.phones.length) {
    return customer.phones
      .map((p) => {
        const label = t ? phoneLabel(p.label, t) : p.label;
        return label ? `${label}: ${p.number}` : p.number;
      })
      .join(" · ");
  }
  return customer.phone || "";
}

export function formatAddress(customer: { address?: string; city?: string; state?: string; zip?: string }) {
  const cityLine = [customer.city, customer.state].filter(Boolean).join(" ");
  const withPostal = customer.zip ? `${cityLine}${cityLine ? "  " : ""}${customer.zip}` : cityLine;
  return [customer.address, withPostal].filter(Boolean).join(", ");
}

export function customerPerson(c?: { firstName?: string; middleName?: string; lastName?: string } | null) {
  if (!c) return "";
  return [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");
}

export function customerName(
  c?: {
    name?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    company?: string;
  } | null
) {
  if (!c) return "";
  const person = customerPerson(c);
  if (c.company && person) return `${c.company} · ${person}`;
  return c.company || person || c.name || "";
}

export function customerBillingName(
  c?: { name?: string; firstName?: string; middleName?: string; lastName?: string; company?: string } | null
) {
  if (!c) return "";
  return c.company || customerPerson(c) || c.name || "";
}

export function vehicleLabel(v?: { year?: number; make?: string; model?: string; trim?: string } | null) {
  if (!v) return "";
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

export function customerSearchHint(
  c?: {
    code?: string;
    company?: string;
    phone?: string;
    document?: string;
    phones?: { number: string }[];
  } | null
) {
  if (!c) return "";
  return [c.code, c.company, c.phones?.[0]?.number || c.phone, c.document].filter(Boolean).join(" · ");
}

export function vehicleSearchHint(v?: { plate?: string; vin?: string; stockNumber?: string; customer?: { name?: string; firstName?: string; lastName?: string } | null } | null) {
  if (!v) return "";
  const owner = customerName(v.customer);
  return [v.stockNumber, v.plate, v.vin, owner].filter(Boolean).join(" · ");
}

export function isWashCategory(category?: string | null) {
  const key = String(category || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return key === "lavado" || key === "detailing";
}

export function workOrderPath(order: { id: string; serviceLine?: string | null }) {
  return `${order.serviceLine === "lavado" ? "/lavado" : "/taller"}/${order.id}`;
}

export function workOrderListPath(order?: { serviceLine?: string | null } | null) {
  return order?.serviceLine === "lavado" ? "/lavado" : "/taller";
}
