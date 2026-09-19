import { Field } from "./ui";
import { catalogLabel } from "../lib/catalogs";
import { k, type Translate } from "../lib/i18n";
import { useShop } from "../lib/shop-context";
import type { Part } from "../vite-env";

export const PART_CATEGORIES = [
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

export const PART_STATUSES = ["activo", "descontinuado"] as const;
export const PART_UOMS = ["pza", "juego", "litro", "galon", "metro"] as const;
export const PART_ADJUST_REASONS = ["conteo", "merma", "dano", "devolucion_proveedor", "correccion", "entrada"] as const;

export type PartFormState = {
  sku: string;
  name: string;
  oem: string;
  alts: string;
  brand: string;
  category: string;
  vendor: string;
  location: string;
  uom: string;
  status: "activo" | "descontinuado";
  stock: string;
  minStock: string;
  maxStock: string;
  cost: string;
  price: string;
  core: string;
  taxable: boolean;
  specialOrder: boolean;
  description: string;
  notes: string;
};

export function emptyPartForm(): PartFormState {
  return {
    sku: "",
    name: "",
    oem: "",
    alts: "",
    brand: "",
    category: "otros",
    vendor: "",
    location: "",
    uom: "pza",
    status: "activo",
    stock: "0",
    minStock: "0",
    maxStock: "0",
    cost: "",
    price: "",
    core: "0",
    taxable: true,
    specialOrder: false,
    description: "",
    notes: "",
  };
}

export function formFromPart(row: Part): PartFormState {
  return {
    sku: row.sku || "",
    name: row.name || "",
    oem: row.oem || "",
    alts: (row.alts || []).join(", "),
    brand: row.brand || "",
    category: row.category || "otros",
    vendor: row.vendor || "",
    location: row.location || "",
    uom: row.uom || "pza",
    status: row.status === "descontinuado" ? "descontinuado" : "activo",
    stock: String(row.stock ?? 0),
    minStock: String(row.minStock ?? 0),
    maxStock: String(row.maxStock ?? 0),
    cost: row.cost != null ? String(row.cost) : "",
    price: row.price != null ? String(row.price) : "",
    core: String(row.core ?? 0),
    taxable: row.taxable !== 0,
    specialOrder: Boolean(row.specialOrder),
    description: row.description || "",
    notes: row.notes || "",
  };
}

export function partFormPayload(form: PartFormState, opts?: { includeStock?: boolean }) {
  const payload: Partial<Part> & { alts: string[]; stock?: number } = {
    sku: form.sku,
    name: form.name,
    oem: form.oem,
    alts: form.alts
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    brand: form.brand,
    category: form.category,
    vendor: form.vendor,
    location: form.location,
    uom: form.uom,
    status: form.status,
    minStock: Number(form.minStock) || 0,
    maxStock: Number(form.maxStock) || 0,
    cost: Number(form.cost) || 0,
    price: Number(form.price) || 0,
    core: Number(form.core) || 0,
    taxable: form.taxable ? 1 : 0,
    specialOrder: form.specialOrder ? 1 : 0,
    description: form.description,
    notes: form.notes,
  };
  if (opts?.includeStock) payload.stock = Number(form.stock) || 0;
  return payload;
}

export function PartFormFields({
  form,
  setForm,
  t,
  includeStock,
  categories,
  uoms,
}: {
  form: PartFormState;
  setForm: (form: PartFormState) => void;
  t: Translate;
  includeStock?: boolean;
  categories?: string[];
  uoms?: string[];
}) {
  const { offerTax } = useShop();
  const categoryOptions = [...(categories?.length ? categories : PART_CATEGORIES)];
  const uomOptions = [...(uoms?.length ? uoms : PART_UOMS)];
  if (form.category && !categoryOptions.includes(form.category)) categoryOptions.push(form.category);
  if (form.uom && !uomOptions.includes(form.uom)) uomOptions.push(form.uom);
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-300">{t("parts.sectionFile")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label={t("parts.oem")}>
            <input value={form.oem} onChange={(e) => setForm({ ...form, oem: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("parts.name")}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("parts.alts")}>
              <input
                placeholder={t("parts.altsHint")}
                value={form.alts}
                onChange={(e) => setForm({ ...form, alts: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("parts.brand")}>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </Field>
          <Field label={t("parts.vendor")}>
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Field>
          <Field label={t("parts.category")}>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categoryOptions.map((id) => (
                <option key={id} value={id}>
                  {catalogLabel(t, "partCat", id)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("parts.status")}>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PartFormState["status"] })}
            >
              {PART_STATUSES.map((id) => (
                <option key={id} value={id}>
                  {t(k(`partStatus.${id}`))}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-300">{t("parts.sectionStock")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("parts.location")}>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label={t("parts.uom")}>
            <select value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })}>
              {uomOptions.map((id) => (
                <option key={id} value={id}>
                  {catalogLabel(t, "partUom", id)}
                </option>
              ))}
            </select>
          </Field>
          {includeStock !== false ? (
            <Field label={t("parts.oh")}>
              <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </Field>
          ) : null}
          <Field label={t("parts.min")}>
            <input value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </Field>
          <Field label={t("parts.max")}>
            <input value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} />
          </Field>
          <Field label={t("parts.cost")}>
            <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </Field>
          <Field label={t("parts.price")}>
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label={t("parts.core")}>
            <input value={form.core} onChange={(e) => setForm({ ...form, core: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {offerTax ? (
            <label className="flex items-center gap-2 normal-case tracking-normal text-slate-200">
              <input
                type="checkbox"
                className="w-auto"
                checked={form.taxable}
                onChange={(e) => setForm({ ...form, taxable: e.target.checked })}
              />
              {t("parts.taxable")}
            </label>
          ) : null}
          <label className="flex items-center gap-2 normal-case tracking-normal text-slate-200">
            <input
              type="checkbox"
              className="w-auto"
              checked={form.specialOrder}
              onChange={(e) => setForm({ ...form, specialOrder: e.target.checked })}
            />
            {t("parts.specialOrder")}
          </label>
        </div>
      </section>

      <section>
        <div className="grid gap-3">
          <Field label={t("parts.description")}>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label={t("common.notes")}>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </section>
    </div>
  );
}
