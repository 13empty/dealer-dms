import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppearancePanel } from "../components/Appearance";
import { UpdateBanner } from "../components/UpdatePanel";
import { Badge, Button, Card, ErrorText, Field, Page, PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth";
import { DASH_WIDGETS, DEFAULT_DASH_WIDGETS, readDashWidgets, toggleDashWidget, writeDashWidgets, type DashWidgetId } from "../lib/dash";
import { call, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import type { DashboardKpis } from "../vite-env";

export default function Dashboard() {
  const { can, user } = useAuth();
  const { t } = useI18n();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [dbPath, setDbPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState({ next: "", confirm: "" });
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [widgets, setWidgets] = useState<DashWidgetId[]>(readDashWidgets);
  const [customizing, setCustomizing] = useState(false);

  function show(id: DashWidgetId) {
    return widgets.includes(id);
  }

  function setWidget(id: DashWidgetId, on: boolean) {
    const next = toggleDashWidget(widgets, id, on);
    setWidgets(next);
    writeDashWidgets(next);
  }

  async function load() {
    try {
      setError(null);
      const data = await call(window.dms.dashboard.kpis());
      setKpis(data);
      if (can.finance) {
        setDbPath(await call(window.dms.meta.dbPath()));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
    function onFocus() {
      void load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function changePassword() {
    try {
      setError(null);
      setPasswordSaved(false);
      if (password.next.length < 6) throw new Error(t("settings.passwordLen"));
      if (password.next !== password.confirm) throw new Error(t("settings.passwordMatch"));
      if (!user) return;
      await call(window.dms.users.setPassword(user.id, password.next));
      setPassword({ next: "", confirm: "" });
      setPasswordSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const cards = useMemo(() => {
    if (!kpis) return [];
    const all: Array<{ id: DashWidgetId; to: string; label: string; value: string; hint: string }> = [
      {
        id: "openOrders",
        to: "/taller",
        label: t("dash.openOrders"),
        value: String(kpis.openWorkOrders),
        hint: t("dash.readyHint", { n: kpis.readyWorkOrders }),
      },
      {
        id: "inShop",
        to: "/taller?status=en_taller",
        label: t("dash.inShop"),
        value: String(kpis.inShopCount || 0),
        hint: t("dash.inShopHint"),
      },
      {
        id: "ready",
        to: "/taller?status=lista",
        label: t("dash.actionReady"),
        value: String(kpis.readyWorkOrders),
        hint: t("dash.deliveredMonth", { n: kpis.deliveredThisMonth || 0 }),
      },
      {
        id: "waitingParts",
        to: "/taller?status=espera_partes",
        label: t("dash.waitingParts"),
        value: String(kpis.waitingPartsCount || 0),
        hint: t("dash.waitingPartsHint"),
      },
      {
        id: "waitingAuth",
        to: "/taller?status=autorizacion",
        label: t("dash.waitingAuth"),
        value: String(kpis.waitingAuthCount || 0),
        hint: t("dash.waitingAuthHint"),
      },
      {
        id: "estimates",
        to: "/taller?kind=presupuesto",
        label: t("dash.estimates"),
        value: String(kpis.estimatesOpen || 0),
        hint: t("dash.estimatesHint"),
      },
      {
        id: "overdue",
        to: "/taller?overdue=1",
        label: t("dash.overdue"),
        value: String(kpis.overdueCount || 0),
        hint: t("dash.overdueHint"),
      },
      {
        id: "unpaid",
        to: "/taller?unpaid=1",
        label: t("dash.unpaid"),
        value: money(kpis.unpaidAmount),
        hint: t("dash.unpaidHint", { n: kpis.unpaidOpenOrders }),
      },
      {
        id: "shopRevenue",
        to: can.finance ? "/finanzas" : "/taller",
        label: t("dash.shopRevenue"),
        value: money(kpis.workshopRevenue),
        hint: t("dash.shopRevenueHint", { n: kpis.deliveredThisMonth || 0 }),
      },
      {
        id: "shopMargin",
        to: can.finance ? "/finanzas" : "/taller",
        label: t("dash.shopMargin"),
        value: money(kpis.workshopMargin),
        hint: t("dash.revenue", { amount: money(kpis.workshopRevenue) }),
      },
      {
        id: "lowParts",
        to: "/partes?low=1",
        label: t("dash.lowParts"),
        value: String(kpis.lowStockCount),
        hint: t("dash.lowHint"),
      },
      {
        id: "stock",
        to: "/vehiculos?kind=inventory",
        label: t("dash.stock"),
        value: String(kpis.vehiclesInStock),
        hint: t("dash.reserved", { n: kpis.vehiclesReserved }),
      },
      {
        id: "salesMonth",
        to: "/ventas",
        label: t("dash.salesMonth"),
        value: money(kpis.salesAmount),
        hint: t("dash.ops", { n: kpis.salesThisMonth }),
      },
      {
        id: "salesMargin",
        to: "/ventas",
        label: t("dash.salesMargin"),
        value: money(kpis.salesMargin),
        hint: t("dash.priceCost"),
      },
    ];
    return all.filter((card) => show(card.id));
  }, [kpis, widgets, t, can.finance]);

  const queues = kpis
    ? [
        { to: "/taller?status=lista", label: t("dash.actionReady"), n: kpis.readyWorkOrders },
        { to: "/taller?unpaid=1", label: t("dash.actionUnpaid"), n: kpis.unpaidOpenOrders },
        { to: "/taller?status=espera_partes", label: t("dash.waitingParts"), n: kpis.waitingPartsCount || 0 },
        { to: "/partes?low=1", label: t("dash.actionLow"), n: kpis.lowStockCount },
      ].filter((item) => item.n > 0)
    : [];

  return (
    <Page>
      <PageHeader
        title={t("dash.title")}
        subtitle={t("dash.subtitle")}
        actions={
          <Button variant="ghost" onClick={() => setCustomizing((v) => !v)}>
            {customizing ? t("common.close") : t("dash.customize")}
          </Button>
        }
      />
      <ErrorText error={error} />
      {can.finance ? <UpdateBanner /> : null}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link className="rounded-md bg-gold-400 px-3 py-2 text-sm font-medium text-onacc hover:bg-gold-500" to="/taller?nueva=1">
          {t("workshop.new")}
        </Link>
        <Link className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm hover:bg-ink-700" to="/taller?nueva=presupuesto">
          {t("workshop.newEstimate")}
        </Link>
        <Link className="rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm hover:bg-ink-700" to="/clientes?nuevo=1">
          {t("customers.new")}
        </Link>
      </div>
      {customizing ? (
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">{t("dash.customizeTitle")}</h2>
              <p className="mt-1 text-sm text-slate-400">{t("dash.customizeHint")}</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setWidgets(DEFAULT_DASH_WIDGETS);
                writeDashWidgets(DEFAULT_DASH_WIDGETS);
              }}
            >
              {t("dash.resetWidgets")}
            </Button>
          </div>
          {(["taller", "ventas", "extra"] as const).map((group) => (
            <div key={group} className="mt-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">{t(k(`dash.group.${group}`))}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {DASH_WIDGETS.filter((w) => w.group === group || (group === "taller" && w.group === "layout")).map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
                    <input type="checkbox" checked={show(w.id)} onChange={(e) => setWidget(w.id, e.target.checked)} />
                    {t(k(`dash.widget.${w.id}`))}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-6 border-t border-ink-600 pt-5">
            <AppearancePanel compact />
          </div>
        </Card>
      ) : null}
      {show("queues") && queues.length ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {queues.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-xl border border-ink-600 bg-ink-800/90 px-4 py-3 transition hover:border-gold-400/50"
            >
              <div className="text-sm text-slate-300">{item.label}</div>
              <div className="mt-1 text-xl font-semibold text-gold-400">{item.n}</div>
            </Link>
          ))}
        </div>
      ) : null}
      {cards.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.id} to={card.to} className="block">
              <Card className="h-full overflow-hidden p-5 transition hover:border-gold-400/40">
                <div className="mb-3 h-0.5 w-10 rounded-full bg-gold-400/80" />
                <div className="text-xs uppercase tracking-wide text-slate-400">{card.label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</div>
                <div className="mt-1 text-sm text-slate-400">{card.hint}</div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{t("dash.emptyWidgets")}</p>
      )}
      {show("lowTable") && kpis && kpis.lowStock.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-600 px-5 py-3">
            <span className="font-medium">{t("dash.lowTable")}</span>
            <Link className="text-sm text-gold-400 hover:underline" to="/partes?low=1">
              {t("dash.goParts")}
            </Link>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-5 py-2">SKU</th>
                <th className="px-5 py-2">{t("dash.part")}</th>
                <th className="px-5 py-2">{t("parts.stock")}</th>
                <th className="px-5 py-2">{t("dash.min")}</th>
              </tr>
            </thead>
            <tbody>
              {kpis.lowStock.map((p) => (
                <tr key={p.id} className="border-t border-ink-600">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link className="text-gold-400 hover:underline" to={`/partes/${p.id}`}>
                      {p.sku}
                    </Link>
                  </td>
                  <td className="px-5 py-2">
                    <Link className="hover:underline" to={`/partes/${p.id}`}>
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-2">{p.stock}</td>
                  <td className="px-5 py-2">{p.minStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {kpis ? <Badge status="cerrada" label={t("dash.totalMargin", { amount: money(kpis.totalMargin) })} /> : null}
        {can.finance ? (
          <>
            <Link className="text-sm text-gold-400 hover:underline" to="/finanzas">
              {t("nav.finance")}
            </Link>
            <Link className="text-sm text-gold-400 hover:underline" to="/ajustes">
              {t("dash.goSettings")}
            </Link>
          </>
        ) : null}
      </div>
      {show("backup") && dbPath ? (
        <Card className="mt-6 max-w-3xl p-5">
          <h2 className="text-sm font-medium">{t("settings.backupTitle")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("settings.backupHint")}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">{dbPath}</p>
          <Button variant="ghost" className="mt-3" onClick={() => void navigator.clipboard.writeText(dbPath)}>
            {t("settings.copyPath")}
          </Button>
        </Card>
      ) : null}
      {show("password") && user ? (
        <Card className="mt-4 max-w-3xl p-5">
          <h2 className="text-sm font-medium">{t("settings.password")}</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void changePassword();
            }}
          >
            <Field label={t("settings.newPassword")}>
              <input type="password" value={password.next} onChange={(e) => setPassword({ ...password, next: e.target.value })} />
            </Field>
            <Field label={t("settings.confirmPassword")}>
              <input type="password" value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit">{t("settings.changePassword")}</Button>
              {passwordSaved ? <span className="text-sm text-emerald-300">{t("settings.passwordSaved")}</span> : null}
            </div>
          </form>
        </Card>
      ) : null}
    </Page>
  );
}
