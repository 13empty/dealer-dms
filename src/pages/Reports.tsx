import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorText, PageHeader } from "../components/ui";
import { call, dateEs, formatNumber, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { usePrefs } from "../lib/prefs-context";
import { useShop } from "../lib/shop-context";
import type { DashboardClosedRow, DashboardEstimateRow, FinancePeriod, FinanceReport, FinanceSummary, Part } from "../vite-env";

const PERIODS: FinancePeriod[] = ["today", "week", "month", "year"];
type ReportTab = "taller" | "partes" | "contaduria" | "ventas" | "lavado";

function printSection(id: ReportTab) {
  document.body.dataset.report = id;
  const done = () => {
    delete document.body.dataset.report;
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

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

function PrintHead({ title, period }: { title: string; period: string }) {
  const { name } = useShop();
  return (
    <div className="report-print-head mb-4">
      <div className="text-lg font-semibold">{name}</div>
      <div>{title}</div>
      {period ? <div className="text-sm">{period}</div> : null}
    </div>
  );
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
  const { prefs } = usePrefs();
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState<ReportTab>("taller");
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
  const stock = report?.partsStock;
  const showSales = prefs.showUnitSales;
  const showWash = offerWash || Number(report?.closedWash?.count || 0) > 0;
  const showPartsInvoices = offerPartInvoices || Number(report?.closedParts?.count || 0) > 0;
  const periodLabel = data?.from && data?.to ? t("finance.periodRange", { from: data.from, to: data.to }) : "";
  const tabs: ReportTab[] = ["taller", "partes", "contaduria", ...(showSales ? (["ventas"] as const) : []), ...(showWash ? (["lavado"] as const) : [])];
  const active = tabs.includes(tab) ? tab : "taller";

  return (
    <div className="page">
      <PageHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
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
            <input className="w-[8.5rem]" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("finance.from")} />
            <input className="w-[8.5rem]" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("finance.to")} />
            <Button variant="ghost" onClick={applyRange}>
              {t("finance.range")}
            </Button>
          </div>
        }
      />
      <ErrorText error={error} />
      {periodLabel ? <p className="no-print mb-3 text-sm text-slate-400">{periodLabel}</p> : null}
      <div className="no-print mb-4 flex flex-wrap gap-1 rounded-md border border-ink-600 p-1">
        {tabs.map((id) => (
          <button
            key={id}
            className={`rounded px-3 py-2 text-sm ${active === id ? "bg-gold-400/15 text-gold-400" : "text-slate-300"}`}
            onClick={() => setTab(id)}
          >
            {t(k(`reports.tab.${id}`))}
          </button>
        ))}
      </div>

      <section data-report-panel="taller" className={active === "taller" ? "grid gap-4" : "hidden"}>
        <PrintHead title={t("reports.tab.taller")} period={periodLabel} />
        <div className="no-print flex justify-end">
          <Button variant="ghost" onClick={() => printSection("taller")}>
            {t("reports.print")}
          </Button>
        </div>
        <p className="text-sm text-slate-400">{t("reports.workshopHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label={t("reports.inShop")} value={String(kpis?.inShopCount || 0)} />
          <Stat label={t("reports.waitingParts")} value={String(kpis?.waitingPartsCount || 0)} />
          <Stat label={t("reports.waitingAuth")} value={String(kpis?.waitingAuthCount || 0)} />
          <Stat label={t("reports.ready")} value={String(kpis?.readyWorkOrders || 0)} />
          <Stat label={t("reports.overdue")} value={String(kpis?.overdueCount || 0)} />
          <Stat label={t("reports.unpaid")} value={money(kpis?.unpaidAmount || 0)} hint={String(kpis?.unpaidOpenOrders || 0)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("reports.hours")} value={formatNumber(shop?.hours || 0)} hint={t("reports.hoursHint")} />
          <Stat label={t("reports.effectiveRate")} value={money(shop?.effectiveRate || 0)} hint={t("reports.effectiveRateHint")} />
          <Stat label={t("finance.avgRo")} value={money(shop?.avgRo || 0)} />
          <Stat label={t("finance.margin")} value={money(shop?.margin || 0)} hint={money(shop?.billed || 0)} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportCard title={t("finance.shopMix")}>
            {shop ? (
              <div className="space-y-4 p-5 text-sm">
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
          <ReportCard title={t("finance.techs")} hint={t("reports.techHint")}>
            {report?.techs.length ? (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-5 py-2">{t("workshop.tech")}</th>
                    <th className="px-5 py-2">{t("finance.roCount")}</th>
                    <th className="px-5 py-2">{t("reports.hours")}</th>
                    <th className="px-5 py-2">{t("workshop.labor")}</th>
                    <th className="px-5 py-2">{t("finance.billed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.techs.map((row) => (
                    <tr key={row.id} className="border-t border-ink-600">
                      <td className="px-5 py-2">{row.name || t("workshop.noTech")}</td>
                      <td className="px-5 py-2">{row.roCount}</td>
                      <td className="px-5 py-2">{formatNumber(row.hours || 0)}</td>
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
          <ReportCard title={t("reports.closedOrders")} hint={t("reports.closedCount", { n: report?.closedOrders?.count || 0 })}>
            <ClosedTable rows={report?.closedOrders?.rows || []} empty={t("reports.empty")} href={(row) => `/taller/${row.id}`} />
          </ReportCard>
          <ReportCard title={t("finance.estimates")} hint={t("finance.estimatesHint")}>
            <div className="grid grid-cols-3 gap-3 px-5 pt-4 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-500">{t("reports.openNow")}</div>
                <div className="mt-1 text-xl">{kpis?.estimatesOpen || 0}</div>
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
        </div>
      </section>

      <section data-report-panel="partes" className={active === "partes" ? "grid gap-4" : "hidden"}>
        <PrintHead title={t("reports.tab.partes")} period={periodLabel} />
        <div className="no-print flex justify-end">
          <Button variant="ghost" onClick={() => printSection("partes")}>
            {t("reports.print")}
          </Button>
        </div>
        <p className="text-sm text-slate-400">{t("reports.partsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("reports.inventoryCost")} value={money(stock?.cost || 0)} hint={t("reports.skuCount", { n: stock?.skuCount || 0 })} />
          <Stat label={t("reports.inventoryRetail")} value={money(stock?.retail || 0)} />
          <Stat label={t("reports.partsGross")} value={money(report?.partsDept?.margin || 0)} hint={money(report?.partsDept?.sales || 0)} />
          <Stat label={t("reports.onOrder")} value={String(stock?.onOrder || 0)} hint={t("reports.specialOrder", { n: stock?.special || 0 })} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportCard title={t("reports.lowStock")} hint={t("reports.lowStockHint")}>
            <LowStockTable rows={(kpis?.lowStock || []).slice(0, 20)} empty={t("reports.lowStockEmpty")} />
          </ReportCard>
          <ReportCard title={t("finance.topParts")}>
            {report?.topParts.length ? (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-5 py-2">{t("workshop.part")}</th>
                    <th className="px-5 py-2">{t("workshop.qty")}</th>
                    <th className="px-5 py-2">{t("finance.billed")}</th>
                    <th className="px-5 py-2">{t("finance.margin")}</th>
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
                      <td className="px-5 py-2">{money((row.amount || 0) - (row.cost || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text={t("reports.empty")} />
            )}
          </ReportCard>
          {showPartsInvoices ? (
            <ReportCard title={t("reports.closedParts")} hint={t("reports.closedCount", { n: report?.closedParts?.count || 0 })}>
              <ClosedTable rows={report?.closedParts?.rows || []} empty={t("reports.empty")} href={(row) => `/taller/${row.id}`} />
            </ReportCard>
          ) : null}
        </div>
      </section>

      <section data-report-panel="contaduria" className={active === "contaduria" ? "grid gap-4" : "hidden"}>
        <PrintHead title={t("reports.tab.contaduria")} period={periodLabel} />
        <div className="no-print flex justify-end">
          <Button variant="ghost" onClick={() => printSection("contaduria")}>
            {t("reports.print")}
          </Button>
        </div>
        <p className="text-sm text-slate-400">{t("reports.booksHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label={t("finance.collected")} value={money(data?.books.collected || 0)} />
          <Stat label={t("finance.spent")} value={money(data?.books.spent || 0)} />
          <Stat label={t("finance.net")} value={money(data?.books.net || 0)} />
          <Stat label={t("finance.tax", { label: data?.taxLabel || "GST" })} value={money(data?.books.taxCollected || 0)} />
          <Stat label={t("finance.receivable")} value={money(data?.books.receivable || 0)} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ReportCard title={t("finance.cashbox")}>
            {data?.cashbox.length ? (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-5 py-2">{t("sales.payMethod")}</th>
                    <th className="px-5 py-2">{t("finance.in")}</th>
                    <th className="px-5 py-2">{t("finance.out")}</th>
                    <th className="px-5 py-2">{t("finance.net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cashbox.map((row) => (
                    <tr key={row.method} className="border-t border-ink-600">
                      <td className="px-5 py-2">{t(k(`pay.${row.method}`))}</td>
                      <td className="px-5 py-2">{money(row.in)}</td>
                      <td className="px-5 py-2">{money(row.out)}</td>
                      <td className="px-5 py-2">{money(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        </div>
      </section>

      {showSales ? (
        <section data-report-panel="ventas" className={active === "ventas" ? "grid gap-4" : "hidden"}>
          <PrintHead title={t("reports.tab.ventas")} period={periodLabel} />
          <div className="no-print flex justify-end">
            <Button variant="ghost" onClick={() => printSection("ventas")}>
              {t("reports.print")}
            </Button>
          </div>
          <p className="text-sm text-slate-400">{t("reports.salesHint")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t("finance.units")} value={String(sales?.units || 0)} />
            <Stat label={t("finance.billed")} value={money(sales?.amount || 0)} />
            <Stat label={t("finance.margin")} value={money(sales?.margin || 0)} />
          </div>
          <ReportCard title={t("finance.unitsSold")}>
            {sales && sales.units > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-5 py-2">{t("vehicles.make")}</th>
                    <th className="px-5 py-2">{t("finance.units")}</th>
                    <th className="px-5 py-2">{t("finance.billed")}</th>
                    <th className="px-5 py-2">{t("finance.margin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.byMake.map((row) => (
                    <tr key={row.id} className="border-t border-ink-600">
                      <td className="px-5 py-2">{row.name}</td>
                      <td className="px-5 py-2">{row.units}</td>
                      <td className="px-5 py-2">{money(row.amount)}</td>
                      <td className="px-5 py-2">{money(row.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text={t("finance.noSales")} />
            )}
          </ReportCard>
        </section>
      ) : null}

      {showWash ? (
        <section data-report-panel="lavado" className={active === "lavado" ? "grid gap-4" : "hidden"}>
          <PrintHead title={t("reports.tab.lavado")} period={periodLabel} />
          <div className="no-print flex justify-end">
            <Button variant="ghost" onClick={() => printSection("lavado")}>
              {t("reports.print")}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label={t("reports.washOpen")} value={String(kpis?.washOpen || 0)} />
            <Stat label={t("reports.closedWash")} value={money(report?.closedWash?.amount || 0)} hint={t("reports.closedCount", { n: report?.closedWash?.count || 0 })} />
          </div>
          <ReportCard title={t("reports.closedWash")}>
            <ClosedTable rows={report?.closedWash?.rows || []} empty={t("reports.empty")} href={(row) => `/lavado/${row.id}`} />
          </ReportCard>
        </section>
      ) : null}
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
