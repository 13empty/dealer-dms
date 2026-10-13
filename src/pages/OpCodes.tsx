import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SearchPicker } from "../components/SearchPicker";
import { CatalogEditor } from "../components/CatalogEditor";
import { Badge, Button, Card, ErrorText, Field, Modal, PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth";
import { catalogLabel, PAY_TYPES, useCatalogs } from "../lib/catalogs";
import { SHOP_DEFAULTS } from "../lib/canada";
import { call, money } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import type { OpCode } from "../vite-env";

const emptyForm = {
  code: "",
  description: "",
  category: "",
  payType: "cliente",
  laborHours: "1",
  laborRate: String(SHOP_DEFAULTS.laborRate),
  price: "",
  cost: "0",
  skillLevel: "B" as OpCode["skillLevel"],
  concern: "",
  cause: "",
  correction: "",
  popular: false,
  active: true,
  notes: "",
  parts: [] as Array<{ partId: string; qty: string; label: string }>,
};

export default function OpCodes() {
  const { can, user } = useAuth();
  const { t } = useI18n();
  const { catalogs, error: catalogError, reload: reloadCatalogs, save: saveCatalogs } = useCatalogs();
  const [rows, setRows] = useState<OpCode[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OpCode | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [defaultRate, setDefaultRate] = useState(String(SHOP_DEFAULTS.laborRate));
  const [quick, setQuick] = useState<OpCode[]>([]);
  const [mine, setMine] = useState(false);
  const categories = (catalogs?.opcodeCategories || [])
    .map((item) => item.id)
    .filter((id) => id !== "lavado" && id !== "detailing");

  async function load() {
    try {
      setError(null);
      const found = await call(window.dms.opCodes.list(q, { serviceLine: "taller" }));
      setRows(Array.isArray(found) ? found : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadQuick() {
    try {
      const found = await call(window.dms.opCodes.shortcuts());
      setQuick(Array.isArray(found) ? found : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q]);

  useEffect(() => {
    void loadQuick();
  }, [user?.id]);

  useEffect(() => {
    void call(window.dms.settings.get())
      .then((s) => setDefaultRate(String(s.laborRate || SHOP_DEFAULTS.laborRate)))
      .catch(() => undefined);
  }, []);

  function startCreate() {
    setEditing(null);
    setMine(false);
    setForm({ ...emptyForm, laborRate: defaultRate, category: "", parts: [] });
    setOpen(true);
  }

  function startEdit(row: OpCode) {
    setEditing(row);
    setMine(quick.some((op) => op.id === row.id));
    setForm({
      code: row.code,
      description: row.description,
      category: row.category,
      payType: row.payType,
      laborHours: String(row.laborHours),
      laborRate: String(row.laborRate),
      price: String(row.price),
      cost: String(row.cost),
      skillLevel: row.skillLevel,
      concern: row.concern,
      cause: row.cause,
      correction: row.correction,
      popular: Boolean(row.popular),
      active: Boolean(row.active),
      notes: row.notes,
      parts: (row.parts || []).map((part) => ({
        partId: part.partId,
        qty: String(part.qty || 1),
        label: `${part.sku || ""} ${part.name || ""}`.trim(),
      })),
    });
    setOpen(true);
  }

  function payload() {
    return {
      ...form,
      laborHours: Number(form.laborHours) || 0,
      laborRate: Number(form.laborRate) || Number(defaultRate) || 0,
      price: form.price === "" ? 0 : Number(form.price),
      cost: Number(form.cost),
      popular: form.popular ? 1 : 0,
      active: form.active ? 1 : 0,
      parts: form.parts
        .filter((part) => part.partId)
        .map((part) => ({ partId: part.partId, qty: Number(part.qty) || 1 })),
    };
  }

  async function save() {
    try {
      setError(null);
      const saved = editing
        ? await call(window.dms.opCodes.update(editing.id, payload()))
        : await call(window.dms.opCodes.create(payload()));
      const wanted = mine;
      const already = quick.some((op) => op.id === saved.id);
      if (wanted && !already) await call(window.dms.opCodes.addShortcut(saved.id));
      if (!wanted && already) await call(window.dms.opCodes.removeShortcut(saved.id));
      setOpen(false);
      await Promise.all([load(), loadQuick(), reloadCatalogs()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function markQuick(id: string, on: boolean) {
    try {
      setError(null);
      const next = on ? await call(window.dms.opCodes.addShortcut(id)) : await call(window.dms.opCodes.removeShortcut(id));
      setQuick(Array.isArray(next) ? next : []);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    if (!(await askConfirm(t("opcodes.deleteConfirm")))) return;
    try {
      await call(window.dms.opCodes.remove(id));
      await Promise.all([load(), loadQuick(), reloadCatalogs()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={t("opcodes.title")}
        subtitle={t("opcodes.subtitle")}
        actions={
          <>
            <Link to="/taller">
              <Button variant="ghost">{t("opcodes.back")}</Button>
            </Link>
            <Button onClick={startCreate}>{t("opcodes.new")}</Button>
          </>
        }
      />
      <div className="mb-4">
        <input placeholder={t("opcodes.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorText error={error || catalogError} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-ink-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">{t("opcodes.code")}</th>
                <th className="px-4 py-3">{t("opcodes.operation")}</th>
                <th className="px-4 py-3">{t("opcodes.hours")}</th>
                <th className="px-4 py-3">{t("opcodes.price")}</th>
                <th className="px-4 py-3">{t("opcodes.pay")}</th>
                <th className="px-4 py-3">{t("opcodes.level")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    {t("common.emptyList")}
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} className={`border-t border-ink-600 ${row.active ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.code}
                    {quick.some((op) => op.id === row.id) ? (
                      <div className="mt-1">
                        <Badge status="cerrada" label={t("opcodes.quick")} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.description}
                    <div className="text-xs text-slate-500">{catalogLabel(t, "op", row.category)}</div>
                    {(row.parts || []).length ? (
                      <div className="text-xs text-gold-400/80">{t("opcodes.partsCount", { n: row.parts?.length || 0 })}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.laborHours}</td>
                  <td className="px-4 py-3">{money(row.price)}</td>
                  <td className="px-4 py-3">{catalogLabel(t, "opPay", row.payType)}</td>
                  <td className="px-4 py-3">{row.skillLevel}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="mr-3 text-gold-400"
                      onClick={() => void markQuick(row.id, !quick.some((op) => op.id === row.id))}
                    >
                      {quick.some((op) => op.id === row.id) ? t("opcodes.quickRemove") : t("opcodes.quickPick")}
                    </button>
                    <button className="mr-3 text-gold-400" onClick={() => startEdit(row)}>
                      {t("common.edit")}
                    </button>
                    {can.destructive ? (
                      <button className="text-red-300" onClick={() => void remove(row.id)}>
                        {t("common.remove")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm font-medium">{t("opcodes.quickTitle")}</div>
            <p className="mt-1 text-xs text-slate-500">{t("opcodes.quickHint", { name: user?.name || t("opcodes.quickYou") })}</p>
            <div className="mt-3">
              <SearchPicker
                value=""
                placeholder={t("opcodes.quickAdd")}
                onChange={(id) => {
                  if (id) void markQuick(id, true);
                }}
                search={async (query) => {
                  const found = await call(window.dms.opCodes.list(query, { activeOnly: true, serviceLine: "taller" }));
                  return (Array.isArray(found) ? found : [])
                    .filter((op) => !quick.some((item) => item.id === op.id))
                    .slice(0, 25)
                    .map((op) => ({
                      id: op.id,
                      label: `${op.code} · ${op.description}`,
                      hint: `${op.laborHours} h · ${money(op.price)}`,
                    }));
                }}
              />
            </div>
            {quick.length ? (
              <ul className="mt-3 space-y-2">
                {quick.map((op) => (
                  <li key={op.id} className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left" onClick={() => startEdit(op)}>
                      <div className="truncate text-sm font-medium">{op.description}</div>
                      <div className="text-xs text-slate-500">
                        {op.code} · {money(op.price)}
                      </div>
                    </button>
                    <button type="button" className="shrink-0 text-xs text-red-300" onClick={() => void markQuick(op.id, false)}>
                      {t("opcodes.quickRemove")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">{t("opcodes.quickEmpty")}</p>
            )}
          </Card>
          <CatalogEditor
            title={t("catalog.opcodeCats")}
            items={(catalogs?.opcodeCategories || []).filter((item) => item.id !== "lavado" && item.id !== "detailing")}
            placeholder={t("catalog.new")}
            canEdit={can.finance}
            labelFor={(id) => catalogLabel(t, "op", id)}
            onChange={(ids) => {
              const wash = (catalogs?.opcodeCategories || [])
                .filter((item) => item.id === "lavado" || item.id === "detailing")
                .map((item) => item.id);
              return saveCatalogs({ opcodeCategories: [...ids, ...wash] });
            }}
          />
          <CatalogEditor
            title={t("catalog.payTypes")}
            hint={t("catalog.payHint")}
            items={catalogs?.payTypes || PAY_TYPES.map((id) => ({ id, inUse: 0, locked: true }))}
            placeholder=""
            canEdit={false}
            locked
            labelFor={(id) => catalogLabel(t, "opPay", id)}
            onChange={() => undefined}
          />
        </div>
      </div>
      {open ? (
        <Modal wide title={editing ? t("opcodes.edit") : t("opcodes.new")} onClose={() => setOpen(false)}>
          <ErrorText error={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("opcodes.code")}>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LOF" />
            </Field>
            <Field label={t("opcodes.category")}>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">{t("catalog.optional")}</option>
                {(categories.includes(form.category) ? categories : [...categories, form.category]).filter(Boolean).map((id) => (
                  <option key={id} value={id}>
                    {catalogLabel(t, "op", id)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("opcodes.description")}>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <Field label={t("opcodes.flat")}>
              <input value={form.laborHours} onChange={(e) => setForm({ ...form, laborHours: e.target.value })} />
            </Field>
            <Field label={t("opcodes.rate")}>
              <input value={form.laborRate} onChange={(e) => setForm({ ...form, laborRate: e.target.value })} />
            </Field>
            <Field label={t("opcodes.salePrice")}>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label={t("opcodes.cost")}>
              <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </Field>
            <Field label={t("opcodes.payType")}>
              <select value={form.payType} onChange={(e) => setForm({ ...form, payType: e.target.value })}>
                {PAY_TYPES.map((id) => (
                  <option key={id} value={id}>
                    {catalogLabel(t, "opPay", id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("opcodes.skill")}>
              <select value={form.skillLevel} onChange={(e) => setForm({ ...form, skillLevel: e.target.value as OpCode["skillLevel"] })}>
                <option value="A">{t("opcodes.skillA")}</option>
                <option value="B">{t("opcodes.skillB")}</option>
                <option value="C">{t("opcodes.skillC")}</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("opcodes.concern")}>
                <input value={form.concern} onChange={(e) => setForm({ ...form, concern: e.target.value })} />
              </Field>
            </div>
            <Field label={t("opcodes.cause")}>
              <input value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} />
            </Field>
            <Field label={t("opcodes.correction")}>
              <input value={form.correction} onChange={(e) => setForm({ ...form, correction: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("opcodes.notes")}>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-ink-600 p-3">
              <div className="mb-2 text-sm font-medium">{t("opcodes.parts")}</div>
              <p className="mb-3 text-xs text-slate-500">{t("opcodes.partsHint")}</p>
              <SearchPicker
                value=""
                selectedLabel=""
                placeholder={t("picker.searchPart")}
                onChange={(_id, option) => {
                  const part = option?.raw as { id?: string; sku?: string; name?: string } | undefined;
                  const partId = String(part?.id || option?.id || "");
                  if (!partId || form.parts.some((row) => row.partId === partId)) return;
                  setForm({
                    ...form,
                    parts: [...form.parts, { partId, qty: "1", label: option?.label || `${part?.sku || ""} ${part?.name || ""}`.trim() }],
                  });
                }}
                search={async (query) => {
                  const found = await call(window.dms.parts.list(query, { limit: 25, activeOnly: true }));
                  return found.map((p) => ({
                    id: p.id,
                    label: `${p.sku} ${p.name}`,
                    hint: [p.location, `${p.stock}`, money(p.price)].filter(Boolean).join(" · "),
                    raw: p,
                  }));
                }}
              />
              {form.parts.length ? (
                <div className="mt-3 space-y-2">
                  {form.parts.map((part) => (
                    <div key={part.partId} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-sm">{part.label}</div>
                      <input
                        className="w-16"
                        value={part.qty}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            parts: form.parts.map((row) => (row.partId === part.partId ? { ...row, qty: e.target.value } : row)),
                          })
                        }
                      />
                      <button
                        className="text-xs text-red-300"
                        onClick={() => setForm({ ...form, parts: form.parts.filter((row) => row.partId !== part.partId) })}
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t("opcodes.noParts")}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
              {t("opcodes.quickMineFlag")}
            </label>
            <p className="-mt-2 text-xs text-slate-500">{t("opcodes.quickMineHint")}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {t("opcodes.activeFlag")}
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("common.save")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
