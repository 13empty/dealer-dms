import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
import { Badge, Button, Card, ErrorText, Field, Modal, Page, PageHeader } from "../components/ui";
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

const OPEN_MIN = 8 * 60;
const CLOSE_MIN = 18 * 60;
const HOUR_PX = 56;

function localMinutes(iso: string) {
  const local = toDateTimeLocal(iso);
  const hh = Number(local.slice(11, 13));
  const mm = Number(local.slice(14, 16));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return OPEN_MIN;
  return hh * 60 + mm;
}

function clock(iso: string) {
  return toDateTimeLocal(iso).slice(11, 16);
}

type Placed = { row: Appointment; start: number; end: number; col: number; cols: number };

function placeAppointments(rows: Appointment[]): Placed[] {
  const items: Placed[] = rows
    .map((row) => {
      const start = localMinutes(row.startsAt);
      const endRaw = localMinutes(row.endsAt);
      return { row, start, end: endRaw > start ? endRaw : start + (row.minutes || 60), col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const groups: Placed[][] = [];
  let group: Placed[] = [];
  let groupEnd = -1;
  for (const item of items) {
    if (!group.length || item.start < groupEnd) {
      group.push(item);
      groupEnd = Math.max(groupEnd, item.end);
      continue;
    }
    groups.push(group);
    group = [item];
    groupEnd = item.end;
  }
  if (group.length) groups.push(group);
  for (const cluster of groups) {
    const active: Placed[] = [];
    for (const item of cluster) {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        if (active[i].end <= item.start) active.splice(i, 1);
      }
      const used = new Set(active.map((entry) => entry.col));
      let col = 0;
      while (used.has(col)) col += 1;
      item.col = col;
      active.push(item);
    }
    const cols = Math.max(1, ...cluster.map((item) => item.col + 1));
    for (const item of cluster) item.cols = cols;
  }
  return items;
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
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hours, setHours] = useState({ openMin: OPEN_MIN, closeMin: CLOSE_MIN, openDays: [1, 2, 3, 4, 5], holidays: [] as { date: string; name: string; closed: boolean }[] });
  const loadSeq = useRef(0);

  const days = useMemo(() => weekKeys(day), [day]);

  async function load(nextDay = day, nextLine = line) {
    const seq = ++loadSeq.current;
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
      if (seq !== loadSeq.current) return;
      setRows(list);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    const loadHours = () => {
      void call(window.dms.settings.get())
        .then((settings) => {
          if (!alive) return;
          setHours({
            openMin: Number(settings.openMin) || OPEN_MIN,
            closeMin: Number(settings.closeMin) || CLOSE_MIN,
            openDays: settings.openDays?.length ? settings.openDays : [1, 2, 3, 4, 5],
            holidays: settings.holidays || [],
          });
        })
        .catch(() => {});
    };
    loadHours();
    window.addEventListener("dms-shop", loadHours);
    return () => {
      alive = false;
      window.removeEventListener("dms-shop", loadHours);
    };
  }, []);

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

  function startNew(at?: string) {
    setEditing(null);
    setDraftStart(at || null);
    setOpen(true);
  }

  function bookAt(event: MouseEvent<HTMLDivElement>) {
    if (!parseDay(day)) return;
    if ((event.target as HTMLElement).closest("[data-appt]")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, event.clientY - bounds.top);
    const snapped = Math.round((hours.openMin + (y / HOUR_PX) * 60) / 15) * 15;
    const start = Math.max(hours.openMin, Math.min(hours.closeMin - 15, snapped));
    startNew(`${day}T${pad(Math.floor(start / 60))}:${pad(start % 60)}`);
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
            <Button onClick={() => startNew()}>{t("agenda.new")}</Button>
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
          const holiday = hours.holidays.find((row) => row.date === key && row.closed);
          const shut = !hours.openDays.includes((parseDay(key) || new Date()).getDay());
          return (
            <button
              key={key}
              type="button"
              onClick={() => setDay(key)}
              className={`rounded-lg border px-2 py-2 text-left text-xs ${
                active ? "border-gold-400 bg-gold-400/15 text-gold-400" : "border-ink-600 text-slate-300 hover:bg-ink-800"
              } ${shut || holiday ? "opacity-60" : ""}`}
            >
              <div className="truncate">{label}</div>
              <div className="mt-1 text-xs text-slate-500">{holiday ? holiday.name : shut ? t("agenda.closedDay") : counts.get(key) || 0}</div>
            </button>
          );
        })}
      </div>
      <p className="mb-2 text-xs text-slate-500">{t("agenda.clickHour")}</p>
      {loading ? <p className="text-sm text-slate-400">{t("common.loading")}</p> : null}
      <DayBoard
        rows={dayRows}
        onOpen={(row) => {
          setEditing(row);
          setDraftStart(null);
          setOpen(true);
        }}
        onSlot={bookAt}
        openMin={hours.openMin}
        closeMin={hours.closeMin}
      />
      {open ? (
        <AppointmentForm
          appointment={editing}
          day={day}
          initialStart={draftStart}
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

function DayBoard({
  rows,
  onOpen,
  onSlot,
  openMin,
  closeMin,
}: {
  rows: Appointment[];
  onOpen: (row: Appointment) => void;
  onSlot: (event: MouseEvent<HTMLDivElement>) => void;
  openMin: number;
  closeMin: number;
}) {
  const { t } = useI18n();
  const inside = rows.filter((row) => {
    const start = localMinutes(row.startsAt);
    return start >= openMin && start < closeMin;
  });
  const outside = rows.filter((row) => !inside.includes(row));
  const cancelled = inside.filter((row) => row.status === "cancelada");
  const placed = placeAppointments(inside.filter((row) => row.status !== "cancelada"));
  const hours = Array.from({ length: Math.max(1, Math.round((closeMin - openMin) / 60)) }, (_, i) => openMin + i * 60);
  const tone: Record<Appointment["status"], string> = {
    agendada: "border-sky-400/60 bg-sky-500/15",
    llegada: "border-amber-400/60 bg-amber-500/15",
    hecha: "border-emerald-400/50 bg-emerald-500/15",
    cancelada: "border-ink-600 bg-ink-700/40",
  };
  return (
    <div>
      {outside.length ? (
        <div className="mb-3 grid gap-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("agenda.outside")}</p>
          {outside.map((row) => (
            <button key={row.id} type="button" onClick={() => onOpen(row)} className="text-left">
              <Card className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{clock(row.startsAt)} – {clock(row.endsAt)}</div>
                    <div className="text-sm text-slate-300">{row.customer?.name || "—"}</div>
                  </div>
                  <Badge status={row.status} label={t(k(`agenda.status.${row.status}`))} />
                </div>
              </Card>
            </button>
          ))}
        </div>
      ) : null}
      <Card className="overflow-hidden">
        <div className="flex">
          <div className="relative w-14 shrink-0 border-r border-ink-600" style={{ height: ((closeMin - openMin) / 60) * HOUR_PX }}>
            {hours.map((minute) => (
              <div
                key={minute}
                className="absolute right-2 text-xs leading-none text-slate-500"
                style={{ top: minute === openMin ? 6 : ((minute - openMin) / 60) * HOUR_PX + 4 }}
              >
                {pad(Math.floor(minute / 60))}:{pad(minute % 60)}
              </div>
            ))}
            <div className="absolute bottom-1 right-2 text-xs leading-none text-slate-500">
              {pad(Math.floor(closeMin / 60))}:{pad(closeMin % 60)}
            </div>
          </div>
          <div className="relative min-w-0 flex-1 cursor-pointer" style={{ height: ((closeMin - openMin) / 60) * HOUR_PX }} onClick={onSlot}>
            {hours.map((minute) => (
              <div key={minute} className="pointer-events-none absolute inset-x-0 border-t border-ink-600/80" style={{ top: ((minute - openMin) / 60) * HOUR_PX }} />
            ))}
            {!placed.length && !outside.length && !cancelled.length ? (
              <p className="pointer-events-none absolute left-3 top-3 text-sm text-slate-500">{t("agenda.empty")}</p>
            ) : null}
            {placed.map((item) => {
              const top = ((Math.max(item.start, openMin) - openMin) / 60) * HOUR_PX;
              const height = Math.max(28, ((Math.min(item.end, closeMin) - Math.max(item.start, openMin)) / 60) * HOUR_PX - 4);
              const width = `calc(${100 / item.cols}% - 6px)`;
              const left = `calc(${(100 / item.cols) * item.col}% + 3px)`;
              return (
                <button
                  key={item.row.id}
                  type="button"
                  data-appt
                  onClick={() => onOpen(item.row)}
                  className={`absolute overflow-hidden rounded-md border px-2 py-1 text-left ${tone[item.row.status]}`}
                  style={{ top, height, width, left }}
                >
                  <div className="truncate text-xs font-medium">
                    {item.row.source === "web" ? "Web · " : ""}
                    {clock(item.row.startsAt)} {item.row.customer?.name || "—"}
                  </div>
                  <div className="truncate text-xs text-slate-400">
                    {item.row.tech?.name || t("agenda.unassigned")}
                    {item.row.vehicle ? ` · ${item.row.vehicle.plate || vehicleLabel(item.row.vehicle)}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
      {cancelled.length ? (
        <div className="mt-3 grid gap-2">
          {cancelled.map((row) => (
            <button key={row.id} type="button" onClick={() => onOpen(row)} className="text-left opacity-60">
              <Card className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="text-sm">
                  {clock(row.startsAt)} · {row.customer?.name || "—"}
                </span>
                <Badge status={row.status} label={t(k(`agenda.status.${row.status}`))} />
              </Card>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AppointmentForm({
  appointment,
  day,
  initialStart,
  offerWash,
  onClose,
  onSaved,
  onOpenOrder,
}: {
  appointment: Appointment | null;
  day: string;
  initialStart?: string | null;
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
  const [startsAt, setStartsAt] = useState(appointment ? toDateTimeLocal(appointment.startsAt) : initialStart || defaultStart(day));
  const [minutes, setMinutes] = useState(appointment?.minutes || 60);
  const [complaint, setComplaint] = useState(appointment?.complaint || "");
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [source, setSource] = useState<"mostrador" | "web">(appointment?.source === "web" ? "web" : "mostrador");
  const [webCar, setWebCar] = useState({ year: String(new Date().getFullYear()), make: "", model: "", plate: "", vin: "" });
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
      source,
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
      if (!appointment && source === "web") {
        await call(
          window.dms.appointments.createWeb({
            customerId: addingCustomer ? undefined : customerId || undefined,
            firstName: customerDraft.firstName,
            lastName: customerDraft.lastName,
            phone: customerDraft.phones[0]?.number || "",
            email: customerDraft.email,
            year: Number(webCar.year),
            make: webCar.make,
            model: webCar.model,
            plate: webCar.plate,
            vin: webCar.vin,
            vehicleId: vehicleId || undefined,
            techUserId: techUserId || null,
            serviceLine,
            startsAt: fromDateTimeLocal(startsAt) || undefined,
            minutes,
            complaint,
            notes,
          })
        );
        onSaved();
        return;
      }
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
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <Field label={t("agenda.source")}>
          <select
            value={source}
            onChange={(e) => {
              const next = e.target.value === "web" ? "web" : "mostrador";
              setSource(next);
              if (next === "web" && !customerId) setAddingCustomer(true);
              if (next === "web" && !vehicleId) setAddingVehicle(true);
            }}
          >
            <option value="mostrador">{t("agenda.sourceCounter")}</option>
            <option value="web">{t("agenda.sourceWeb")}</option>
          </select>
        </Field>
        {source === "web" ? <p className="self-end text-xs text-slate-400">{t("agenda.webHint")}</p> : null}
      </div>
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
            {source === "web" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("vehicles.year")} required>
                  <input value={webCar.year} onChange={(e) => setWebCar({ ...webCar, year: e.target.value })} />
                </Field>
                <Field label={t("vehicles.make")} required>
                  <input value={webCar.make} onChange={(e) => setWebCar({ ...webCar, make: e.target.value })} />
                </Field>
                <Field label={t("vehicles.model")} required>
                  <input value={webCar.model} onChange={(e) => setWebCar({ ...webCar, model: e.target.value })} />
                </Field>
                <Field label={t("vehicles.plate")}>
                  <input value={webCar.plate} onChange={(e) => setWebCar({ ...webCar, plate: e.target.value })} />
                </Field>
                <Field label={t("agenda.tempVin")} hint={t("agenda.tempVinHint")}>
                  <input value={webCar.vin} onChange={(e) => setWebCar({ ...webCar, vin: e.target.value })} placeholder={t("agenda.tempVinPlaceholder")} />
                </Field>
              </div>
            ) : (
              <VehicleDraftFields form={vehicleDraft} setForm={setVehicleDraft} t={t} />
            )}
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
