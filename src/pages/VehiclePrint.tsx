import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, ErrorText, PageHeader, GuidCopy } from "../components/ui";
import { call, customerName, dateEs, formatNumber, money, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import type { ShopSettings, Vehicle } from "../vite-env";

export default function VehiclePrint() {
  const { id } = useParams();
  const { t } = useI18n();
  const [row, setRow] = useState<Vehicle | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [vehicle, settings] = await Promise.all([
          call(window.dms.vehicles.get(String(id || ""), { history: true })),
          call(window.dms.settings.get()),
        ]);
        setRow(vehicle);
        setShop(settings);
        if (!vehicle) throw new Error(t("common.notFound"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id]);

  if (!row || !shop) {
    return (
      <div className="p-8">
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("common.notFound") : t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-8 print:bg-white print:p-0 print:text-black">
      <div className="no-print mb-6">
        <PageHeader
          title={t("vehicles.printTitle")}
          actions={
            <>
              <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/vehiculos/${row.id}`}>
                {t("vehicles.view")}
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
            <h1 className="mt-1 text-2xl font-semibold">{vehicleLabel(row)}</h1>
            <p className="text-sm text-slate-400 print:text-neutral-600">
              {[row.stockNumber, row.plate, row.vin].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2">
              <GuidCopy value={row.id} />
            </div>
          </div>
          <div className="text-right text-sm">
            <div>{t(k(`vehicle.${row.status}`))}</div>
            <div>{t(k(`vehicleCond.${row.condition || "usado"}`))}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.kms")}</dt>
            <dd>{formatNumber(row.km)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.color")}</dt>
            <dd>{row.color || t("common.dash")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.engine")}</dt>
            <dd>{row.engine || t("common.dash")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.transmission")}</dt>
            <dd>{row.transmission ? t(k(`vehicleTrans.${row.transmission}`)) : t("common.dash")}</dd>
          </div>
          {row.status !== "cliente" ? (
            <>
              <div>
                <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.price")}</dt>
                <dd>{money(row.price)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.lot")}</dt>
                <dd>{row.location || t("common.dash")}</dd>
              </div>
            </>
          ) : null}
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.owner")}</dt>
            <dd>{customerName(row.customer) || t("vehicles.none")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("vehicles.keyNumber")}</dt>
            <dd>{row.keyNumber || t("common.dash")}</dd>
          </div>
        </dl>
        {row.alert ? <p className="mt-6 text-sm font-medium">{t("vehicles.alert")}: {row.alert}</p> : null}
        {row.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{row.notes}</p> : null}
        <p className="mt-8 text-xs text-slate-500 print:text-neutral-500">{dateEs(row.createdAt)}</p>
      </div>
    </div>
  );
}
