import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, ErrorText, Field, PageHeader, GuidCopy } from "../components/ui";
import { call, dateEs, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import { useShop } from "../lib/shop-context";
import type { Sale } from "../vite-env";

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { offerTax } = useShop();
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");

  async function load() {
    try {
      setError(null);
      const next = await call(window.dms.sales.get(String(id || "")));
      setSale(next);
      if (!next) throw new Error(t("sales.missing"));
      if (Number(next.balance) > 0) setAmount(String(next.balance));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function act(fn: () => Promise<Sale>) {
    try {
      const next = await fn();
      setSale(next);
      if (Number(next.balance) > 0) setAmount(String(next.balance));
      else setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!sale) {
    return (
      <div className="page">
        <PageHeader
          title={t("sales.title")}
          actions={
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/ventas">
              {t("nav.sales")}
            </Link>
          }
        />
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("sales.missing") : t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={`${sale.vehicle?.year || ""} ${sale.vehicle?.make || ""} ${sale.vehicle?.model || ""}`.trim() || t("sales.title")}
        subtitle={`${sale.customer?.name} · ${sale.vehicle?.year} ${sale.vehicle?.make} ${sale.vehicle?.model}`}
        actions={
          <>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/ventas/${sale.id}/imprimir`}>
              {t("common.print")}
            </Link>
            {sale.status === "borrador" ? (
              <>
                <Button onClick={() => void act(() => call(window.dms.sales.close(sale.id)))}>{t("sales.close")}</Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    void act(async () => {
                      if (!askConfirm(t("sales.deleteConfirm"))) return sale;
                      await call(window.dms.sales.remove(sale.id));
                      navigate("/ventas");
                      return sale;
                    })
                  }
                >
                  {t("sales.deleteDraft")}
                </Button>
              </>
            ) : null}
            {sale.status === "cerrada" && (Number(sale.balance || 0) <= 0.009 || sale.paymentMethod === "financiado") ? (
              <Button onClick={() => void act(() => call(window.dms.sales.deliver(sale.id)))}>{t("sales.deliver")}</Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4">
        <GuidCopy value={sale.id} />
      </div>
      <ErrorText error={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <Badge status={sale.status} label={t(k(`sale.${sale.status}`))} />
            {sale.status === "cerrada" && Number(sale.balance || 0) <= 0.009 ? <Badge status="pagada" label={t("sales.paidOff")} /> : null}
            <span className="text-sm text-slate-400">{t(k(`pay.${sale.paymentMethod}`))}</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400">{t("sales.price")}</dt>
              <dd className="text-lg">{money(sale.price)}</dd>
            </div>
            {offerTax ? (
            <div>
              <dt className="text-slate-400">{t("sales.tax", { label: "GST" })}</dt>
              <dd>
                {Number(sale.taxRate) > 0
                  ? `${sale.taxRate}% · ${money(sale.tax || 0)}`
                  : sale.customer?.taxExempt
                    ? t("invoice.gstExempt")
                    : money(0)}
              </dd>
            </div>
            ) : null}
            <div>
              <dt className="text-slate-400">{t("workshop.total")}</dt>
              <dd className="text-lg">{money(sale.total || Number(sale.price) + Number(sale.tax || 0))}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("sales.down")}</dt>
              <dd>{money(sale.downPayment)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("sales.collected")}</dt>
              <dd>{money(sale.paid || 0)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("sales.balance")}</dt>
              <dd>{money(sale.balance || 0)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("sales.closedAt")}</dt>
              <dd>{dateEs(sale.closedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("sales.deliveredAt")}</dt>
              <dd>{dateEs(sale.deliveredAt)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-slate-400">{sale.notes || t("customers.noNotes")}</p>
          <Link className="mt-4 mr-4 inline-block text-sm text-gold-400" to={`/clientes/${sale.customerId}`}>
            {t("sales.viewCustomer")}
          </Link>
          {sale.vehicleId ? (
            <Link className="mt-4 inline-block text-sm text-gold-400" to={`/vehiculos/${sale.vehicleId}`}>
              {t("sales.viewVehicle")}
            </Link>
          ) : null}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("sales.payments")}</h2>
          <ul className="mb-4 space-y-2 text-sm">
            {(sale.payments || []).map((p) => (
              <li key={p.id} className="flex justify-between border-b border-ink-600 pb-2">
                <span>
                  {dateEs(p.paidAt)} · {t(k(`pay.${p.method}`))}
                  <div className="text-xs text-slate-500">{p.notes}</div>
                </span>
                <span>{money(p.amount)}</span>
              </li>
            ))}
          </ul>
          {sale.status === "borrador" ? (
            <p className="text-sm text-slate-400">{t("sales.closeFirst")}</p>
          ) : sale.status === "entregada" && Number(sale.balance || 0) <= 0.009 ? (
            <p className="text-sm text-emerald-300">{t("sales.closedPaid")}</p>
          ) : sale.status === "entregada" ? (
            <div className="grid gap-2">
              <p className="text-xs text-amber-200">{t("sales.deliveredOpenBalance")}</p>
              <Field label={t("sales.amount")}>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label={t("sales.payMethod")}>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="efectivo">{t("pay.efectivo")}</option>
                  <option value="transferencia">{t("pay.transferencia")}</option>
                  <option value="tarjeta">{t("pay.tarjeta")}</option>
                  <option value="financiamiento">{t("pay.financiamiento")}</option>
                </select>
              </Field>
              <Button
                onClick={() =>
                  void act(async () => {
                    return call(window.dms.sales.addPayment(sale.id, { amount: Number(amount), method }));
                  })
                }
              >
                {t("sales.deposit")}
              </Button>
            </div>
          ) : Number(sale.balance || 0) <= 0.009 ? (
            <div className="grid gap-2">
              <p className="text-sm text-emerald-300">{t("sales.paidReady")}</p>
              <Button onClick={() => void act(() => call(window.dms.sales.deliver(sale.id)))}>{t("sales.deliver")}</Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <Field label={t("sales.amount")}>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label={t("sales.payMethod")}>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="efectivo">{t("pay.efectivo")}</option>
                  <option value="transferencia">{t("pay.transferencia")}</option>
                  <option value="tarjeta">{t("pay.tarjeta")}</option>
                  <option value="financiamiento">{t("pay.financiamiento")}</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    void act(async () => {
                      return call(window.dms.sales.addPayment(sale.id, { amount: Number(amount), method }));
                    })
                  }
                >
                  {t("sales.deposit")}
                </Button>
                <Button
                  onClick={() =>
                    void act(async () => {
                      return call(
                        window.dms.sales.addPayment(sale.id, {
                          amount: sale.paymentMethod === "financiado" ? Number(amount) || Number(sale.balance || 0) : Number(sale.balance || 0),
                          method,
                          close: true,
                        })
                      );
                    })
                  }
                >
                  {t("sales.payAndDeliver")}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {sale.paymentMethod === "financiado" ? t("sales.financedCanDeliver") : t("sales.payToDeliver")}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
