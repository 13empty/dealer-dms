import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalSearch } from "./components/GlobalSearch";
import { Icon, initials, type IconName } from "./components/icons";
import { AppearanceStrip } from "./components/Appearance";
import { Badge, Button } from "./components/ui";
import { BrandMark } from "./components/BrandMark";
import { UpdateBanner } from "./components/UpdatePanel";
import { UpdateNotice } from "./components/UpdateNotice";
import { LanguageSelect, k, useI18n } from "./lib/i18n";
import { call } from "./lib/format";
import { usePrefs } from "./lib/prefs-context";
import { useShop, ShopName } from "./lib/shop-context";
import { DEFAULT_NAV_OFFICE, DEFAULT_NAV_OPS, NAV_OFFICE, NAV_OPS, reorderNav, sortByNavOrder, type NavId } from "./lib/nav";
import { clampNavWidth, NAV_WIDTH_DEFAULT } from "./lib/prefs";
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
import PartInvoice from "./pages/PartInvoice";
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
import { ChangelogModal, VersionButton } from "./components/ChangelogModal";
import { ShopProvider } from "./lib/shop-context";
import { markChangelogSeen } from "./lib/changelog";

type NestedLink = { to: string; label: string; icon: IconName; show: boolean };
type MenuLink = {
  id: NavId;
  to: string;
  label: string;
  icon: IconName;
  show: boolean;
  end?: boolean;
  match?: string;
  nested?: NestedLink[];
};

