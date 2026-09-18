import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SearchPicker, type SearchOption } from "../components/SearchPicker";
import {
  customerDraftFromQuery,
  customerFormPayload,
  emptyCustomerForm,
  emptyVehicleDraft,
  vehicleDraftPayload,
  VehicleDraftFields,
  type CustomerFormState,
  type VehicleDraft,
} from "../components/CustomerForm";
import { Badge, Button, Card, ErrorText, Field, FormSection, Modal, Page, PageHeader, Toolbar } from "../components/ui";
import { call, customerName, customerSearchHint, dateTimeEs, fromDateTimeLocal, money, vehicleLabel, vehicleSearchHint, workOrderPath } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { defaultPromisedAt } from "../lib/prefs";
import { usePrefs } from "../lib/prefs-context";
import type { Customer, StaffUser, Vehicle, WorkOrder, WorkOrderStatus } from "../vite-env";

const COL_TONE: Record<string, string> = {
  presupuesto: "border-t-sky-400",
  recepcion: "border-t-slate-400",
  autorizacion: "border-t-amber-400",
  espera_partes: "border-t-violet-400",
  en_taller: "border-t-gold-400",
  en_espera: "border-t-orange-400",
  lista: "border-t-emerald-400",
};

const BOARD_STATUSES: WorkOrderStatus[] = ["recepcion", "autorizacion", "espera_partes", "en_taller", "en_espera", "lista"];
const SIMPLE_BOARD: WorkOrderStatus[] = ["en_taller", "lista"];
const VIEW_KEY = "dms.workshop.view";

function readWorkshopView(): "board" | "list" {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "board" || stored === "list") return stored;
  } catch {
    /* ignore */
  }
  return "list";
}

function writeWorkshopView(next: "board" | "list") {
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    /* ignore */
  }
}

const emptyForm = {
  kind: "orden" as "orden" | "presupuesto",
  customerId: "",
  vehicleId: "",
  complaint: "",
  cause: "",
  notes: "",
  kmIn: "",
  promisedAt: "",
  techUserId: "",
  waiter: false,
  priority: "normal" as "normal" | "urgente",
  poNumber: "",
  serviceLine: "taller" as "taller" | "lavado",
};

