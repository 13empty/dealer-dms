const { and, eq, ne, sql } = require("drizzle-orm");
const { appointments, customers, vehicles, users } = require("./schema.cjs");
const { getDb } = require("./index.cjs");
const { nowIso, newGuid } = require("./migrate.cjs");
const { fromSettings, slotReason } = require("./calendar.cjs");

const STATUSES = ["agendada", "llegada", "hecha", "cancelada"];
const LINES = ["taller", "lavado"];
const STEP = 15;

function db() {
  return getDb();
}

function shopCalendar() {
  return require("./repo.cjs").calendarSettings();
}

function assertOpen(startsAt, minutes) {
  const why = slotReason(parseWhen(startsAt), minutes, shopCalendar());
  if (why) throw new Error(why);
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
          vin: vehicle.vin || "",
          tempVin: String(vehicle.vin || "").toUpperCase().startsWith("TMP"),
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

function nextMorning(cursor, cal) {
  const next = dayStart(cursor);
  next.setDate(next.getDate() + 1);
  return atMinutes(next, cal.openMin);
}

function snapForward(start, minutes, cal) {
  let cursor = new Date(start);
  for (let guard = 0; guard < 21; guard += 1) {
    if (minutesOf(cursor) < cal.openMin) cursor = atMinutes(cursor, cal.openMin);
    const rounded = Math.ceil(minutesOf(cursor) / STEP) * STEP;
    if (rounded !== minutesOf(cursor)) cursor = atMinutes(cursor, rounded);
    const closedDay = !cal.openDays.includes(cursor.getDay()) || slotReason(cursor, minutes, cal).startsWith("Feriado");
    if (closedDay || minutesOf(cursor) + minutes > cal.closeMin) {
      cursor = nextMorning(cursor, cal);
      continue;
    }
    return cursor;
  }
  return cursor;
}

function findNextSlot(candidate) {
  const cal = shopCalendar();
  const minutes = candidate.minutes;
  let cursor = snapForward(parseWhen(candidate.startsAt), minutes, cal);
  for (let i = 0; i < 21 * 48; i += 1) {
    const why = slotReason(cursor, minutes, cal);
    if (!why) {
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
    cursor = nextMorning(cursor, cal);
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
    source: data.source === "web" ? "web" : data.source != null ? "mostrador" : current.source || "mostrador",
    externalId: data.externalId !== undefined ? data.externalId || null : current.externalId || null,
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

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function tempVin() {
  for (let i = 0; i < 6; i += 1) {
    const vin = `TMP${newGuid().replace(/-/g, "").slice(0, 13)}`.toUpperCase();
    const existing = db().select().from(vehicles).where(eq(vehicles.vin, vin)).get();
    if (!existing) return vin;
  }
  throw new Error("No se pudo generar un VIN temporal");
}

function findCustomerByPhone(phone) {
  const tail = digits(phone).slice(-10);
  if (tail.length < 7) return null;
  const rows = db()
    .select({ id: customers.id, phone: customers.phone, phonesJson: customers.phonesJson })
    .from(customers)
    .where(eq(customers.deleted, 0))
    .all();
  return (
    rows.find((row) => {
      const nums = [row.phone];
      try {
        const extra = JSON.parse(row.phonesJson || "[]");
        if (Array.isArray(extra)) {
          for (const item of extra) nums.push(item && item.number);
        }
      } catch {
        /* un teléfono mal guardado no debe tumbar la cita */
      }
      return nums.some((item) => digits(item).slice(-10) === tail);
    }) || null
  );
}

function reuseWebVehicle(customerId, data) {
  const rows = db()
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.customerId, customerId), eq(vehicles.deleted, 0)))
    .all();
  const provided = String(data.vin || "").trim().toUpperCase();
  if (provided) {
    const byVin = rows.find((row) => String(row.vin || "").toUpperCase() === provided);
    return byVin ? byVin.id : null;
  }
  const year = Number(data.year);
  const make = String(data.make || "").trim().toLowerCase();
  const model = String(data.model || "").trim().toLowerCase();
  const temp = rows.find(
    (row) =>
      String(row.vin || "").toUpperCase().startsWith("TMP") &&
      Number(row.year) === year &&
      String(row.make || "").trim().toLowerCase() === make &&
      String(row.model || "").trim().toLowerCase() === model
  );
  return temp ? temp.id : null;
}

function createWebAppointment(data) {
  const repo = require("./repo.cjs");
  const minutes = durationOf(data);
  assertOpen(data.startsAt, minutes);
  if (data.externalId) {
    const prev = db().select().from(appointments).where(eq(appointments.externalId, String(data.externalId))).get();
    if (prev && !isGone(prev)) return getAppointment(prev.id);
  }
  const year = Number(data.year);
  const make = String(data.make || "").trim();
  const model = String(data.model || "").trim();
  let customer = null;
  if (data.customerId) customer = readCustomer(data.customerId);
  else if (data.phone) {
    const hit = findCustomerByPhone(data.phone);
    if (hit) customer = readCustomer(hit.id);
  }
  if (!customer) {
    const firstName = String(data.firstName || "").trim();
    const lastName = String(data.lastName || "").trim();
    const phone = String(data.phone || "").trim();
    if (!firstName || !lastName) throw new Error("Nombre y apellido son obligatorios");
    if (digits(phone).length < 7) throw new Error("El teléfono es obligatorio para un cliente de la web");
    customer = repo.createCustomer({
      firstName,
      lastName,
      email: String(data.email || "").trim(),
      phones: [{ label: "mobile", number: phone }],
      source: "web",
      type: "particular",
    });
  }
  let vehicleId = data.vehicleId || null;
  if (vehicleId) readVehicle(vehicleId, customer.id);
  else {
    const reused = reuseWebVehicle(customer.id, data);
    if (reused) vehicleId = reused;
    else {
      if (!year || year < 1950 || year > 2100 || !make || !model) throw new Error("Año, marca y modelo son obligatorios");
      const provided = String(data.vin || "").trim();
      const vin = provided || tempVin();
      const vehicle = repo.createVehicle({
        vin,
        plate: String(data.plate || "").trim(),
        year,
        make,
        model,
        customerId: customer.id,
        status: "cliente",
        notes: provided ? "" : "VIN temporal. Capturarlo cuando el auto llegue al taller.",
      });
      vehicleId = vehicle.id;
    }
  }
  return createAppointment({
    customerId: customer.id,
    vehicleId,
    techUserId: data.techUserId || null,
    serviceLine: data.serviceLine || "taller",
    startsAt: data.startsAt,
    minutes: data.minutes,
    complaint: data.complaint || "",
    notes: data.notes || "",
    source: "web",
    externalId: data.externalId || null,
  });
}

function createAppointment(data) {
  const window = buildWindow(data);
  if (!STATUSES.includes(window.status) || window.status === "cancelada") window.status = "agendada";
  readCustomer(window.customerId);
  readVehicle(window.vehicleId, window.customerId);
  readTech(window.techUserId);
  assertOpen(window.startsAt, window.minutes);
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
      source: window.source,
      externalId: window.externalId,
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
    const timeChanged = window.startsAt !== current.startsAt || window.endsAt !== current.endsAt;
    if (timeChanged) assertOpen(window.startsAt, window.minutes);
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
      source: window.source,
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
  createWebAppointment,
  updateAppointment,
  cancelAppointment,
  nextAppointmentSlot,
  openAppointmentOrder,
};