function linkActive(pathname: string, to: string, end?: boolean, match?: string) {
  if (match) return pathname === match || pathname.startsWith(`${match}/`);
  if (end || to === "/") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavList({
  items,
  order,
  catalog,
  onReorder,
}: {
  items: MenuLink[];
  order: NavId[];
  catalog: readonly NavId[];
  onReorder: (next: NavId[]) => void;
}) {
  const { pathname } = useLocation();
  const links = sortByNavOrder(items.filter((item) => item.show), order);
  const visibleIds = links.map((item) => item.id);
  const [overId, setOverId] = useState<NavId | null>(null);
  const [dragId, setDragId] = useState<NavId | null>(null);
  const skipClick = useRef(false);

  return (
    <div className="flex flex-col gap-0.5">
      {links.map((link) => {
        const nested = (link.nested || []).filter((item) => item.show);
        const open = Boolean(nested.length && linkActive(pathname, link.to, link.end, link.match));
        const parentActive = linkActive(pathname, link.to, link.end, link.match);
        return (
        <div
          key={link.id}
          draggable
          onDragStart={(e) => {
            skipClick.current = false;
            setDragId(link.id);
            e.dataTransfer.setData("text/plain", link.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overId !== link.id) setOverId(link.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const from = e.dataTransfer.getData("text/plain") as NavId;
            setOverId(null);
            setDragId(null);
            if (!from || from === link.id || !visibleIds.includes(from)) return;
            skipClick.current = true;
            onReorder(reorderNav(order, visibleIds, from, link.id, catalog));
          }}
          onDragEnd={() => {
            setOverId(null);
            setDragId(null);
          }}
          className={`rounded-lg ${dragId === link.id ? "opacity-40" : ""} ${
            overId === link.id && dragId && dragId !== link.id ? "ring-1 ring-gold-400/60" : ""
          }`}
        >
          <NavLink
            to={link.to}
            end={link.end || link.to === "/"}
            draggable={false}
            onClick={(e) => {
              if (skipClick.current) {
                e.preventDefault();
                skipClick.current = false;
              }
            }}
            className={() =>
              `flex cursor-grab items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition active:cursor-grabbing ${
                parentActive && !open
                  ? "bg-gold-400/15 font-medium text-gold-400"
                  : parentActive
                    ? "font-medium text-gold-400"
                    : "text-slate-300 hover:bg-ink-700 hover:text-white"
              }`
            }
          >
            <Icon name={link.icon} className="h-4 w-4 shrink-0 opacity-80" />
            <span className="truncate">{link.label}</span>
          </NavLink>
          {open ? (
            <div className="mb-1 ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-ink-600 pl-2">
              {nested.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  draggable={false}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ${
                      isActive ? "bg-gold-400/15 font-medium text-gold-400" : "text-slate-400 hover:bg-ink-700 hover:text-white"
                    }`
                  }
                >
                  <Icon name={child.icon} className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{child.label}</span>
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>
        );
      })}
    </div>
  );
}

function Shell() {
  const { user, can, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { prefs, setPref } = usePrefs();
  const { offerWash } = useShop();
  const [appVersion, setAppVersion] = useState("");
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [navWidth, setNavWidth] = useState(() => clampNavWidth(prefs.navWidth));
  const navWidthRef = useRef(navWidth);

  useEffect(() => {
    navWidthRef.current = navWidth;
  }, [navWidth]);

  useEffect(() => {
    setNavWidth(clampNavWidth(prefs.navWidth));
  }, [prefs.navWidth]);

  useEffect(() => {
    void call(window.dms.meta.version())
      .then((v) => setAppVersion(String(v || "")))
      .catch(() => {});
  }, []);

  function startNavResize(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const origin = event.clientX;
    const start = navWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = clampNavWidth(start + ev.clientX - origin);
      navWidthRef.current = next;
      setNavWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setPref("navWidth", navWidthRef.current);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onUp);
  }

  const opsItems: MenuLink[] = [
    { id: "home", to: "/", label: t("nav.home"), icon: "home", show: true, end: true },
    { id: "workshop", to: "/taller", label: t("nav.workshop"), icon: "wrench", show: true, end: true },
    { id: "wash", to: "/lavado", label: t("nav.wash"), icon: "droplet", show: offerWash, end: true },
    { id: "customers", to: "/clientes", label: t("nav.customers"), icon: "users", show: true },
    { id: "parts", to: "/partes", label: t("nav.parts"), icon: "box", show: true },
    { id: "opcodes", to: "/taller/opcodes", label: t("nav.opcodes"), icon: "list", show: true },
    { id: "vehicles", to: "/vehiculos", label: t("nav.vehicles"), icon: "car", show: true },
    { id: "sales", to: "/ventas", label: t("nav.sales"), icon: "tag", show: prefs.showUnitSales },
  ];
  const officeItems: MenuLink[] = [
    { id: "finance", to: "/finanzas", label: t("nav.finance"), icon: "ledger", show: can.finance },
    {
      id: "settings",
      to: "/ajustes/taller",
      match: "/ajustes",
      label: t("nav.settings"),
      icon: "settings",
      show: can.finance,
      nested: [
        { to: "/ajustes/taller", label: t("nav.settingsShop"), icon: "building", show: true },
        { to: "/ajustes/operaciones", label: t("nav.settingsOps"), icon: "wrench", show: true },
        { to: "/ajustes/apariencia", label: t("nav.settingsLook"), icon: "palette", show: true },
        { to: "/ajustes/actualizaciones", label: t("nav.settingsUpdates"), icon: "download", show: can.updates },
        { to: "/ajustes/respaldo", label: t("nav.settingsBackup"), icon: "archive", show: true },
      ],
    },
    { id: "sql", to: "/sql", label: t("nav.sql"), icon: "terminal", show: can.options },
    { id: "users", to: "/usuarios", label: t("nav.users"), icon: "shield", show: can.users },
  ];
  const office = officeItems.filter((item) => item.show);
  const navCustomized =
    prefs.navOpsOrder.join(" ") !== DEFAULT_NAV_OPS.join(" ") ||
    prefs.navOfficeOrder.join(" ") !== DEFAULT_NAV_OFFICE.join(" ");

  return (
    <div className="flex h-full">
      <aside
        style={{ width: navWidth }}
        className="relative flex shrink-0 flex-col border-r border-ink-600 bg-ink-900/95 print:hidden"
      >
        <div className="border-b border-ink-600 px-4 py-4">
          <div className="flex items-start gap-3">
            <BrandMark className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gold-400">{t("nav.brand")}</div>
              <div className="text-base font-semibold leading-tight">
                <ShopName />
              </div>
            </div>
          </div>
        </div>
        <div className="border-b border-ink-600 p-3">
          <GlobalSearch />
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-auto p-3">
          <NavList
            items={opsItems}
            order={prefs.navOpsOrder}
            catalog={NAV_OPS}
            onReorder={(next) => setPref("navOpsOrder", next)}
          />
          {office.length ? (
            <div>
              <div className="mb-1 px-3 text-[10px] uppercase tracking-[0.16em] text-slate-500">{t("nav.office")}</div>
              <NavList
                items={office}
                order={prefs.navOfficeOrder}
                catalog={NAV_OFFICE}
                onReorder={(next) => setPref("navOfficeOrder", next)}
              />
            </div>
          ) : null}
          {navCustomized ? (
            <button
              type="button"
              className="px-3 text-left text-[11px] text-slate-500 hover:text-gold-400"
              onClick={() => {
                setPref("navOpsOrder", [...DEFAULT_NAV_OPS]);
                setPref("navOfficeOrder", [...DEFAULT_NAV_OFFICE]);
              }}
            >
              {t("nav.resetOrder")}
            </button>
          ) : (
            <p className="px-3 text-[11px] leading-snug text-slate-600">{t("nav.reorderHint")}</p>
          )}
        </nav>
        <div className="border-t border-ink-600 p-3">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-700 text-xs font-semibold text-gold-400">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <div className="break-words text-sm font-medium leading-tight [overflow-wrap:anywhere]">{user?.name}</div>
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
            <VersionButton
              className="mt-3 w-full text-center"
              version={appVersion}
              onClick={() => setChangelogOpen(true)}
            />
          ) : null}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          title={t("nav.resize")}
          onMouseDown={startNavResize}
          onDoubleClick={() => {
            setNavWidth(NAV_WIDTH_DEFAULT);
            setPref("navWidth", NAV_WIDTH_DEFAULT);
          }}
          className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize hover:bg-gold-400/50"
        />
      </aside>
      {appVersion ? (
        <UpdateNotice
          version={appVersion}
          onShowMore={(kind) => {
            if (kind === "available" && can.updates) {
              navigate("/ajustes/actualizaciones");
              return;
            }
            setChangelogOpen(true);
          }}
        />
      ) : null}
      {changelogOpen && appVersion ? (
        <ChangelogModal
          version={appVersion}
          allowHide
          onClose={(hide) => {
            if (hide) markChangelogSeen(appVersion);
            setChangelogOpen(false);
          }}
        />
      ) : null}
      <main className="min-w-0 flex-1 overflow-auto bg-ink-950">
        {can.updates ? <UpdateBanner className="mx-6 mt-5 mb-0" /> : null}
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
            <Route path="/partes/factura" element={<PartInvoice />} />
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
            <Route path="/ajustes" element={can.finance ? <Navigate to="/ajustes/taller" replace /> : <Navigate to="/" replace />} />
            <Route path="/ajustes/:section" element={can.finance ? <Settings /> : <Navigate to="/" replace />} />
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
      <ShopProvider>
        <ErrorBoundary>
          <Gate />
        </ErrorBoundary>
      </ShopProvider>
    </AuthProvider>
  );
}
