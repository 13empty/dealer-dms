import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalSearch } from "./components/GlobalSearch";
import { Icon, initials, type IconName } from "./components/icons";
import { AppearanceStrip } from "./components/Appearance";
import { Badge, Button } from "./components/ui";
import { BrandMark } from "./components/BrandMark";
import { LanguageSelect, k, useI18n } from "./lib/i18n";
import { call } from "./lib/format";
import { usePrefs } from "./lib/prefs-context";
import LoginGate from "./pages/LoginGate";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import VehicleDetail from "./pages/VehicleDetail";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Sales from "./pages/Sales";
import SaleDetail from "./pages/SaleDetail";
import Parts from "./pages/Parts";
import PartDetail from "./pages/PartDetail";
import PartPrint from "./pages/PartPrint";
import Workshop from "./pages/Workshop";
import OpCodes from "./pages/OpCodes";
import Wash from "./pages/Wash";
import WashTicket from "./pages/WashTicket";
import WorkOrderDetail from "./pages/WorkOrderDetail";
import Finance from "./pages/Finance";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Invoice from "./pages/Invoice";
import SalePrint from "./pages/SalePrint";
import VehiclePrint from "./pages/VehiclePrint";
import SqlStudio from "./pages/SqlStudio";

function Shell() {
  const { user, can, logout } = useAuth();
  const { t } = useI18n();
  const { prefs } = usePrefs();
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    void call(window.dms.meta.version())
      .then((v) => setAppVersion(String(v || "")))
      .catch(() => {});
  }, []);

  const ops = [
    { to: "/", label: t("nav.home"), icon: "home" as const, show: true },
    { to: "/taller", label: t("nav.workshop"), icon: "wrench" as const, show: true, end: true },
    { to: "/lavado", label: t("nav.wash"), icon: "droplet" as const, show: true, end: true },
    { to: "/clientes", label: t("nav.customers"), icon: "users" as const, show: true },
    { to: "/partes", label: t("nav.parts"), icon: "box" as const, show: true },
    { to: "/taller/opcodes", label: t("nav.opcodes"), icon: "list" as const, show: true },
    { to: "/vehiculos", label: t("nav.vehicles"), icon: "car" as const, show: true },
    { to: "/ventas", label: t("nav.sales"), icon: "tag" as const, show: prefs.showUnitSales },
  ].filter((l) => l.show);

  const office = [
    { to: "/finanzas", label: t("nav.finance"), icon: "ledger" as const, show: can.finance },
    { to: "/ajustes", label: t("nav.settings"), icon: "settings" as const, show: can.finance },
    { to: "/sql", label: t("nav.sql"), icon: "terminal" as const, show: can.options },
    { to: "/usuarios", label: t("nav.users"), icon: "shield" as const, show: can.users },
  ].filter((l) => l.show);

  function navItem(link: { to: string; label: string; icon: IconName; end?: boolean }) {
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end || link.to === "/"}
        className={({ isActive }) =>
          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
            isActive ? "bg-gold-400/15 font-medium text-gold-400" : "text-slate-300 hover:bg-ink-700 hover:text-white"
          }`
        }
      >
        <Icon name={link.icon} className="h-4 w-4 opacity-80" />
        {link.label}
      </NavLink>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink-600 bg-ink-900/95 print:hidden">
        <div className="border-b border-ink-600 px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gold-400">{t("nav.brand")}</div>
              <div className="truncate text-base font-semibold leading-tight">Dealer DMS</div>
            </div>
          </div>
        </div>
        <div className="border-b border-ink-600 p-3">
          <GlobalSearch />
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-auto p-3">
          <div className="flex flex-col gap-0.5">{ops.map(navItem)}</div>
          {office.length ? (
            <div>
              <div className="mb-1 px-3 text-[10px] uppercase tracking-[0.16em] text-slate-500">{t("nav.office")}</div>
              <div className="flex flex-col gap-0.5">{office.map(navItem)}</div>
            </div>
          ) : null}
        </nav>
        <div className="border-t border-ink-600 p-3">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-700 text-xs font-semibold text-gold-400">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <div className="flex flex-wrap items-center gap-1">
                <Badge status={user?.role || "empleado"} label={t(k(`role.${user?.role || "empleado"}`))} />
                {user?.job ? <Badge status={user.job} label={t(k(`job.${user.job}`))} /> : null}
              </div>
            </div>
          </div>
          <LanguageSelect compact />
          <AppearanceStrip />
          <Button variant="ghost" className="mt-3 flex w-full items-center justify-center gap-2" onClick={() => void logout()}>
            <Icon name="logout" className="h-4 w-4" />
            {t("nav.logout")}
          </Button>
          {appVersion ? (
            <div className="mt-3 text-center text-[11px] tabular-nums text-slate-500">
              {t("nav.version", { version: appVersion })}
            </div>
          ) : null}
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto bg-ink-950">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vehiculos" element={<Vehicles />} />
            <Route path="/vehiculos/:id/imprimir" element={<VehiclePrint />} />
            <Route path="/vehiculos/:id" element={<VehicleDetail />} />
            <Route path="/clientes" element={<Customers />} />
            <Route path="/clientes/:id" element={<CustomerDetail />} />
            <Route path="/ventas" element={<Sales />} />
            <Route path="/ventas/:id/imprimir" element={<SalePrint />} />
            <Route path="/ventas/:id" element={<SaleDetail />} />
            <Route path="/partes" element={<Parts />} />
            <Route path="/partes/imprimir" element={<PartPrint />} />
            <Route path="/partes/:id/imprimir" element={<PartPrint />} />
            <Route path="/partes/:id" element={<PartDetail />} />
            <Route path="/recambios" element={<Navigate to="/partes" replace />} />
            <Route path="/taller" element={<Workshop />} />
            <Route path="/taller/opcodes" element={<OpCodes />} />
            <Route path="/taller/:id/imprimir" element={<Invoice />} />
            <Route path="/taller/:id" element={<WorkOrderDetail />} />
            <Route path="/lavado" element={<Wash />} />
            <Route path="/lavado/:id/imprimir" element={<Invoice />} />
            <Route path="/lavado/:id" element={<WashTicket />} />
            <Route path="/finanzas" element={can.finance ? <Finance /> : <Navigate to="/" replace />} />
            <Route path="/ajustes" element={can.finance ? <Settings /> : <Navigate to="/" replace />} />
            <Route path="/sql" element={can.options ? <SqlStudio /> : <Navigate to="/" replace />} />
            <Route path="/usuarios" element={can.users ? <Users /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function Gate() {
  const { loading, user, needsSetup, bootError } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">{t("common.loading")}</div>;
  }
  if (bootError) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-slate-300">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">{t("app.restartTitle")}</h1>
          <p className="mt-3 text-sm text-slate-400">{bootError}</p>
          <p className="mt-3 text-sm text-slate-400">{t("app.restartHint")}</p>
          <code className="mt-3 inline-block rounded-md bg-ink-800 px-3 py-2 text-gold-400">npm run dev</code>
        </div>
      </div>
    );
  }
  if (needsSetup || !user) return <LoginGate />;
  return <Shell />;
}

export default function App() {
  const { t } = useI18n();
  if (typeof window === "undefined" || !window.dms) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-slate-300">
        {t("app.browserOnly", { cmd: "npm run dev" })}
      </div>
    );
  }

  return (
    <AuthProvider>
      <ErrorBoundary>
        <Gate />
      </ErrorBoundary>
    </AuthProvider>
  );
}
