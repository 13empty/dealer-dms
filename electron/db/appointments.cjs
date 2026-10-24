const { and, eq, ne, sql } = require("drizzle-orm");
const { appointments, customers, vehicles, users } = require("./schema.cjs");
const { getDb } = require("./index.cjs");
const { nowIso, newGuid } = require("./migrate.cjs");

const STATUSES = ["agendada", "llegada", "hecha", "cancelada"];
const LINES = ["taller", "lavado"];
const OPEN_MIN = 8 * 60;
const CLOSE_MIN = 18 * 60;
const STEP = 15;

function db() {
  return getDb();
}

function isGone(row) {
  return !row || Number(row.deleted) === 1;
}

function parseWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha no válida");
  return date;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function clock(value) {
  const date = value instanceof Date ? value : parseWhen(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dayStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function atMinutes(day, minutes) {
  const date = dayStart(day);
  date.setMinutes(minutes);
  return date;
}

function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function durationOf(data, current) {
  if (data.minutes != null && data.minutes !== "") {
    const n = Math.round(Number(data.minutes));
    if (!Number.isFinite(n) || n < 15 || n > 480) {
      throw new Error("La cita debe durar entre 15 minutos y 8 horas");
    }
    return n;
  }
  if (current) {
    const n = Math.round((parseWhen(current.endsAt) - parseWhen(current.startsAt)) / 60000);
    if (n >= 15 && n <= 480) return n;
  }
  return 60;
}

function personName(row) {
  if (!row) return "";
  const person = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ");
  if (row.company && person) return `${row.company} · ${person}`;
  return row.company || person || row.name || "";
}

function decorate(row) {
  if (!row || isGone(row)) return null;
  const customer = row.customerId
    ? db().select().from(customers).where(eq(customers.id, row.customerId)).get()
    : null;
  const vehicle = row.vehicleId
    ? db().select().from(vehicles).where(eq(vehicles.id, row.vehicleId)).get()
    : null;
  const tech = row.techUserId ? db().select().from(users).where(eq(users.id, row.techUserId)).get() : null;
  const start = parseWhen(row.startsAt);
  const end = parseWhen(row.endsAt);
  return {
    ...row,
    minutes: Math.max(15, Math.round((end - start) / 60000)),
    customer: customer && !isGone(customer)
      ? { id: customer.id, name: personName(customer), phone: customer.phone || "" }
      : null,
    vehicle: vehicle && !isGone(vehicle)
      ? {
          id: vehicle.id,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          plate: vehicle.plate || "",
        }
      : null,
    tech: tech && !isGone(tech) && tech.active ? { id: tech.id, name: tech.name } : null,
  };
}

function sameSlot(existing, candidate) {
  if (candidate.customerId && existing.customerId === candidate.customerId) return true;
  if (candidate.techUserId && existing.techUserId && existing.techUserId === candidate.techUserId) return true;
  const line = candidate.serviceLine || "taller";
  if ((existing.serviceLine || "taller") !== line) return false;
  return !candidate.techUserId || !existing.techUserId;
}

function conflicts(candidate) {
  const rows = db()
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.deleted, 0),
        ne(appointments.status, "cancelada"),
        sql`${appointments.startsAt} < ${candidate.endsAt}`,
        sql`${appointments.endsAt} > ${candidate.startsAt}`
      )
    )
    .all();
  return rows.filter((row) => row.id !== candidate.excludeId && sameSlot(row, candidate));
}

function snapForward(start, minutes) {
  let cursor = new Date(start);
  if (minutesOf(cursor) < OPEN_MIN) cursor = atMinutes(cursor, OPEN_MIN);
  const rounded = Math.ceil(minutesOf(cursor) / STEP) * STEP;
  if (rounded !== minutesOf(cursor)) cursor = atMinutes(cursor, rounded);
  if (minutesOf(cursor) + minutes > CLOSE_MIN) {
    const next = dayStart(cursor);
    next.setDate(next.getDate() + 1);
    cursor = atMinutes(next, OPEN_MIN);
  }
  return cursor;
}

function findNextSlot(candidate) {
  const minutes = candidate.minutes;
  let cursor = snapForward(parseWhen(candidate.startsAt), minutes);
  for (let i = 0; i < 14 * 48; i += 1) {
    if (minutesOf(cursor) >= OPEN_MIN && minutesOf(cursor) + minutes <= CLOSE_MIN) {
      const ends = addMinutes(cursor, minutes);
      const hit = conflicts({
        ...candidate,
        startsAt: cursor.toISOString(),
        endsAt: ends.toISOString(),
      });
      if (!hit.length) return { startsAt: cursor.toISOString(), endsAt: ends.toISOString(), minutes };
      cursor = addMinutes(cursor, STEP);
      continue;
    }
    const next = dayStart(cursor);
    next.setDate(next.getDate() + 1);
    cursor = atMinutes(next, OPEN_MIN);
  }
  return null;
}

function assertFree(candidate) {
  const hits = conflicts(candidate).map(decorate).filter(Boolean);
  if (!hits.length) return;
  const hit = hits[0];
  const who = hit.customer?.name || hit.tech?.name || "otra cita";
  const next = findNextSlot({ ...candidate, minutes: candidate.minutes || durationOf({}, { startsAt: candidate.startsAt, endsAt: candidate.endsAt }) });
  const suggestion = next ? ` El siguiente hueco es ${clock(next.startsAt)}.` : "";
  throw new Error(`Ese horario ya está ocupado (${who}, ${clock(hit.startsAt)}–${clock(hit.endsAt)}).${suggestion}`);
}

