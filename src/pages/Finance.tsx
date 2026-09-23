import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SearchPicker, type SearchOption } from "../components/SearchPicker";
import { Button, Card, ErrorText, Field, Modal, PageHeader } from "../components/ui";
import { call, customerName, dateEs, money, vehicleLabel } from "../lib/format";
import { k, useI18n, type Translate } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import type { Expense, FinancePeriod, FinanceReceivable, FinanceSummary } from "../vite-env";

const categories: Expense["category"][] = ["partes", "renta", "servicios", "sueldos", "otros"];
const methods = ["efectivo", "tarjeta", "transferencia"];
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

function ReportCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-600 px-5 py-3 font-medium">{title}</div>
      {children}
    </Card>
  );
}

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyExpense() {
  return { amount: "", category: "partes" as Expense["category"], method: "efectivo", spentAt: todayInput(), notes: "" };
}

function emptyCollect() {
  return {
    kind: "otro" as "taller" | "venta" | "otro",
    id: "",
    amount: "",
    method: "efectivo",
    paidAt: todayInput(),
    notes: "",
    label: "",
    hint: "",
    close: true,
  };
}

function receivableKey(row: Pick<FinanceReceivable, "kind" | "id">) {
  return `${row.kind}:${row.id}`;
}

function receivableOption(row: FinanceReceivable, t: Translate): SearchOption {
  return {
    id: receivableKey(row),
    label: `${row.number} · ${money(row.balance || 0)}`,
    hint: [customerName(row.customer), row.kind === "venta" ? t("nav.sales") : t("nav.workshop")].filter(Boolean).join(" · "),
    raw: row,
  };
}

