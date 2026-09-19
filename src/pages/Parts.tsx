import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  PART_CATEGORIES,
  PART_STATUSES,
  emptyPartForm,
  formFromPart,
  partFormPayload,
  PartFormFields,
  type PartFormState,
} from "../components/PartForm";
import { CatalogEditor } from "../components/CatalogEditor";
import { Badge, Button, Card, ErrorText, Modal, Page, PageHeader, Toolbar } from "../components/ui";
import { useAuth } from "../lib/auth";
import { catalogLabel, useCatalogs } from "../lib/catalogs";
import { call, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import { useShop } from "../lib/shop-context";
import type { Part } from "../vite-env";

export default function Parts() {
  const { can } = useAuth();
  const { t } = useI18n();
  const { catalogs, save: saveCatalogs } = useCatalogs();
  const { offerPartInvoices } = useShop();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<Part[]>([]);
  const [q, setQ] = useState(() => params.get("q") || "");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [stockFilter, setStockFilter] = useState(() =>
    params.get("low") === "1" ? "low" : params.get("reorder") === "1" ? "reorder" : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState<PartFormState>(emptyPartForm());

  async function load() {
    try {
      setError(null);
      setRows(
        await call(
          window.dms.parts.list(q, {
            category: category || undefined,
            status: status || undefined,
            low: stockFilter === "low",
            reorder: stockFilter === "reorder",
          })
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q, category, status, stockFilter]);

  function startCreate() {
    setEditing(null);
    setForm(emptyPartForm());
    setOpen(true);
  }

  function startEdit(row: Part) {
    setEditing(row);
    setForm(formFromPart(row));
    setOpen(true);
  }

  async function save() {
    try {
      const payload = partFormPayload(form, { includeStock: true });
      if (editing) await call(window.dms.parts.update(editing.id, payload));
      else await call(window.dms.parts.create(payload));
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    if (!askConfirm(t("parts.deleteConfirm"))) return;
    try {
      await call(window.dms.parts.remove(id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function printHref(mode: string) {
    const p = new URLSearchParams();
    p.set("modo", mode);
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (status) p.set("status", status);
    if (stockFilter === "low") p.set("low", "1");
    if (stockFilter === "reorder") p.set("reorder", "1");
    return `/partes/imprimir?${p.toString()}`;
  }

  return (
    <Page>
      <PageHeader
        title={t("parts.title")}
        subtitle={t("parts.subtitle")}
        actions={
          <>
            <Link className="btn-ghost" to={printHref("conteo")}>
              {t("parts.printCount")}
            </Link>
            <Link className="btn-ghost" to={printHref("reorden")}>
              {t("parts.printReorder")}
            </Link>
            {offerPartInvoices ? (
              <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/partes/factura">
                {t("parts.invoiceNew")}
              </Link>
            ) : null}
            <Button variant="ghost" onClick={() => setCatalogOpen(true)}>
              {t("parts.catalogs")}
            </Button>
            <Button onClick={startCreate}>{t("parts.new")}</Button>
          </>
        }
      />
      <Toolbar>
        <input className="min-w-[220px] flex-1" autoFocus placeholder={t("parts.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="w-40" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("parts.category")}: {t("common.all")}</option>
          {(catalogs?.partCategories.map((item) => item.id) || PART_CATEGORIES).map((id) => (
            <option key={id} value={id}>
              {catalogLabel(t, "partCat", id)}
            </option>
          ))}
        </select>
        <select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("parts.status")}: {t("common.all")}</option>
          {PART_STATUSES.map((id) => (
            <option key={id} value={id}>
              {t(k(`partStatus.${id}`))}
            </option>
          ))}
        </select>
        <select className="w-44" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="">{t("parts.stockAny")}</option>
          <option value="low">{t("parts.low")}</option>
          <option value="reorder">{t("parts.needsReorder")}</option>
        </select>
        <div className="ml-auto text-xs text-slate-500">{t("parts.count", { n: rows.length })}</div>
      </Toolbar>
      <ErrorText error={error} />
      <Card className="overflow-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">{t("parts.part")}</th>
              <th className="px-4 py-3">{t("parts.oem")}</th>
              <th className="px-4 py-3">{t("parts.location")}</th>
              <th className="px-4 py-3">{t("parts.stock")}</th>
              <th className="px-4 py-3">{t("parts.onOrder")}</th>
              <th className="px-4 py-3">{t("parts.costPrice")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  {t("common.emptyList")}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-600">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link className="text-gold-400 hover:underline" to={`/partes/${row.id}`}>
                    {row.sku}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/partes/${row.id}`}>{row.name}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.low ? <Badge status="reservado" label={t("parts.low")} /> : null}
                    {row.status === "descontinuado" ? (
                      <Badge status="descontinuado" label={t("partStatus.descontinuado")} />
                    ) : null}
                    {row.specialOrder ? <Badge status="consignacion" label={t("parts.specialOrder")} /> : null}
                    {(row.reorderQty || 0) > 0 ? <Badge status="en_taller" label={t("parts.reorderQty", { n: row.reorderQty || 0 })} /> : null}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.oem || t("common.dash")}</td>
                <td className="px-4 py-3">{row.location || t("common.dash")}</td>
                <td className="px-4 py-3">{t("parts.minOf", { stock: row.stock, min: row.minStock })}</td>
                <td className="px-4 py-3">{row.onOrder || 0}</td>
                <td className="px-4 py-3">
                  {money(row.cost)} · {money(row.price)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-gold-400" onClick={() => startEdit(row)}>
                    {t("common.edit")}
                  </button>
                  {can.destructive ? (
                    <button className="text-red-300" onClick={() => void remove(row.id)}>
                      {t("common.delete")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open ? (
        <Modal title={editing ? t("parts.edit") : t("parts.new")} onClose={() => setOpen(false)} wide>
          <PartFormFields
            form={form}
            setForm={setForm}
            t={t}
            includeStock
            categories={catalogs?.partCategories.map((item) => item.id)}
            uoms={catalogs?.partUoms.map((item) => item.id)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("common.save")}</Button>
          </div>
        </Modal>
      ) : null}
      {catalogOpen ? (
        <Modal title={t("parts.catalogs")} onClose={() => setCatalogOpen(false)} wide>
          <div className="grid gap-4 md:grid-cols-2">
            <CatalogEditor
              title={t("catalog.partCats")}
              items={catalogs?.partCategories || []}
              placeholder={t("catalog.new")}
              canEdit={can.finance}
              labelFor={(id) => catalogLabel(t, "partCat", id)}
              onChange={(ids) => saveCatalogs({ partCategories: ids })}
            />
            <CatalogEditor
              title={t("catalog.uoms")}
              items={catalogs?.partUoms || []}
              placeholder={t("catalog.new")}
              canEdit={can.finance}
              labelFor={(id) => catalogLabel(t, "partUom", id)}
              onChange={(ids) => saveCatalogs({ partUoms: ids })}
            />
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
