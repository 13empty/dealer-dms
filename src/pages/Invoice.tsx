import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, ErrorText, PageHeader, GuidCopy } from "../components/ui";
import { call, customerBillingName, dateEs, formatAddress, formatPhones, formatNumber, money, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import type { ShopSettings, WorkOrder } from "../vite-env";

export default function Invoice() {
  const { id } = useParams();
  const { t } = useI18n();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [wo, settings] = await Promise.all([
          call(window.dms.workOrders.get(String(id || ""))),
          call(window.dms.settings.get()),
        ]);
        setOrder(wo);
        setShop(settings);
        if (!wo) throw new Error(t("workshop.missing"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id]);

  if (!order || !shop) {
    return (
      <div className="p-8">
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("workshop.missing") : t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-8 print:bg-white print:p-0 print:text-black">
      <div className="no-print">
      <PageHeader
        title={t("invoice.title", { number: order.number })}
        subtitle={t("invoice.subtitle")}
        actions={
          <>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm text-slate-100" to={`/taller/${order.id}`}>
              {t("invoice.back")}
            </Link>
            <Button onClick={() => window.print()}>{t("common.print")}</Button>
          </>
        }
      />
      </div>
      <ErrorText error={error} />
      <div className="mx-auto max-w-3xl rounded-xl border border-ink-600 bg-ink-800 p-8 print:border-0 print:bg-white print:p-0 print:text-black">
        <div className="flex items-start justify-between gap-6 border-b border-ink-600 pb-5 print:border-slate-300">
          <div>
            <div className="text-xl font-semibold">{shop.name}</div>
            {shop.address ? <div className="mt-1 text-sm text-slate-400 print:text-slate-600">{shop.address}</div> : null}
            <div className="mt-1 text-sm text-slate-400 print:text-slate-600">
              {[shop.phone, shop.email].filter(Boolean).join(" · ")}
            </div>
            {shop.gstNumber ? (
              <div className="mt-1 text-sm text-slate-400 print:text-slate-600">{t("invoice.gstNumber", { number: shop.gstNumber })}</div>
            ) : null}
          </div>
          <div className="text-right">
          <div className="text-sm uppercase tracking-wide text-slate-400 print:text-slate-600">
            {order.kind === "presupuesto" ? t("workshop.estimate") : t("workshop.wo")}
          </div>
            <div className="text-2xl font-semibold">{order.number}</div>
            <div className="mt-1">
              <GuidCopy value={order.id} />
            </div>
            <div className="mt-1 text-sm text-slate-400 print:text-slate-600">{dateEs(order.createdAt)}</div>
          </div>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("workshop.customer")}</div>
            <div className="mt-1 font-medium">{customerBillingName(order.customer)}</div>
            {order.customer ? (
              <>
                <div className="mt-1 text-sm text-slate-400 print:text-slate-600">{formatAddress(order.customer) || t("common.dash")}</div>
                <div className="text-sm text-slate-400 print:text-slate-600">{formatPhones(order.customer) || t("common.dash")}</div>
              </>
            ) : null}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{t("workshop.vehicle")}</div>
            <div className="mt-1 font-medium">{vehicleLabel(order.vehicle)}</div>
            <div className="mt-1 text-sm text-slate-400 print:text-slate-600">
              {t("vehicles.plate")}: {order.vehicle?.plate || t("common.dash")}
            </div>
            <div className="text-sm text-slate-400 print:text-slate-600">VIN: {order.vehicle?.vin}</div>
            <div className="text-sm text-slate-400 print:text-slate-600">
              {t("workshop.kmIn")}: {formatNumber(order.kmIn || 0)}
            </div>
          </div>
        </div>
        <p className="mt-6 text-sm">
          <span className="text-slate-500">{t("workshop.complaint")}: </span>
          {order.complaint || t("workshop.noComplaint")}
        </p>
        {order.cause ? (
          <p className="mt-2 text-sm">
            <span className="text-slate-500">{t("workshop.cause")}: </span>
            {order.cause}
          </p>
        ) : null}
        {order.correction ? (
          <p className="mt-2 text-sm">
            <span className="text-slate-500">{t("workshop.correction")}: </span>
            {order.correction}
          </p>
        ) : null}
        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-slate-400 print:text-slate-600">
            <tr className="border-b border-ink-600 print:border-slate-300">
              <th className="py-2">{t("workshop.description")}</th>
              <th className="py-2">{t("workshop.qty")}</th>
              <th className="py-2 text-right">{t("workshop.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {(order.lines || []).map((line) => (
              <tr key={line.id} className="border-b border-ink-600 print:border-slate-200">
                <td className="py-2">
                  {line.description}
                  <div className="text-xs text-slate-500">
                    {line.type === "part" ? t("workshop.part") : line.opcode ? t("workshop.op", { code: line.opcode.code }) : t("workshop.labor")}
                    {" · "}
                    {t(k(`woPay.${line.payType || "cliente"}`))}
                    {Number(line.authorized) === 0 ? ` · ${t("workshop.declined")}` : ""}
                  </div>
                  {line.complaint || line.opcode?.concern ? (
                    <div className="text-xs text-slate-500">{line.complaint || line.opcode?.concern}</div>
                  ) : null}
                </td>
                <td className="py-2">{line.qty}</td>
                <td className="py-2 text-right">
                  {Number(line.authorized) === 0 || (line.payType && line.payType !== "cliente" && line.payType !== "sublet")
                    ? money(0)
                    : money(line.qty * line.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>{t("workshop.subtotal")}</span>
            <span>{money(order.subtotal || 0)}</span>
          </div>
          {Number(order.discount) > 0 ? (
            <div className="flex justify-between text-slate-400 print:text-slate-600">
              <span>
                {t("workshop.discount")} {order.discountPct}%
              </span>
              <span>-{money(order.discount)}</span>
            </div>
          ) : null}
          {Number(order.taxRate) > 0 ? (
            <div className="flex justify-between">
              <span>
                {shop.taxLabel} {order.taxRate}%
              </span>
              <span>{money(order.tax || 0)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-slate-400 print:text-slate-600">
              <span>{shop.taxLabel || "GST"}</span>
              <span>{order.customer?.taxExempt ? t("invoice.gstExempt") : money(0)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>{t("workshop.total")}</span>
            <span>{money(order.total || 0)}</span>
          </div>
          <div className="flex justify-between text-slate-400 print:text-slate-600">
            <span>{t("workshop.paid")}</span>
            <span>{money(order.paid || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("workshop.balance")}</span>
            <span>{money(order.balance || 0)}</span>
          </div>
        </div>
        {(order.payments || []).length > 0 ? (
          <div className="mt-6 text-sm">
            <div className="mb-2 font-medium">{t("workshop.payments")}</div>
            {(order.payments || []).map((p) => (
              <div key={p.id} className="flex justify-between text-slate-400 print:text-slate-600">
                <span>
                  {dateEs(p.paidAt)} · {t(k(`pay.${p.method}`))}
                </span>
                <span>{money(p.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {shop.invoiceNotes ? <p className="mt-8 whitespace-pre-wrap text-xs text-slate-500">{shop.invoiceNotes}</p> : null}
        <p className="mt-4 text-xs text-slate-500">{t("invoice.thanks")}</p>
      </div>
    </div>
  );
}
