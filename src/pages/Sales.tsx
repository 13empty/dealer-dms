import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SearchPicker, type SearchOption } from "../components/SearchPicker";
import { Badge, Button, Card, ErrorText, Field, Modal, Page, PageHeader, Toolbar } from "../components/ui";
import { call, customerName, customerSearchHint, money, vehicleLabel, vehicleSearchHint } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { useShop } from "../lib/shop-context";
import type { Customer, Sale, ShopSettings, Vehicle } from "../vite-env";

const emptySaleForm = {
  customerId: "",
  vehicleId: "",
  price: "",
  downPayment: "0",
  paymentMethod: "contado" as "contado" | "financiado",
  notes: "",
};

const emptyPicked = { customerLabel: "", customerHint: "", vehicleLabel: "", vehicleHint: "", taxExempt: false };

export default function Sales() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();
  const { offerTax } = useShop();
  const [rows, setRows] = useState<Sale[]>([]);
  const [q, setQ] = useState("");
  const [unpaid, setUnpaid] = useState(() => params.get("unpaid") === "1");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptySaleForm);
  const [picked, setPicked] = useState(emptyPicked);
  const [shop, setShop] = useState<ShopSettings | null>(null);

  async function load() {
    try {
      setError(null);
      const [list, settings] = await Promise.all([
        call(window.dms.sales.list(q, { unpaid: unpaid || undefined })),
        call(window.dms.settings.get()),
      ]);
      setRows(list);
      setShop(settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q, unpaid]);

  useEffect(() => {
    const cliente = params.get("cliente") || "";
    const vehiculo = params.get("vehiculo") || "";
    if (!cliente && !vehiculo) return;
    void (async () => {
      try {
        const customer = cliente ? await call(window.dms.customers.get(cliente)) : null;
        const vehicle = vehiculo ? await call(window.dms.vehicles.get(vehiculo)) : null;
        const owner = customer || vehicle?.customer || null;
        setForm({
          customerId: owner ? String(owner.id) : "",
          vehicleId: vehicle ? String(vehicle.id) : "",
          price: vehicle ? String(vehicle.price) : "",
          downPayment: "0",
          paymentMethod: "contado",
          notes: "",
        });
        setPicked({
          customerLabel: customerName(owner),
          customerHint: customerSearchHint(owner),
          vehicleLabel: vehicle ? vehicleLabel(vehicle) : "",
          vehicleHint: vehicle ? vehicleSearchHint(vehicle) : "",
          taxExempt: Boolean(owner?.taxExempt),
        });
        setError(null);
        setOpen(true);
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("cliente");
            next.delete("vehiculo");
            return next;
          },
          { replace: true }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [params]);

  function pickVehicle(_id: string, option: SearchOption | null) {
    const v = option?.raw as Vehicle | undefined;
    setForm({
      ...form,
      vehicleId: option ? String(option.id) : "",
      price: v ? String(v.price) : form.price,
    });
    setPicked({
      ...picked,
      vehicleLabel: option?.label || "",
      vehicleHint: option?.hint || "",
    });
  }

  function startCreate() {
    setForm(emptySaleForm);
    setPicked(emptyPicked);
    setError(null);
    setOpen(true);
  }

  async function save() {
    try {
      setError(null);
      const created = await call(
        window.dms.sales.create({
          customerId: form.customerId,
          vehicleId: form.vehicleId,
          price: Number(form.price),
          downPayment: Number(form.downPayment),
          paymentMethod: form.paymentMethod,
          notes: form.notes,
        })
      );
      setOpen(false);
      setForm(emptySaleForm);
      setPicked(emptyPicked);
      navigate(`/ventas/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Page>
      <PageHeader
        title={t("sales.title")}
        subtitle={t("sales.subtitle")}
        actions={<Button onClick={startCreate}>{t("sales.new")}</Button>}
      />
      <Toolbar>
        <div className="min-w-[220px] flex-1">
          <input autoFocus placeholder={t("sales.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-300">
          <input type="checkbox" checked={unpaid} onChange={(e) => setUnpaid(e.target.checked)} />
          {t("sales.filterUnpaid")}
        </label>
      </Toolbar>
      <ErrorText error={error} />
      <Card className="overflow-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">{t("sales.customer")}</th>
              <th className="px-4 py-3">{t("sales.vehicle")}</th>
              <th className="px-4 py-3">{t("workshop.total")}</th>
              <th className="px-4 py-3">{t("sales.payment")}</th>
              <th className="px-4 py-3">{t("sales.status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  {t("common.emptyList")}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-600">
                <td className="px-4 py-3">
                  <Link className="text-gold-400 hover:underline" to={`/ventas/${row.id}`}>
                    {customerName(row.customer) || row.customer?.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {row.vehicle?.year} {row.vehicle?.make} {row.vehicle?.model}
                  <div className="text-xs text-slate-500">{row.vehicle?.vin}</div>
                </td>
                <td className="px-4 py-3">
                  {money(row.total || row.price)}
                  {Number(row.tax) > 0 ? <div className="text-xs text-slate-500">{money(row.price)}</div> : null}
                </td>
                <td className="px-4 py-3">{t(k(`pay.${row.paymentMethod}`))}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge status={row.status} label={t(k(`sale.${row.status}`))} />
                    {row.status === "cerrada" && Number(row.balance || 0) <= 0.009 ? (
                      <Badge status="pagada" label={t("sales.paidOff")} />
                    ) : Number(row.balance || 0) > 0.009 && row.status !== "borrador" ? (
                      <span className="text-xs text-amber-300">{money(row.balance)}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link className="text-gold-400" to={`/ventas/${row.id}`}>
                    {t("common.open")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open ? (
        <Modal title={t("sales.new")} onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <ErrorText error={error} />
            <Field label={t("sales.customer")}>
              <SearchPicker
                value={form.customerId}
                selectedLabel={picked.customerLabel}
                selectedHint={picked.customerHint}
                placeholder={t("picker.searchCustomer")}
                onChange={(id, option) => {
                  const customer = option?.raw as Customer | undefined;
                  setForm({ ...form, customerId: id });
                  setPicked({
                    ...picked,
                    customerLabel: option?.label || "",
                    customerHint: option?.hint || "",
                    taxExempt: Boolean(customer?.taxExempt),
                  });
                }}
                search={async (query) => {
                  const rows = await call(window.dms.customers.list(query, { limit: 25, lite: true }));
                  return rows.map((c) => ({
                    id: c.id,
                    label: customerName(c),
                    hint: customerSearchHint(c),
                    raw: c,
                  }));
                }}
              />
            </Field>
            <Field label={t("sales.stockVehicle")}>
              <SearchPicker
                value={form.vehicleId}
                selectedLabel={picked.vehicleLabel}
                selectedHint={picked.vehicleHint}
                placeholder={t("picker.searchVehicle")}
                onChange={pickVehicle}
                search={async (query) => {
                  const rows = await call(window.dms.vehicles.list(query, undefined, { limit: 25, kind: "inventory" }));
                  return rows
                    .filter((v) => v.status === "en_stock" || v.status === "consignacion")
                    .map((v) => ({
                      id: v.id,
                      label: `${vehicleLabel(v)} · ${v.stockNumber || v.plate || v.vin}`,
                      hint: vehicleSearchHint(v) || money(v.price),
                      raw: v,
                    }));
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("sales.price")}>
                <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label={t("sales.down")}>
                <input value={form.downPayment} onChange={(e) => setForm({ ...form, downPayment: e.target.value })} />
              </Field>
            </div>
            {shop && offerTax ? (
              <p className="text-xs text-slate-400">
                {picked.taxExempt
                  ? t("invoice.gstExempt")
                  : `${shop.taxLabel || "GST"} ${Number(shop.taxRate) || 0}% · ${t("workshop.total")} ${money(
                      (Number(form.price) || 0) * (1 + (Number(shop.taxRate) || 0) / 100)
                    )}`}
              </p>
            ) : null}
            <Field label={t("sales.method")}>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as "contado" | "financiado" })}
              >
                <option value="contado">{t("sales.cash")}</option>
                <option value="financiado">{t("sales.financed")}</option>
              </select>
            </Field>
            <Field label={t("common.notes")}>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("sales.draft")}</Button>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
