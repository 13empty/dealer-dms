import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, ErrorText, PageHeader, GuidCopy } from "../components/ui";
import { call, customerName, dateEs, money, vehicleLabel } from "../lib/format";
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
  }, [id]);

  if (!sale || !shop) {
    return (
      <div className="p-8">
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("sales.missing") : t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-8 print:bg-white print:p-0 print:text-black">
      <div className="no-print mb-6">
        <PageHeader
          title={t("sales.printTitle")}
          actions={
            <>
              <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/ventas/${sale.id}`}>
                {t("common.open")}
              </Link>
              <Button onClick={() => window.print()}>{t("common.print")}</Button>
            </>
          }
        />
      </div>
      <div className="mx-auto max-w-3xl rounded-lg border border-ink-600 p-8 print:border-black">
        <div className="mb-6 flex justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold-400 print:text-black">{shop.name}</div>
            <h1 className="mt-1 text-2xl font-semibold">
              {sale.vehicle ? vehicleLabel(sale.vehicle) : t("sales.title")}
            </h1>
            <div className="mt-1">
              <GuidCopy value={sale.id} />
            </div>
            <p className="text-sm text-slate-400 print:text-neutral-600">{shop.address}</p>
            <p className="text-sm text-slate-400 print:text-neutral-600">{[shop.phone, shop.email].filter(Boolean).join(" · ")}</p>
            {shop.gstNumber ? (
              <p className="text-sm text-slate-400 print:text-neutral-600">{t("invoice.gstNumber", { number: shop.gstNumber })}</p>
            ) : null}
          </div>
          <div className="text-right text-sm">
            <div>{t(k(`sale.${sale.status}`))}</div>
            <div>{dateEs(sale.closedAt || sale.createdAt)}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("sales.customer")}</dt>
            <dd>{customerName(sale.customer) || sale.customer?.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("sales.vehicle")}</dt>
            <dd>{sale.vehicle ? vehicleLabel(sale.vehicle) : t("common.dash")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("sales.price")}</dt>
            <dd>{money(sale.price)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">
              {shop.taxLabel || "GST"} {Number(sale.taxRate) ? `${sale.taxRate}%` : ""}
            </dt>
            <dd>{Number(sale.taxRate) > 0 ? money(sale.tax || 0) : sale.customer?.taxExempt ? t("invoice.gstExempt") : money(0)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("workshop.total")}</dt>
            <dd>{money(sale.total || Number(sale.price) + Number(sale.tax || 0))}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("sales.balance")}</dt>
            <dd>{money(sale.balance || 0)}</dd>
          </div>
        </dl>
        {(sale.payments || []).length ? (
          <div className="mt-6 text-sm">
            <div className="mb-2 font-medium">{t("sales.payments")}</div>
            {(sale.payments || []).map((p) => (
              <div key={p.id} className="flex justify-between text-slate-400 print:text-neutral-600">
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