export default function Workshop() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();
  const { user, can } = useAuth();
  const { prefs } = usePrefs();
  const washLane = location.pathname.startsWith("/lavado");
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [q, setQ] = useState(() => params.get("q") || "");
  const [view, setView] = useState<"board" | "list">(readWorkshopView);
  const [simple, setSimple] = useState(false);
  const [offerWash, setOfferWash] = useState<boolean | null>(null);
  const [status, setStatus] = useState(() => params.get("status") || "");
  const [kind, setKind] = useState(() => params.get("kind") || "");
  const [unpaid, setUnpaid] = useState(() => params.get("unpaid") === "1");
  const [overdue, setOverdue] = useState(() => params.get("overdue") === "1");
  const [showDelivered, setShowDelivered] = useState(() => params.get("entregada") === "1" || params.get("status") === "entregada");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [picked, setPicked] = useState({
    customerLabel: "",
    customerHint: "",
    vehicleLabel: "",
    vehicleHint: "",
    vehicleOwnerId: "",
  });
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [draft, setDraft] = useState<VehicleDraft>(emptyVehicleDraft());
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<CustomerFormState>(emptyCustomerForm());
  const [customerDupes, setCustomerDupes] = useState<Customer[]>([]);
  const [customerForce, setCustomerForce] = useState(false);
  const pickSeq = useRef(0);

  async function load() {
    try {
      setError(null);
      const [orders, staffRows, settings] = await Promise.all([
        call(
          window.dms.workOrders.list(q, {
            status: status || undefined,
            kind: kind || undefined,
            serviceLine: washLane ? "lavado" : "taller",
            unpaid: unpaid || undefined,
            overdue: overdue || undefined,
            open: showDelivered ? undefined : true,
          })
        ),
        call(window.dms.staff.list({ line: washLane ? "lavado" : "taller" })),
        call(window.dms.settings.get()),
      ]);
      setRows(Array.isArray(orders) ? orders : []);
      setStaff(Array.isArray(staffRows) ? staffRows : []);
      const nextSimple = settings?.serviceMode === "sencillo" || washLane;
      setSimple(nextSimple);
      setOfferWash(Boolean(settings?.offerWash));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q, status, kind, unpaid, overdue, showDelivered, washLane]);

  useEffect(() => {
    const cliente = params.get("cliente") || "";
    const vehiculo = params.get("vehiculo") || "";
    if (!cliente && !vehiculo) return;
    void (async () => {
      try {
        const vehicle = vehiculo ? await call(window.dms.vehicles.get(vehiculo)) : null;
        const customerId = cliente || vehicle?.customerId || "";
        const customer = customerId ? await call(window.dms.customers.get(customerId)) : null;
        if (!customer && !vehicle) return;
        const owned = customer?.vehicles || [];
        const chosen = vehicle || owned[0];
        const owner = customer || vehicle?.customer || null;
        setForm({
          ...emptyForm,
          serviceLine: washLane ? "lavado" : "taller",
          complaint: washLane ? t("workshop.washComplaint") : "",
          customerId: owner ? String(owner.id) : "",
          vehicleId: chosen ? String(chosen.id) : "",
          kmIn: chosen ? String(chosen.km || 0) : "",
          techUserId: user?.id && staff.some((u) => u.id === user.id) ? String(user.id) : "",
        });
        setPicked({
          customerLabel: customerName(owner),
          customerHint: customerSearchHint(owner),
          vehicleLabel: chosen ? `${vehicleLabel(chosen)} · ${chosen.plate || chosen.vin}` : "",
          vehicleHint: chosen ? vehicleSearchHint(chosen) : "",
          vehicleOwnerId: chosen?.customerId ? String(chosen.customerId) : owner ? String(owner.id) : "",
        });
        setDraft(emptyVehicleDraft());
        setAddingVehicle(!chosen);
        setAddingCustomer(false);
        setCustomerDraft(emptyCustomerForm());
        setCustomerDupes([]);
        setCustomerForce(false);
        setOpen(true);
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("cliente");
            next.delete("vehiculo");
            return next;
          },
          { replace: true }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [params.get("cliente"), params.get("vehiculo")]);

  useEffect(() => {
    if (washLane) return;
    if (params.get("linea") !== "lavado" && params.get("nueva") !== "lavado") return;
    const next = new URLSearchParams(params);
    next.delete("linea");
    if (next.get("nueva") === "lavado") next.set("nueva", "1");
    navigate({ pathname: "/lavado", search: next.toString() ? `?${next}` : "" }, { replace: true });
  }, [washLane, params, navigate]);

  useEffect(() => {
    const nueva = params.get("nueva");
    if (!nueva) return;
    if (washLane && offerWash !== true) return;
    startCreate(nueva === "presupuesto" ? "presupuesto" : "orden", washLane ? "lavado" : "taller");
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("nueva");
        return next;
      },
      { replace: true }
    );
  }, [params.get("nueva"), washLane, offerWash]);

  async function save() {
    try {
      setError(null);
      let customerId = form.customerId;
      if (addingCustomer || !customerId) {
        if (!addingCustomer) throw new Error(t("picker.searchCustomer"));
        if (!customerDraft.company.trim() && (!customerDraft.firstName.trim() || !customerDraft.lastName.trim())) {
          throw new Error(t("customers.nameRequired"));
        }
        const payload = customerFormPayload(customerDraft, { force: customerForce, includeVehicle: false });
        if (!customerForce) {
          const matches = await call(window.dms.customers.findDuplicates({ ...payload }));
          if (matches.length) {
            setCustomerDupes(matches);
            return;
          }
        }
        const createdCustomer = await call(window.dms.customers.create(payload));
        customerId = String(createdCustomer.id);
      }
      let vehicleId = form.vehicleId;
      if (!vehicleId) {
        const payload = vehicleDraftPayload(draft);
        if (!payload) throw new Error(t("customers.vehicleRequired"));
        const createdVehicle = await call(
          window.dms.vehicles.create({
            ...payload,
            customerId,
            status: "cliente",
            km: Number(form.kmIn || payload.km) || 0,
          })
        );
        vehicleId = String(createdVehicle.id);
      }
      const created = await call(
        window.dms.workOrders.create({
          kind: form.kind,
          customerId,
          vehicleId,
          complaint: form.complaint,
          cause: form.cause,
          notes: form.notes,
          kmIn: form.kmIn ? Number(form.kmIn) : undefined,
          promisedAt: fromDateTimeLocal(form.promisedAt),
          techUserId: form.techUserId || null,
          waiter: form.waiter ? 1 : 0,
          priority: form.priority,
          poNumber: form.poNumber,
          serviceLine: form.serviceLine,
        })
      );
      setOpen(false);
      setForm(emptyForm);
      setPicked({ customerLabel: "", customerHint: "", vehicleLabel: "", vehicleHint: "", vehicleOwnerId: "" });
      setDraft(emptyVehicleDraft());
      setAddingVehicle(false);
      setAddingCustomer(false);
      setCustomerDraft(emptyCustomerForm());
      setCustomerDupes([]);
      setCustomerForce(false);
      navigate(workOrderPath(created));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startAddingCustomer(query = "") {
    setAddingCustomer(true);
    setCustomerDraft(customerDraftFromQuery(query));
    setCustomerDupes([]);
    setCustomerForce(false);
    setForm((prev) => ({ ...prev, customerId: "", vehicleId: "" }));
    setPicked({ customerLabel: "", customerHint: "", vehicleLabel: "", vehicleHint: "", vehicleOwnerId: "" });
    setDraft(emptyVehicleDraft());
    setAddingVehicle(true);
    setError(null);
  }

  function startCreate(kind: "orden" | "presupuesto", line: "taller" | "lavado" = "taller") {
    setForm({
      ...emptyForm,
      kind,
      serviceLine: line,
      complaint: line === "lavado" ? t("workshop.washComplaint") : "",
      promisedAt: defaultPromisedAt(prefs.promisedDays),
      techUserId: user?.id && staff.some((u) => u.id === user.id) ? String(user.id) : "",
    });
    setPicked({ customerLabel: "", customerHint: "", vehicleLabel: "", vehicleHint: "", vehicleOwnerId: "" });
    setDraft(emptyVehicleDraft());
    setAddingVehicle(false);
    setAddingCustomer(false);
    setCustomerDraft(emptyCustomerForm());
    setCustomerDupes([]);
    setCustomerForce(false);
    setError(null);
    setOpen(true);
  }

  function pickCustomer(id: string, option: SearchOption | null) {
    const keep = Boolean(id && form.vehicleId && picked.vehicleOwnerId === id);
    setForm({
      ...form,
      customerId: id,
      vehicleId: keep ? form.vehicleId : "",
    });
    setPicked({
      customerLabel: option?.label || "",
      customerHint: option?.hint || "",
      vehicleLabel: keep ? picked.vehicleLabel : "",
      vehicleHint: keep ? picked.vehicleHint : "",
      vehicleOwnerId: keep ? picked.vehicleOwnerId : "",
    });
    if (!id || keep) {
      if (!id) setAddingVehicle(false);
      return;
    }
    setAddingCustomer(false);
    setCustomerDupes([]);
    setCustomerForce(false);
    const seq = ++pickSeq.current;
    void (async () => {
      try {
        const owned = await call(window.dms.vehicles.list("", undefined, { customerId: id, limit: 25 }));
        if (seq !== pickSeq.current) return;
        if (!Array.isArray(owned) || owned.length === 0) {
          setDraft(emptyVehicleDraft());
          setAddingVehicle(true);
          return;
        }
        setAddingVehicle(false);
        if (owned.length === 1) {
          const v = owned[0];
          setForm((prev) => ({ ...prev, vehicleId: String(v.id), kmIn: String(v.km || 0) }));
          setPicked((prev) => ({
            ...prev,
            vehicleLabel: `${vehicleLabel(v)} · ${v.plate || v.vin}`,
            vehicleHint: vehicleSearchHint(v),
            vehicleOwnerId: v.customerId ? String(v.customerId) : id,
          }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }

  function pickVehicle(id: string, option: SearchOption | null) {
    const v = option?.raw as Vehicle | undefined;
    const ownerId = v?.customerId ? String(v.customerId) : form.customerId;
    setForm({
      ...form,
      vehicleId: id,
      customerId: ownerId,
      kmIn: v ? String(v.km || 0) : form.kmIn,
    });
    setAddingCustomer(false);
    setPicked({
      customerLabel: v?.customer ? customerName(v.customer) : picked.customerLabel,
      customerHint: v?.customer ? customerSearchHint(v.customer) : picked.customerHint,
      vehicleLabel: option?.label || "",
      vehicleHint: option?.hint || "",
      vehicleOwnerId: v?.customerId ? String(v.customerId) : "",
    });
  }

  const estimates = useMemo(() => (Array.isArray(rows) ? rows.filter((r) => r.kind === "presupuesto") : []), [rows]);
  const boardStatuses = simple ? SIMPLE_BOARD : BOARD_STATUSES;
  const board = useMemo(() => {
    const map: Record<string, WorkOrder[]> = {};
    for (const statusKey of boardStatuses) map[statusKey] = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.kind === "presupuesto") continue;
      if (simple) {
        const col = row.status === "lista" ? "lista" : row.status === "entregada" ? "" : "en_taller";
        if (col && map[col]) map[col].push(row);
        continue;
      }
      if (map[row.status]) map[row.status].push(row);
    }
    return map;
  }, [rows, simple, boardStatuses]);

  function card(row: WorkOrder) {
    return (
      <Link
        key={row.id}
        to={workOrderPath(row)}
        className="block rounded-lg border border-ink-600 border-t-2 bg-ink-900/90 p-3 shadow-sm shadow-black/20 transition hover:border-gold-400/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-mono text-xs text-gold-400">{row.number}</div>
          <span className="flex items-center gap-1">
            {row.priority === "urgente" ? <Badge status="urgente" label={t("workshop.priority.urgente")} /> : null}
          </span>
        </div>
        <div className="mt-1 text-sm">{customerName(row.customer)}</div>
        <div className="text-xs text-slate-400">
          {vehicleLabel(row.vehicle)} · {row.vehicle?.plate || row.vehicle?.vin}
        </div>
        <div className="mt-2 truncate text-xs text-slate-500">{row.complaint || t("workshop.noComplaint")}</div>
        <div className="mt-2 flex items-center justify-between text-xs">
          {simple ? <span /> : <span className={row.overdue ? "text-red-300" : "text-slate-500"}>{dateTimeEs(row.promisedAt)}</span>}
          <span className="flex items-center gap-2">
            {Number(row.balance || 0) <= 0.009 && row.status !== "entregada" ? (
              <Badge status="pagada" label={t("workshop.paidOff")} />
            ) : null}
            <span className={Number(row.balance) > 0 ? "text-amber-300" : "text-slate-300"}>{money(row.total || 0)}</span>
          </span>
        </div>
      </Link>
    );
  }

  async function enableWash() {
    try {
      setError(null);
      const settings = await call(window.dms.settings.get());
      await call(window.dms.settings.save({ ...settings, offerWash: true }));
      window.dispatchEvent(new Event("dms-shop"));
      setOfferWash(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (washLane && offerWash === false) {
    return (
      <Page>
        <PageHeader title={t("wash.title")} subtitle={t("wash.subtitle")} />
        <ErrorText error={error} />
        <Card className="max-w-xl p-5">
          <h2 className="text-lg font-medium">{t("wash.turnOn")}</h2>
          <p className="mt-2 text-sm text-slate-400">{t("wash.turnOnHint")}</p>
          {can.finance ? (
            <Button className="mt-4" onClick={() => void enableWash()}>
              {t("wash.turnOnAction")}
            </Button>
          ) : (
            <p className="mt-4 text-sm text-slate-400">{t("wash.askManager")}</p>
          )}
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={washLane ? t("wash.title") : t("workshop.title")}
        subtitle={washLane ? t("wash.subtitle") : t("workshop.subtitle")}
        actions={
          <>
            {washLane ? null : (
              <Button variant="ghost" onClick={() => navigate("/taller/opcodes")}>
                {t("opcodes.title")}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => startCreate("presupuesto", washLane ? "lavado" : "taller")}
            >
              {t("workshop.newEstimate")}
            </Button>
            <Button onClick={() => startCreate("orden", washLane ? "lavado" : "taller")}>
              {washLane ? t("workshop.newWash") : t("workshop.new")}
            </Button>
          </>
        }
      />
      <Toolbar>
        <div className="min-w-[220px] flex-1">
          <input placeholder={t("workshop.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="w-40" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">{t("common.all")}</option>
          <option value="orden">{t("workshop.order")}</option>
          <option value="presupuesto">{t("workshop.estimate")}</option>
        </select>
        <select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("workshop.status")}: {t("common.all")}</option>
          {(simple ? SIMPLE_BOARD : BOARD_STATUSES).concat("entregada").map((item) => (
            <option key={item} value={item}>
              {t(k(`wo.${item}`))}
            </option>
          ))}
        </select>
        <label className="mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-300">
          <input type="checkbox" checked={unpaid} onChange={(e) => setUnpaid(e.target.checked)} />
          {t("workshop.filterUnpaid")}
        </label>
        {!simple ? (
          <label className="mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-300">
            <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />
            {t("workshop.filterOverdue")}
          </label>
        ) : null}
        <label className="mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-300">
          <input type="checkbox" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} />
          {t("wo.entregada")}
        </label>
        <div className="flex rounded-lg border border-ink-600 bg-ink-950 p-0.5">
          <Button
            variant={view === "board" ? "primary" : "ghost"}
            className={view === "board" ? "" : "border-0 bg-transparent"}
            onClick={() => {
              setView("board");
              writeWorkshopView("board");
            }}
          >
            {t("workshop.board")}
          </Button>
          <Button
            variant={view === "list" ? "primary" : "ghost"}
            className={view === "list" ? "" : "border-0 bg-transparent"}
            onClick={() => {
              setView("list");
              writeWorkshopView("list");
            }}
          >
            {t("workshop.listView")}
          </Button>
        </div>
        <div className="ml-auto text-xs text-slate-500">{t("workshop.count", { n: rows.length })}</div>
      </Toolbar>
      <ErrorText error={error} />
      {view === "board" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3 pb-4">
          <div className="min-h-[12rem] rounded-xl border border-ink-600 bg-ink-800 p-3">
            <div className={`mb-3 border-t-2 pt-2 text-xs uppercase tracking-wide text-slate-400 ${COL_TONE.presupuesto}`}>
              {t("workshop.estimate")} ({estimates.length})
            </div>
            <div className="space-y-2">{estimates.length ? estimates.map(card) : <p className="text-xs text-slate-600">{t("workshop.emptyBoard")}</p>}</div>
          </div>
          {boardStatuses.map((col) => (
            <div key={col} className="min-h-[12rem] rounded-xl border border-ink-600 bg-ink-800 p-3">
              <div className={`mb-3 border-t-2 pt-2 text-xs uppercase tracking-wide text-slate-400 ${COL_TONE[col]}`}>
                {t(k(`wo.${col}`))} ({(board[col] || []).length})
              </div>
              <div className="space-y-2">
                {(board[col] || []).length ? board[col].map(card) : <p className="text-xs text-slate-600">{t("workshop.emptyBoard")}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-ink-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">{t("workshop.wo")}</th>
                <th className="px-4 py-3">{t("workshop.customer")}</th>
                <th className="px-4 py-3">{t("workshop.vehicle")}</th>
                <th className="px-4 py-3">{t("workshop.promised")}</th>
                <th className="px-4 py-3">{t("workshop.total")}</th>
                <th className="px-4 py-3">{t("workshop.balance")}</th>
                <th className="px-4 py-3">{t("workshop.status")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                    {t("common.emptyList")}
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-ink-600">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link className="text-gold-400 hover:underline" to={workOrderPath(row)}>
                      {row.number}
                    </Link>
                    {row.kind === "presupuesto" ? <div className="text-sky-300">{t("workshop.estimate")}</div> : null}
                  </td>
                  <td className="px-4 py-3">{customerName(row.customer)}</td>
                  <td className="px-4 py-3">
                    {row.vehicle?.year} {row.vehicle?.make} {row.vehicle?.model}
                    <div className="text-xs text-slate-500">{row.vehicle?.plate || row.complaint}</div>
                  </td>
                  <td className={`px-4 py-3 text-xs ${row.overdue ? "text-red-300" : "text-slate-400"}`}>{dateTimeEs(row.promisedAt)}</td>
                  <td className="px-4 py-3">{money(row.total || 0)}</td>
                  <td className="px-4 py-3">{money(row.balance || 0)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge status={row.kind === "presupuesto" ? "presupuesto" : row.status} label={t(k(row.kind === "presupuesto" ? "wo.presupuesto" : `wo.${row.status}`))} />
                      {Number(row.balance || 0) <= 0.009 && row.status !== "entregada" && row.kind !== "presupuesto" ? (
                        <Badge status="pagada" label={t("workshop.paidOff")} />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-gold-400" to={workOrderPath(row)}>
                      {t("common.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {open ? (
        <Modal
          xl
          title={
            form.kind === "presupuesto"
              ? t("workshop.newEstimate")
              : form.serviceLine === "lavado"
                ? t("workshop.newWash")
                : t("workshop.newTitle")
          }
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void save()}>{t("common.create")}</Button>
            </>
          }
        >
          <div className="grid gap-4">
            <FormSection title={t("workshop.sectionIntake")}>
              <div className={`grid gap-3 ${simple ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
                <Field label={t("workshop.type")}>
                  <select
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as "orden" | "presupuesto" })}
                  >
                    <option value="orden">{t("workshop.order")}</option>
                    <option value="presupuesto">{t("workshop.estimate")}</option>
                  </select>
                </Field>
                {!simple ? (
                  <Field label={t("workshop.priority")}>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value as "normal" | "urgente" })}
                    >
                      <option value="normal">{t("workshop.priority.normal")}</option>
                      <option value="urgente">{t("workshop.priority.urgente")}</option>
                    </select>
                  </Field>
                ) : null}
                <Field label={washLane ? t("workshop.washTech") : t("workshop.tech")}>
                  <select value={form.techUserId} onChange={(e) => setForm({ ...form, techUserId: e.target.value })}>
                    <option value="">{t("workshop.noTech")}</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.job ? ` · ${t(k(`job.${u.job}`))}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {!simple ? (
                  <Field label={t("workshop.promised")}>
                    <input value={form.promisedAt} onChange={(e) => setForm({ ...form, promisedAt: e.target.value })} placeholder="2026-09-16T09:00" />
                  </Field>
                ) : null}
              </div>
            </FormSection>

            <FormSection title={t("workshop.sectionWho")}>
              <div className="grid gap-3">
                <ErrorText error={error} />
                {addingCustomer ? (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">{t("workshop.addCustomerHere")}</p>
                      <button
                        type="button"
                        className="text-xs text-gold-400 hover:underline"
                        onClick={() => {
                          setAddingCustomer(false);
                          setCustomerDraft(emptyCustomerForm());
                          setCustomerDupes([]);
                          setCustomerForce(false);
                        }}
                      >
                        {t("workshop.searchExistingCustomer")}
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t("customers.firstName")}>
                        <input
                          autoFocus
                          value={customerDraft.firstName}
                          onChange={(e) => setCustomerDraft({ ...customerDraft, firstName: e.target.value })}
                        />
                      </Field>
                      <Field label={t("customers.lastName")}>
                        <input
                          value={customerDraft.lastName}
                          onChange={(e) => setCustomerDraft({ ...customerDraft, lastName: e.target.value })}
                        />
                      </Field>
                      <Field label={t("customers.phones")}>
                        <input
                          value={customerDraft.phones[0]?.number || ""}
                          onChange={(e) =>
                            setCustomerDraft({
                              ...customerDraft,
                              phones: [{ label: customerDraft.phones[0]?.label || "mobile", number: e.target.value }],
                            })
                          }
                          placeholder={t("customers.number")}
                        />
                      </Field>
                      <Field label={t("customers.email")}>
                        <input
                          value={customerDraft.email}
                          onChange={(e) => setCustomerDraft({ ...customerDraft, email: e.target.value })}
                        />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
                      <input
                        type="checkbox"
                        checked={customerDraft.taxExempt}
                        onChange={(e) => setCustomerDraft({ ...customerDraft, taxExempt: e.target.checked })}
                      />
                      {t("customers.taxExempt")}
                    </label>
                    {customerDupes.length ? (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                        <div className="font-medium">{t("customers.duplicates")}</div>
                        <p className="mt-1 text-xs text-amber-200/80">{t("customers.duplicatesHint")}</p>
                        <ul className="mt-2 space-y-1">
                          {customerDupes.map((row) => (
                            <li key={row.id}>
                              {row.code} · {customerName(row)} · {row.phone || row.email || row.document}
                            </li>
                          ))}
                        </ul>
                        <label className="mt-3 flex items-center gap-2 text-xs normal-case tracking-normal">
                          <input type="checkbox" checked={customerForce} onChange={(e) => setCustomerForce(e.target.checked)} />
                          {t("customers.saveAnyway")}
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Field label={t("workshop.customer")}>
                    <SearchPicker
                      autoFocus
                      value={form.customerId}
                      selectedLabel={picked.customerLabel}
                      selectedHint={picked.customerHint}
                      placeholder={t("picker.searchCustomer")}
                      onChange={pickCustomer}
                      onCreate={startAddingCustomer}
                      createText={(query) =>
                        query.trim() ? t("picker.createCustomerNamed", { name: query.trim() }) : t("customers.new")
                      }
                      search={async (query) => {
                        const found = await call(window.dms.customers.list(query, { limit: 25, lite: true }));
                        return found.map((c) => ({
                          id: c.id,
                          label: customerName(c),
                          hint: customerSearchHint(c),
                          raw: c,
                        }));
                      }}
                    />
                    <button type="button" className="mt-2 w-fit text-xs text-gold-400 hover:underline" onClick={() => startAddingCustomer()}>
                      {t("customers.new")}
                    </button>
                  </Field>
                )}
                {addingVehicle ? (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">{t("workshop.addVehicleHere")}</p>
                      <button
                        type="button"
                        className="text-xs text-gold-400 hover:underline"
                        onClick={() => {
                          setAddingVehicle(false);
                          setDraft(emptyVehicleDraft());
                        }}
                      >
                        {t("workshop.searchExistingVehicle")}
                      </button>
                    </div>
                    <VehicleDraftFields
                      form={draft}
                      setForm={(next) => {
                        setDraft(next);
                        setForm((prev) => ({ ...prev, kmIn: next.km, vehicleId: "" }));
                      }}
                      t={t}
                    />
                    {!simple ? (
                      <Field label={t("workshop.po")}>
                        <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
                      </Field>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className={`grid gap-3 ${simple ? "md:grid-cols-[minmax(0,1fr)_10rem]" : "md:grid-cols-[minmax(0,1fr)_10rem_12rem]"}`}>
                      <Field label={t("workshop.vehicle")}>
                        <SearchPicker
                          value={form.vehicleId}
                          selectedLabel={picked.vehicleLabel}
                          selectedHint={picked.vehicleHint}
                          placeholder={t("picker.searchVehicle")}
                          allowEmpty
                          onChange={pickVehicle}
                          search={async (query) => {
                            const found = await call(
                              window.dms.vehicles.list(query, undefined, {
                                limit: 25,
                                ...(form.customerId && !query.trim() ? { customerId: form.customerId } : {}),
                              })
                            );
                            return found.map((v) => ({
                              id: v.id,
                              label: `${vehicleLabel(v)} · ${v.plate || v.vin}`,
                              hint: vehicleSearchHint(v),
                              raw: v,
                            }));
                          }}
                        />
                      </Field>
                      <Field label={t("workshop.kmIn")}>
                        <input value={form.kmIn} onChange={(e) => setForm({ ...form, kmIn: e.target.value })} />
                      </Field>
                      {!simple ? (
                        <Field label={t("workshop.po")}>
                          <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
                        </Field>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="w-fit text-xs text-gold-400 hover:underline"
                      onClick={() => {
                        if (!form.customerId && !addingCustomer) {
                          setError(t("picker.searchCustomer"));
                          return;
                        }
                        setForm((prev) => ({ ...prev, vehicleId: "" }));
                        setPicked((prev) => ({ ...prev, vehicleLabel: "", vehicleHint: "", vehicleOwnerId: "" }));
                        setDraft({ ...emptyVehicleDraft(), km: form.kmIn || "0" });
                        setAddingVehicle(true);
                      }}
                    >
                      {t("customers.addVehicle")}
                    </button>
                  </>
                )}
                {!simple ? (
                  <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
                    <input type="checkbox" checked={form.waiter} onChange={(e) => setForm({ ...form, waiter: e.target.checked })} />
                    {t("workshop.waiter")}
                  </label>
                ) : null}
              </div>
            </FormSection>

            <FormSection title={t("workshop.sectionWork")}>
              <div className={`grid gap-3 ${simple ? "" : "md:grid-cols-2"}`}>
                <Field label={t("workshop.complaint")}>
                  <textarea rows={3} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} />
                </Field>
                {!simple ? (
                  <Field label={t("workshop.cause")}>
                    <textarea rows={3} value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} />
                  </Field>
                ) : null}
                <div className={simple ? "" : "md:col-span-2"}>
                  <Field label={t("common.notes")}>
                    <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </Field>
                </div>
              </div>
            </FormSection>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