export default function Finance() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState<"caja" | "reportes">("reportes");
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [form, setForm] = useState(emptyExpense);
  const [collect, setCollect] = useState(emptyCollect);

  async function load(nextPeriod = period, nextFrom = from, nextTo = to) {
    try {
      setError(null);
      const payload =
        nextPeriod === "range"
          ? { period: nextPeriod, from: nextFrom, to: nextTo }
          : nextPeriod;
      setData(await call(window.dms.finance.summary(payload)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (period === "range" && (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))) return;
    void load();
  }, [period, from, to]);

  async function saveExpense() {
    try {
      await call(
        window.dms.finance.addExpense({
          amount: Number(form.amount),
          category: form.category,
          method: form.method,
          spentAt: form.spentAt,
          notes: form.notes,
        })
      );
      setExpenseOpen(false);
      setForm(emptyExpense());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveCollect() {
    try {
      await call(
        window.dms.finance.collect({
          kind: collect.kind,
          id: collect.kind === "otro" ? undefined : collect.id,
          amount: Number(collect.amount),
          method: collect.method,
          paidAt: collect.paidAt,
          notes: collect.notes,
          close: collect.kind === "otro" ? false : collect.close,
        })
      );
      setCollectOpen(false);
      setCollect(emptyCollect());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeExpense(id: string) {
    if (!askConfirm(t("finance.deleteExpense"))) return;
    try {
      await call(window.dms.finance.removeExpense(id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeIncome(id: string) {
    if (!askConfirm(t("finance.deleteIncome"))) return;
    try {
      await call(window.dms.finance.removeIncome(id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startCollect(row?: FinanceReceivable) {
    if (row) {
      const option = receivableOption(row, t);
      setCollect({
        kind: row.kind,
        id: row.id,
        amount: String(row.balance || ""),
        method: "efectivo",
        paidAt: todayInput(),
        notes: "",
        label: option.label,
        hint: option.hint || "",
        close: true,
      });
    } else {
      setCollect(emptyCollect());
    }
    setCollectOpen(true);
  }

  const books = data?.books;
  const receivables = data?.receivables || [];
  const report = data?.report;

  function pickPeriod(next: FinancePeriod) {
    setPeriod(next);
    if (next !== "range") {
      setFrom("");
      setTo("");
    }
  }

  function applyRange() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      setError(t("finance.dateFormat"));
      return;
    }
    setPeriod("range");
  }

  return (
    <div className="page">
      <PageHeader
        title={t("finance.title")}
        subtitle={t("finance.subtitle")}
        actions={
          <>
            <div className="flex rounded-md border border-ink-600">
              {PERIODS.map((id) => (
                <button
                  key={id}
                  className={`px-3 py-2 text-sm ${period === id ? "bg-gold-400/15 text-gold-400" : "text-slate-300"}`}
                  onClick={() => pickPeriod(id)}
                >
                  {t(k(`finance.${id}`))}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                className="w-[8.5rem]"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder={t("finance.from")}
              />
              <input
                className="w-[8.5rem]"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={t("finance.to")}
              />
              <Button variant="ghost" onClick={applyRange}>
                {t("finance.range")}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => window.print()}>
              {t("common.print")}
            </Button>
            <Button variant="ghost" onClick={() => setExpenseOpen(true)}>
              {t("finance.addExpense")}
            </Button>
            <Button onClick={() => startCollect()}>{t("finance.addPayment")}</Button>
          </>
        }
      />
      <ErrorText error={error} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-ink-600">
          <button
            className={`px-3 py-2 text-sm ${tab === "caja" ? "bg-gold-400/15 text-gold-400" : "text-slate-300"}`}
            onClick={() => setTab("caja")}
          >
            {t("finance.tabCash")}
          </button>
          <button
            className={`px-3 py-2 text-sm ${tab === "reportes" ? "bg-gold-400/15 text-gold-400" : "text-slate-300"}`}
            onClick={() => setTab("reportes")}
          >
            {t("finance.tabReports")}
          </button>
        </div>
        {data?.from && data?.to ? (
          <p className="text-sm text-slate-400">
            {t("finance.periodRange", { from: data.from, to: data.to })}
          </p>
        ) : null}
      </div>
      {books ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="p-5">
            <div className="text-xs uppercase text-slate-400">{t("finance.collected")}</div>
            <div className="mt-2 text-2xl">{money(books.collected)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {t("finance.collectedHint", { sales: money(books.collectedSales), shop: money(books.collectedShop) })}
              {books.collectedOther ? ` · ${t("finance.otherIncome")}: ${money(books.collectedOther)}` : ""}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-xs uppercase text-slate-400">{t("finance.spent")}</div>
            <div className="mt-2 text-2xl">{money(books.spent)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs uppercase text-slate-400">{t("finance.net")}</div>
            <div className="mt-2 text-2xl">{money(books.net)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs uppercase text-slate-400">{t("finance.receivable")}</div>
            <div className="mt-2 text-2xl">{money(books.receivable)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs uppercase text-slate-400">{t("finance.tax", { label: data?.taxLabel || "GST" })}</div>
            <div className="mt-2 text-2xl">{money(books.taxCollected)}</div>
            <div className="mt-1 text-xs text-slate-500">{t("finance.taxHint")}</div>
          </Card>
        </div>
      ) : null}
      <div className={tab === "caja" ? "grid gap-4 xl:grid-cols-2" : "hidden print:grid print:gap-4 xl:grid-cols-2"}>
        <Card className="overflow-hidden">
          <div className="border-b border-ink-600 px-5 py-3 font-medium">{t("finance.cashbox")}</div>
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
              {(data?.cashbox || []).map((row) => (
                <tr key={row.method} className="border-t border-ink-600">
                  <td className="px-5 py-2">{t(k(`pay.${row.method}`))}</td>
                  <td className="px-5 py-2">{money(row.in)}</td>
                  <td className="px-5 py-2">{money(row.out)}</td>
                  <td className="px-5 py-2">{money(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-ink-600 px-5 py-3 font-medium">{t("finance.receivables")}</div>
          {receivables.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noReceivables")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("finance.customer")}</th>
                  <th className="px-5 py-2">{t("finance.collected")}</th>
                  <th className="px-5 py-2">{t("finance.balance")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((row) => (
                  <tr key={receivableKey(row)} className="border-t border-ink-600">
                    <td className="px-5 py-2">
                      <Link className="text-gold-400" to={row.kind === "venta" ? `/ventas/${row.id}` : `/taller/${row.id}`}>
                        {row.number} · {customerName(row.customer) || t("common.dash")}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {row.kind === "venta" ? t("nav.sales") : t("nav.workshop")}
                      </div>
                    </td>
                    <td className="px-5 py-2">{money(row.paid || 0)}</td>
                    <td className="px-5 py-2">{money(row.balance || 0)}</td>
                    <td className="px-5 py-2 text-right">
                      <button className="text-gold-400" onClick={() => startCollect(row)}>
                        {t("finance.collect")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-ink-600 px-5 py-3 font-medium">{t("finance.journal")}</div>
          {(data?.journal || []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.emptyJournal")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("finance.date")}</th>
                  <th className="px-5 py-2">{t("finance.movement")}</th>
                  <th className="px-5 py-2">{t("finance.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.journal || []).map((row) => (
                  <tr key={row.id} className="border-t border-ink-600">
                    <td className="px-5 py-2 whitespace-nowrap">{dateEs(row.at)}</td>
                    <td className="px-5 py-2">
                      {row.href ? (
                        <Link className="text-gold-400" to={row.href}>
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                      <div className="text-xs text-slate-500">
                        {t(k(`finance.source.${row.source}`))} · {t(k(`pay.${row.method}`))}
                        {row.category ? ` · ${t(k(`expense.${row.category}`))}` : ""}
                      </div>
                    </td>
                    <td className={`px-5 py-2 ${row.type === "gasto" ? "text-red-300" : "text-emerald-300"}`}>
                      {row.type === "gasto" ? "−" : "+"}
                      {money(row.amount)}
                      {row.incomeId ? (
                        <button className="ml-3 text-xs text-red-300" onClick={() => void removeIncome(row.incomeId as string)}>
                          {t("common.delete")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-ink-600 px-5 py-3 font-medium">{t("finance.expenses")}</div>
          {(data?.expenses || []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noExpenses")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("finance.date")}</th>
                  <th className="px-5 py-2">{t("finance.category")}</th>
                  <th className="px-5 py-2">{t("finance.amount")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data?.expenses || []).map((row) => (
                  <tr key={row.id} className="border-t border-ink-600">
                    <td className="px-5 py-2">{dateEs(row.spentAt)}</td>
                    <td className="px-5 py-2">
                      {t(k(`expense.${row.category}`))}
                      <div className="text-xs text-slate-500">
                        {t(k(`pay.${row.method}`))}
                        {row.notes ? ` · ${row.notes}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-2">{money(row.amount)}</td>
                    <td className="px-5 py-2 text-right">
                      <button className="text-red-300" onClick={() => void removeExpense(row.id)}>
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <div className={tab === "reportes" ? "mt-4 grid gap-4 xl:grid-cols-2" : "mt-4 hidden print:grid print:gap-4 xl:grid-cols-2"}>
        <p className="xl:col-span-2 text-sm text-slate-400">{t("finance.postedHint")}</p>
        <div className="xl:col-span-2">
          <ReportCard title={t("finance.estimates")}>
            {report?.estimates ? (
              <div className="p-5 text-sm">
                <p className="mb-4 text-slate-400">{t("finance.estimatesHint")}</p>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs uppercase text-slate-500">{t("finance.estCount")}</div>
                    <div className="mt-1 text-xl">{report.estimates.count}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-500">{t("finance.estQuoted")}</div>
                    <div className="mt-1 text-xl text-amber-200">{money(report.estimates.quoted)}</div>
                    <div className="mt-1 text-xs text-slate-500">{t("finance.estLeft")}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-500">{t("finance.estDeclined")}</div>
                    <div className="mt-1 text-xl">{money(report.estimates.declined)}</div>
                  </div>
                </div>
                {report.estimates.rows.length ? (
                  <table className="w-full text-left">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="py-1">{t("workshop.number")}</th>
                        <th className="py-1">{t("finance.customer")}</th>
                        <th className="py-1">{t("finance.estDate")}</th>
                        <th className="py-1 text-right">{t("finance.estQuoted")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.estimates.rows.map((row) => (
                        <tr key={row.id} className="border-t border-ink-600">
                          <td className="py-2">
                            <Link className="text-gold-400" to={`/taller/${row.id}`}>
                              {row.number}
                            </Link>
                          </td>
                          <td className="py-2">{row.customerName || t("common.dash")}</td>
                          <td className="py-2">{dateEs(row.createdAt)}</td>
                          <td className="py-2 text-right tabular-nums text-amber-200">{money(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-slate-400">{t("finance.noEstimates")}</p>
                )}
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noEstimates")}</p>
            )}
          </ReportCard>
        </div>
        <ReportCard title={t("finance.shopMix")}>
          {report ? (
            <div className="space-y-4 p-5 text-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.roCount")}</div>
                  <div className="mt-1 text-xl">{report.shop.roCount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.avgRo")}</div>
                  <div className="mt-1 text-xl">{money(report.shop.avgRo)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.billed")}</div>
                  <div className="mt-1 text-xl">{money(report.shop.billed)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.margin")}</div>
                  <div className="mt-1 text-xl">{money(report.shop.margin)}</div>
                </div>
              </div>
              <MixBar
                parts={[
                  { key: "labor", amount: report.shop.labor, className: "bg-gold-400" },
                  { key: "parts", amount: report.shop.parts, className: "bg-sky-400" },
                  { key: "sublet", amount: report.shop.sublet, className: "bg-violet-400" },
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
                    <td>{money(report.shop.labor)}</td>
                    <td>{money(report.shop.laborMargin)}</td>
                  </tr>
                  <tr className="border-t border-ink-600">
                    <td className="py-2">{t("workshop.part")}</td>
                    <td>{money(report.shop.parts)}</td>
                    <td>{money(report.shop.partsMargin)}</td>
                  </tr>
                  <tr className="border-t border-ink-600">
                    <td className="py-2">{t("woPay.sublet")}</td>
                    <td>{money(report.shop.sublet)}</td>
                    <td>{money(report.shop.subletMargin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noSales")}</p>
          )}
        </ReportCard>
        <ReportCard title={t("finance.unitsSold")}>
          {report && report.sales.units > 0 ? (
            <div className="p-5 text-sm">
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.units")}</div>
                  <div className="mt-1 text-xl">{report.sales.units}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.billed")}</div>
                  <div className="mt-1 text-xl">{money(report.sales.amount)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("finance.margin")}</div>
                  <div className="mt-1 text-xl">{money(report.sales.margin)}</div>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1">{t("vehicles.make")}</th>
                    <th className="py-1">{t("finance.units")}</th>
                    <th className="py-1">{t("finance.billed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sales.byMake.map((row) => (
                    <tr key={row.id} className="border-t border-ink-600">
                      <td className="py-2">{row.name}</td>
                      <td>{row.units}</td>
                      <td>{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noSales")}</p>
          )}
        </ReportCard>
        <ReportCard title={t("finance.topParts")}>
          {report && report.topParts.length ? (
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
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noSales")}</p>
          )}
        </ReportCard>
        <ReportCard title={t("finance.topOps")}>
          {report && report.topOps.length ? (
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
                    <td className="px-5 py-2">
                      {row.code ? `${row.code} · ${row.name}` : row.name}
                    </td>
                    <td className="px-5 py-2">{row.qty}</td>
                    <td className="px-5 py-2">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noSales")}</p>
          )}
        </ReportCard>
        <ReportCard title={t("finance.techs")}>
          {report && report.techs.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("workshop.tech")}</th>
                  <th className="px-5 py-2">{t("finance.roCount")}</th>
                  <th className="px-5 py-2">{t("finance.billed")}</th>
                </tr>
              </thead>
              <tbody>
                {report.techs.map((row) => (
                  <tr key={row.id} className="border-t border-ink-600">
                    <td className="px-5 py-2">{row.name || t("workshop.noTech")}</td>
                    <td className="px-5 py-2">{row.roCount}</td>
                    <td className="px-5 py-2">{money(row.billed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-400">{t("finance.noSales")}</p>
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
          ) : null}
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
          ) : null}
        </ReportCard>
      </div>
      {expenseOpen ? (
        <Modal title={t("finance.addExpense")} onClose={() => setExpenseOpen(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("finance.amount")}>
              <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label={t("finance.spentAt")}>
              <input value={form.spentAt} onChange={(e) => setForm({ ...form, spentAt: e.target.value })} placeholder="AAAA-MM-DD" />
            </Field>
            <Field label={t("finance.category")}>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Expense["category"] })}>
                {categories.map((id) => (
                  <option key={id} value={id}>
                    {t(k(`expense.${id}`))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("sales.payMethod")}>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {methods.map((id) => (
                  <option key={id} value={id}>
                    {t(k(`pay.${id}`))}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("common.notes")}>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExpenseOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveExpense()}>{t("common.save")}</Button>
          </div>
        </Modal>
      ) : null}
      {collectOpen ? (
        <Modal title={t("finance.collectTitle")} onClose={() => setCollectOpen(false)} overflowVisible>
          <p className="mb-3 text-sm text-slate-400">{t("finance.collectHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t("finance.document")}>
                <SearchPicker
                  value={collect.kind === "otro" || !collect.id ? "" : receivableKey({ kind: collect.kind, id: collect.id })}
                  selectedLabel={collect.label}
                  selectedHint={collect.hint}
                  placeholder={t("finance.searchDoc")}
                  allowEmpty
                  emptyText={t("finance.noDocument")}
                  autoFocus={!collect.id}
                  onChange={(id, option) => {
                    if (!id || !option) {
                      setCollect({ ...collect, kind: "otro", id: "", label: "", hint: "", amount: collect.kind === "otro" ? collect.amount : "" });
                      return;
                    }
                    const row = (option.raw || {}) as FinanceReceivable;
                    setCollect({
                      ...collect,
                      kind: row.kind === "venta" ? "venta" : "taller",
                      id: row.id,
                      amount: row.balance != null ? String(row.balance) : collect.amount,
                      label: option.label,
                      hint: option.hint || "",
                    });
                  }}
                  search={async (query) => {
                    const q = query.trim().toLowerCase();
                    const seen = new Set<string>();
                    const out: SearchOption[] = [];
                    function add(row: FinanceReceivable) {
                      if (!row?.id || Number(row.balance || 0) <= 0.009) return;
                      const option = receivableOption(row, t);
                      if (seen.has(option.id)) return;
                      seen.add(option.id);
                      out.push(option);
                    }
                    for (const row of receivables) {
                      if (q) {
                        const hay = [row.number, customerName(row.customer), row.kind].join(" ").toLowerCase();
                        if (!hay.includes(q)) continue;
                      }
                      add(row);
                    }
                    if (q) {
                      try {
                        const [orders, sales] = await Promise.all([
                          call(window.dms.workOrders.list(query, { unpaid: true, limit: 8 })),
                          call(window.dms.sales.list(query, { unpaid: true, limit: 8 })),
                        ]);
                        for (const wo of orders || []) {
                          add({
                            kind: "taller",
                            id: wo.id,
                            number: wo.number,
                            customer: wo.customer,
                            paid: wo.paid,
                            balance: wo.balance,
                          });
                        }
                        for (const sale of sales || []) {
                          add({
                            kind: "venta",
                            id: sale.id,
                            number: [sale.vehicle ? vehicleLabel(sale.vehicle) : "", customerName(sale.customer)].filter(Boolean).join(" · ") || sale.id.slice(0, 8),
                            customer: sale.customer,
                            paid: sale.paid,
                            balance: sale.balance,
                          });
                        }
                      } catch {
                        /* keep local matches */
                      }
                    }
                    return out.slice(0, 12);
                  }}
                />
              </Field>
            </div>
            <Field label={t("finance.amount")}>
              <input value={collect.amount} onChange={(e) => setCollect({ ...collect, amount: e.target.value })} />
            </Field>
            <Field label={t("finance.spentAt")}>
              <input value={collect.paidAt} onChange={(e) => setCollect({ ...collect, paidAt: e.target.value })} placeholder="AAAA-MM-DD" />
            </Field>
            <Field label={t("sales.payMethod")}>
              <select value={collect.method} onChange={(e) => setCollect({ ...collect, method: e.target.value })}>
                {methods.map((id) => (
                  <option key={id} value={id}>
                    {t(k(`pay.${id}`))}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("common.notes")}>
                <input value={collect.notes} onChange={(e) => setCollect({ ...collect, notes: e.target.value })} />
              </Field>
            </div>
            {collect.kind !== "otro" && collect.id ? (
              <label className="sm:col-span-2 mb-0 flex items-start gap-2 text-sm text-slate-300">
                <input
                  className="mt-0.5"
                  type="checkbox"
                  checked={collect.close}
                  onChange={(e) => setCollect({ ...collect, close: e.target.checked })}
                />
                <span>
                  {t("finance.closeIfPaid")}
                  <span className="mt-0.5 block text-xs text-slate-500">{t("finance.closeIfPaidHint")}</span>
                </span>
              </label>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCollectOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveCollect()}>
              {collect.kind !== "otro" && collect.close ? t("finance.collectAndClose") : t("finance.collect")}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
