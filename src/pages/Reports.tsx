import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorText, PageHeader } from "../components/ui";
import { call, dateEs, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { useShop } from "../lib/shop-context";
import type { DashboardClosedRow, DashboardEstimateRow, FinancePeriod, FinanceReport, FinanceSummary, Part } from "../vite-env";

const PERIODS: FinancePeriod[] = ["today", "week", "month", "year"];

function MixBar({ parts }: { parts: Array<{ key: string; amount: number; className: string }> }) {
  const total = parts.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (total <= 0.009) return <div className="h-2 rounded-full bg-ink-700" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-ink-700">
      {parts
        .filter((p) => p.amount > 0.009)
        .map((p) => (
          <div key={p.key} className={p.className} style={{ width: `${(p.amount / total) * 100}%` }} />
        ))}
    </div>
  );
}

function ReportCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-600 px-5 py-3">
        <div className="font-medium">{title}</div>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-xl">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-4 text-sm text-slate-400">{text}</p>;
}

function ClosedTable({
  rows,
  empty,
  href,
}: {
  rows: DashboardClosedRow[];
  empty: string;
  href: (row: DashboardClosedRow) => string;
}) {
  const { t } = useI18n();
  if (!rows.length) return <Empty text={empty} />;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          <th className="px-5 py-2">{t("workshop.number")}</th>
          <th className="px-5 py-2">{t("finance.customer")}</th>
          <th className="px-5 py-2">{t("workshop.vehicle")}</th>
          <th className="px-5 py-2">{t("finance.date")}</th>
          <th className="px-5 py-2 text-right">{t("finance.billed")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-ink-600">
            <td className="px-5 py-2">
              <Link className="font-mono text-xs text-gold-400" to={href(row)}>
                {row.number}
              </Link>
            </td>
            <td className="px-5 py-2">{row.customerName || t("common.dash")}</td>
            <td className="px-5 py-2 text-slate-400">{row.vehicleLabel || t("common.dash")}</td>
            <td className="px-5 py-2">{dateEs(row.deliveredAt)}</td>
            <td className="px-5 py-2 text-right tabular-nums">{money(row.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Reports() {
  const { t } = useI18n();
  const { offerWash, offerPartInvoices } = useShop();
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(nextPeriod = period, nextFrom = from, nextTo = to) {
    try {
      setError(null);
      const payload = nextPeriod === "range" ? { period: nextPeriod, from: nextFrom, to: nextTo } : nextPeriod;
      setData(await call(window.dms.finance.summary(payload)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (period === "range" && (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))) return;
    void load();
  }, [period, from, to]);

  function applyRange() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      setError(t("finance.dateFormat"));
      return;
    }
    setPeriod("range");
  }

  const report: FinanceReport | undefined = data?.report;
  const kpis = data?.kpis;
  const shop = report?.shop;
  const sales = report?.sales;
  const closedOrders = report?.closedOrders;
  const closedParts = report?.closedParts;
  const closedWash = report?.closedWash;
  const showParts = offerPartInvoices || Number(closedParts?.count || 0) > 0;
  const showWash = offerWash || Number(closedWash?.count || 0) > 0;
  const lowStock = (kpis?.lowStock || []).slice(0, 12);

  return (
    <div className="page">
      <PageHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        actions={
          <>
            <div className="flex rounded-md border border-ink-600">
              {PERIODS.map((id) => (
                <button
                  key={id}
                  className={`px-3 py-2 text-sm ${period === id ? "bg-gold-400/15 text-gold-400" : "text-slate-300"}`}
                  onClick={() => setPeriod(id)}
                >
                  {t(k(`finance.${id}`))}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input className="w-[8.5rem]" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("finance.from")} />
              <input className="w-[8.5rem]" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("finance.to")} />
              <Button variant="ghost" onClick={applyRange}>
                {t("finance.range")}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => window.print()}>
              {t("common.print")}
            </Button>
          </>
        }
      />
      <ErrorText error={error} />
      {data?.from && data?.to ? <p className="mb-4 text-sm text-slate-400">{t("finance.periodRange", { from: data.from, to: data.to })}</p> : null}

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">{t("reports.now")}</h2>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Stat label={t("reports.inShop")} value={String(kpis?.inShopCount || 0)} />
        <Stat label={t("reports.waitingParts")} value={String(kpis?.waitingPartsCount || 0)} />
        <Stat label={t("reports.waitingAuth")} value={String(kpis?.waitingAuthCount || 0)} />
        <Stat label={t("reports.ready")} value={String(kpis?.readyWorkOrders || 0)} />
        <Stat label={t("reports.overdue")} value={String(kpis?.overdueCount || 0)} />
        <Stat label={t("reports.unpaid")} value={money(kpis?.unpaidAmount || 0)} hint={String(kpis?.unpaidOpenOrders || 0)} />
        <Stat label={t("reports.openNow")} value={money(kpis?.estimatesAmount || 0)} hint={String(kpis?.estimatesOpen || 0)} />
      </div>
      <div className="mb-8 grid gap-4 xl:grid-cols-2">
        <ReportCard title={t("reports.openNow")} hint={t("reports.openNowHint")}>
          <EstimateTable rows={kpis?.estimates || []} empty={t("dash.estimatesEmpty")} />
        </ReportCard>
        <ReportCard title={t("reports.lowStock")} hint={t("reports.lowStockHint")}>
          <LowStockTable rows={lowStock} empty={t("reports.lowStockEmpty")} />
        </ReportCard>
      </div>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">{t("reports.period")}</h2>
      <p className="mb-3 text-sm text-slate-400">{t("finance.postedHint")}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label={t("finance.collected")} value={money(data?.books.collected || 0)} />
        <Stat label={t("finance.billed")} value={money(shop?.billed || 0)} hint={t("reports.closedCount", { n: shop?.roCount || 0 })} />
        <Stat label={t("finance.margin")} value={money(shop?.margin || 0)} />
        <Stat label={t("finance.tax", { label: data?.taxLabel || "GST" })} value={money(data?.books.taxCollected || 0)} />
        <Stat label={t("finance.receivable")} value={money(data?.books.receivable || 0)} />
        <Stat label={t("finance.units")} value={String(sales?.units || 0)} hint={money(sales?.amount || 0)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportCard title={t("reports.closedOrders")} hint={t("reports.closedCount", { n: closedOrders?.count || 0 })}>
          <ClosedTable rows={closedOrders?.rows || []} empty={t("reports.empty")} href={(row) => `/taller/${row.id}`} />
        </ReportCard>
        <ReportCard title={t("finance.estimates")} hint={t("finance.estimatesHint")}>
          <div className="grid grid-cols-3 gap-3 px-5 pt-4 text-sm">
            <div>
              <div className="text-xs uppercase text-slate-500">{t("finance.estCount")}</div>
              <div className="mt-1 text-xl">{report?.estimates?.count || 0}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">{t("finance.estQuoted")}</div>
              <div className="mt-1 text-xl text-amber-200">{money(report?.estimates?.quoted || 0)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">{t("finance.estDeclined")}</div>
              <div className="mt-1 text-xl">{money(report?.estimates?.declined || 0)}</div>
            </div>
          </div>
          <EstimateTable rows={report?.estimates?.rows || []} empty={t("finance.noEstimates")} />
        </ReportCard>

        <ReportCard title={t("finance.shopMix")}>
          {shop ? (
            <div className="space-y-4 p-5 text-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.roCount")}</div>
                  <div className="mt-1 text-xl">{shop.roCount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.avgRo")}</div>
                  <div className="mt-1 text-xl">{money(shop.avgRo)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.billed")}</div>
                  <div className="mt-1 text-xl">{money(shop.billed)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.margin")}</div>
                  <div className="mt-1 text-xl">{money(shop.margin)}</div>
                </div>
              </div>
              <MixBar
                parts={[
                  { key: "labor", amount: shop.labor, className: "bg-gold-400" },
                  { key: "parts", amount: shop.parts, className: "bg-sky-400" },
                  { key: "sublet", amount: shop.sublet, className: "bg-violet-400" },
                ]}
              />
              <table className="w-full text-left">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1">{t("finance.mix")}</th>
                    <th className="py-1">{t("finance.billed")}</th>
                    <th className="py-1">{t("finance.margin")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-ink-600">
                    <td className="py-2">{t("workshop.labor")}</td>
                    <td>{money(shop.labor)}</td>
                    <td>{money(shop.laborMargin)}</td>
                  </tr>
                  <tr className="border-t border-ink-600">
                    <td className="py-2">{t("workshop.part")}</td>
                    <td>{money(shop.parts)}</td>
                    <td>{money(shop.partsMargin)}</td>
                  </tr>
                  <tr className="border-t border-ink-600">
                    <td className="py-2">{t("woPay.sublet")}</td>
                    <td>{money(shop.sublet)}</td>
                    <td>{money(shop.subletMargin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text={t("reports.empty")} />
          )}
        </ReportCard>

        <ReportCard title={t("finance.techs")}>
          {report?.techs.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("workshop.tech")}</th>
                  <th className="px-5 py-2">{t("finance.roCount")}</th>
                  <th className="px-5 py-2">{t("workshop.labor")}</th>
                  <th className="px-5 py-2">{t("finance.billed")}</th>
                </tr>
              </thead>
              <tbody>
                {report.techs.map((row) => (
                  <tr key={row.id} className="border-t border-ink-600">
                    <td className="px-5 py-2">{row.name || t("workshop.noTech")}</td>
                    <td className="px-5 py-2">{row.roCount}</td>
                    <td className="px-5 py-2">{money(row.laborAmount)}</td>
                    <td className="px-5 py-2">{money(row.billed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text={t("reports.empty")} />
          )}
        </ReportCard>

        <ReportCard title={t("finance.topParts")}>
          {report?.topParts.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("workshop.part")}</th>
                  <th className="px-5 py-2">{t("workshop.qty")}</th>
                  <th className="px-5 py-2">{t("finance.billed")}</th>
                </tr>
              </thead>
              <tbody>
                {report.topParts.map((row) => (
                  <tr key={row.id} className="border-t border-ink-600">
                    <td className="px-5 py-2">
                      {row.name}
                      {row.sku ? <div className="text-xs text-slate-500">{row.sku}</div> : null}
                    </td>
                    <td className="px-5 py-2">{row.qty}</td>
                    <td className="px-5 py-2">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text={t("reports.empty")} />
          )}
        </ReportCard>

        <ReportCard title={t("finance.topOps")}>
          {report?.topOps.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("workshop.operation")}</th>
                  <th className="px-5 py-2">{t("workshop.qty")}</th>
                  <th className="px-5 py-2">{t("finance.billed")}</th>
                </tr>
              </thead>
              <tbody>
                {report.topOps.map((row) => (
                  <tr key={row.id} className="border-t border-ink-600">
                    <td className="px-5 py-2">{row.code ? `${row.code} · ${row.name}` : row.name}</td>
                    <td className="px-5 py-2">{row.qty}</td>
                    <td className="px-5 py-2">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text={t("reports.empty")} />
          )}
        </ReportCard>

        {showParts ? (
          <ReportCard title={t("reports.closedParts")} hint={t("reports.closedCount", { n: closedParts?.count || 0 })}>
            <ClosedTable rows={closedParts?.rows || []} empty={t("reports.empty")} href={(row) => `/taller/${row.id}`} />
          </ReportCard>
        ) : null}
        {showWash ? (
          <ReportCard title={t("reports.closedWash")} hint={t("reports.closedCount", { n: closedWash?.count || 0 })}>
            <ClosedTable rows={closedWash?.rows || []} empty={t("reports.empty")} href={(row) => `/lavado/${row.id}`} />
          </ReportCard>
        ) : null}

        <ReportCard title={t("finance.unitsSold")}>
          {sales && sales.units > 0 ? (
            <div className="p-5 text-sm">
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.units")}</div>
                  <div className="mt-1 text-xl">{sales.units}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.billed")}</div>
                  <div className="mt-1 text-xl">{money(sales.amount)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.margin")}</div>
                  <div className="mt-1 text-xl">{money(sales.margin)}</div>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1">{t("vehicles.make")}</th>
                    <th className="py-1">{t("finance.units")}</th>
                    <th className="py-1">{t("finance.billed")}</th>
                    <th className="py-1">{t("finance.margin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.byMake.map((row) => (
                    <tr key={row.id} className="border-t border-ink-600">
                      <td className="py-2">{row.name}</td>
                      <td>{row.units}</td>
                      <td>{money(row.amount)}</td>
                      <td>{money(row.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text={t("finance.noSales")} />
          )}
        </ReportCard>

        <ReportCard title={t("finance.expenseMix")}>
          {report ? (
            <div className="p-5 text-sm">
              <MixBar
                parts={report.expensesByCategory.map((row, i) => ({
                  key: row.category,
                  amount: row.amount,
                  className: ["bg-gold-400", "bg-sky-400", "bg-violet-400", "bg-amber-400", "bg-slate-400"][i] || "bg-slate-400",
                }))}
              />
              <table className="mt-3 w-full text-left">
                <tbody>
                  {report.expensesByCategory.map((row) => (
                    <tr key={row.category} className="border-t border-ink-600">
                      <td className="py-2">{t(k(`expense.${row.category}`))}</td>
                      <td className="py-2 text-right">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text={t("reports.empty")} />
          )}
        </ReportCard>

        <ReportCard title={t("finance.aging")}>
          {report ? (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("finance.days")}</th>
                  <th className="px-5 py-2">{t("finance.count")}</th>
                  <th className="px-5 py-2">{t("finance.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {report.aging.map((row) => (
                  <tr key={row.bucket} className="border-t border-ink-600">
                    <td className="px-5 py-2">{t(k(`finance.aging.${row.bucket}`))}</td>
                    <td className="px-5 py-2">{row.count}</td>
                    <td className="px-5 py-2">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text={t("reports.empty")} />
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function EstimateTable({ rows, empty }: { rows: DashboardEstimateRow[]; empty: string }) {
  const { t } = useI18n();
  if (!rows.length) return <Empty text={empty} />;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          <th className="px-5 py-2">{t("workshop.number")}</th>
          <th className="px-5 py-2">{t("finance.customer")}</th>
          <th className="px-5 py-2">{t("workshop.vehicle")}</th>
          <th className="px-5 py-2">{t("finance.estDate")}</th>
          <th className="px-5 py-2 text-right">{t("finance.estQuoted")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-ink-600">
            <td className="px-5 py-2">
              <Link className="font-mono text-xs text-gold-400" to={`/taller/${row.id}`}>
                {row.number}
              </Link>
            </td>
            <td className="px-5 py-2">{row.customerName || t("common.dash")}</td>
            <td className="px-5 py-2 text-slate-400">{row.vehicleLabel || t("common.dash")}</td>
            <td className="px-5 py-2">{dateEs(row.createdAt)}</td>
            <td className="px-5 py-2 text-right tabular-nums text-amber-200">{money(row.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LowStockTable({ rows, empty }: { rows: Part[]; empty: string }) {
  const { t } = useI18n();
  if (!rows.length) return <Empty text={empty} />;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          <th className="px-5 py-2">{t("workshop.part")}</th>
          <th className="px-5 py-2">{t("reports.stockOnHand")}</th>
          <th className="px-5 py-2">{t("reports.min")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-ink-600">
            <td className="px-5 py-2">
              <Link className="text-gold-400" to={`/partes/${row.id}`}>
                {row.name}
              </Link>
              {row.sku ? <div className="text-xs text-slate-500">{row.sku}</div> : null}
            </td>
            <td className="px-5 py-2">{row.stock}</td>
            <td className="px-5 py-2">{row.minStock}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
