import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  VehicleDraftFields,
  customerDraftFromQuery,
  customerFormPayload,
  emptyCustomerForm,
  emptyVehicleDraft,
  vehicleDraftPayload,
  type CustomerFormState,
  type VehicleDraft,
} from "../components/CustomerForm";
import { SearchPicker } from "../components/SearchPicker";
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, Page, PageHeader } from "../components/ui";
import { call, customerName, customerSearchHint, fromDateTimeLocal, toDateTimeLocal, vehicleLabel, workOrderPath } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { useShop } from "../lib/shop-context";
import type { Appointment, AppointmentStatus, Customer, StaffUser, Vehicle } from "../vite-env";

const DURATIONS = [30, 45, 60, 90, 120, 180, 240];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftDay(key: string, days: number) {
  const date = parseDay(key) || new Date();
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

function weekKeys(key: string) {
  const date = parseDay(key) || new Date();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const next = new Date(monday);
    next.setDate(monday.getDate() + i);
    return dayKey(next);
  });
}

function rangeFor(fromKey: string, toKey: string) {
  const from = parseDay(fromKey) || new Date();
  from.setHours(0, 0, 0, 0);
  const to = parseDay(toKey) || new Date(from);
  to.setDate(to.getDate() + 1);
  to.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function defaultStart(key: string) {
  return `${key}T09:00`;
}

export default function Agenda() {
  const { t, locale } = useI18n();
  const { offerWash } = useShop();
  const navigate = useNavigate();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [line, setLine] = useState<"" | "taller" | "lavado">("");
  const [rows, setRows] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const days = useMemo(() => weekKeys(day), [day]);

  async function load(nextDay = day, nextLine = line) {
    setLoading(true);
    setError(null);
    try {
      const span = rangeFor(days[0] || nextDay, days[6] || nextDay);
      const list = await call(
        window.dms.appointments.list({
          ...span,
          serviceLine: nextLine || undefined,
        })
      );
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!parseDay(day)) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, line]);

  const dayRows = rows.filter((row) => dayKey(new Date(row.startsAt)) === day);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status === "cancelada") continue;
    const key = dayKey(new Date(row.startsAt));
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  function startNew() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <Page>
      <PageHeader
        title={t("agenda.title")}
        subtitle={t("agenda.subtitle")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDay(dayKey(new Date()))}>
              {t("agenda.today")}
            </Button>
            <Button onClick={startNew}>{t("agenda.new")}</Button>
          </>
        }
      />
      <ErrorText error={error} />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Button variant="ghost" onClick={() => setDay(shiftDay(day, -1))}>
          {t("agenda.prev")}
        </Button>
        <Field label={t("agenda.date")}>
          <input value={day} placeholder="2026-10-24" onChange={(e) => setDay(e.target.value.trim())} />
        </Field>
        <Button variant="ghost" onClick={() => setDay(shiftDay(day, 1))}>
          {t("agenda.next")}
        </Button>
        <Field label={t("agenda.line")}>
          <select value={line} onChange={(e) => setLine(e.target.value as "" | "taller" | "lavado")}>
            <option value="">{t("agenda.allLines")}</option>
            <option value="taller">{t("agenda.lineShop")}</option>
            {offerWash ? <option value="lavado">{t("agenda.lineWash")}</option> : null}
          </select>
        </Field>
      </div>
      <div className="mb-4 grid grid-cols-7 gap-1">
        {days.map((key) => {
          const date = parseDay(key) || new Date();
          const label = new Intl.DateTimeFormat(locale === "en" ? "en-CA" : locale === "fr" ? "fr-CA" : "es-MX", {
            weekday: "short",
            day: "numeric",
          }).format(date);
          const active = key === day;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setDay(key)}
              className={`rounded-lg border px-2 py-2 text-left text-xs ${
                active ? "border-gold-400 bg-gold-400/15 text-gold-400" : "border-ink-600 text-slate-300 hover:bg-ink-800"
              }`}
            >
              <div className="truncate">{label}</div>
              <div className="mt-1 text-[11px] text-slate-500">{counts.get(key) || 0}</div>
            </button>
          );
        })}
      </div>
      {loading ? <p className="text-sm text-slate-400">{t("common.loading")}</p> : null}
      {!loading && !dayRows.length ? <Empty>{t("agenda.empty")}</Empty> : null}
      <div className="grid gap-2">
        {dayRows.map((row) => (
          <button key={row.id} type="button" onClick={() => { setEditing(row); setOpen(true); }} className="text-left">
            <Card className={`px-4 py-3 ${row.status === "cancelada" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-white">
                    {toDateTimeLocal(row.startsAt).slice(11, 16)} – {toDateTimeLocal(row.endsAt).slice(11, 16)}
                  </div>
                  <div className="text-sm text-slate-300">
                    {row.customer?.name || "—"}
                    {row.vehicle ? ` · ${vehicleLabel(row.vehicle)}${row.vehicle.plate ? ` · ${row.vehicle.plate}` : ""}` : ""}
                  </div>
                  <div className="text-xs text-slate-500">
                    {row.tech?.name || t("agenda.unassigned")}
                    {row.complaint ? ` · ${row.complaint}` : ""}
                  </div>
                </div>
                <Badge status={row.status} label={t(k(`agenda.status.${row.status}`))} />
              </div>
            </Card>
          </button>
        ))}
      </div>
      {open ? (
        <AppointmentForm
          appointment={editing}
          day={day}
          offerWash={offerWash}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void load();
          }}
          onOpenOrder={(order) => {
            navigate(workOrderPath(order));
          }}
        />
      ) : null}
    </Page>
  );
}

function AppointmentForm({
  appointment,
  day,
  offerWash,
  onClose,
  onSaved,
  onOpenOrder,
}: {
  appointment: Appointment | null;
  day: string;
  offerWash: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenOrder: (order: { id: string; serviceLine?: string | null }) => void;
}) {
  const { t } = useI18n();
  const { offerTax } = useShop();
  const [customerId, setCustomerId] = useState(appointment?.customerId || "");
  const [customerLabel, setCustomerLabel] = useState(appointment?.customer?.name || "");
  const [customerHint, setCustomerHint] = useState(appointment?.customer?.phone || "");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<CustomerFormState>(emptyCustomerForm);
  const [customerDupes, setCustomerDupes] = useState<Customer[]>([]);
  const [customerForce, setCustomerForce] = useState(false);
  const [vehicleId, setVehicleId] = useState(appointment?.vehicleId || "");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(emptyVehicleDraft);
  const [techUserId, setTechUserId] = useState(appointment?.techUserId || "");
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [serviceLine, setServiceLine] = useState<"taller" | "lavado">(appointment?.serviceLine || "taller");
  const [startsAt, setStartsAt] = useState(appointment ? toDateTimeLocal(appointment.startsAt) : defaultStart(day));
  const [minutes, setMinutes] = useState(appointment?.minutes || 60);
  const [complaint, setComplaint] = useState(appointment?.complaint || "");
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setVehicles([]);
      return;
    }
    let cancelled = false;
    void call(window.dms.vehicles.list("", undefined, { customerId, limit: 40 }))
      .then((list) => {
        if (cancelled) return;
        setVehicles(list);
        if (!list.length && !vehicleId) setAddingVehicle(true);
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, vehicleId]);

  useEffect(() => {
    void call(window.dms.staff.list({ line: serviceLine }))
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [serviceLine]);

  function payload() {
    return {
      customerId,
      vehicleId: vehicleId || null,
      techUserId: techUserId || null,
      serviceLine,
      startsAt: fromDateTimeLocal(startsAt) || undefined,
      minutes,
      complaint,
      notes,
      excludeId: appointment?.id,
    };
  }

  function startAddingCustomer(query = "") {
    setAddingCustomer(true);
    setCustomerDraft(customerDraftFromQuery(query));
    setCustomerDupes([]);
    setCustomerForce(false);
    setCustomerId("");
    setCustomerLabel("");
    setCustomerHint("");
    setVehicleId("");
    setVehicles([]);
    setVehicleDraft(emptyVehicleDraft());
    setAddingVehicle(true);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let nextCustomerId = customerId;
      if (addingCustomer || !nextCustomerId) {
        if (!addingCustomer) throw new Error(t("picker.searchCustomer"));
        if (!customerDraft.company.trim() && (!customerDraft.firstName.trim() || !customerDraft.lastName.trim())) {
          throw new Error(t("customers.nameRequired"));
        }
        const customerPayload = customerFormPayload(customerDraft, { force: customerForce, includeVehicle: false });
        if (!customerForce) {
          const matches = await call(window.dms.customers.findDuplicates({ ...customerPayload }));
          if (matches.length) {
            setCustomerDupes(matches);
            return;
          }
        }
        const createdCustomer = await call(window.dms.customers.create(customerPayload));
        nextCustomerId = String(createdCustomer.id);
        setCustomerId(nextCustomerId);
        setCustomerLabel(customerName(createdCustomer));
        setCustomerHint(customerSearchHint(createdCustomer));
        setAddingCustomer(false);
        setCustomerDupes([]);
        setCustomerForce(false);
      }
      let nextVehicleId = vehicleId;
      if (addingVehicle) {
        const vehiclePayload = vehicleDraftPayload(vehicleDraft);
        if (vehiclePayload) {
          const createdVehicle = await call(
            window.dms.vehicles.create({
              ...vehiclePayload,
              customerId: nextCustomerId,
              status: "cliente",
            })
          );
          nextVehicleId = String(createdVehicle.id);
          setVehicleId(nextVehicleId);
          setVehicles((prev) => [...prev, createdVehicle]);
          setAddingVehicle(false);
        }
      }
      const body = {
        ...payload(),
        customerId: nextCustomerId,
        vehicleId: nextVehicleId || null,
      };
      if (appointment) await call(window.dms.appointments.update(appointment.id, body));
      else await call(window.dms.appointments.create(body));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function useNext() {
    setError(null);
    try {
      const slot = await call(window.dms.appointments.next(payload()));
      if (!slot) {
        setError(t("agenda.noSlot"));
        return;
      }
      setStartsAt(toDateTimeLocal(slot.startsAt));
      setMinutes(slot.minutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function setStatus(status: AppointmentStatus) {
    if (!appointment) return;
    setBusy(true);
    setError(null);
    try {
      await call(window.dms.appointments.update(appointment.id, { status }));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function openOrder() {
    if (!appointment) return;
    setBusy(true);
    setError(null);
    try {
      const order = await call(window.dms.appointments.openOrder(appointment.id));
      onOpenOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={appointment ? t("agenda.edit") : t("agenda.new")}
      onClose={onClose}
      wide
      overflowVisible
      footer={
        <>
          <Button variant="ghost" onClick={() => void useNext()} disabled={busy}>
            {t("agenda.useSlot")}
          </Button>
          {appointment && appointment.status !== "cancelada" ? (
            <Button variant="danger" onClick={() => void setStatus("cancelada")} disabled={busy}>
              {t("agenda.cancel")}
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={busy || (!customerId && !addingCustomer)}>
            {t("agenda.save")}
          </Button>
        </>
      }
    >
      <ErrorText error={error} />
      <div className="grid gap-3 md:grid-cols-2">
        {addingCustomer ? (
          <div className="grid gap-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">{t("agenda.addCustomerHere")}</p>
              <button
                type="button"
                className="text-xs text-gold-400 hover:underline"
                onClick={() => {
                  setAddingCustomer(false);
                  setCustomerDraft(emptyCustomerForm());
                  setCustomerDupes([]);
                  setCustomerForce(false);
                  setAddingVehicle(false);
                  setVehicleDraft(emptyVehicleDraft());
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
                <input value={customerDraft.email} onChange={(e) => setCustomerDraft({ ...customerDraft, email: e.target.value })} />
              </Field>
            </div>
            {offerTax ? (
              <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
                <input
                  type="checkbox"
                  checked={customerDraft.taxExempt}
                  onChange={(e) => setCustomerDraft({ ...customerDraft, taxExempt: e.target.checked })}
                />
                {t("customers.taxExempt")}
              </label>
            ) : null}
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
          <Field label={t("agenda.customer")} required>
            <SearchPicker
              value={customerId}
              selectedLabel={customerLabel}
              selectedHint={customerHint}
              placeholder={t("picker.searchCustomer")}
              onChange={(id, option) => {
                setAddingCustomer(false);
                setCustomerDupes([]);
                setCustomerForce(false);
                setCustomerId(id);
                setCustomerLabel(option?.label || "");
                setCustomerHint(option?.hint || "");
                setVehicleId("");
                setAddingVehicle(false);
                setVehicleDraft(emptyVehicleDraft());
              }}
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
                }));
              }}
            />
            <button type="button" className="mt-2 w-fit text-xs text-gold-400 hover:underline" onClick={() => startAddingCustomer()}>
              {t("customers.new")}
            </button>
          </Field>
        )}
        {addingVehicle ? (
          <div className="grid gap-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">{t("agenda.addVehicleHere")}</p>
              <button
                type="button"
                className="text-xs text-gold-400 hover:underline"
                onClick={() => {
                  setAddingVehicle(false);
                  setVehicleDraft(emptyVehicleDraft());
                }}
              >
                {t("workshop.searchExistingVehicle")}
              </button>
            </div>
            <VehicleDraftFields form={vehicleDraft} setForm={setVehicleDraft} t={t} />
          </div>
        ) : (
          <Field label={t("agenda.vehicle")}>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">{t("agenda.noVehicle")}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle)}
                  {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-2 w-fit text-xs text-gold-400 hover:underline"
              onClick={() => {
                if (!customerId && !addingCustomer) {
                  setError(t("picker.searchCustomer"));
                  return;
                }
                setVehicleId("");
                setVehicleDraft(emptyVehicleDraft());
                setAddingVehicle(true);
                setError(null);
              }}
            >
              {t("customers.addVehicle")}
            </button>
          </Field>
        )}
        <Field label={t("agenda.line")}>
          <select
            value={serviceLine}
            onChange={(e) => {
              setServiceLine(e.target.value as "taller" | "lavado");
              setTechUserId("");
            }}
          >
            <option value="taller">{t("agenda.lineShop")}</option>
            {offerWash ? <option value="lavado">{t("agenda.lineWash")}</option> : null}
          </select>
        </Field>
        <Field label={t("agenda.tech")}>
          <select value={techUserId} onChange={(e) => setTechUserId(e.target.value)}>
            <option value="">{t("agenda.unassigned")}</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("agenda.start")} required>
          <input value={startsAt} placeholder="2026-10-24T09:00" onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label={t("agenda.minutes")}>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {DURATIONS.map((n) => (
              <option key={n} value={n}>
                {t("agenda.minutesOption", { n })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("agenda.complaint")}>
          <input value={complaint} onChange={(e) => setComplaint(e.target.value)} />
        </Field>
        <Field label={t("common.notes")}>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {appointment && appointment.status !== "cancelada" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {appointment.status === "agendada" ? (
            <Button variant="ghost" onClick={() => void setStatus("llegada")} disabled={busy}>
              {t("agenda.arrive")}
            </Button>
          ) : null}
          {appointment.status !== "hecha" ? (
            <Button variant="ghost" onClick={() => void setStatus("hecha")} disabled={busy}>
              {t("agenda.done")}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => void openOrder()} disabled={busy}>
            {t("agenda.openOrder")}
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