function readCustomer(id) {
  const customer = db().select().from(customers).where(eq(customers.id, String(id || ""))).get();
  if (!customer || isGone(customer)) throw new Error("Cliente no encontrado");
  if (customer.status === "bloqueado") throw new Error("Cliente bloqueado. Desbloquéalo para agendar.");
  if (customer.status === "inactivo") throw new Error("Cliente inactivo. Actívalo para agendar.");
  return customer;
}

function readVehicle(id, customerId) {
  if (!id) return null;
  const vehicle = db().select().from(vehicles).where(eq(vehicles.id, String(id))).get();
  if (!vehicle || isGone(vehicle)) throw new Error("Vehículo no encontrado");
  if (vehicle.customerId && vehicle.customerId !== customerId) throw new Error("Ese vehículo pertenece a otro cliente");
  return vehicle;
}

function readTech(id) {
  if (!id) return null;
  const tech = db().select().from(users).where(eq(users.id, String(id))).get();
  if (!tech || isGone(tech) || !tech.active) throw new Error("Ese técnico no está activo");
  return tech;
}

function buildWindow(data, current = {}) {
  const customerId = data.customerId != null ? String(data.customerId) : current.customerId;
  const serviceLine = LINES.includes(data.serviceLine) ? data.serviceLine : current.serviceLine || "taller";
  const techUserId = data.techUserId !== undefined ? data.techUserId || null : current.techUserId || null;
  const startsAt = data.startsAt != null ? parseWhen(data.startsAt) : parseWhen(current.startsAt);
  const minutes = durationOf(data, current);
  const endsAt = addMinutes(startsAt, minutes);
  return {
    customerId,
    vehicleId: data.vehicleId !== undefined ? data.vehicleId || null : current.vehicleId || null,
    techUserId,
    serviceLine,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    minutes,
    complaint: data.complaint != null ? String(data.complaint).trim() : current.complaint || "",
    notes: data.notes != null ? String(data.notes).trim() : current.notes || "",
    status: data.status != null ? data.status : current.status || "agendada",
  };
}

function listAppointments(opts = {}) {
  const from = opts.from ? parseWhen(opts.from) : dayStart(new Date());
  const to = opts.to ? parseWhen(opts.to) : addMinutes(dayStart(from), 24 * 60);
  let rows = db()
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.deleted, 0),
        sql`${appointments.startsAt} < ${to.toISOString()}`,
        sql`${appointments.endsAt} > ${from.toISOString()}`
      )
    )
    .all();
  if (opts.serviceLine && LINES.includes(opts.serviceLine)) {
    rows = rows.filter((row) => row.serviceLine === opts.serviceLine);
  }
  if (opts.techUserId) rows = rows.filter((row) => row.techUserId === opts.techUserId);
  rows.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  return rows.map(decorate).filter(Boolean);
}

function getAppointment(id) {
  return decorate(db().select().from(appointments).where(eq(appointments.id, String(id || ""))).get());
}

function createAppointment(data) {
  const window = buildWindow(data);
  if (!STATUSES.includes(window.status) || window.status === "cancelada") window.status = "agendada";
  readCustomer(window.customerId);
  readVehicle(window.vehicleId, window.customerId);
  readTech(window.techUserId);
  assertFree(window);
  const id = newGuid();
  const now = nowIso();
  db()
    .insert(appointments)
    .values({
      id,
      customerId: window.customerId,
      vehicleId: window.vehicleId,
      techUserId: window.techUserId,
      serviceLine: window.serviceLine,
      status: "agendada",
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      complaint: window.complaint,
      notes: window.notes,
      workOrderId: null,
      deleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getAppointment(id);
}

function updateAppointment(id, data) {
  const current = db().select().from(appointments).where(eq(appointments.id, String(id || ""))).get();
  if (!current || isGone(current)) throw new Error("Cita no encontrada");
  const window = buildWindow(data, current);
  if (!STATUSES.includes(window.status)) throw new Error("Estado de cita no válido");
  if (window.status !== "cancelada") {
    readCustomer(window.customerId);
    readVehicle(window.vehicleId, window.customerId);
    readTech(window.techUserId);
    assertFree({ ...window, excludeId: current.id });
  }
  db()
    .update(appointments)
    .set({
      customerId: window.customerId,
      vehicleId: window.vehicleId,
      techUserId: window.techUserId,
      serviceLine: window.serviceLine,
      status: window.status,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      complaint: window.complaint,
      notes: window.notes,
      updatedAt: nowIso(),
    })
    .where(eq(appointments.id, current.id))
    .run();
  return getAppointment(current.id);
}

function cancelAppointment(id) {
  return updateAppointment(id, { status: "cancelada" });
}

function nextAppointmentSlot(data) {
  const window = buildWindow(data);
  if (window.customerId) readCustomer(window.customerId);
  return findNextSlot({ ...window, excludeId: data.excludeId || null });
}

function openAppointmentOrder(id) {
  const current = getAppointment(id);
  if (!current) throw new Error("Cita no encontrada");
  if (current.status === "cancelada") throw new Error("La cita está cancelada");
  const repo = require("./repo.cjs");
  if (current.workOrderId) {
    const existing = repo.getWorkOrder(current.workOrderId);
    if (existing) return existing;
  }
  if (!current.vehicleId) throw new Error("Elige el vehículo para abrir la orden");
  const order = repo.createWorkOrder({
    customerId: current.customerId,
    vehicleId: current.vehicleId,
    serviceLine: current.serviceLine,
    complaint: current.complaint,
    notes: current.notes,
    promisedAt: current.startsAt,
    techUserId: current.techUserId,
  });
  db()
    .update(appointments)
    .set({ workOrderId: order.id, status: current.status === "agendada" ? "llegada" : current.status, updatedAt: nowIso() })
    .where(eq(appointments.id, current.id))
    .run();
  return order;
}

module.exports = {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  nextAppointmentSlot,
  openAppointmentOrder,
};
