import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PrintDoc, PrintShopHead } from "../components/PrintDoc";
import { ErrorText } from "../components/ui";
import { call, customerBillingName, dateEs, formatAddress, formatPhones, money, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import type { Sale, ShopSettings } from "../vite-env";

export default function SalePrint() {
  const { id } = useParams();
  const { t } = useI18n();
  const [sale, setSale] = useState<Sale | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [row, settings] = await Promise.all([
          call(window.dms.sales.get(String(id || ""))),
          call(window.dms.settings.get()),
        ]);
        setSale(row);
        setShop(settings);
        if (!row) throw new Error(t("sales.missing"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id, t]);

  if (!sale || !shop) {
    return (
      <div className="p-8">
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("sales.missing") : t("common.loading")}</p>
      </div>
    );
  }

  const total = Number(sale.total || Number(sale.price) + Number(sale.tax || 0));
  const paidOff = Number(sale.balance || 0) <= 0.009 && total > 0.009;

  return (
    <PrintDoc title={t("sales.printTitle")} subtitle={t("invoice.subtitle")} backTo={`/ventas/${sale.id}`} backLabel={t("common.open")}>
      <ErrorText error={error} />
      <PrintShopHead
        shop={shop}
        docLabel={t("sales.printTitle")}
        number={sale.vehicle?.stockNumber || ""}
        date={dateEs(sale.deliveredAt || sale.closedAt || sale.createdAt)}
        extra={
          paidOff ? (
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">{t("invoice.paidFull")}</div>
          ) : null
        }
      />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("sales.customer")}</div>
          <div className="mt-1 font-medium">{customerBillingName(sale.customer) || sale.customer?.name || t("common.dash")}</div>
          {sale.customer ? (
            <>
              {formatAddress(sale.customer) ? <div className="mt-1 text-sm text-neutral-600">{formatAddress(sale.customer)}</div> : null}
              {formatPhones(sale.customer) ? <div className="text-sm text-neutral-600">{formatPhones(sale.customer)}</div> : null}
              {sale.customer.email ? <div className="text-sm text-neutral-600">{sale.customer.email}</div> : null}
            </>
          ) : null}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("sales.vehicle")}</div>
          <div className="mt-1 font-medium">{sale.vehicle ? vehicleLabel(sale.vehicle) : t("common.dash")}</div>
          {sale.vehicle?.plate ? (
            <div className="mt-1 text-sm text-neutral-600">
              {t("vehicles.plate")}: {sale.vehicle.plate}
            </div>
          ) : null}
          {sale.vehicle?.vin ? <div className="text-sm text-neutral-600">VIN: {sale.vehicle.vin}</div> : null}
          {sale.vehicle?.stockNumber ? (
            <div className="text-sm text-neutral-600">
              {t("vehicles.stockNumber")}: {sale.vehicle.stockNumber}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>{t("sales.price")}</span>
          <span>{money(sale.price)}</span>
        </div>
        <div className="flex justify-between">
          <span>
            {shop.taxLabel || "GST"}
            {Number(sale.taxRate) ? ` ${sale.taxRate}%` : ""}
          </span>
          <span>{Number(sale.taxRate) > 0 ? money(sale.tax || 0) : sale.customer?.taxExempt ? t("invoice.gstExempt") : money(0)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-semibold">
          <span>{t("workshop.total")}</span>
          <span>{money(total)}</span>
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>{t("workshop.paid")}</span>
          <span>{money(sale.paid != null ? sale.paid : total - Number(sale.balance || 0))}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>{t("sales.balance")}</span>
          <span>{money(sale.balance || 0)}</span>
        </div>
      </div>

      {(sale.payments || []).length ? (
        <div className="mt-6 text-sm">
          <div className="mb-2 font-medium">{t("sales.payments")}</div>
          {(sale.payments || []).map((p) => (
            <div key={p.id} className="flex justify-between text-neutral-600">
              <span>
                {dateEs(p.paidAt)} · {t(k(`pay.${p.method}`))}
              </span>
              <span>{money(p.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {shop.invoiceNotes ? <p className="mt-8 whitespace-pre-wrap text-xs text-neutral-500">{shop.invoiceNotes}</p> : null}
      <p className="mt-4 text-xs text-neutral-500">{t("invoice.thanks")}</p>
    </PrintDoc>
  );
}
