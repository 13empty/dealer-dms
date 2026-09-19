import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { WashTypePicker, WashTypesPanel } from "../components/WashTypesPanel";
import { Badge, Button, Card, ErrorText, Field, Modal, Page, PageHeader } from "../components/ui";
import {
  call,
  customerName,
  customerSearchHint,
  money,
  vehicleLabel,
  vehicleSearchHint,
  workOrderPath,
  isCollected,
} from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import type { Customer, StaffUser, WashType, WorkOrder } from "../vite-env";

function typeNames(order: WorkOrder) {
  const fromLines = (order.lines || [])
    .map((line) => line.description)
    .filter(Boolean);
  if (fromLines.length) return fromLines.join(" · ");
  return order.complaint || "";
}

export default function Wash() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();
  const { user, can } = useAuth();
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [types, setTypes] = useState<WashType[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [offerWash, setOfferWash] = useState<boolean | null>(null);
  const [q, setQ] = useState(() => params.get("q") || "");
  const [showDone, setShowDone] = useState(() => params.get("entregada") === "1");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(() => params.get("tipos") === "1");
  const [form, setForm] = useState({
    customerId: "",
    vehicleId: "",
    techUserId: "",
    notes: "",
    kmIn: "",
    washTypeIds: [] as string[],
  });
  const [picked, setPicked] = useState({
    customerLabel: "",
    customerHint: "",
    vehicleLabel: "",
    vehicleHint: "",
    vehicleOwnerId: "",
  });
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
      const [orders, staffRows, settings, washTypes] = await Promise.all([
        call(
          window.dms.workOrders.list(q, {
            serviceLine: "lavado",
            open: showDone ? undefined : true,
          })
        ),
        call(window.dms.staff.list({ line: "lavado" })),
        call(window.dms.settings.get()),
        call(window.dms.washTypes.list()),
      ]);
      setRows(Array.isArray(orders) ? orders : []);
      setStaff(Array.isArray(staffRows) ? staffRows : []);
      setOfferWash(Boolean(settings?.offerWash));
      setTypes(Array.isArray(washTypes) ? washTypes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q, showDone]);

  useEffect(() => {
    if (params.get("nueva") !== "1" || offerWash !== true) return;
    startCreate();
    const next = new URLSearchParams(params);
    next.delete("nueva");
    setParams(next, { replace: true });
  }, [params.get("nueva"), offerWash]);

  async function enableWash() {
    try {
      const settings = await call(window.dms.settings.get());
      await call(window.dms.settings.save({ ...settings, offerWash: true }));
      window.dispatchEvent(new Event("dms-shop"));
      setOfferWash(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function resetCreate() {
    setForm({
      customerId: "",
      vehicleId: "",
      techUserId: user?.id && staff.some((u) => u.id === user.id) ? String(user.id) : "",
      notes: "",
      kmIn: "",
      washTypeIds: [],
    });
    setPicked({ customerLabel: "", customerHint: "", vehicleLabel: "", vehicleHint: "", vehicleOwnerId: "" });
    setDraft(emptyVehicleDraft());
    setAddingVehicle(false);
    setAddingCustomer(false);
    setCustomerDraft(emptyCustomerForm());
    setCustomerDupes([]);
    setCustomerForce(false);
    setError(null);
  }

  function startCreate() {
    resetCreate();
    setOpen(true);
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
    const raw = option?.raw as { km?: number; customerId?: string } | undefined;
    setForm((prev) => ({ ...prev, vehicleId: id, kmIn: raw?.km != null ? String(raw.km) : prev.kmIn }));
    setPicked((prev) => ({
      ...prev,
      vehicleLabel: option?.label || "",
      vehicleHint: option?.hint || "",
      vehicleOwnerId: raw?.customerId ? String(raw.customerId) : prev.vehicleOwnerId,
    }));
  }

  async function save() {
    try {
      setError(null);
      if (!form.washTypeIds.length) throw new Error(t("wash.needType"));
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
          kind: "orden",
          customerId,
          vehicleId,
          notes: form.notes,
          kmIn: form.kmIn ? Number(form.kmIn) : undefined,
          techUserId: form.techUserId || null,
          serviceLine: "lavado",
          washTypeIds: form.washTypeIds,
        })
      );
      setOpen(false);
      resetCreate();
      navigate(workOrderPath(created));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const doing = rows.filter((row) => row.status !== "lista" && row.status !== "entregada" && row.kind !== "presupuesto");
  const ready = rows.filter((row) => row.status === "lista");
  const delivered = rows.filter((row) => row.status === "entregada");

  function card(row: WorkOrder) {
    return (
      <Link
        key={row.id}
        to={workOrderPath(row)}
        className="block rounded-xl border border-ink-600 bg-ink-900/70 p-3 hover:border-cyan-400/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-xs text-cyan-200">{row.number}</div>
            <div className="truncate font-medium">{vehicleLabel(row.vehicle)}</div>
            <div className="truncate text-xs text-slate-500">{customerName(row.customer)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm">{money(row.total || 0)}</div>
            {isCollected(row) ? (
              <Badge status="pagada" label={t("workshop.paidOff")} />
            ) : Number(row.balance || 0) > 0.009 ? (
              <div className="text-xs text-amber-300">{money(row.balance)}</div>
            ) : null}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-slate-400">{typeNames(row) || t("wash.noTypesYet")}</p>
        {row.tech?.name ? <p className="mt-1 text-xs text-slate-500">{row.tech.name}</p> : null}
      </Link>
    );
  }

  return (
    <Page>
      <PageHeader
        title={t("wash.title")}
        subtitle={t("wash.subtitle")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setTypesOpen((v) => !v)}>
              {t("wash.manageTypes")}
            </Button>
            {offerWash ? <Button onClick={startCreate}>{t("wash.new")}</Button> : null}
          </>
        }
      />
      <ErrorText error={error} />

      {offerWash === false ? (
        <Card className="mb-4 max-w-2xl p-5">
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
      ) : null}

      {typesOpen || offerWash === false ? (
        <Card className="mb-4 p-5">
          <WashTypesPanel types={types} onChange={load} />
        </Card>
      ) : null}

      {offerWash ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <input placeholder={t("wash.search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-300">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              {t("wash.showDone")}
            </label>
          </div>
          <div className={`grid gap-3 ${showDone ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            <Card className="p-3">
              <div className="mb-3 border-t-2 border-cyan-400 pt-2 text-xs uppercase tracking-wide text-slate-400">
                {t("wash.inProgress")} ({doing.length})
              </div>
              <div className="space-y-2">{doing.length ? doing.map(card) : <p className="text-xs text-slate-600">{t("wash.emptyQueue")}</p>}</div>
            </Card>
            <Card className="p-3">
              <div className="mb-3 border-t-2 border-emerald-400 pt-2 text-xs uppercase tracking-wide text-slate-400">
                {t("wash.ready")} ({ready.length})
              </div>
              <div className="space-y-2">{ready.length ? ready.map(card) : <p className="text-xs text-slate-600">{t("wash.emptyQueue")}</p>}</div>
            </Card>
            {showDone ? (
              <Card className="p-3">
                <div className="mb-3 border-t-2 border-slate-500 pt-2 text-xs uppercase tracking-wide text-slate-400">
                  {t("wash.done")} ({delivered.length})
                </div>
                <div className="space-y-2">{delivered.length ? delivered.map(card) : <p className="text-xs text-slate-600">{t("wash.emptyQueue")}</p>}</div>
              </Card>
            ) : null}
          </div>
        </>
      ) : offerWash === false ? (
        <p className="text-sm text-slate-500">{t("wash.tallerHint")}</p>
      ) : null}

      {open ? (
        <Modal
          xl
          title={t("wash.new")}
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
            <ErrorText error={error} />
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t("wash.pickTypes")}</div>
              <WashTypePicker
                types={types}
                selectedIds={form.washTypeIds}
                onToggle={(id) =>
                  setForm((prev) => ({
                    ...prev,
                    washTypeIds: prev.washTypeIds.includes(id)
                      ? prev.washTypeIds.filter((item) => item !== id)
                      : [...prev.washTypeIds, id],
                  }))
                }
              />
            </div>
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
                    />
                  </Field>
                  <Field label={t("customers.email")}>
                    <input value={customerDraft.email} onChange={(e) => setCustomerDraft({ ...customerDraft, email: e.target.value })} />
                  </Field>
                </div>
                {customerDupes.length ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <div className="font-medium">{t("customers.duplicates")}</div>
                    <ul className="mt-2 space-y-1">
                      {customerDupes.map((row) => (
                        <li key={row.id}>
                          {row.code} · {customerName(row)}
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
              </Field>
            )}
            {addingVehicle ? (
              <div className="grid gap-3">
                <p className="text-xs text-slate-400">{t("workshop.addVehicleHere")}</p>
                <VehicleDraftFields
                  form={draft}
                  setForm={(next) => {
                    setDraft(next);
                    setForm((prev) => ({ ...prev, kmIn: next.km, vehicleId: "" }));
                  }}
                  t={t}
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
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
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("workshop.washTech")}>
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
              <Field label={t("common.notes")}>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
