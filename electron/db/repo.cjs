const { eq, desc, like, or, and, sql, ne, inArray } = require("drizzle-orm");
const {
  users,
  customers,
  customerNotes,
  vehicles,
  vehicleNotes,
  sales,
  salePayments,
  parts,
  workOrders,
  workOrderLines,
  inventoryMovements,
  opCodes,
  opCodeParts,
  workOrderPayments,
  shopSettings,
  expenses,
  incomes,
} = require("./schema.cjs");
const { getDb, getSqlite } = require("./index.cjs");
const { nowIso, splitLegacyName, newGuid } = require("./migrate.cjs");

function db() {
  return getDb();
}

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function dayStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function periodStartIso(period) {
  return period === "today" ? dayStartIso() : monthStartIso();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function localDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function periodBounds(input = "month") {
  const spec = typeof input === "string" || input == null ? { period: input || "month" } : input;
  const period = ["today", "week", "month", "year", "range"].includes(spec.period) ? spec.period : "month";
  const now = new Date();
  let startDate;
  let endDate;
  if (period === "today") {
    startDate = startOfLocalDay(now);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
  } else if (period === "week") {
    startDate = startOfLocalDay(now);
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  } else if (period === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear() + 1, 0, 1);
  } else if (period === "range") {
    const from = String(spec.from || "").trim();
    const to = String(spec.to || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new Error("Usa fechas AAAA-MM-DD");
    }
    startDate = new Date(`${from}T00:00:00`);
    endDate = new Date(`${to}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    if (!(startDate.getTime() < endDate.getTime())) throw new Error("El rango de fechas no es válido");
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return {
    period,
    from: localDate(startDate),
    to: localDate(new Date(endDate.getTime() - 1)),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

function inPeriod(iso, bounds) {
  const at = String(iso || "");
  return Boolean(at) && at >= bounds.start && at < bounds.end;
}

function agingBucket(iso) {
  const t = new Date(iso || 0).getTime();
  const days = Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0;
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function rankMap(map) {
  return [...map.values()]
    .map((row) => ({
      ...row,
      amount: roundMoney(row.amount),
      cost: roundMoney(row.cost || 0),
      margin: roundMoney((row.amount || 0) - (row.cost || 0)),
    }))
    .sort((a, b) => b.amount - a.amount || b.qty - a.qty);
}

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function cashMethod(method) {
  const m = String(method || "").toLowerCase();
  if (m === "tarjeta") return "tarjeta";
  if (m === "transferencia") return "transferencia";
  if (m === "financiamiento" || m === "financiado") return "financiamiento";
  return "efectivo";
}

function clampDue(amount, due) {
  let n = Number(amount);
  if (!(n > 0)) return 0;
  const cap = Number(due);
  if (Number.isFinite(cap) && cap >= 0 && n > cap + 0.009) n = cap;
  return roundMoney(n);
}

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}

function salePriceDown(data, current = {}, taxRate = 0) {
  const price = Math.max(0, roundMoney(data.price != null ? data.price : current.price || 0));
  const rate = Math.max(0, Number(data.taxRate != null ? data.taxRate : taxRate) || 0);
  const tax = roundMoney(price * (rate / 100));
  const total = roundMoney(price + tax);
  let down = Math.max(0, roundMoney(data.downPayment != null ? data.downPayment : current.downPayment || 0));
  if (down > total) down = total;
  return { price, downPayment: down, taxRate: rate, tax, total };
}

function customerTaxRate(customer, settings) {
  if (settings && Number(settings.offerTax) === 0) return 0;
  if (Number(customer?.taxExempt)) return 0;
  return Math.max(0, Number(settings?.taxRate) || 0);
}

function likePattern(q) {
  return `%${String(q || "").trim()}%`;
}

function isGone(row) {
  return Number(row?.deleted) === 1;
}

function alive(table) {
  return eq(table.deleted, 0);
}

function markDeleted(table, id, extra = {}) {
  db().update(table).set({ deleted: 1, ...extra }).where(eq(table.id, id)).run();
  return { id };
}

function parsePhones(raw, fallbackPhone = "") {
  let phones = [];
  if (Array.isArray(raw)) phones = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try {
      phones = JSON.parse(raw);
    } catch {
      phones = [];
    }
  }
  phones = (phones || [])
    .map((p) => ({
      label: String(p?.label || "Teléfono").trim() || "Teléfono",
      number: String(p?.number || "").trim(),
    }))
    .filter((p) => p.number);
  if (!phones.length && fallbackPhone) {
    phones = [{ label: "Principal", number: String(fallbackPhone).trim() }];
  }
  return phones;
}

function normalizeContact(data, current = {}) {
  const phones = parsePhones(data.phones ?? data.phonesJson, data.phone ?? current.phone);
  return {
    phone: phones[0]?.number || "",
    phonesJson: JSON.stringify(phones),
    phones,
    address: data.address != null ? String(data.address).trim() : current.address || "",
    city: data.city != null ? String(data.city).trim() : current.city || "",
    state: data.state != null ? String(data.state).trim() : current.state || "",
    zip: data.zip != null ? String(data.zip).trim() : current.zip || "",
  };
}

const CUSTOMER_TYPES = ["particular", "empresa", "flotilla", "seguro", "mayoreo"];
const CUSTOMER_STATUSES = ["activo", "inactivo", "bloqueado"];
const CUSTOMER_SOURCES = ["mostrador", "referido", "web", "facebook", "whatsapp", "otro"];
const CUSTOMER_CONTACTS = ["phone", "email", "whatsapp"];
const CUSTOMER_LANGS = ["", "es", "en-CA", "fr-CA"];

function pickEnum(value, allowed, fallback) {
  const v = String(value == null ? "" : value).trim();
  return allowed.includes(v) ? v : fallback;
}

function flag01(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function asId(value) {
  return String(value == null ? "" : value).trim();
}

function nextCustomerCode() {
  const rows = db().select({ code: customers.code }).from(customers).all();
  let max = 0;
  for (const row of rows) {
    const n = Number(String(row.code || "").replace(/\D/g, "")) || 0;
    if (n > max) max = n;
  }
  return `C-${String(max + 1).padStart(4, "0")}`;
}

function parseJsonList(raw, mapFn) {
  let rows = [];
  if (Array.isArray(raw)) rows = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try {
      rows = JSON.parse(raw);
    } catch {
      rows = [];
    }
  }
  return (rows || []).map(mapFn).filter(Boolean);
}

function parseContacts(raw) {
  return parseJsonList(raw, (c) => {
    const name = String(c?.name || "").trim();
    const phone = String(c?.phone || "").trim();
    const email = String(c?.email || "").trim();
    const role = String(c?.role || "autorizado").trim() || "autorizado";
    if (!name && !phone && !email) return null;
    return { name, role, phone, email };
  });
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function phoneTail(value) {
  const digits = phoneDigits(value);
  return digits.length >= 7 ? digits.slice(-10) : "";
}

function emptyCustomerStats() {
  return { lastVisit: null, lifetime: 0, receivable: 0, openOrders: 0, vehicleCount: 0 };
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows || []) {
    const id = row[key];
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

function fetchByIds(table, column, ids) {
  const wanted = [...new Set((ids || []).filter(Boolean).map((id) => asId(id)))];
  if (!wanted.length) return [];
  const rows = [];
  for (let i = 0; i < wanted.length; i += 400) {
    rows.push(...db().select().from(table).where(inArray(column, wanted.slice(i, i + 400))).all());
  }
  return rows;
}

function composeName(data, current = {}) {
  let firstName = data.firstName != null ? String(data.firstName).trim() : current.firstName || "";
  let middleName = data.middleName != null ? String(data.middleName).trim() : current.middleName || "";
  let lastName = data.lastName != null ? String(data.lastName).trim() : current.lastName || "";
  const company = data.company != null ? String(data.company).trim() : current.company || "";
  const type = pickEnum(data.type != null ? data.type : current.type, CUSTOMER_TYPES, "particular");
  if ((!firstName || !lastName) && data.name && !company) {
    const split = splitLegacyName(data.name);
    firstName = firstName || split.firstName;
    middleName = middleName || split.middleName;
    lastName = lastName || split.lastName;
  }
  if (["empresa", "flotilla", "seguro", "mayoreo"].includes(type) && !company) {
    throw new Error("Captura la razón social");
  }
  if (!company && (!firstName || !lastName)) throw new Error("Primer nombre y apellido son obligatorios");
  const person = [firstName, middleName, lastName].filter(Boolean).join(" ");
  return {
    firstName,
    middleName,
    lastName,
    company,
    type,
    name: company && person ? `${company} · ${person}` : company || person,
  };
}

function customerProfile(data, current = {}) {
  const names = composeName(data, current);
  const contacts = parseContacts(data.contacts ?? data.contactsJson ?? current.contactsJson);
  return {
    ...names,
    status: pickEnum(data.status != null ? data.status : current.status, CUSTOMER_STATUSES, "activo"),
    source: pickEnum(data.source != null ? data.source : current.source, CUSTOMER_SOURCES, "mostrador"),
    taxExempt: flag01(data.taxExempt, Number(current.taxExempt) || 0),
    accountOpen: flag01(data.accountOpen, Number(current.accountOpen) || 0),
    creditLimit: data.creditLimit != null ? Math.max(0, Number(data.creditLimit) || 0) : Number(current.creditLimit) || 0,
    discountPct: data.discountPct != null ? Math.max(0, Number(data.discountPct) || 0) : Number(current.discountPct) || 0,
    preferredContact: pickEnum(
      data.preferredContact != null ? data.preferredContact : current.preferredContact,
      CUSTOMER_CONTACTS,
      "phone"
    ),
    language: pickEnum(data.language != null ? data.language : current.language, CUSTOMER_LANGS, ""),
    birthday: data.birthday != null ? String(data.birthday).trim() : current.birthday || "",
    marketing: flag01(data.marketing, current.marketing == null ? 1 : Number(current.marketing)),
    contactsJson: JSON.stringify(contacts),
    contacts,
  };
}

function withPhones(row) {
  if (!row) return row;
  const phones = parsePhones(row.phonesJson, row.phone);
  const contacts = parseContacts(row.contactsJson);
  const person = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ");
  const company = row.company || "";
  const name = row.name || (company && person ? `${company} · ${person}` : company || person);
  return {
    ...row,
    phones,
    contacts,
    company,
    type: row.type || "particular",
    status: row.status || "activo",
    source: row.source || "mostrador",
    taxExempt: Number(row.taxExempt) || 0,
    accountOpen: Number(row.accountOpen) || 0,
    creditLimit: Number(row.creditLimit) || 0,
    discountPct: Number(row.discountPct) || 0,
    marketing: row.marketing == null ? 1 : Number(row.marketing),
    preferredContact: row.preferredContact || "phone",
    language: row.language || "",
    birthday: row.birthday || "",
    code: row.code || "",
    name,
  };
}

function withVehicles(row) {
  const base = withPhones(row);
  if (!base) return base;
  const owned = db().select().from(vehicles).where(and(eq(vehicles.customerId, row.id), alive(vehicles))).all();
  return { ...base, vehicles: owned };
}

function matchingCustomerIdsByVehicle(query) {
  const p = likePattern(query);
  return getSqlite()
    .prepare(
      `SELECT DISTINCT customer_id AS id FROM vehicles
       WHERE customer_id IS NOT NULL AND IFNULL(deleted,0)=0 AND (vin LIKE ? OR plate LIKE ? OR make LIKE ? OR model LIKE ? OR stock_number LIKE ? OR trim LIKE ?)`
    )
    .all(p, p, p, p, p, p)
    .map((r) => asId(r.id))
    .filter(Boolean);
}

function customerStatsMap() {
  const stats = new Map();
  function ensure(id) {
    const key = asId(id);
    if (!key) return emptyCustomerStats();
    if (!stats.has(key)) stats.set(key, emptyCustomerStats());
    return stats.get(key);
  }
  function touch(st, iso) {
    if (iso && (!st.lastVisit || iso > st.lastVisit)) st.lastVisit = iso;
  }
  const linesBy = groupBy(db().select().from(workOrderLines).all(), "workOrderId");
  const woPayBy = groupBy(db().select().from(workOrderPayments).all(), "workOrderId");
  const salePayBy = groupBy(db().select().from(salePayments).all(), "saleId");
  const partTax = new Map(
    db()
      .select()
      .from(parts)
      .all()
      .map((p) => [p.id, p.taxable == null ? 1 : Number(p.taxable)])
  );
  for (const order of db().select().from(workOrders).all()) {
    if (isGone(order)) continue;
    const st = ensure(order.customerId);
    touch(st, order.createdAt);
    touch(st, order.deliveredAt);
    if ((order.kind || "orden") === "presupuesto") continue;
    const totals = workOrderTotals(order, linesBy.get(order.id) || [], partTax);
    const paid = (woPayBy.get(order.id) || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = roundMoney(totals.total - paid);
    if (order.status === "entregada") st.lifetime = roundMoney(st.lifetime + totals.total);
    else st.openOrders += 1;
    if (balance > 0) st.receivable = roundMoney(st.receivable + balance);
  }
  for (const sale of db().select().from(sales).all()) {
    if (isGone(sale)) continue;
    const st = ensure(sale.customerId);
    const paid = (salePayBy.get(sale.id) || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const taxRate = Number(sale.taxRate) || 0;
    const tax = roundMoney(sale.tax != null ? sale.tax : Number(sale.price || 0) * (taxRate / 100));
    const total = roundMoney(Number(sale.price || 0) + tax);
    const balance = roundMoney(total - paid);
    touch(st, sale.createdAt);
    touch(st, sale.closedAt);
    touch(st, sale.deliveredAt);
    if (sale.status === "cerrada" || sale.status === "entregada") st.lifetime = roundMoney(st.lifetime + total);
    if (sale.status !== "borrador" && balance > 0) st.receivable = roundMoney(st.receivable + balance);
  }
  for (const vehicle of db().select().from(vehicles).all()) {
    if (isGone(vehicle) || !vehicle.customerId) continue;
    ensure(vehicle.customerId).vehicleCount += 1;
  }
  return stats;
}

function withStats(row, stats) {
  const base = withPhones(row);
  if (!base) return base;
  const extra = stats.get(base.id) || emptyCustomerStats();
  const creditLeft =
    Number(base.accountOpen) && Number(base.creditLimit) > 0
      ? roundMoney(Math.max(0, Number(base.creditLimit) - extra.receivable))
      : null;
  return { ...base, ...extra, creditLeft };
}

function findDuplicates(data, excludeId) {
  const email = String(data.email || "").trim().toLowerCase();
  const document = String(data.document || "").trim().toLowerCase();
  const phones = parsePhones(data.phones ?? data.phonesJson, data.phone)
    .map((p) => phoneTail(p.number))
    .filter(Boolean);
  if (!email && !document && !phones.length) return [];
  return db()
    .select()
    .from(customers)
    .all()
    .filter((row) => {
      if (isGone(row)) return false;
      if (excludeId && String(row.id) === asId(excludeId)) return false;
      if (email && String(row.email || "").trim().toLowerCase() === email) return true;
      if (document && String(row.document || "").trim().toLowerCase() === document) return true;
      const existing = parsePhones(row.phonesJson, row.phone).map((p) => phoneTail(p.number));
      return phones.some((p) => existing.includes(p));
    })
    .map(withPhones);
}

function assertNoDuplicates(data, excludeId) {
  if (data.force) return;
  const dupes = findDuplicates(data, excludeId);
  if (!dupes.length) return;
  const sample = dupes[0];
  throw new Error(`Ya existe un cliente parecido: ${sample.code} ${sample.name}. Confirma para guardar de todos modos.`);
}

function assertCustomerCanTransact(customer) {
  if (!customer || isGone(customer)) throw new Error("Cliente no encontrado");
  if (customer.status === "bloqueado") {
    throw new Error("Cliente bloqueado. Desbloquéalo en el expediente para abrir órdenes o ventas.");
  }
  if (customer.status === "inactivo") {
    throw new Error("Cliente inactivo. Actívalo para seguir operando.");
  }
  if (Number(customer.accountOpen) && Number(customer.creditLimit) > 0) {
    const st = customerStatsMap().get(customer.id) || emptyCustomerStats();
    if (st.receivable > Number(customer.creditLimit) + 0.009) {
      throw new Error("El cliente rebasó su límite de crédito");
    }
  }
}

function listCustomers(q, opts = {}) {
  const query = String(q || "").trim();
  const limit = Number(opts.limit) || 0;
  const lite = Boolean(opts.lite || limit);
  const filters = [];
  filters.push(alive(customers));
  if (opts.type) filters.push(eq(customers.type, String(opts.type)));
  if (opts.status) filters.push(eq(customers.status, String(opts.status)));
  if (query) {
    const p = likePattern(query);
    const search = [
      like(customers.name, p),
      like(customers.firstName, p),
      like(customers.middleName, p),
      like(customers.lastName, p),
      like(customers.company, p),
      like(customers.phone, p),
      like(customers.phonesJson, p),
      like(customers.document, p),
      like(customers.email, p),
      like(customers.address, p),
      like(customers.city, p),
      like(customers.notes, p),
      like(customers.contactsJson, p),
      like(customers.code, p),
      like(customers.id, p),
    ];
    const codeMatch = query.match(/^c-?0*(\d+)$/i);
    if (codeMatch) search.push(eq(customers.code, `C-${String(codeMatch[1]).padStart(4, "0")}`));
    const vehicleIds = matchingCustomerIdsByVehicle(query);
    if (vehicleIds.length) search.push(inArray(customers.id, vehicleIds));
    filters.push(or(...search));
  }
  let stmt = db().select().from(customers);
  if (filters.length === 1) stmt = stmt.where(filters[0]);
  else if (filters.length > 1) stmt = stmt.where(and(...filters));
  stmt = stmt.orderBy(desc(customers.createdAt));
  let rows = (limit > 0 ? stmt.limit(Math.max(limit * 3, limit)) : stmt).all();
  const stats = lite && !opts.balance ? null : customerStatsMap();
  const mapped = rows.map((row) => {
    const base = lite ? withPhones(row) : withVehicles(row);
    return stats ? { ...withStats(row, stats), vehicles: base.vehicles } : base;
  });
  const wanted = opts.balance ? mapped.filter((row) => Number(row.receivable) > 0) : mapped;
  return limit > 0 ? wanted.slice(0, limit) : wanted;
}

function getCustomer(id) {
  const customer = db().select().from(customers).where(eq(customers.id, id)).get();
  if (!customer) return null;
  const stats = customerStatsMap();
  const notesLog = db()
    .select()
    .from(customerNotes)
    .where(eq(customerNotes.customerId, id))
    .orderBy(desc(customerNotes.createdAt))
    .all();
  const customerSales = db()
    .select()
    .from(sales)
    .where(and(eq(sales.customerId, id), alive(sales)))
    .orderBy(desc(sales.createdAt))
    .all()
    .map(attachSaleExtras);
  const customerOrders = db()
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.customerId, id), alive(workOrders)))
    .orderBy(desc(workOrders.createdAt))
    .all()
    .map(attachWorkOrder);
  const customerVehicles = db().select().from(vehicles).where(and(eq(vehicles.customerId, id), alive(vehicles))).all();
  return {
    ...withStats(customer, stats),
    sales: customerSales,
    workOrders: customerOrders,
    vehicles: customerVehicles,
    notesLog,
  };
}

function attachIncomingVehicle(customerId, vehicle) {
  if (!vehicle || typeof vehicle !== "object") return;
  const vin = String(vehicle.vin || "").trim();
  const plate = String(vehicle.plate || "").trim();
  const make = String(vehicle.make || "").trim();
  const model = String(vehicle.model || "").trim();
  if (!vin && !plate && !make && !model) return;
  createVehicle({
    vin,
    plate,
    make,
    model,
    year: vehicle.year,
    color: vehicle.color,
    km: vehicle.km,
    trim: vehicle.trim,
    status: "cliente",
    customerId,
    cost: 0,
    price: 0,
  });
}

function createCustomer(data) {
  assertNoDuplicates(data);
  const contact = normalizeContact(data);
  const profile = customerProfile(data);
  const createdAt = nowIso();
  const row = {
    name: profile.name,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    phone: contact.phone,
    phonesJson: contact.phonesJson,
    email: String(data.email || "").trim(),
    document: String(data.document || "").trim(),
    address: contact.address,
    city: contact.city,
    state: contact.state,
    zip: contact.zip,
    notes: String(data.notes || "").trim(),
    company: profile.company,
    type: profile.type,
    status: profile.status,
    source: profile.source,
    taxExempt: profile.taxExempt,
    accountOpen: profile.accountOpen,
    creditLimit: profile.creditLimit,
    discountPct: profile.discountPct,
    preferredContact: profile.preferredContact,
    language: profile.language,
    birthday: profile.birthday,
    marketing: profile.marketing,
    contactsJson: profile.contactsJson,
    createdAt,
    updatedAt: createdAt,
    id: newGuid(),
    code: nextCustomerCode(),
  };
  db().insert(customers).values(row).run();
  attachIncomingVehicle(row.id, data.vehicle);
  return getCustomer(row.id);
}

function updateCustomer(id, data) {
  const current = db().select().from(customers).where(eq(customers.id, id)).get();
  if (!current) throw new Error("Cliente no encontrado");
  assertNoDuplicates(data, id);
  const contact = normalizeContact(data, current);
  const profile = customerProfile(data, current);
  db()
    .update(customers)
    .set({
      name: profile.name,
      firstName: profile.firstName,
      middleName: profile.middleName,
      lastName: profile.lastName,
      phone: contact.phone,
      phonesJson: contact.phonesJson,
      email: data.email != null ? String(data.email).trim() : current.email,
      document: data.document != null ? String(data.document).trim() : current.document,
      address: contact.address,
      city: contact.city,
      state: contact.state,
      zip: contact.zip,
      notes: data.notes != null ? String(data.notes).trim() : current.notes,
      company: profile.company,
      type: profile.type,
      status: profile.status,
      source: profile.source,
      taxExempt: profile.taxExempt,
      accountOpen: profile.accountOpen,
      creditLimit: profile.creditLimit,
      discountPct: profile.discountPct,
      preferredContact: profile.preferredContact,
      language: profile.language,
      birthday: profile.birthday,
      marketing: profile.marketing,
      contactsJson: profile.contactsJson,
      updatedAt: nowIso(),
    })
    .where(eq(customers.id, id))
    .run();
  return getCustomer(id);
}

function addCustomerNote(id, data = {}) {
  const current = db().select().from(customers).where(eq(customers.id, id)).get();
  if (!current) throw new Error("Cliente no encontrado");
  const body = String(data.body || "").trim();
  if (!body) throw new Error("Escribe una nota");
  db()
    .insert(customerNotes)
    .values({
      id: newGuid(),
      customerId: asId(id),
      body,
      userName: String(data.userName || "").trim(),
      createdAt: nowIso(),
    })
    .run();
  return getCustomer(id);
}

function unlinkCustomerVehicle(customerId, vehicleId) {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) throw new Error("Vehículo no encontrado");
  if (asId(vehicle.customerId) !== asId(customerId)) throw new Error("Ese vehículo no está vinculado a este cliente");
  db().update(vehicles).set({ customerId: null }).where(eq(vehicles.id, vehicleId)).run();
  return getCustomer(customerId);
}

function removeCustomer(id) {
  const current = db().select().from(customers).where(eq(customers.id, id)).get();
  if (!current) throw new Error("Cliente no encontrado");
  if (isGone(current)) return { id };
  const openWo = db()
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(alive(workOrders), ne(workOrders.status, "entregada"), eq(workOrders.customerId, id)))
    .get();
  if (openWo) throw new Error("Este cliente tiene órdenes abiertas. Ciérralas o bórralas primero.");
  const openSale = db()
    .select({ id: sales.id })
    .from(sales)
    .where(and(alive(sales), eq(sales.customerId, id), ne(sales.status, "entregada"), ne(sales.status, "borrador")))
    .get();
  if (openSale) throw new Error("Este cliente tiene una venta abierta. Ciérrala primero.");
  return markDeleted(customers, id, { updatedAt: nowIso() });
}

const VEHICLE_STATUSES = ["en_stock", "reservado", "vendido", "cliente", "consignacion"];
const VEHICLE_CONDITIONS = ["usado", "nuevo", "certificado"];
const VEHICLE_FUELS = ["", "gasolina", "diesel", "hibrido", "electrico", "glp"];
const VEHICLE_TRANS = ["", "automatico", "manual", "cvt", "dct"];
const VEHICLE_DRIVE = ["", "FWD", "RWD", "AWD", "4x4"];
const VEHICLE_BODY = ["", "sedan", "hatch", "suv", "pickup", "van", "coupe", "wagon", "moto", "otro"];
const VIN_MAP = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5,
  P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
};
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

function inventoryStatus(status) {
  return status === "en_stock" || status === "reservado" || status === "consignacion";
}

function normalizeVin(raw) {
  return String(raw || "").trim().toUpperCase().replace(/[\s-]/g, "");
}

function vinCheckDigit(vin) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const n = VIN_MAP[vin[i]];
    if (n == null) return "";
    sum += n * VIN_WEIGHTS[i];
  }
  const rem = sum % 11;
  return rem === 10 ? "X" : String(rem);
}

function vinMeta(raw) {
  const value = normalizeVin(raw);
  let checkOk = true;
  if (value.length === 17 && /^[A-HJ-NPR-Z0-9]+$/.test(value)) {
    checkOk = vinCheckDigit(value) === value[8];
  }
  return { value, checkOk };
}

function daysBetween(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function dateOverdue(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const day = raw.length <= 10 ? `${raw}T23:59:59` : raw;
  const t = new Date(day).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

function nextStockNumber() {
  const rows = db().select({ stockNumber: vehicles.stockNumber }).from(vehicles).all();
  let max = 0;
  for (const row of rows) {
    const m = String(row.stockNumber || "").match(/^STK-(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `STK-${String(max + 1).padStart(4, "0")}`;
}

function assertStockNumberFree(stockNumber, excludeId) {
  const value = String(stockNumber || "").trim().toUpperCase();
  if (!value) return "";
  const clash = db().select().from(vehicles).where(eq(vehicles.stockNumber, value)).get();
  if (clash && !isGone(clash) && asId(clash.id) !== asId(excludeId || "")) throw new Error("Ese número de stock ya existe");
  return value;
}

function vehicleStatsMap() {
  const stats = new Map();
  function ensure(id) {
    const key = asId(id);
    if (!key) return { lastVisit: null, openOrders: 0 };
    if (!stats.has(key)) stats.set(key, { lastVisit: null, openOrders: 0 });
    return stats.get(key);
  }
  for (const order of db().select().from(workOrders).all()) {
    if (isGone(order)) continue;
    const st = ensure(order.vehicleId);
    if (order.createdAt && (!st.lastVisit || order.createdAt > st.lastVisit)) st.lastVisit = order.createdAt;
    if (order.deliveredAt && (!st.lastVisit || order.deliveredAt > st.lastVisit)) st.lastVisit = order.deliveredAt;
    if (order.status !== "entregada" && (order.kind || "orden") !== "presupuesto") st.openOrders += 1;
  }
  return stats;
}

function vehicleProfile(data, current = {}) {
  const vin = vinMeta(data.vin != null ? data.vin : current.vin);
  if (!vin.value) throw new Error("El VIN es obligatorio");
  const make = data.make != null ? String(data.make).trim() : current.make || "";
  const model = data.model != null ? String(data.model).trim() : current.model || "";
  if (!make || !model) throw new Error("Marca y modelo son obligatorios");
  const status = pickEnum(data.status != null ? data.status : current.status, VEHICLE_STATUSES, "en_stock");
  const customerId =
    data.customerId !== undefined ? (data.customerId ? asId(data.customerId) : null) : current.customerId || null;
  if ((status === "vendido" || status === "cliente" || status === "consignacion") && !customerId && !current.id) {
    throw new Error("Asigna un cliente a este vehículo");
  }
  if ((status === "vendido" || status === "cliente" || status === "consignacion") && !customerId && current.id) {
    throw new Error("Asigna un cliente a este vehículo");
  }
  let stockNumber = data.stockNumber != null ? String(data.stockNumber).trim().toUpperCase() : current.stockNumber || "";
  if (inventoryStatus(status) && !stockNumber) stockNumber = nextStockNumber();
  if (!inventoryStatus(status) && data.stockNumber === "") stockNumber = "";
  stockNumber = assertStockNumberFree(stockNumber, current.id);
  const acquiredAt =
    data.acquiredAt !== undefined
      ? data.acquiredAt
        ? String(data.acquiredAt)
        : null
      : current.acquiredAt || (inventoryStatus(status) ? current.createdAt || nowIso() : null);
  return {
    vin: vin.value,
    vinCheckOk: vin.checkOk,
    make,
    model,
    year: data.year != null ? Number(data.year) || new Date().getFullYear() : Number(current.year) || new Date().getFullYear(),
    color: data.color != null ? String(data.color).trim() : current.color || "",
    plate: data.plate != null ? String(data.plate).trim().toUpperCase() : current.plate || "",
    km: data.km != null ? Number(data.km) || 0 : Number(current.km) || 0,
    cost: data.cost != null ? Number(data.cost) || 0 : Number(current.cost) || 0,
    price: data.price != null ? Number(data.price) || 0 : Number(current.price) || 0,
    status,
    customerId,
    notes: data.notes != null ? String(data.notes).trim() : current.notes || "",
    stockNumber,
    trim: data.trim != null ? String(data.trim).trim() : current.trim || "",
    bodyStyle: pickEnum(data.bodyStyle != null ? data.bodyStyle : current.bodyStyle, VEHICLE_BODY, ""),
    engine: data.engine != null ? String(data.engine).trim() : current.engine || "",
    transmission: pickEnum(data.transmission != null ? data.transmission : current.transmission, VEHICLE_TRANS, ""),
    drivetrain: pickEnum(data.drivetrain != null ? data.drivetrain : current.drivetrain, VEHICLE_DRIVE, ""),
    fuel: pickEnum(data.fuel != null ? data.fuel : current.fuel, VEHICLE_FUELS, ""),
    interiorColor: data.interiorColor != null ? String(data.interiorColor).trim() : current.interiorColor || "",
    doors: data.doors != null ? Math.max(0, Number(data.doors) || 0) : Number(current.doors) || 0,
    condition: pickEnum(data.condition != null ? data.condition : current.condition, VEHICLE_CONDITIONS, "usado"),
    location: data.location != null ? String(data.location).trim() : current.location || "",
    keyNumber: data.keyNumber != null ? String(data.keyNumber).trim() : current.keyNumber || "",
    unitNumber: data.unitNumber != null ? String(data.unitNumber).trim() : current.unitNumber || "",
    acquiredAt,
    insurance: data.insurance != null ? String(data.insurance).trim() : current.insurance || "",
    insurancePolicy: data.insurancePolicy != null ? String(data.insurancePolicy).trim() : current.insurancePolicy || "",
    licenseExpiry: data.licenseExpiry != null ? String(data.licenseExpiry).trim() : current.licenseExpiry || "",
    inspectionDue: data.inspectionDue != null ? String(data.inspectionDue).trim() : current.inspectionDue || "",
    productionDate: data.productionDate != null ? String(data.productionDate).trim() : current.productionDate || "",
    alert: data.alert != null ? String(data.alert).trim() : current.alert || "",
  };
}

function plateCountsMap() {
  const counts = new Map();
  for (const row of db().select({ plate: vehicles.plate }).from(vehicles).where(alive(vehicles)).all()) {
    const plate = String(row.plate || "").trim();
    if (!plate) continue;
    counts.set(plate, (counts.get(plate) || 0) + 1);
  }
  return counts;
}

function decorateVehicle(row, stats, plateCounts) {
  if (!row) return null;
  const customer = row.customerId
    ? withPhones(db().select().from(customers).where(eq(customers.id, row.customerId)).get())
    : null;
  const st = stats ? stats.get(row.id) : null;
  const status = row.status || "en_stock";
  const plate = String(row.plate || "").trim();
  let plateClash = false;
  if (plate) {
    if (plateCounts) plateClash = (plateCounts.get(plate) || 0) > 1;
    else {
      const other = db()
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(and(eq(vehicles.plate, plate), alive(vehicles)))
        .all();
      plateClash = other.some((v) => asId(v.id) !== asId(row.id));
    }
  }
  const vin = vinMeta(row.vin);
  return {
    ...row,
    status,
    condition: row.condition || "usado",
    customer,
    daysInStock: inventoryStatus(status) ? daysBetween(row.acquiredAt || row.createdAt) : 0,
    lastVisit: st?.lastVisit || null,
    openOrders: st?.openOrders || 0,
    vinCheckOk: vin.checkOk,
    plateClash,
    inspectionOverdue: dateOverdue(row.inspectionDue),
    licenseOverdue: dateOverdue(row.licenseExpiry),
  };
}

function attachVehicle(row) {
  return decorateVehicle(row, vehicleStatsMap());
}

function listVehicles(q, status, opts = {}) {
  const query = String(q || "").trim();
  const limit = Number(opts.limit) || 0;
  const filters = [];
  filters.push(alive(vehicles));
  if (status) filters.push(eq(vehicles.status, status));
  if (opts.customerId) filters.push(eq(vehicles.customerId, asId(opts.customerId)));
  if (opts.condition) filters.push(eq(vehicles.condition, String(opts.condition)));
  if (opts.kind === "inventory") filters.push(inArray(vehicles.status, ["en_stock", "reservado", "consignacion"]));
  if (opts.kind === "customer") filters.push(eq(vehicles.status, "cliente"));
  if (opts.kind === "sold") filters.push(eq(vehicles.status, "vendido"));
  if (query && limit > 0) {
    const p = likePattern(query);
    filters.push(
      or(
        like(vehicles.vin, p),
        like(vehicles.plate, p),
        like(vehicles.make, p),
        like(vehicles.model, p),
        like(vehicles.color, p),
        like(vehicles.stockNumber, p),
        like(vehicles.trim, p),
        like(vehicles.unitNumber, p),
        like(vehicles.engine, p),
        like(vehicles.keyNumber, p),
        like(vehicles.id, p)
      )
    );
  }
  let stmt = db().select().from(vehicles);
  if (filters.length === 1) stmt = stmt.where(filters[0]);
  else if (filters.length > 1) stmt = stmt.where(and(...filters));
  stmt = stmt.orderBy(desc(vehicles.createdAt));
  const stats = vehicleStatsMap();
  const plates = plateCountsMap();
  let rows = (limit > 0 ? stmt.limit(Math.max(limit * 3, limit)) : stmt).all().map((row) => decorateVehicle(row, stats, plates));
  if (query && limit <= 0) {
    const needle = query.toLowerCase();
    rows = rows.filter((v) => {
      const hay = `${v.vin} ${v.plate || ""} ${v.make} ${v.model} ${v.trim || ""} ${v.color} ${v.stockNumber || ""} ${v.unitNumber || ""} ${v.engine || ""} ${v.keyNumber || ""} ${v.id || ""} ${v.customer?.name || ""} ${v.customer?.firstName || ""} ${v.customer?.lastName || ""} ${v.customer?.company || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }
  if (Number(opts.aging) > 0) {
    rows = rows.filter((v) => inventoryStatus(v.status) && Number(v.daysInStock) >= Number(opts.aging));
  }
  return limit > 0 ? rows.slice(0, limit) : rows;
}

function getVehicle(id, opts = {}) {
  const row = attachVehicle(db().select().from(vehicles).where(eq(vehicles.id, id)).get());
  if (!row || !opts.history) return row;
  const orders = db()
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.vehicleId, id), alive(workOrders)))
    .orderBy(desc(workOrders.createdAt))
    .all()
    .map((o) => {
      const lines = db().select().from(workOrderLines).where(eq(workOrderLines.workOrderId, o.id)).all();
      const payments = db().select().from(workOrderPayments).where(eq(workOrderPayments.workOrderId, o.id)).all();
      const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const totals = workOrderTotals(o, lines);
      return {
        ...o,
        ...totals,
        paid,
        balance: roundMoney(totals.total - paid),
      };
    });
  const vehicleSales = db()
    .select()
    .from(sales)
    .where(and(eq(sales.vehicleId, id), alive(sales)))
    .orderBy(desc(sales.createdAt))
    .all()
    .map(attachSaleExtras);
  const notesLog = db()
    .select()
    .from(vehicleNotes)
    .where(eq(vehicleNotes.vehicleId, id))
    .orderBy(desc(vehicleNotes.createdAt))
    .all();
  return { ...row, workOrders: orders, sales: vehicleSales, notesLog };
}

function createVehicle(data) {
  const profile = vehicleProfile(data);
  const existing = db().select().from(vehicles).where(eq(vehicles.vin, profile.vin)).get();
  if (existing && !isGone(existing)) throw new Error("Ya existe un vehículo con ese VIN");
  if (existing && isGone(existing)) buryDeletedUnique("vehicles", "vin", profile.vin);
  const createdAt = nowIso();
  const id = newGuid();
  db()
    .insert(vehicles)
    .values({
      id,
      vin: profile.vin,
      make: profile.make,
      model: profile.model,
      year: profile.year,
      color: profile.color,
      plate: profile.plate,
      km: profile.km,
      cost: profile.cost,
      price: profile.price,
      status: profile.status,
      customerId: profile.customerId,
      notes: profile.notes,
      createdAt,
      stockNumber: profile.stockNumber,
      trim: profile.trim,
      bodyStyle: profile.bodyStyle,
      engine: profile.engine,
      transmission: profile.transmission,
      drivetrain: profile.drivetrain,
      fuel: profile.fuel,
      interiorColor: profile.interiorColor,
      doors: profile.doors,
      condition: profile.condition,
      location: profile.location,
      keyNumber: profile.keyNumber,
      unitNumber: profile.unitNumber,
      acquiredAt: profile.acquiredAt || (inventoryStatus(profile.status) ? createdAt : null),
      insurance: profile.insurance,
      insurancePolicy: profile.insurancePolicy,
      licenseExpiry: profile.licenseExpiry,
      inspectionDue: profile.inspectionDue,
      productionDate: profile.productionDate,
      alert: profile.alert,
      updatedAt: createdAt,
    })
    .run();
  return getVehicle(id);
}

function updateVehicle(id, data) {
  const current = getVehicle(id);
  if (!current) throw new Error("Vehículo no encontrado");
  const profile = vehicleProfile(data, current);
  if (profile.vin !== current.vin) {
    const existing = db().select().from(vehicles).where(eq(vehicles.vin, profile.vin)).get();
    if (existing && asId(existing.id) !== asId(id)) throw new Error("Ya existe un vehículo con ese VIN");
  }
  db()
    .update(vehicles)
    .set({
      vin: profile.vin,
      make: profile.make,
      model: profile.model,
      year: profile.year,
      color: profile.color,
      plate: profile.plate,
      km: profile.km,
      cost: profile.cost,
      price: profile.price,
      status: profile.status,
      customerId: profile.customerId,
      notes: profile.notes,
      stockNumber: profile.stockNumber,
      trim: profile.trim,
      bodyStyle: profile.bodyStyle,
      engine: profile.engine,
      transmission: profile.transmission,
      drivetrain: profile.drivetrain,
      fuel: profile.fuel,
      interiorColor: profile.interiorColor,
      doors: profile.doors,
      condition: profile.condition,
      location: profile.location,
      keyNumber: profile.keyNumber,
      unitNumber: profile.unitNumber,
      acquiredAt: profile.acquiredAt,
      insurance: profile.insurance,
      insurancePolicy: profile.insurancePolicy,
      licenseExpiry: profile.licenseExpiry,
      inspectionDue: profile.inspectionDue,
      productionDate: profile.productionDate,
      alert: profile.alert,
      updatedAt: nowIso(),
    })
    .where(eq(vehicles.id, id))
    .run();
  return getVehicle(id, { history: true });
}

function addVehicleNote(id, data = {}) {
  const current = getVehicle(id);
  if (!current) throw new Error("Vehículo no encontrado");
  const body = String(data.body || "").trim();
  if (!body) throw new Error("Escribe una nota");
  db()
    .insert(vehicleNotes)
    .values({
      id: newGuid(),
      vehicleId: asId(id),
      body,
      userName: String(data.userName || "").trim(),
      createdAt: nowIso(),
    })
    .run();
  return getVehicle(id, { history: true });
}

function restoreVehicle(id, data) {
  db().update(vehicles).set({ deleted: 0, updatedAt: nowIso() }).where(eq(vehicles.id, id)).run();
  return updateVehicle(id, data);
}

function removeVehicle(id) {
  const current = db().select().from(vehicles).where(eq(vehicles.id, id)).get();
  if (!current) throw new Error("Vehículo no encontrado");
  if (isGone(current)) return { id };
  const openWo = db()
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(alive(workOrders), ne(workOrders.status, "entregada"), eq(workOrders.vehicleId, id)))
    .get();
  if (openWo) throw new Error("Este vehículo tiene órdenes abiertas. Ciérralas o bórralas primero.");
  const openSale = db()
    .select({ id: sales.id })
    .from(sales)
    .where(and(alive(sales), eq(sales.vehicleId, id), ne(sales.status, "entregada")))
    .get();
  if (openSale) throw new Error("Este vehículo está en una venta. Ciérrala primero.");
  return markDeleted(vehicles, id, { updatedAt: nowIso() });
}

function attachSales(rows) {
  const list = (rows || []).filter(Boolean);
  if (!list.length) return [];
  const customerBy = new Map(fetchByIds(customers, customers.id, list.map((s) => s.customerId)).map((row) => [row.id, withPhones(row)]));
  const vehicleBy = new Map(fetchByIds(vehicles, vehicles.id, list.map((s) => s.vehicleId)).map((row) => [row.id, row]));
  const payBy = groupBy(fetchByIds(salePayments, salePayments.saleId, list.map((s) => s.id)), "saleId");
  return list.map((sale) => {
    const payments = (payBy.get(sale.id) || [])
      .slice()
      .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
    const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const taxRate = Number(sale.taxRate) || 0;
    const tax = roundMoney(sale.tax != null ? sale.tax : Number(sale.price || 0) * (taxRate / 100));
    const total = roundMoney(Number(sale.price || 0) + tax);
    return {
      ...sale,
      customer: customerBy.get(sale.customerId) || null,
      vehicle: vehicleBy.get(sale.vehicleId) || null,
      payments,
      taxRate,
      tax,
      total,
      paid: roundMoney(paid),
      balance: roundMoney(total - paid),
    };
  });
}

function attachSaleExtras(sale) {
  if (!sale) return null;
  return attachSales([sale])[0] || null;
}

function listSales(q, opts = {}) {
  const rows = db().select().from(sales).where(alive(sales)).orderBy(desc(sales.createdAt)).all();
  let detailed = attachSales(rows);
  const query = String(q || "").trim().toLowerCase();
  if (query) {
    detailed = detailed.filter((s) => {
      const hay = `${s.id} ${s.customer?.name || ""} ${s.vehicle?.make || ""} ${s.vehicle?.model || ""} ${s.vehicle?.vin || ""} ${s.vehicle?.plate || ""} ${s.vehicle?.stockNumber || ""} ${s.status}`.toLowerCase();
      return hay.includes(query);
    });
  }
  if (opts.status) detailed = detailed.filter((s) => s.status === String(opts.status));
  if (opts.unpaid) detailed = detailed.filter((s) => s.status !== "borrador" && Number(s.balance) > 0.009);
  const limit = Number(opts.limit) || 0;
  return limit > 0 ? detailed.slice(0, limit) : detailed;
}

function getSale(id) {
  const sale = db().select().from(sales).where(eq(sales.id, id)).get();
  return attachSaleExtras(sale);
}

function createSale(data) {
  const customerId = asId(data.customerId);
  const vehicleId = asId(data.vehicleId);
  const customer = db().select().from(customers).where(eq(customers.id, customerId)).get();
  assertCustomerCanTransact(customer);
  const vehicle = getVehicle(vehicleId);
  if (!vehicle || isGone(vehicle)) throw new Error("Vehículo no encontrado");
  if (vehicle.status !== "en_stock" && vehicle.status !== "reservado" && vehicle.status !== "consignacion") {
    throw new Error("El vehículo no está disponible para venta");
  }
  const open = db()
    .select()
    .from(sales)
    .where(and(eq(sales.vehicleId, vehicleId), ne(sales.status, "entregada"), alive(sales)))
    .all()
    .filter((s) => s.status === "borrador" || s.status === "cerrada");
  if (open.length) throw new Error("Ese vehículo ya tiene una venta abierta");

  const priced = salePriceDown(data, { price: Number(vehicle.price) || 0, downPayment: 0 }, customerTaxRate(customer, getSettings()));
  const run = getSqlite().transaction(() => {
    const id = newGuid();
    db()
      .insert(sales)
      .values({
        id,
        customerId,
        vehicleId,
        price: priced.price,
        taxRate: priced.taxRate,
        tax: priced.tax,
        downPayment: priced.downPayment,
        paymentMethod: data.paymentMethod === "financiado" ? "financiado" : "contado",
        status: "borrador",
        notes: String(data.notes || "").trim(),
        createdAt: nowIso(),
      })
      .run();
    db().update(vehicles).set({ status: "reservado", ...(vehicle.status === "consignacion" ? {} : { customerId }) }).where(eq(vehicles.id, vehicleId)).run();
    return id;
  });
  return getSale(run());
}

function updateSale(id, data) {
  const sale = db().select().from(sales).where(eq(sales.id, id)).get();
  if (!sale || isGone(sale)) throw new Error("Venta no encontrada");
  if (sale.status !== "borrador") throw new Error("Solo se puede editar un borrador");
  const priced = salePriceDown(data, sale, sale.taxRate);
  db()
    .update(sales)
    .set({
      price: priced.price,
      taxRate: priced.taxRate,
      tax: priced.tax,
      downPayment: priced.downPayment,
      paymentMethod: data.paymentMethod != null ? data.paymentMethod : sale.paymentMethod,
      notes: data.notes != null ? String(data.notes).trim() : sale.notes,
    })
    .where(eq(sales.id, id))
    .run();
  return getSale(id);
}

function closeSale(id) {
  const run = getSqlite().transaction(() => {
    const sale = db().select().from(sales).where(eq(sales.id, id)).get();
    if (!sale || isGone(sale)) throw new Error("Venta no encontrada");
    if (sale.status !== "borrador") throw new Error("Solo se puede cerrar un borrador");
    const closedAt = nowIso();
    db()
      .update(sales)
      .set({ status: "cerrada", closedAt })
      .where(eq(sales.id, id))
      .run();
    db().update(vehicles).set({ status: "vendido" }).where(eq(vehicles.id, sale.vehicleId)).run();
    if (Number(sale.downPayment) > 0) {
      const due = roundMoney(Number(sale.price || 0) + Number(sale.tax || 0));
      db()
        .insert(salePayments)
        .values({
          id: newGuid(),
          saleId: id,
          amount: Math.min(Number(sale.downPayment), due),
          method: sale.paymentMethod === "financiado" ? "enganche" : "contado",
          paidAt: closedAt,
          notes: "Enganche / pago al cierre",
        })
        .run();
    }
  });
  run();
  return getSale(id);
}

function deliverSale(id) {
  const sale = getSale(id);
  if (!sale) throw new Error("Venta no encontrada");
  if (sale.status === "entregada") return sale;
  if (sale.status !== "cerrada") throw new Error("Solo se puede entregar una venta cerrada");
  if (sale.paymentMethod !== "financiado" && Number(sale.balance) > 0.009) {
    throw new Error("Hay saldo. Cobra para entregar la unidad.");
  }
  db().update(sales).set({ status: "entregada", deliveredAt: nowIso() }).where(eq(sales.id, id)).run();
  return getSale(id);
}

function addSalePayment(id, data) {
  const sale = getSale(id);
  if (!sale) throw new Error("Venta no encontrada");
  if (sale.status === "borrador") throw new Error("Cierra la venta antes de registrar cobros");
  const due = Number(sale.balance) || 0;
  if (sale.status === "entregada" && due <= 0.009) throw new Error("La venta ya está pagada y entregada");
  const wantsClose = Boolean(data.close) && sale.status !== "entregada";
  if (wantsClose && due <= 0.009) return deliverSale(id);
  let amount = clampDue(data.amount, due);
  if (wantsClose && (!amount || amount <= 0)) amount = due;
  if (!(amount > 0)) throw new Error("El monto debe ser mayor a 0");
  const run = getSqlite().transaction(() => {
    db()
      .insert(salePayments)
      .values({
        id: newGuid(),
        saleId: id,
        amount,
        method: ["efectivo", "tarjeta", "transferencia", "financiamiento", "enganche", "contado"].includes(String(data.method || "").toLowerCase())
          ? String(data.method).toLowerCase()
          : "efectivo",
        paidAt: data.paidAt ? expenseTimestamp(data.paidAt) : nowIso(),
        notes: String(data.notes || "").trim(),
      })
      .run();
    const next = getSale(id);
    if (wantsClose) {
      if (Number(next.balance) > 0.009 && next.paymentMethod !== "financiado") return next;
      return deliverSale(id);
    }
    return next;
  });
  return run();
}

function deleteSale(id) {
  const sale = db().select().from(sales).where(eq(sales.id, id)).get();
  if (!sale) throw new Error("Venta no encontrada");
  if (isGone(sale)) return { id };
  if (sale.status !== "borrador") throw new Error("Solo se puede eliminar un borrador");
  const run = getSqlite().transaction(() => {
    markDeleted(sales, id);
    const vehicle = getVehicle(sale.vehicleId);
    if (vehicle && vehicle.status === "reservado") {
      if (vehicle.customerId && vehicle.customerId !== sale.customerId) {
        db().update(vehicles).set({ status: "consignacion" }).where(eq(vehicles.id, sale.vehicleId)).run();
      } else {
        db().update(vehicles).set({ status: "en_stock", customerId: null }).where(eq(vehicles.id, sale.vehicleId)).run();
      }
    }
  });
  run();
  return { id };
}

const PART_CATEGORIES = ["filtros", "frenos", "electrico", "fluidos", "motor", "llantas", "carroceria", "clima", "otros"];
const PART_STATUSES = ["activo", "descontinuado"];
const PART_UOMS = ["pza", "juego", "litro", "galon", "metro"];
const PART_ADJUST_REASONS = ["conteo", "merma", "dano", "devolucion_proveedor", "correccion", "entrada"];
const OP_CATEGORIES = ["mantenimiento", "frenos", "motor", "transmision", "electrico", "suspension", "diagnostico", "climatizacion", "carroceria", "llantas", "otros"];
const OP_PAY_TYPES = ["cliente", "garantia", "interno", "sublet"];
const WASH_CATEGORIES = ["lavado", "detailing"];
const WASH_OP_CODES = [
  {
    code: "WASH-X",
    description: "Lavado exterior",
    category: "lavado",
    laborHours: 0.3,
    price: 35,
    concern: "Exterior sucio",
    cause: "Polvo y suciedad de calle",
    correction: "Lavado y secado exterior",
  },
  {
    code: "WASH-I",
    description: "Lavado interior",
    category: "lavado",
    laborHours: 0.4,
    price: 40,
    concern: "Interior sucio",
    cause: "Uso diario",
    correction: "Aspirado y limpia interior",
  },
  {
    code: "WASH-F",
    description: "Lavado completo",
    category: "lavado",
    laborHours: 0.6,
    price: 65,
    popular: 1,
    concern: "Lavado completo",
    cause: "Mantenimiento de presentación",
    correction: "Lavado interior y exterior",
  },
  {
    code: "DET-X",
    description: "Detailing express",
    category: "detailing",
    laborHours: 1.5,
    price: 149,
    popular: 1,
    concern: "Presentación",
    cause: "Suciedad incrustada",
    correction: "Detailing express interior y exterior",
  },
  {
    code: "DET-F",
    description: "Detailing completo",
    category: "detailing",
    laborHours: 3,
    price: 299,
    concern: "Detailing completo",
    cause: "Vehículo opaco o sucio a fondo",
    correction: "Detailing interior y exterior completo",
  },
  {
    code: "WAX",
    description: "Encerado",
    category: "detailing",
    laborHours: 0.8,
    price: 89,
    concern: "Pintura opaca",
    cause: "Desgaste de cera",
    correction: "Aplicar cera protectora",
  },
];

function catalogKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function cleanCatalogName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

function parseCatalogList(raw, defaults) {
  if (raw == null || String(raw).trim() === "") return [...defaults];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [...defaults];
    const out = [];
    const seen = new Set();
    for (const item of parsed) {
      const id = cleanCatalogName(item);
      const key = catalogKey(id);
      if (!id || !key || seen.has(key)) continue;
      seen.add(key);
      out.push(id);
    }
    return out;
  } catch {
    return [...defaults];
  }
}

function countByColumn(table, column) {
  const rows = getSqlite()
    .prepare(`SELECT ${column} AS id, COUNT(*) AS n FROM ${table} WHERE IFNULL(deleted, 0) = 0 GROUP BY ${column}`)
    .all();
  const map = {};
  for (const row of rows) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    map[id] = Number(row.n) || 0;
  }
  return map;
}

function mergeCatalog(saved, usedMap) {
  const seen = new Set();
  const out = [];
  function add(id) {
    const name = cleanCatalogName(id);
    const key = catalogKey(name);
    if (!name || !key || seen.has(key)) return;
    seen.add(key);
    let inUse = 0;
    for (const [usedId, n] of Object.entries(usedMap)) {
      if (catalogKey(usedId) === key) inUse += Number(n) || 0;
    }
    out.push({ id: name, inUse });
  }
  saved.forEach(add);
  Object.keys(usedMap).forEach(add);
  return out;
}

function getCatalogs() {
  const row = readSettingsRow();
  return {
    opcodeCategories: mergeCatalog(parseCatalogList(row.opcodeCategories, OP_CATEGORIES), countByColumn("op_codes", "category")),
    partCategories: mergeCatalog(parseCatalogList(row.partCategories, PART_CATEGORIES), countByColumn("parts", "category")),
    partUoms: mergeCatalog(parseCatalogList(row.partUoms, PART_UOMS), countByColumn("parts", "uom")),
    payTypes: OP_PAY_TYPES.map((id) => ({ id, inUse: 0, locked: true })),
  };
}

function normalizeCatalogInput(list, currentItems) {
  const names = Array.isArray(list) ? list : [];
  const out = [];
  const seen = new Set();
  for (const item of names) {
    const id = typeof item === "string" ? item : item && item.id;
    const name = cleanCatalogName(id);
    const key = catalogKey(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  for (const item of currentItems || []) {
    const key = catalogKey(item.id);
    if (item.inUse > 0 && key && !seen.has(key)) {
      out.push(item.id);
      seen.add(key);
    }
  }
  return out;
}

function saveCatalogs(data) {
  const current = getCatalogs();
  const patch = {};
  if (data && data.opcodeCategories) {
    patch.opcodeCategories = JSON.stringify(normalizeCatalogInput(data.opcodeCategories, current.opcodeCategories));
  }
  if (data && data.partCategories) {
    patch.partCategories = JSON.stringify(normalizeCatalogInput(data.partCategories, current.partCategories));
  }
  if (data && data.partUoms) {
    patch.partUoms = JSON.stringify(normalizeCatalogInput(data.partUoms, current.partUoms));
  }
  if (Object.keys(patch).length) patchSettings(patch);
  return getCatalogs();
}

function ensureWashSetup() {
  const cats = getCatalogs();
  const nextOp = cats.opcodeCategories.map((item) => item.id);
  for (const id of ["lavado", "detailing"]) {
    if (!nextOp.some((item) => catalogKey(item) === catalogKey(id))) nextOp.push(id);
  }
  const nextPart = cats.partCategories.map((item) => item.id);
  if (!nextPart.some((item) => catalogKey(item) === catalogKey("detailing"))) nextPart.push("detailing");
  saveCatalogs({ opcodeCategories: nextOp, partCategories: nextPart });
  const have = new Set(
    db()
      .select()
      .from(opCodes)
      .all()
      .map((row) => String(row.code || "").toUpperCase())
  );
  for (const op of WASH_OP_CODES) {
    if (have.has(op.code)) continue;
    try {
      createOpCode(op);
    } catch {
      /* already exists or catalog write race */
    }
  }
}

function isWashCategory(category) {
  return WASH_CATEGORIES.includes(catalogKey(category));
}

function asWashType(row) {
  if (!row) return null;
  const category = isWashCategory(row.category) ? catalogKey(row.category) : "lavado";
  return {
    id: row.id,
    code: row.code,
    name: row.description,
    category,
    price: Number(row.price) || 0,
    minutes: Math.max(0, Math.round((Number(row.laborHours) || 0) * 60)),
    active: Number(row.active) !== 0,
  };
}

function nextWashCode(category) {
  const prefix = catalogKey(category) === "detailing" ? "DET" : "WASH";
  const used = new Set(
    db()
      .select()
      .from(opCodes)
      .all()
      .map((row) => String(row.code || "").toUpperCase())
  );
  let n = 1;
  while (used.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

function listWashTypes(opts = {}) {
  ensureWashSetup();
  let rows = db()
    .select()
    .from(opCodes)
    .all()
    .filter((row) => isWashCategory(row.category) && !isGone(row));
  if (opts.activeOnly) rows = rows.filter((row) => Number(row.active) !== 0);
  rows.sort((a, b) => {
    const ca = catalogKey(a.category);
    const cb = catalogKey(b.category);
    if (ca !== cb) return ca === "lavado" ? -1 : 1;
    return (Number(a.price) || 0) - (Number(b.price) || 0);
  });
  return rows.map(asWashType);
}

function getWashType(id) {
  const row = db().select().from(opCodes).where(eq(opCodes.id, asId(id))).get();
  if (!row || !isWashCategory(row.category)) return null;
  return asWashType(row);
}

function createWashType(data) {
  ensureWashSetup();
  const name = String(data.name || data.description || "").trim();
  if (!name) throw new Error("Ponle nombre al tipo de lavado");
  const category = catalogKey(data.category) === "detailing" ? "detailing" : "lavado";
  const minutes = data.minutes != null && String(data.minutes).trim() !== "" ? Number(data.minutes) : category === "detailing" ? 90 : 25;
  const laborHours = Number.isFinite(minutes) && minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : category === "detailing" ? 1.5 : 0.4;
  const created = createOpCode({
    code: String(data.code || "").trim() || nextWashCode(category),
    description: name,
    category,
    payType: "cliente",
    laborHours,
    laborRate: 0,
    price: Number(data.price) || 0,
    cost: Number(data.cost) || 0,
    concern: name,
    correction: name,
    popular: data.popular ? 1 : 0,
    active: data.active === 0 || data.active === false ? 0 : 1,
  });
  return asWashType(created);
}

function updateWashType(id, data) {
  const current = getWashType(id);
  if (!current) throw new Error("Tipo de lavado no encontrado");
  const category = data.category != null ? (catalogKey(data.category) === "detailing" ? "detailing" : "lavado") : current.category;
  const minutes = data.minutes != null ? Number(data.minutes) : current.minutes;
  const laborHours = Number.isFinite(minutes) && minutes >= 0 ? Math.round((minutes / 60) * 100) / 100 : current.minutes / 60;
  const updated = updateOpCode(id, {
    description: data.name != null || data.description != null ? String(data.name || data.description || "").trim() : current.name,
    category,
    price: data.price != null ? Number(data.price) || 0 : current.price,
    laborHours,
    laborRate: 0,
    active: data.active != null ? data.active : current.active,
  });
  return asWashType(updated);
}

function removeWashType(id) {
  const current = getWashType(id);
  if (!current) throw new Error("Tipo de lavado no encontrado");
  return removeOpCode(id);
}

function applyWashTypesToOrder(orderId, typeIds, complaint) {
  const ids = [...new Set((Array.isArray(typeIds) ? typeIds : []).map((item) => asId(item)).filter(Boolean))];
  const names = [];
  for (const typeId of ids) {
    const type = getWashType(typeId);
    const raw = db().select().from(opCodes).where(eq(opCodes.id, typeId)).get();
    if (!type || !type.active || isGone(raw)) throw new Error("Tipo de lavado no encontrado");
    addWorkOrderLine(orderId, { type: "labor", opCodeId: type.id, payType: "cliente" });
    names.push(type.name);
  }
  if (names.length && !String(complaint || "").trim()) {
    db().update(workOrders).set({ complaint: names.join(", "), updatedAt: nowIso() }).where(eq(workOrders.id, orderId)).run();
  }
}

function ensureCatalogValue(column, defaults, value, fallback, optional = false) {
  const name = cleanCatalogName(value);
  if (!name) return optional ? "" : fallback;
  const row = readSettingsRow();
  const list = parseCatalogList(row[column], defaults);
  const match = list.find((id) => catalogKey(id) === catalogKey(name));
  if (match) return match;
  patchSettings({ [column]: JSON.stringify([...list, name]) });
  return name;
}

function parseAlts(raw) {
  if (typeof raw === "string" && raw.trim() && !raw.trim().startsWith("[")) {
    return raw
      .split(/[,;]+/)
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean);
  }
  return parseJsonList(raw, (item) => {
    const value = String(typeof item === "string" ? item : item?.number || item?.sku || "").trim().toUpperCase();
    return value || null;
  });
}

function decoratePart(row) {
  if (!row) return null;
  const stock = Number(row.stock) || 0;
  const minStock = Number(row.minStock) || 0;
  const maxStock = Number(row.maxStock) || 0;
  const onOrder = Number(row.onOrder) || 0;
  const cost = Number(row.cost) || 0;
  const price = Number(row.price) || 0;
  const status = pickEnum(row.status, PART_STATUSES, "activo");
  const target = maxStock > 0 ? maxStock : minStock;
  const reorderQty = Math.max(0, target - stock - onOrder);
  const margin = roundMoney(price - cost);
  return {
    ...row,
    alts: parseAlts(row.altsJson),
    status,
    category: String(row.category || "otros").trim() || "otros",
    uom: String(row.uom || "pza").trim() || "pza",
    taxable: row.taxable == null ? 1 : Number(row.taxable),
    specialOrder: Number(row.specialOrder) || 0,
    core: Number(row.core) || 0,
    reorderQty,
    low: status !== "descontinuado" && stock <= minStock,
    margin,
    marginPct: cost > 0 ? Math.round((margin / cost) * 1000) / 10 : 0,
  };
}

function partProfile(data, current = {}) {
  const sku = String(data.sku != null ? data.sku : current.sku || "")
    .trim()
    .toUpperCase();
  const name = data.name != null ? String(data.name).trim() : current.name || "";
  if (!sku || !name) throw new Error("SKU y nombre son obligatorios");
  const alts = data.alts != null ? parseAlts(data.alts) : parseAlts(data.altsJson != null ? data.altsJson : current.altsJson);
  return {
    sku,
    name,
    description: data.description != null ? String(data.description).trim() : current.description || "",
    location: data.location != null ? String(data.location).trim() : current.location || "",
    minStock: data.minStock != null ? Math.max(0, Number(data.minStock) || 0) : Number(current.minStock) || 0,
    maxStock: data.maxStock != null ? Math.max(0, Number(data.maxStock) || 0) : Number(current.maxStock) || 0,
    cost: data.cost != null ? Math.max(0, Number(data.cost) || 0) : Number(current.cost) || 0,
    price: data.price != null ? Math.max(0, Number(data.price) || 0) : Number(current.price) || 0,
    oem: data.oem != null ? String(data.oem).trim().toUpperCase() : current.oem || "",
    altsJson: JSON.stringify(alts),
    brand: data.brand != null ? String(data.brand).trim() : current.brand || "",
    category: ensureCatalogValue("partCategories", PART_CATEGORIES, data.category != null ? data.category : current.category, "otros"),
    vendor: data.vendor != null ? String(data.vendor).trim() : current.vendor || "",
    core: data.core != null ? Math.max(0, Number(data.core) || 0) : Number(current.core) || 0,
    taxable: data.taxable != null ? flag01(data.taxable, 1) : current.taxable == null ? 1 : Number(current.taxable),
    uom: ensureCatalogValue("partUoms", PART_UOMS, data.uom != null ? data.uom : current.uom, "pza"),
    onOrder: data.onOrder != null ? Math.max(0, Number(data.onOrder) || 0) : Number(current.onOrder) || 0,
    status: pickEnum(data.status != null ? data.status : current.status, PART_STATUSES, "activo"),
    specialOrder: data.specialOrder != null ? flag01(data.specialOrder, 0) : Number(current.specialOrder) || 0,
    notes: data.notes != null ? String(data.notes).trim() : current.notes || "",
  };
}

function listParts(q, opts = {}) {
  const query = String(q || "").trim();
  const limit = Number(opts.limit) || 0;
  const filters = [];
  filters.push(alive(parts));
  if (opts.category) filters.push(eq(parts.category, String(opts.category)));
  if (opts.status) filters.push(eq(parts.status, String(opts.status)));
  else if (opts.activeOnly) filters.push(eq(parts.status, "activo"));
  if (query) {
    const p = likePattern(query);
    filters.push(
      or(
        like(parts.sku, p),
        like(parts.name, p),
        like(parts.location, p),
        like(parts.description, p),
        like(parts.oem, p),
        like(parts.altsJson, p),
        like(parts.brand, p),
        like(parts.vendor, p),
        like(parts.id, p)
      )
    );
  }
  let stmt = db().select().from(parts);
  if (filters.length === 1) stmt = stmt.where(filters[0]);
  else if (filters.length > 1) stmt = stmt.where(and(...filters));
  stmt = stmt.orderBy(parts.name);
  let rows = (limit > 0 ? stmt.limit(Math.max(limit * 3, limit)) : stmt).all().map(decoratePart);
  if (opts.low) rows = rows.filter((p) => p.low);
  if (opts.reorder) rows = rows.filter((p) => p.reorderQty > 0);
  return limit > 0 ? rows.slice(0, limit) : rows;
}

function getPart(id) {
  const part = decoratePart(db().select().from(parts).where(eq(parts.id, id)).get());
  if (!part) return null;
  const movements = db()
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.partId, id))
    .orderBy(desc(inventoryMovements.createdAt))
    .all();
  const usage = db()
    .select()
    .from(workOrderLines)
    .where(eq(workOrderLines.partId, id))
    .all()
    .map((line) => {
      const order = db().select().from(workOrders).where(eq(workOrders.id, line.workOrderId)).get();
      if (order && isGone(order)) return null;
      return {
        ...line,
        workOrder: order ? { id: order.id, number: order.number, status: order.status, kind: order.kind || "orden" } : null,
      };
    })
    .filter(Boolean);
  const lastSold = movements.find((m) => m.reason === "taller")?.createdAt || null;
  const lastReceived = movements.find((m) => m.qty > 0 && (m.reason === "recibo" || m.reason === "alta" || m.reason === "entrada"))?.createdAt || null;
  return { ...part, movements, usage, lastSold, lastReceived };
}

function buryDeletedUnique(tableName, column, value) {
  const row = getSqlite().prepare(`SELECT id, deleted FROM ${tableName} WHERE ${column} = ? LIMIT 1`).get(value);
  if (row && Number(row.deleted) === 1) {
    getSqlite()
      .prepare(`UPDATE ${tableName} SET ${column} = ? WHERE id = ?`)
      .run(`${value}~${String(row.id).slice(0, 8)}`, row.id);
  }
}

function createPart(data) {
  const profile = partProfile(data);
  const existing = db().select().from(parts).where(eq(parts.sku, profile.sku)).get();
  if (existing && !isGone(existing)) throw new Error("Ya existe una parte con ese SKU");
  if (existing && isGone(existing)) buryDeletedUnique("parts", "sku", profile.sku);
  const stock = Math.max(0, Number(data.stock) || 0);
  const createdAt = nowIso();
  const id = newGuid();
  db()
    .insert(parts)
    .values({
      ...profile,
      id,
      stock,
      createdAt,
      updatedAt: createdAt,
    })
    .run();
  if (stock > 0) {
    db()
      .insert(inventoryMovements)
      .values({
        id: newGuid(),
        partId: id,
        qty: stock,
        reason: "alta",
        notes: "Stock inicial",
        createdAt,
      })
      .run();
  }
  return getPart(id);
}

function updatePart(id, data) {
  const current = db().select().from(parts).where(eq(parts.id, id)).get();
  if (!current || isGone(current)) throw new Error("Parte no encontrada");
  const profile = partProfile(data, current);
  if (profile.sku !== current.sku) {
    const clash = db().select().from(parts).where(eq(parts.sku, profile.sku)).get();
    if (clash && !isGone(clash)) throw new Error("Ya existe una parte con ese SKU");
    if (clash && isGone(clash)) buryDeletedUnique("parts", "sku", profile.sku);
  }
  const run = getSqlite().transaction(() => {
    db()
      .update(parts)
      .set({ ...profile, updatedAt: nowIso() })
      .where(eq(parts.id, id))
      .run();
    if (data.stock != null && data.stock !== "") {
      const next = Math.max(0, Number(data.stock) || 0);
      const delta = next - Number(current.stock || 0);
      if (delta) {
        db().update(parts).set({ stock: next, updatedAt: nowIso() }).where(eq(parts.id, id)).run();
        db()
          .insert(inventoryMovements)
          .values({
            id: newGuid(),
            partId: id,
            qty: delta,
            reason: "correccion",
            notes: "OH",
            createdAt: nowIso(),
          })
          .run();
      }
    }
  });
  run();
  return getPart(id);
}

function adjustPartStock(id, data) {
  const current = db().select().from(parts).where(eq(parts.id, id)).get();
  if (!current || isGone(current)) throw new Error("Parte no encontrada");
  const qty = Number(data.qty);
  if (!qty || qty === 0) throw new Error("La cantidad no puede ser 0");
  const next = current.stock + qty;
  if (next < 0) throw new Error("Stock insuficiente");
  const reason = pickEnum(data.reason, PART_ADJUST_REASONS, qty > 0 ? "entrada" : "correccion");
  const run = getSqlite().transaction(() => {
    db().update(parts).set({ stock: next, updatedAt: nowIso() }).where(eq(parts.id, id)).run();
    db()
      .insert(inventoryMovements)
      .values({
        id: newGuid(),
        partId: id,
        qty,
        reason,
        notes: String(data.notes || "").trim(),
        createdAt: nowIso(),
      })
      .run();
  });
  run();
  return getPart(id);
}

function receivePart(id, data = {}) {
  const current = db().select().from(parts).where(eq(parts.id, id)).get();
  if (!current || isGone(current)) throw new Error("Parte no encontrada");
  const qty = Math.floor(Number(data.qty));
  if (!qty || qty <= 0) throw new Error("La cantidad a recibir debe ser mayor a 0");
  const cost = data.cost != null && data.cost !== "" ? Math.max(0, Number(data.cost) || 0) : Number(current.cost) || 0;
  const onOrder = Math.max(0, Number(current.onOrder || 0) - qty);
  const patch = {
    stock: Number(current.stock) + qty,
    onOrder,
    cost,
    updatedAt: nowIso(),
  };
  if (data.vendor != null && String(data.vendor).trim()) patch.vendor = String(data.vendor).trim();
  const run = getSqlite().transaction(() => {
    db().update(parts).set(patch).where(eq(parts.id, id)).run();
    db()
      .insert(inventoryMovements)
      .values({
        id: newGuid(),
        partId: id,
        qty,
        reason: "recibo",
        notes: String(data.notes || data.vendor || "").trim() || "Recibo de proveedor",
        createdAt: nowIso(),
      })
      .run();
  });
  run();
  return getPart(id);
}

function orderPart(id, data = {}) {
  const current = db().select().from(parts).where(eq(parts.id, id)).get();
  if (!current || isGone(current)) throw new Error("Parte no encontrada");
  const qty = Math.floor(Number(data.qty));
  if (!qty || qty <= 0) throw new Error("La cantidad a pedir debe ser mayor a 0");
  const patch = {
    onOrder: Number(current.onOrder || 0) + qty,
    updatedAt: nowIso(),
  };
  if (data.vendor != null && String(data.vendor).trim()) patch.vendor = String(data.vendor).trim();
  db().update(parts).set(patch).where(eq(parts.id, id)).run();
  return getPart(id);
}

function restorePart(id, data) {
  db().update(parts).set({ deleted: 0, updatedAt: nowIso() }).where(eq(parts.id, id)).run();
  return updatePart(id, data);
}

function removePart(id) {
  const current = db().select().from(parts).where(eq(parts.id, id)).get();
  if (!current) throw new Error("Parte no encontrada");
  if (isGone(current)) return { id };
  return markDeleted(parts, id, { updatedAt: nowIso() });
}

function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeWoPrefix(value) {
  const raw = String(value || "OT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return raw || "OT";
}

function woPadOf(row) {
  return clampInt(row?.woPad, 3, 8, 4);
}

function formatWorkOrderNumber(prefix, n, pad) {
  return `${sanitizeWoPrefix(prefix)}-${String(Math.max(1, Number(n) || 1)).padStart(woPadOf({ woPad: pad }), "0")}`;
}

function findWorkOrderByNumber(number) {
  return db().select().from(workOrders).where(eq(workOrders.number, number)).get();
}

function serviceModeOf(row) {
  return String(row?.serviceMode || "").toLowerCase() === "sencillo" ? "sencillo" : "completo";
}

function isSimpleShop() {
  return serviceModeOf(readSettingsRow()) === "sencillo";
}

function isWashOrder(order) {
  return (order?.serviceLine || "taller") === "lavado";
}

function isSimpleOrder(order) {
  return isSimpleShop() || isWashOrder(order);
}

function readSettingsRow() {
  let row = db().select().from(shopSettings).get();
  if (!row) {
    const id = newGuid();
    db()
      .insert(shopSettings)
      .values({
        id,
        name: "Dealer DMS",
        phone: "",
        email: "",
        address: "",
        taxLabel: "GST",
        taxRate: 5,
        gstNumber: "",
        woPrefix: "OT",
        woNextNumber: 1,
        woPad: 4,
        laborRate: 145,
        invoiceNotes: "Prices in CAD. GST 5% (Alberta — no provincial sales tax).",
        serviceMode: "completo",
        allowUpdates: 0,
        offerWash: 0,
      })
      .run();
    row = db().select().from(shopSettings).where(eq(shopSettings.id, id)).get();
  }
  return {
    ...row,
    woPrefix: sanitizeWoPrefix(row.woPrefix),
    woNextNumber: Math.max(1, Number(row.woNextNumber) || 1),
    woPad: woPadOf(row),
    serviceMode: serviceModeOf(row),
    allowUpdates: Number(row.allowUpdates) === 1 ? 1 : 0,
    offerWash: Number(row.offerWash) === 1 ? 1 : 0,
    offerPartInvoices: Number(row.offerPartInvoices) === 1 ? 1 : 0,
    offerTax: row.offerTax == null ? 1 : Number(row.offerTax) === 1 ? 1 : 0,
    estPrefix: sanitizeWoPrefix(row.estPrefix || "PRE"),
    estNextNumber: Math.max(1, Number(row.estNextNumber) || 1),
    washPrefix: sanitizeWoPrefix(row.washPrefix || "DET"),
    washNextNumber: Math.max(1, Number(row.washNextNumber) || 1),
    piPrefix: sanitizeWoPrefix(row.piPrefix || "PI"),
    piNextNumber: Math.max(1, Number(row.piNextNumber) || 1),
  };
}

function updatesAllowed() {
  return Number(readSettingsRow().allowUpdates) === 1;
}

function offerWashOn() {
  return Number(readSettingsRow().offerWash) === 1;
}

function offerPartInvoicesOn() {
  return Number(readSettingsRow().offerPartInvoices) === 1;
}

function offerTaxOn() {
  const row = readSettingsRow();
  return row.offerTax == null ? true : Number(row.offerTax) === 1;
}

function setUpdatesAllowed(on) {
  patchSettings({ allowUpdates: on ? 1 : 0 });
  return updatesAllowed();
}

function patchSettings(values) {
  const row = readSettingsRow();
  db().update(shopSettings).set(values).where(eq(shopSettings.id, row.id)).run();
}

function peekSeriesNumber(prefix, nextNumber, pad) {
  const safePrefix = sanitizeWoPrefix(prefix);
  const safePad = woPadOf({ woPad: pad });
  let n = Math.max(1, Number(nextNumber) || 1);
  let number = formatWorkOrderNumber(safePrefix, n, safePad);
  while (findWorkOrderByNumber(number)) {
    n += 1;
    number = formatWorkOrderNumber(safePrefix, n, safePad);
  }
  return { number, nextNumber: n, prefix: safePrefix, pad: safePad };
}

function seriesForWorkOrder(kind, serviceLine) {
  const settings = readSettingsRow();
  if (kind === "presupuesto") {
    return { prefix: settings.estPrefix || "PRE", nextKey: "estNextNumber", nextNumber: settings.estNextNumber };
  }
  if (kind === "factura_partes") {
    return { prefix: settings.piPrefix || "PI", nextKey: "piNextNumber", nextNumber: settings.piNextNumber };
  }
  if (serviceLine === "lavado") {
    return { prefix: settings.washPrefix || "DET", nextKey: "washNextNumber", nextNumber: settings.washNextNumber };
  }
  return { prefix: settings.woPrefix, nextKey: "woNextNumber", nextNumber: settings.woNextNumber };
}

function peekNextWorkOrderNumber(row, kind = "orden", serviceLine = "taller") {
  const settings = row || readSettingsRow();
  const series = seriesForWorkOrder(kind, serviceLine);
  return peekSeriesNumber(series.prefix, series.nextNumber, settings.woPad);
}

function nextWorkOrderNumber(kind = "orden", serviceLine = "taller") {
  const settings = readSettingsRow();
  const series = seriesForWorkOrder(kind, serviceLine);
  const peek = peekSeriesNumber(series.prefix, series.nextNumber, settings.woPad);
  patchSettings({ [series.nextKey]: peek.nextNumber + 1 });
  return peek.number;
}

function normalizeWoNumber(raw) {
  const settings = readSettingsRow();
  const pad = woPadOf(settings);
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const tagged = s.match(/^([A-Z0-9]{1,8})-(\d{1,8})$/);
  if (tagged) return formatWorkOrderNumber(tagged[1], Number(tagged[2]), pad);
  const digits = s.replace(/\D/g, "");
  if (!digits) throw new Error("Usa un número como OT-0042");
  return formatWorkOrderNumber(settings.woPrefix, Number(digits), pad);
}

function lineTotal(line) {
  return Number(line.qty || 0) * Number(line.unitPrice || 0);
}

function lineCost(line) {
  return Number(line.qty || 0) * Number(line.unitCost || 0);
}

const WO_STATUSES = ["recepcion", "autorizacion", "espera_partes", "en_taller", "en_espera", "lista", "entregada"];
const WO_KINDS = ["orden", "presupuesto", "factura_partes"];
const WO_SERVICE_LINES = ["taller", "lavado"];
const LINE_PAYS = ["cliente", "garantia", "interno", "sublet"];

function isEstimate(order) {
  return (order?.kind || "orden") === "presupuesto";
}

function lineBillable(line) {
  if (Number(line.authorized) === 0) return false;
  const pay = line.payType || "cliente";
  return pay === "cliente" || pay === "sublet";
}

function partTaxMap(lines) {
  const map = new Map();
  for (const line of lines || []) {
    if (line.type !== "part" || !line.partId || map.has(line.partId)) continue;
    const part = db().select().from(parts).where(eq(parts.id, line.partId)).get();
    map.set(line.partId, !part || part.taxable == null ? 1 : Number(part.taxable));
  }
  return map;
}

function workOrderTotals(order, lines, taxMap) {
  const rows = lines || [];
  const authorized = rows.filter((l) => Number(l.authorized) !== 0);
  const billable = authorized.filter(lineBillable);
  const warranty = authorized.filter((l) => (l.payType || "cliente") === "garantia");
  const internal = authorized.filter((l) => (l.payType || "cliente") === "interno");
  const declined = rows.filter((l) => Number(l.authorized) === 0);
  const subtotal = billable.reduce((s, l) => s + lineTotal(l), 0);
  const discountPct = Number(order.discountPct || 0);
  const discount = roundMoney(subtotal * (discountPct / 100));
  const map = taxMap || partTaxMap(rows);
  const taxableSub = billable.reduce((s, l) => {
    if (l.type === "part" && l.partId && Number(map.get(l.partId)) === 0) return s;
    return s + lineTotal(l);
  }, 0);
  const taxable = roundMoney(Math.max(0, taxableSub * (1 - discountPct / 100)));
  const taxRate = Number(order.taxRate || 0);
  const tax = roundMoney(taxable * (taxRate / 100));
  const total = roundMoney(Math.max(0, subtotal - discount) + tax);
  const cost = billable.reduce((s, l) => s + lineCost(l), 0);
  return {
    subtotal: roundMoney(subtotal),
    discount,
    discountPct,
    tax,
    taxRate,
    total,
    cost: roundMoney(cost),
    margin: roundMoney(total - cost),
    warrantyTotal: roundMoney(warranty.reduce((s, l) => s + lineTotal(l), 0)),
    internalTotal: roundMoney(internal.reduce((s, l) => s + lineTotal(l), 0)),
    declinedTotal: roundMoney(declined.reduce((s, l) => s + lineTotal(l), 0)),
  };
}

function lightWorkOrder(order) {
  if (!order) return null;
  const lines = db().select().from(workOrderLines).where(eq(workOrderLines.workOrderId, order.id)).all();
  const payments = db().select().from(workOrderPayments).where(eq(workOrderPayments.workOrderId, order.id)).all();
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totals = workOrderTotals(order, lines);
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    kind: order.kind || "orden",
    serviceLine: order.serviceLine || "taller",
    complaint: order.complaint,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    paid,
    balance: roundMoney(totals.total - paid),
    ...totals,
  };
}

function decorateWorkOrderLine(line, opcode) {
  return {
    ...line,
    payType: line.payType || "cliente",
    authorized: line.authorized == null ? 1 : Number(line.authorized),
    complaint: line.complaint || opcode?.concern || "",
    cause: line.cause || opcode?.cause || "",
    correction: line.correction || opcode?.correction || "",
    opcode: opcode || null,
  };
}

function attachWorkOrders(orders, opts = {}) {
  const list = (orders || []).filter(Boolean);
  if (!list.length) return [];
  const lite = Boolean(opts.lite);
  const customerBy = new Map(fetchByIds(customers, customers.id, list.map((o) => o.customerId)).map((row) => [row.id, withPhones(row)]));
  const vehicleBy = new Map(
    fetchByIds(vehicles, vehicles.id, list.map((o) => o.vehicleId)).map((row) => {
      const vin = vinMeta(row.vin);
      return [
        row.id,
        {
          ...row,
          vinCheckOk: vin.checkOk,
          inspectionOverdue: dateOverdue(row.inspectionDue),
          licenseOverdue: dateOverdue(row.licenseExpiry),
        },
      ];
    })
  );
  const techBy = new Map(fetchByIds(users, users.id, list.map((o) => o.techUserId)).map((row) => [row.id, row]));
  const allLines = fetchByIds(workOrderLines, workOrderLines.workOrderId, list.map((o) => o.id));
  const linesBy = groupBy(allLines, "workOrderId");
  const payBy = groupBy(fetchByIds(workOrderPayments, workOrderPayments.workOrderId, list.map((o) => o.id)), "workOrderId");
  const opBy = lite
    ? new Map()
    : new Map(fetchByIds(opCodes, opCodes.id, allLines.map((l) => l.opCodeId)).map((row) => [row.id, row]));
  const taxMap = new Map(
    fetchByIds(
      parts,
      parts.id,
      allLines.filter((l) => l.type === "part").map((l) => l.partId)
    ).map((p) => [p.id, p.taxable == null ? 1 : Number(p.taxable)])
  );
  const now = nowIso();
  return list.map((order) => {
    const rawLines = linesBy.get(order.id) || [];
    const lines = lite ? rawLines : rawLines.map((line) => decorateWorkOrderLine(line, line.opCodeId ? opBy.get(line.opCodeId) : null));
    const payments = (payBy.get(order.id) || [])
      .slice()
      .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
    const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totals = workOrderTotals(order, lines, taxMap);
    const balance = roundMoney(totals.total - paid);
    const tech = order.techUserId ? techBy.get(order.techUserId) : null;
    return {
      ...order,
      kind: order.kind || "orden",
      serviceLine: order.serviceLine || "taller",
      priority: order.priority || "normal",
      customer: customerBy.get(order.customerId) || null,
      vehicle: vehicleBy.get(order.vehicleId) || null,
      tech: tech ? { id: tech.id, name: tech.name, username: tech.username, laborRate: Number(tech.laborRate) || 0 } : null,
      lines: lite ? [] : lines,
      payments: lite ? [] : payments,
      paid,
      balance,
      overdue: Boolean(order.promisedAt && order.status !== "entregada" && order.status !== "lista" && order.promisedAt < now),
      ...totals,
    };
  });
}

function attachWorkOrder(order) {
  return attachWorkOrders([order])[0] || null;
}

function listWorkOrders(q, opts = {}) {
  const filters = [];
  if (opts.deleted) filters.push(eq(workOrders.deleted, 1));
  else filters.push(alive(workOrders));
  if (opts.kind) filters.push(eq(workOrders.kind, String(opts.kind)));
  if (opts.serviceLine === "lavado") {
    filters.push(eq(workOrders.serviceLine, "lavado"));
  } else if (opts.serviceLine === "taller") {
    filters.push(eq(workOrders.serviceLine, "taller"));
    if (!opts.kind) filters.push(ne(workOrders.kind, "factura_partes"));
  }
  if (opts.status) filters.push(eq(workOrders.status, String(opts.status)));
  if (opts.techUserId) filters.push(eq(workOrders.techUserId, asId(opts.techUserId)));
  if (opts.open) filters.push(ne(workOrders.status, "entregada"));
  let stmt = db().select().from(workOrders);
  if (filters.length === 1) stmt = stmt.where(filters[0]);
  else if (filters.length > 1) stmt = stmt.where(and(...filters));
  let rows = stmt.orderBy(desc(workOrders.createdAt)).all();
  const query = String(q || "").trim().toLowerCase();
  const limit = Number(opts.limit) || 0;
  if (!query && !opts.unpaid && !opts.overdue) {
    const cap = limit > 0 ? limit : opts.open ? 0 : 200;
    if (cap > 0 && rows.length > cap) rows = rows.slice(0, cap);
  }
  let detailed = attachWorkOrders(rows, { lite: !opts.full });
  if (opts.unpaid) detailed = detailed.filter((o) => o.kind !== "presupuesto" && Number(o.balance) > 0.009);
  if (opts.overdue) detailed = detailed.filter((o) => o.overdue);
  if (query) {
    detailed = detailed.filter((o) => {
      const hay = `${o.number} ${o.id || ""} ${o.customer?.name || ""} ${o.customer?.company || ""} ${o.vehicle?.make || ""} ${o.vehicle?.model || ""} ${o.vehicle?.plate || ""} ${o.vehicle?.vin || ""} ${o.status} ${o.kind} ${o.serviceLine || ""} ${o.complaint} ${o.poNumber || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }
  return limit > 0 ? detailed.slice(0, limit) : detailed;
}

function getWorkOrder(id) {
  const attached = attachWorkOrder(db().select().from(workOrders).where(eq(workOrders.id, id)).get());
  if (!attached) return null;
  const history = attached.vehicleId
    ? db()
        .select()
        .from(workOrders)
        .where(eq(workOrders.vehicleId, attached.vehicleId))
        .orderBy(desc(workOrders.createdAt))
        .all()
        .filter((o) => o.id !== attached.id && !isGone(o))
        .slice(0, 6)
        .map(lightWorkOrder)
    : [];
  return { ...attached, history };
}

function createWorkOrder(data) {
  const customerId = asId(data.customerId);
  const kind = pickEnum(data.kind, WO_KINDS, "orden");
  const serviceLine = pickEnum(data.serviceLine, WO_SERVICE_LINES, "taller");
  const partInvoice = kind === "factura_partes";
  const vehicleId = partInvoice ? "" : asId(data.vehicleId);
  const customer = db().select().from(customers).where(eq(customers.id, customerId)).get();
  assertCustomerCanTransact(customer);
  const vehicle = partInvoice ? null : getVehicle(vehicleId);
  if (!partInvoice && (!vehicle || isGone(vehicle))) throw new Error("Vehículo no encontrado");
  if (!partInvoice && vehicle.customerId && asId(vehicle.customerId) !== customerId) {
    throw new Error("Ese vehículo pertenece a otro cliente");
  }
  const settings = getSettings();
  const kmIn = partInvoice ? 0 : data.kmIn != null ? Number(data.kmIn) || 0 : Number(vehicle.km) || 0;
  const createdAt = nowIso();
  const id = newGuid();
  const simple = (settings.serviceMode === "sencillo" || serviceLine === "lavado" || partInvoice) && kind !== "presupuesto";
  const taxRate = data.taxExempt || Number(customer.taxExempt) || !offerTaxOn() ? 0 : customerTaxRate(customer, settings);
  const run = getSqlite().transaction(() => {
    if (!partInvoice && !vehicle.customerId) {
      db().update(vehicles).set({ customerId }).where(eq(vehicles.id, vehicleId)).run();
    }
    db()
      .insert(workOrders)
      .values({
        id,
        number: nextWorkOrderNumber(kind, serviceLine),
        customerId,
        vehicleId: partInvoice ? null : vehicleId,
        status: simple ? "en_taller" : "recepcion",
        kind,
        serviceLine: partInvoice ? "taller" : serviceLine,
        complaint: String(data.complaint || "").trim(),
        cause: String(data.cause || "").trim(),
        correction: String(data.correction || "").trim(),
        notes: String(data.notes || "").trim(),
        kmIn,
        kmOut: Number(data.kmOut) || 0,
        promisedAt: data.promisedAt ? String(data.promisedAt) : null,
        techUserId: data.techUserId ? asId(data.techUserId) : null,
        taxRate,
        discountPct: clampPct(data.discountPct != null ? data.discountPct : customer.discountPct),
        waiter: flag01(data.waiter, 0),
        priority: pickEnum(data.priority, ["normal", "urgente"], "normal"),
        poNumber: String(data.poNumber || "").trim(),
        authorizedAt: simple ? createdAt : null,
        authorizedBy: simple ? (serviceLine === "lavado" ? "lavado" : "taller") : "",
        holdReason: "",
        createdAt,
        updatedAt: createdAt,
      })
      .run();
    if (!partInvoice && kmIn > Number(vehicle.km || 0)) {
      db().update(vehicles).set({ km: kmIn }).where(eq(vehicles.id, vehicleId)).run();
    }
    return id;
  });
  run();
  if (Array.isArray(data.washTypeIds) && data.washTypeIds.length) {
    applyWashTypesToOrder(id, data.washTypeIds, data.complaint);
  }
  return getWorkOrder(id);
}

function updateWorkOrder(id, data) {
  const current = db().select().from(workOrders).where(eq(workOrders.id, id)).get();
  if (!current || isGone(current)) throw new Error("Orden no encontrada");
  if (current.status === "entregada") throw new Error("La orden ya fue entregada");
  db()
    .update(workOrders)
    .set({
      complaint: data.complaint != null ? String(data.complaint).trim() : current.complaint,
      cause: data.cause != null ? String(data.cause).trim() : current.cause || "",
      correction: data.correction != null ? String(data.correction).trim() : current.correction || "",
      notes: data.notes != null ? String(data.notes).trim() : current.notes,
      status: data.status != null ? pickEnum(data.status, WO_STATUSES, current.status) : current.status,
      serviceLine: data.serviceLine != null ? pickEnum(data.serviceLine, WO_SERVICE_LINES, current.serviceLine || "taller") : current.serviceLine || "taller",
      kmIn: data.kmIn != null ? Number(data.kmIn) || 0 : current.kmIn,
      kmOut: data.kmOut != null ? Number(data.kmOut) || 0 : current.kmOut || 0,
      promisedAt: data.promisedAt !== undefined ? (data.promisedAt ? String(data.promisedAt) : null) : current.promisedAt,
      techUserId: data.techUserId !== undefined ? (data.techUserId ? asId(data.techUserId) : null) : current.techUserId,
      discountPct: data.discountPct != null ? clampPct(data.discountPct) : current.discountPct || 0,
      waiter: data.waiter != null ? flag01(data.waiter) : current.waiter || 0,
      priority: data.priority != null ? pickEnum(data.priority, ["normal", "urgente"], current.priority || "normal") : current.priority || "normal",
      poNumber: data.poNumber != null ? String(data.poNumber).trim() : current.poNumber || "",
      holdReason: data.holdReason != null ? String(data.holdReason).trim() : current.holdReason || "",
      taxRate: data.taxExempt
        ? 0
        : data.taxExempt === false
          ? customerTaxRate(
              db().select().from(customers).where(eq(customers.id, current.customerId)).get(),
              getSettings()
            )
          : data.taxRate != null
            ? Math.max(0, Number(data.taxRate) || 0)
            : current.taxRate,
      updatedAt: nowIso(),
    })
    .where(eq(workOrders.id, id))
    .run();
  return getWorkOrder(id);
}

function setWorkOrderStatus(id, status) {
  if (!WO_STATUSES.includes(status)) throw new Error("Estado no válido");
  const current = db().select().from(workOrders).where(eq(workOrders.id, id)).get();
  if (!current || isGone(current)) throw new Error("Orden no encontrada");
  if (current.status === "entregada") throw new Error("La orden ya fue entregada");
  if (isEstimate(current) && status !== "recepcion" && status !== "autorizacion") {
    throw new Error("Convierte el presupuesto a OT para avanzar el taller");
  }
  if (status === "entregada") return deliverWorkOrder(id);
  const patch = { status, updatedAt: nowIso() };
  if (isSimpleOrder(current) && !isEstimate(current) && !current.authorizedAt) {
    patch.authorizedAt = nowIso();
    patch.authorizedBy = current.authorizedBy || (isWashOrder(current) ? "lavado" : "taller");
  }
  db().update(workOrders).set(patch).where(eq(workOrders.id, id)).run();
  return getWorkOrder(id);
}

function authorizeWorkOrder(id, data = {}) {
  const current = db().select().from(workOrders).where(eq(workOrders.id, id)).get();
  if (!current) throw new Error("Orden no encontrada");
  if (current.status === "entregada") throw new Error("La orden ya fue entregada");
  const by = String(data.authorizedBy || data.userName || "").trim();
  const nextStatus = current.status === "recepcion" || current.status === "autorizacion" ? "autorizacion" : current.status;
  db()
    .update(workOrders)
    .set({
      authorizedAt: nowIso(),
      authorizedBy: by,
      status: isEstimate(current) ? current.status : nextStatus,
      updatedAt: nowIso(),
    })
    .where(eq(workOrders.id, id))
    .run();
  return getWorkOrder(id);
}

function consumePartStock(order, lineId, part, qty) {
  const want = Number(qty) || 0;
  if (want <= 0) return;
  const stock = Number(part.stock) || 0;
  if (stock >= want) {
    /* take full qty */
  } else if (Number(part.specialOrder) && stock <= 0) {
    return;
  } else if (Number(part.specialOrder)) {
    throw new Error(`Hay ${stock} de ${part.name} en OH y pediste ${want}. Baja la cantidad o espera el pedido.`);
  } else {
    throw new Error(`Stock insuficiente de ${part.name} (${stock} disp.)`);
  }
  db().update(parts).set({ stock: stock - want, updatedAt: nowIso() }).where(eq(parts.id, part.id)).run();
  db()
    .insert(inventoryMovements)
    .values({
      id: newGuid(),
      partId: part.id,
      qty: -want,
      reason: "taller",
      workOrderLineId: lineId,
      notes: `OT ${order.number}`,
      createdAt: nowIso(),
    })
    .run();
}

function lineStockTaken(lineId) {
  const rows = db().select().from(inventoryMovements).where(eq(inventoryMovements.workOrderLineId, lineId)).all();
  const net = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
  return Math.max(0, -net);
}

function restorePartStock(order, line, qty) {
  if (line.type !== "part" || !line.partId) return;
  const outstanding = lineStockTaken(line.id);
  const requested = qty != null ? Number(qty) : outstanding;
  const take = Math.min(outstanding, Number.isFinite(requested) ? requested : 0);
  if (!(take > 0)) return;
  const part = db().select().from(parts).where(eq(parts.id, line.partId)).get();
  if (!part) return;
  db()
    .update(parts)
    .set({ stock: part.stock + take, updatedAt: nowIso() })
    .where(eq(parts.id, line.partId))
    .run();
  db()
    .insert(inventoryMovements)
    .values({
      id: newGuid(),
      partId: line.partId,
      qty: take,
      reason: "devolucion",
      workOrderLineId: line.id,
      notes: `Reverso OT ${order.number}`,
      createdAt: nowIso(),
    })
    .run();
}

function detachLineInventory(lineId) {
  getSqlite().prepare("UPDATE inventory_movements SET work_order_line_id = NULL WHERE work_order_line_id = ?").run(lineId);
}

function addWorkOrderLine(id, data) {
  const order = db().select().from(workOrders).where(eq(workOrders.id, id)).get();
  if (!order || isGone(order)) throw new Error("Orden no encontrada");
  if (order.status === "entregada") throw new Error("La orden ya fue entregada");
  const type = data.type === "part" ? "part" : "labor";
  if (data.qty != null && data.qty !== "" && !(Number(data.qty) > 0)) {
    throw new Error("La cantidad debe ser mayor a 0");
  }
  const qty = Number(data.qty) || 1;
  const estimate = isEstimate(order);

  const run = getSqlite().transaction(() => {
    let description = String(data.description || "").trim();
    let unitPrice = Number(data.unitPrice) || 0;
    let unitCost = Number(data.unitCost) || 0;
    let partId = null;
    let opCodeId = data.opCodeId ? asId(data.opCodeId) : null;
    let payType = pickEnum(data.payType, LINE_PAYS, "cliente");
    const authorized = data.authorized == null ? 1 : flag01(data.authorized, 1);

    if (type === "part") {
      partId = asId(data.partId);
      const part = db().select().from(parts).where(eq(parts.id, partId)).get();
      if (!part || isGone(part)) throw new Error("Parte no encontrada");
      if (!estimate && part.stock < qty && !Number(part.specialOrder)) {
        throw new Error(`Stock insuficiente de ${part.name} (${part.stock} disp.)`);
      }
      description = description || part.name;
      unitPrice = data.unitPrice != null ? Number(data.unitPrice) : Number(part.price);
      unitCost = data.unitCost != null ? Number(data.unitCost) : Number(part.cost);
      const lineId = newGuid();
      db()
        .insert(workOrderLines)
        .values({
          id: lineId,
          workOrderId: id,
          type,
          description,
          partId,
          opCodeId: null,
          qty,
          unitPrice,
          unitCost,
          payType,
          authorized,
          complaint: "",
          cause: "",
          correction: "",
        })
        .run();
      if (!estimate) consumePartStock(order, lineId, part, qty);
      return;
    }

    let hours = qty;
    let complaint = String(data.complaint || "").trim();
    let cause = String(data.cause || "").trim();
    let correction = String(data.correction || "").trim();
    let bundled = [];
    if (opCodeId) {
      const op = getOpCode(opCodeId);
      if (!op || isGone(op) || !op.active) throw new Error("Op Code no encontrado o inactivo");
      description = description || `${op.code} · ${op.description}`;
      hours = data.qty != null ? Number(data.qty) : Number(op.laborHours) || 1;
      unitPrice = data.unitPrice != null ? Number(data.unitPrice) : Number(op.price) || Number(op.laborHours) * Number(op.laborRate);
      unitCost = data.unitCost != null ? Number(data.unitCost) : Number(op.cost) || 0;
      payType = pickEnum(data.payType || op.payType, LINE_PAYS, "cliente");
      complaint = complaint || op.concern || "";
      cause = cause || op.cause || "";
      correction = correction || op.correction || "";
      bundled = op.parts || [];
      const patch = {};
      if (!order.complaint && complaint) patch.complaint = complaint;
      if (!order.cause && cause) patch.cause = cause;
      if (!order.correction && correction) patch.correction = correction;
      if (Object.keys(patch).length) db().update(workOrders).set(patch).where(eq(workOrders.id, id)).run();
    }

    if (!description) throw new Error("Describe la mano de obra o elige un Op Code");
    db()
      .insert(workOrderLines)
      .values({
        id: newGuid(),
        workOrderId: id,
        type,
        description,
        partId: null,
        opCodeId,
        qty: hours,
        unitPrice,
        unitCost,
        payType,
        authorized,
        complaint,
        cause,
        correction,
      })
      .run();

    for (const bundle of bundled) {
      const part = db().select().from(parts).where(eq(parts.id, bundle.partId)).get();
      if (!part || isGone(part)) throw new Error("Parte del Op Code no encontrada");
      const partQty = Number(bundle.qty) > 0 ? Number(bundle.qty) : 1;
      if (!estimate && part.stock < partQty && !Number(part.specialOrder)) {
        throw new Error(`Stock insuficiente de ${part.name} (${part.stock} disp.)`);
      }
      const partLineId = newGuid();
      db()
        .insert(workOrderLines)
        .values({
          id: partLineId,
          workOrderId: id,
          type: "part",
          description: part.name,
          partId: part.id,
          opCodeId,
          qty: partQty,
          unitPrice: Number(part.price) || 0,
          unitCost: Number(part.cost) || 0,
          payType,
          authorized,
          complaint: "",
          cause: "",
          correction: "",
        })
        .run();
      if (!estimate) consumePartStock(order, partLineId, part, partQty);
    }
  });
  run();
  return getWorkOrder(id);
}

function updateWorkOrderLine(lineId, data) {
  const line = db().select().from(workOrderLines).where(eq(workOrderLines.id, lineId)).get();
  if (!line) throw new Error("Línea no encontrada");
  const order = db().select().from(workOrders).where(eq(workOrders.id, line.workOrderId)).get();
  if (!order || isGone(order) || order.status === "entregada") throw new Error("No se puede modificar una orden entregada");
  const authorized = data.authorized != null ? flag01(data.authorized, Number(line.authorized) || 1) : line.authorized == null ? 1 : Number(line.authorized);
  const payType = data.payType != null ? pickEnum(data.payType, LINE_PAYS, line.payType || "cliente") : line.payType || "cliente";
  const wasAuthorized = Number(line.authorized) !== 0;
  const nowAuthorized = Number(authorized) !== 0;
  if (data.qty != null && data.qty !== "" && !(Number(data.qty) > 0)) {
    throw new Error("La cantidad debe ser mayor a 0");
  }
  const nextQty = data.qty != null && data.qty !== "" ? Number(data.qty) : Number(line.qty);
  const run = getSqlite().transaction(() => {
    if (!isEstimate(order) && line.type === "part" && line.partId) {
      if (wasAuthorized && !nowAuthorized) {
        restorePartStock(order, line, Number(line.qty));
      } else if (!wasAuthorized && nowAuthorized) {
        const part = db().select().from(parts).where(eq(parts.id, line.partId)).get();
        if (!part) throw new Error("Parte no encontrada");
        consumePartStock(order, line.id, part, nextQty);
      } else if (wasAuthorized && nowAuthorized && nextQty !== Number(line.qty)) {
        const delta = nextQty - Number(line.qty);
        const part = db().select().from(parts).where(eq(parts.id, line.partId)).get();
        if (!part) throw new Error("Parte no encontrada");
        if (delta > 0) consumePartStock(order, line.id, part, delta);
        else restorePartStock(order, line, -delta);
      }
    }
    db()
      .update(workOrderLines)
      .set({
        authorized,
        payType,
        description: data.description != null ? String(data.description).trim() : line.description,
        qty: nextQty,
        unitPrice: data.unitPrice != null ? Number(data.unitPrice) : line.unitPrice,
        complaint: data.complaint != null ? String(data.complaint).trim() : line.complaint || "",
        cause: data.cause != null ? String(data.cause).trim() : line.cause || "",
        correction: data.correction != null ? String(data.correction).trim() : line.correction || "",
      })
      .where(eq(workOrderLines.id, lineId))
      .run();
  });
  run();
  return getWorkOrder(line.workOrderId);
}

function convertEstimate(id) {
  const order = db().select().from(workOrders).where(eq(workOrders.id, id)).get();
  if (!order || isGone(order)) throw new Error("Orden no encontrada");
  if (!isEstimate(order)) throw new Error("Esa orden ya no es presupuesto");
  const lines = db().select().from(workOrderLines).where(eq(workOrderLines.workOrderId, id)).all();
  const run = getSqlite().transaction(() => {
    for (const line of lines) {
      if (line.type !== "part" || !line.partId || Number(line.authorized) === 0) continue;
      const part = db().select().from(parts).where(eq(parts.id, line.partId)).get();
      if (!part) throw new Error("Parte no encontrada");
      consumePartStock(order, line.id, part, Number(line.qty));
    }
    db()
      .update(workOrders)
      .set({
        kind: "orden",
        number: nextWorkOrderNumber("orden", order.serviceLine || "taller"),
        status: isSimpleOrder(order) || order.authorizedAt ? "en_taller" : "recepcion",
        authorizedAt: isSimpleOrder(order) ? order.authorizedAt || nowIso() : order.authorizedAt,
        authorizedBy: isSimpleOrder(order) ? order.authorizedBy || (isWashOrder(order) ? "lavado" : "taller") : order.authorizedBy,
        updatedAt: nowIso(),
      })
      .where(eq(workOrders.id, id))
      .run();
  });
  run();
  return getWorkOrder(id);
}

function removeWorkOrderLine(lineId) {
  const line = db().select().from(workOrderLines).where(eq(workOrderLines.id, lineId)).get();
  if (!line) throw new Error("Línea no encontrada");
  const order = db().select().from(workOrders).where(eq(workOrders.id, line.workOrderId)).get();
  if (!order || isGone(order) || order.status === "entregada") throw new Error("No se puede modificar una orden entregada");

  const run = getSqlite().transaction(() => {
    if (!isEstimate(order) && Number(line.authorized) !== 0) restorePartStock(order, line);
    detachLineInventory(lineId);
    db().delete(workOrderLines).where(eq(workOrderLines.id, lineId)).run();
  });
  run();
  return getWorkOrder(line.workOrderId);
}

function archiveRecord(tableName, recordId, payload) {
  getSqlite()
    .prepare("INSERT INTO record_history (id, table_name, record_id, payload, deleted_at) VALUES (?, ?, ?, ?, ?)")
    .run(newGuid(), tableName, String(recordId || ""), JSON.stringify(payload || {}), nowIso());
}

function pruneUnusedOpcodeCategories(usedIds) {
  const names = [...new Set((usedIds || []).map((id) => cleanCatalogName(id)).filter(Boolean))];
  if (!names.length) return;
  const current = getCatalogs().opcodeCategories;
  const keep = current.filter((item) => item.inUse > 0 || !names.some((name) => catalogKey(name) === catalogKey(item.id)));
  saveCatalogs({ opcodeCategories: keep.map((item) => item.id) });
}

function removeWorkOrder(id, opts = {}) {
  const order = getWorkOrder(id);
  if (!order) throw new Error("Orden no encontrada");
  if (isGone(order)) return { id };
  if (order.status === "entregada") throw new Error("La orden ya fue entregada");
  if (Number(order.paid) > 0.009) throw new Error("Esta OT ya tiene cobros. No se puede borrar.");
  const run = getSqlite().transaction(() => {
    const lines = db().select().from(workOrderLines).where(eq(workOrderLines.workOrderId, id)).all();
    archiveRecord("work_orders", id, { order, lines });
    if (!isEstimate(order)) {
      for (const line of lines) restorePartStock(order, line);
    }
    markDeleted(workOrders, id, { updatedAt: nowIso() });
  });
  run();
  if (opts.pruneCategories) {
    const cats = (order.lines || []).map((line) => line.opcode?.category).filter(Boolean);
    pruneUnusedOpcodeCategories(cats);
  }
  return { id };
}

function deliverWorkOrder(id, data = {}) {
  const order = getWorkOrder(id);
  if (!order || isGone(order)) throw new Error("Orden no encontrada");
  if (order.status === "entregada") return order;
  if (isEstimate(order)) throw new Error("Convierte el presupuesto a OT antes de entregar");
  if (Number(order.balance) > 0.009 && !Number(order.customer?.accountOpen) && !data.force) {
    throw new Error("Hay saldo. Cobra o abre cuenta al cliente para entregar.");
  }
  const kmOut = data.kmOut != null ? Number(data.kmOut) || 0 : Number(order.kmOut || order.kmIn || 0);
  db()
    .update(workOrders)
    .set({ status: "entregada", deliveredAt: nowIso(), kmOut, updatedAt: nowIso() })
    .where(eq(workOrders.id, id))
    .run();
  const km = Math.max(kmOut, Number(order.kmIn || 0));
  if (km > Number(order.vehicle?.km || 0)) {
    db().update(vehicles).set({ km }).where(eq(vehicles.id, order.vehicleId)).run();
  }
  return getWorkOrder(id);
}

function addWorkOrderPayment(id, data) {
  const order = getWorkOrder(id);
  if (!order || isGone(order)) throw new Error("Orden no encontrada");
  if (isEstimate(order)) throw new Error("Convierte el presupuesto a OT para cobrar");
  const due = Number(order.balance) || 0;
  if (order.status === "entregada" && due <= 0.009) throw new Error("La OT ya está pagada y entregada");
  const wantsClose = Boolean(data.close) && order.status !== "entregada";
  if (wantsClose && due <= 0.009) return deliverWorkOrder(id, data);
  let amount = clampDue(data.amount, due);
  if (wantsClose && (!amount || amount <= 0)) amount = due;
  if (!amount || amount <= 0) throw new Error("El monto debe ser mayor a 0");
  const method = ["efectivo", "tarjeta", "transferencia"].includes(data.method) ? data.method : "efectivo";
  const run = getSqlite().transaction(() => {
    db()
      .insert(workOrderPayments)
      .values({
        id: newGuid(),
        workOrderId: id,
        amount,
        method,
        paidAt: data.paidAt ? expenseTimestamp(data.paidAt) : nowIso(),
        notes: String(data.notes || "").trim(),
      })
      .run();
    const next = getWorkOrder(id);
    if (wantsClose) {
      if (Number(next.balance) > 0.009 && !Number(next.customer?.accountOpen)) return next;
      return deliverWorkOrder(id, data);
    }
    return next;
  });
  return run();
}

function shopDisplayName() {
  try {
    return String(readSettingsRow().name || "").trim() || "Dealer DMS";
  } catch {
    return "Dealer DMS";
  }
}

function getSettings() {
  const row = readSettingsRow();
  const peek = peekNextWorkOrderNumber(row, "orden", "taller");
  const estPeek = peekNextWorkOrderNumber(row, "presupuesto", "taller");
  const washPeek = peekNextWorkOrderNumber(row, "orden", "lavado");
  const piPeek = peekNextWorkOrderNumber(row, "factura_partes", "taller");
  const catalogs = getCatalogs();
  return {
    ...row,
    woPreview: peek.number,
    estPreview: estPeek.number,
    washPreview: washPeek.number,
    piPreview: piPeek.number,
    opcodeCategories: catalogs.opcodeCategories.map((item) => item.id),
    partCategories: catalogs.partCategories.map((item) => item.id),
    partUoms: catalogs.partUoms.map((item) => item.id),
    catalogs,
    allowUpdates: updatesAllowed(),
    offerWash: offerWashOn(),
    offerPartInvoices: offerPartInvoicesOn(),
    offerTax: offerTaxOn() ? 1 : 0,
  };
}

function saveSettings(data) {
  const current = readSettingsRow();
  const taxRate = data.taxRate != null ? Math.max(0, Number(data.taxRate) || 0) : Math.max(0, Number(current.taxRate) || 0);
  const laborRate = data.laborRate != null ? Math.max(0, Number(data.laborRate) || 0) : Math.max(0, Number(current.laborRate) || 0);
  const offerWash = data.offerWash != null ? (data.offerWash ? 1 : 0) : Number(current.offerWash) === 1 ? 1 : 0;
  const offerPartInvoices = data.offerPartInvoices != null ? (data.offerPartInvoices ? 1 : 0) : Number(current.offerPartInvoices) === 1 ? 1 : 0;
  const offerTax = data.offerTax != null ? (data.offerTax ? 1 : 0) : current.offerTax == null ? 1 : Number(current.offerTax) === 1 ? 1 : 0;
  patchSettings({
    name: String(data.name || current.name || "Dealer DMS").trim() || "Dealer DMS",
    phone: data.phone != null ? String(data.phone).trim() : current.phone || "",
    email: data.email != null ? String(data.email).trim() : current.email || "",
    address: data.address != null ? String(data.address).trim() : current.address || "",
    taxLabel: String(data.taxLabel || current.taxLabel || "GST").trim() || "GST",
    taxRate: offerTax ? taxRate : 0,
    gstNumber: data.gstNumber != null ? String(data.gstNumber).trim() : current.gstNumber || "",
    laborRate,
    invoiceNotes: data.invoiceNotes != null ? String(data.invoiceNotes).trim() : current.invoiceNotes || "",
    serviceMode: serviceModeOf({ serviceMode: data.serviceMode != null ? data.serviceMode : current.serviceMode }),
    offerWash,
    offerPartInvoices,
    offerTax,
  });
  if (offerWash) ensureWashSetup();
  return getSettings();
}

function saveWorkOrderNumbering(data) {
  const woPrefix = sanitizeWoPrefix(data.woPrefix);
  const woPad = woPadOf({ woPad: data.woPad });
  const woNextNumber = Math.max(1, Math.min(99999999, Math.floor(Number(data.woNextNumber) || 1)));
  const estPrefix = sanitizeWoPrefix(data.estPrefix || "PRE");
  const estNextNumber = Math.max(1, Math.min(99999999, Math.floor(Number(data.estNextNumber) || 1)));
  const washPrefix = sanitizeWoPrefix(data.washPrefix || "DET");
  const washNextNumber = Math.max(1, Math.min(99999999, Math.floor(Number(data.washNextNumber) || 1)));
  const piPrefix = sanitizeWoPrefix(data.piPrefix || "PI");
  const piNextNumber = Math.max(1, Math.min(99999999, Math.floor(Number(data.piNextNumber) || 1)));
  patchSettings({ woPrefix, woNextNumber, woPad, estPrefix, estNextNumber, washPrefix, washNextNumber, piPrefix, piNextNumber });
  return getSettings();
}

function setWorkOrderNumber(id, rawNumber) {
  const order = db().select().from(workOrders).where(eq(workOrders.id, id)).get();
  if (!order) throw new Error("Orden no encontrada");
  const number = normalizeWoNumber(rawNumber);
  const clash = findWorkOrderByNumber(number);
  if (clash && clash.id !== asId(id)) throw new Error("Ese número de OT ya existe");
  db().update(workOrders).set({ number, updatedAt: nowIso() }).where(eq(workOrders.id, id)).run();
  const settings = readSettingsRow();
  const tagged = String(number).match(/^([A-Z0-9]+)-(\d+)$/);
  if (tagged && tagged[1] === settings.woPrefix) {
    const n = Number(tagged[2]);
    if (n >= settings.woNextNumber) {
      patchSettings({ woNextNumber: n + 1 });
    }
  }
  return getWorkOrder(id);
}

function customerLabel(c) {
  if (!c) return "";
  const person = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");
  if (c.company && person) return `${c.company} · ${person}`;
  return c.company || person || c.name || "";
}

function searchGlobal(q) {
  const query = String(q || "").trim();
  if (!query) return { customers: [], vehicles: [], workOrders: [], parts: [], sales: [] };
  const customerRows = listCustomers(query, { limit: 6, lite: true });
  const vehicleRows = listVehicles(query, null, { limit: 6 });
  const seenVehicles = new Set(vehicleRows.map((v) => v.id));
  for (const customer of customerRows) {
    if (vehicleRows.length >= 6) break;
    const owned = listVehicles("", null, { customerId: customer.id, limit: 3 });
    for (const vehicle of owned) {
      if (seenVehicles.has(vehicle.id)) continue;
      vehicleRows.push(vehicle);
      seenVehicles.add(vehicle.id);
      if (vehicleRows.length >= 6) break;
    }
  }
  const workOrderRows = listWorkOrders(query, { limit: 6 });
  const partRows = listParts(query, { limit: 6, activeOnly: true });
  const saleRows = listSales(query, { limit: 6 });
  return {
    customers: customerRows.map((c) => ({
      type: "customer",
      id: c.id,
      href: `/clientes/${c.id}`,
      label: customerLabel(c),
      hint: [c.code, c.phones?.[0]?.number || c.phone, c.document].filter(Boolean).join(" · "),
    })),
    vehicles: vehicleRows.slice(0, 6).map((v) => ({
      type: "vehicle",
      id: v.id,
      href: `/vehiculos/${v.id}`,
      label: [v.year, v.make, v.model].filter(Boolean).join(" "),
      hint: [v.plate, v.vin, v.stockNumber, customerLabel(v.customer)].filter(Boolean).join(" · "),
    })),
    workOrders: workOrderRows.map((o) => ({
      type: "workOrder",
      id: o.id,
      href: o.serviceLine === "lavado" ? `/lavado/${o.id}` : `/taller/${o.id}`,
      label: o.number,
      hint: [
        customerLabel(o.customer),
        [o.vehicle?.year, o.vehicle?.make, o.vehicle?.model].filter(Boolean).join(" "),
        o.vehicle?.plate,
        o.kind === "presupuesto" ? "presupuesto" : o.status,
        o.serviceLine === "lavado" ? "lavado" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    parts: partRows.map((p) => ({
      type: "part",
      id: p.id,
      href: `/partes/${p.id}`,
      label: `${p.sku} ${p.name}`,
      hint: [p.location, p.oem, `stock ${p.stock}`].filter(Boolean).join(" · "),
    })),
    sales: saleRows.map((s) => ({
      type: "sale",
      id: s.id,
      href: `/ventas/${s.id}`,
      label: `#${s.id} ${customerLabel(s.customer)}`,
      hint: [[s.vehicle?.year, s.vehicle?.make, s.vehicle?.model].filter(Boolean).join(" "), s.status, s.vehicle?.stockNumber].filter(Boolean).join(" · "),
    })),
  };
}

function listStaff(opts = {}) {
  const rows = db()
    .select()
    .from(users)
    .all()
    .filter((u) => u.active && !isGone(u))
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      job: u.job || "tecnico",
      laborRate: Number(u.laborRate) || 0,
      canTech: Number(u.canTech) ? 1 : 0,
      canWash: Number(u.canWash) ? 1 : 0,
      active: u.active,
    }));
  const line = opts.line === "lavado" ? "lavado" : "taller";
  if (line === "lavado") {
    const washers = rows.filter((u) => u.canWash);
    if (washers.length) return washers;
    return rows.filter((u) => u.canTech);
  }
  const techs = rows.filter((u) => u.canTech);
  return techs.length ? techs : rows;
}

function dashboardKpis() {
  const inStock = db().select({ n: sql`count(*)` }).from(vehicles).where(and(eq(vehicles.status, "en_stock"), alive(vehicles))).get();
  const reserved = db().select({ n: sql`count(*)` }).from(vehicles).where(and(eq(vehicles.status, "reservado"), alive(vehicles))).get();
  const start = monthStartIso();
  const monthSales = db()
    .select()
    .from(sales)
    .all()
    .filter((s) => !isGone(s) && (s.closedAt || s.createdAt) >= start && s.status !== "borrador");
  const salesPretax = monthSales.reduce((s, row) => s + Number(row.price || 0), 0);
  const salesAmount = monthSales.reduce((s, row) => {
    const tax = roundMoney(row.tax != null ? row.tax : Number(row.price || 0) * (Number(row.taxRate) || 0) / 100);
    return s + Number(row.price || 0) + tax;
  }, 0);
  const salesCost = monthSales.reduce((s, row) => {
    const v = getVehicle(row.vehicleId);
    return s + Number(v?.cost || 0);
  }, 0);
  const allParts = db().select().from(parts).all().filter((p) => !isGone(p)).map(decoratePart);
  const lowStock = allParts.filter((p) => p.low);
  const deliveredWo = attachWorkOrders(
    db()
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.status, "entregada"), alive(workOrders)))
      .all()
      .filter((o) => (o.deliveredAt || o.createdAt) >= start),
    { lite: true }
  );
  const woRevenue = deliveredWo.reduce((s, o) => s + Number(o.total || 0), 0);
  const woPretax = deliveredWo.reduce((s, o) => s + Number(o.total || 0) - Number(o.tax || 0), 0);
  const woCost = deliveredWo.reduce((s, o) => s + Number(o.cost || 0), 0);
  const openDetailed = attachWorkOrders(
    db()
      .select()
      .from(workOrders)
      .where(and(ne(workOrders.status, "entregada"), alive(workOrders)))
      .all(),
    { lite: true }
  );
  const shopOpen = openDetailed.filter((o) => !isWashOrder(o));
  const washOpenRows = openDetailed.filter((o) => isWashOrder(o));
  const closedRosRows = deliveredWo
    .filter((o) => !isWashOrder(o) && o.kind !== "factura_partes")
    .sort((a, b) => String(b.deliveredAt || b.createdAt || "").localeCompare(String(a.deliveredAt || a.createdAt || "")));
  const closedPartsRows = deliveredWo
    .filter((o) => o.kind === "factura_partes")
    .sort((a, b) => String(b.deliveredAt || b.createdAt || "").localeCompare(String(a.deliveredAt || a.createdAt || "")));
  const unpaidOpen = shopOpen.filter((o) => o.kind !== "presupuesto" && o.balance > 0.009).length;
  const unpaidAmount = shopOpen.filter((o) => o.kind !== "presupuesto").reduce((s, o) => s + Math.max(0, Number(o.balance || 0)), 0);
  const inShopCount = shopOpen.filter((o) => o.status === "en_taller").length;
  const waitingPartsCount = shopOpen.filter((o) => o.status === "espera_partes").length;
  const waitingAuthCount = shopOpen.filter((o) => o.status === "autorizacion").length;
  const estimateOpenRows = shopOpen
    .filter((o) => o.kind === "presupuesto")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const estimatesOpen = estimateOpenRows.length;
  const overdueCount = shopOpen.filter((o) => o.overdue).length;
  const washOpen = washOpenRows.length;

  return {
    vehiclesInStock: Number(inStock?.n) || 0,
    vehiclesReserved: Number(reserved?.n) || 0,
    salesThisMonth: monthSales.length,
    salesAmount,
    salesMargin: salesPretax - salesCost,
    openWorkOrders: shopOpen.length,
    readyWorkOrders: shopOpen.filter((o) => o.status === "lista").length,
    unpaidOpenOrders: unpaidOpen,
    unpaidAmount,
    lowStockCount: lowStock.length,
    lowStock,
    workshopRevenue: woRevenue,
    workshopMargin: woPretax - woCost,
    totalMargin: salesPretax - salesCost + (woPretax - woCost),
    inShopCount,
    waitingPartsCount,
    waitingAuthCount,
    estimatesOpen,
    estimatesAmount: roundMoney(estimateOpenRows.reduce((s, o) => s + Number(o.total || 0), 0)),
    estimatesDeclined: roundMoney(estimateOpenRows.reduce((s, o) => s + Number(o.declinedTotal || 0), 0)),
    estimates: estimateOpenRows.slice(0, 20).map(dashEstimateRow),
    overdueCount,
    washOpen,
    offerWash: offerWashOn(),
    deliveredThisMonth: deliveredWo.length,
    closedRosThisMonth: closedRosRows.length,
    closedRosAmount: closedRosRows.reduce((s, o) => s + Number(o.total || 0), 0),
    closedPartsThisMonth: closedPartsRows.length,
    closedPartsAmount: closedPartsRows.reduce((s, o) => s + Number(o.total || 0), 0),
    closedRos: closedRosRows.slice(0, 20).map(dashClosedRow),
    closedParts: closedPartsRows.slice(0, 20).map(dashClosedRow),
  };
}

function dashEstimateRow(order) {
  const row = dashClosedRow(order);
  return {
    ...row,
    declined: Number(order.declinedTotal || 0),
    createdAt: order.createdAt || null,
  };
}

function dashClosedRow(order) {
  const customer = order.customer;
  const vehicle = order.vehicle;
  const person = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim();
  const customerName = customer?.company && person ? `${customer.company} · ${person}` : customer?.company || person || customer?.name || "";
  const car = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "";
  return {
    id: order.id,
    number: order.number,
    customerName,
    vehicleLabel: vehicle?.plate ? (car ? `${car} · ${vehicle.plate}` : vehicle.plate) : car,
    total: Number(order.total || 0),
    deliveredAt: order.deliveredAt || null,
  };
}

function financeSummary(period) {
  const bounds = periodBounds(period);
  const kpis = dashboardKpis();
  const settings = getSettings();

  const paymentsRaw = db()
    .select()
    .from(salePayments)
    .orderBy(desc(salePayments.paidAt))
    .all()
    .filter((p) => inPeriod(p.paidAt, bounds));
  const saleByPay = new Map(
    attachSales(fetchByIds(sales, sales.id, paymentsRaw.map((p) => p.saleId))).map((sale) => [sale.id, sale])
  );
  const payments = paymentsRaw
    .map((p) => ({ ...p, sale: saleByPay.get(p.saleId) || null }))
    .filter((p) => p.sale && !isGone(p.sale));
  const woPayments = db()
    .select()
    .from(workOrderPayments)
    .orderBy(desc(workOrderPayments.paidAt))
    .all()
    .filter((p) => inPeriod(p.paidAt, bounds))
    .map((p) => {
      const order = db().select().from(workOrders).where(eq(workOrders.id, p.workOrderId)).get();
      return { ...p, workOrder: order && !isGone(order) ? { id: order.id, number: order.number } : null };
    })
    .filter((p) => p.workOrder);
  const expenseRows = db().select().from(expenses).orderBy(desc(expenses.spentAt)).all().filter((e) => !isGone(e) && inPeriod(e.spentAt, bounds));
  const incomeRows = db().select().from(incomes).orderBy(desc(incomes.receivedAt)).all().filter((e) => !isGone(e) && inPeriod(e.receivedAt, bounds));

  const collectedSales = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const collectedShop = woPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const collectedOther = incomeRows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const collected = roundMoney(collectedSales + collectedShop + collectedOther);
  const spent = roundMoney(expenseRows.reduce((s, e) => s + Number(e.amount || 0), 0));

  const emptyMethods = () => ({ efectivo: 0, tarjeta: 0, transferencia: 0, financiamiento: 0 });
  const inByMethod = emptyMethods();
  const outByMethod = emptyMethods();
  for (const p of [...payments, ...woPayments, ...incomeRows]) {
    const method = cashMethod(p.method);
    inByMethod[method] += Number(p.amount || 0);
  }
  for (const e of expenseRows) {
    const method = cashMethod(e.method);
    outByMethod[method] += Number(e.amount || 0);
  }
  const cashbox = ["efectivo", "tarjeta", "transferencia", "financiamiento"].map((method) => ({
    method,
    in: roundMoney(inByMethod[method]),
    out: roundMoney(outByMethod[method]),
    net: roundMoney(inByMethod[method] - outByMethod[method]),
  }));

  const allOrders = attachWorkOrders(db().select().from(workOrders).where(alive(workOrders)).all(), { lite: true });
  const postedOrders = attachWorkOrders(
    db()
      .select()
      .from(workOrders)
      .where(and(alive(workOrders), eq(workOrders.status, "entregada")))
      .all()
      .filter((o) => (o.kind || "orden") !== "presupuesto" && inPeriod(o.deliveredAt || o.createdAt, bounds))
  );

  const woReceivables = allOrders
    .filter((o) => o.kind !== "presupuesto" && Number(o.balance || 0) > 0.009)
    .map((o) => ({
      kind: "taller",
      id: o.id,
      number: o.number,
      customer: o.customer,
      total: o.total,
      paid: o.paid,
      balance: o.balance,
      since: o.createdAt,
      bucket: agingBucket(o.createdAt),
    }));
  const allSales = attachSales(db().select().from(sales).where(alive(sales)).all());
  const saleReceivables = allSales
    .filter((s) => (s.status === "cerrada" || s.status === "entregada") && Number(s.balance || 0) > 0.009)
    .map((s) => ({
      kind: "venta",
      id: s.id,
      number: `#${s.id}`,
      customer: s.customer,
      total: s.total || s.price,
      paid: s.paid,
      balance: s.balance,
      since: s.closedAt || s.createdAt,
      bucket: agingBucket(s.closedAt || s.createdAt),
    }));
  const receivables = [...woReceivables, ...saleReceivables];
  const receivable = roundMoney(receivables.reduce((s, r) => s + Number(r.balance || 0), 0));
  const postedSales = allSales.filter(
    (s) => (s.status === "cerrada" || s.status === "entregada") && inPeriod(s.closedAt || s.createdAt, bounds)
  );
  const taxCollected = roundMoney(
    postedOrders.reduce((s, o) => s + Number(o.tax || 0), 0) + postedSales.reduce((s, sale) => s + Number(sale.tax || 0), 0)
  );

  const journal = [
    ...payments.map((p) => ({
      id: `sale-${p.id}`,
      at: p.paidAt,
      type: "ingreso",
      source: "venta",
      label: p.sale?.customer ? [p.sale.customer.firstName, p.sale.customer.lastName].filter(Boolean).join(" ") || p.sale.customer.name : `Venta #${p.saleId}`,
      method: p.method,
      amount: Number(p.amount || 0),
      href: `/ventas/${p.saleId}`,
    })),
    ...woPayments.map((p) => ({
      id: `wo-${p.id}`,
      at: p.paidAt,
      type: "ingreso",
      source: "taller",
      label: p.workOrder?.number || `OT ${p.workOrderId}`,
      method: p.method,
      amount: Number(p.amount || 0),
      href: `/taller/${p.workOrderId}`,
    })),
    ...incomeRows.map((e) => ({
      id: `inc-${e.id}`,
      at: e.receivedAt,
      type: "ingreso",
      source: "ingreso",
      label: e.notes || "Ingreso",
      method: e.method,
      amount: Number(e.amount || 0),
      href: null,
      incomeId: e.id,
    })),
    ...expenseRows.map((e) => ({
      id: `exp-${e.id}`,
      at: e.spentAt,
      type: "gasto",
      source: "gasto",
      label: e.notes || e.category,
      method: e.method,
      amount: Number(e.amount || 0),
      href: null,
      expenseId: e.id,
      category: e.category,
    })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const mix = { labor: 0, parts: 0, sublet: 0, laborCost: 0, partsCost: 0, subletCost: 0 };
  const partRank = new Map();
  const opRank = new Map();
  const techRank = new Map();
  const postedPartIds = [];
  for (const order of postedOrders) {
    for (const line of order.lines || []) {
      if (line.partId) postedPartIds.push(line.partId);
    }
  }
  const postedPartBy = new Map(fetchByIds(parts, parts.id, postedPartIds).map((p) => [p.id, p]));
  for (const order of postedOrders) {
    const techKey = order.techUserId || "none";
    const techRow = techRank.get(techKey) || {
      id: techKey,
      name: order.tech?.name || "",
      roCount: 0,
      billed: 0,
      laborAmount: 0,
    };
    techRow.roCount += 1;
    techRow.billed += Number(order.total || 0);
    for (const line of order.lines || []) {
      if (Number(line.authorized) === 0) continue;
      const pay = line.payType || "cliente";
      const amount = lineTotal(line);
      const cost = lineCost(line);
      const qty = Number(line.qty || 0);
      if (pay === "sublet") {
        mix.sublet += amount;
        mix.subletCost += cost;
      } else if (line.type === "part") {
        mix.parts += amount;
        mix.partsCost += cost;
        const partKey = line.partId || line.description || "part";
        const part = line.partId ? postedPartBy.get(line.partId) : null;
        const current = partRank.get(partKey) || {
          id: partKey,
          sku: part?.sku || "",
          name: part?.name || line.description || "",
          qty: 0,
          amount: 0,
          cost: 0,
        };
        current.qty += qty;
        current.amount += amount;
        current.cost += cost;
        partRank.set(partKey, current);
      } else {
        mix.labor += amount;
        mix.laborCost += cost;
        techRow.laborAmount += amount;
        const opKey = line.opCodeId || line.description || "labor";
        const current = opRank.get(opKey) || {
          id: opKey,
          code: line.opcode?.code || "",
          name: line.opcode?.description || line.description || "",
          qty: 0,
          amount: 0,
          cost: 0,
        };
        current.qty += qty;
        current.amount += amount;
        current.cost += cost;
        opRank.set(opKey, current);
      }
    }
    techRank.set(techKey, techRow);
  }

  const closedSales = allSales.filter((s) => s.status !== "borrador" && inPeriod(s.closedAt || s.createdAt, bounds));
  const makeRank = new Map();
  let salesAmount = 0;
  let salesCost = 0;
  for (const sale of closedSales) {
    const amount = Number(sale.price || 0);
    const cost = Number(sale.vehicle?.cost || 0);
    salesAmount += amount;
    salesCost += cost;
    const make = String(sale.vehicle?.make || "").trim() || "—";
    const current = makeRank.get(make) || { id: make, name: make, units: 0, amount: 0, cost: 0 };
    current.units += 1;
    current.amount += amount;
    current.cost += cost;
    makeRank.set(make, current);
  }

  const agingBuckets = ["0-30", "31-60", "61-90", "90+"].map((bucket) => {
    const rows = receivables.filter((r) => r.bucket === bucket);
    return {
      bucket,
      count: rows.length,
      amount: roundMoney(rows.reduce((s, r) => s + Number(r.balance || 0), 0)),
    };
  });

  const laborSales = roundMoney(mix.labor);
  const partsSales = roundMoney(mix.parts);
  const subletSales = roundMoney(mix.sublet);
  const shopBilled = roundMoney(postedOrders.reduce((s, o) => s + Number(o.total || 0), 0));
  const shopCost = roundMoney(postedOrders.reduce((s, o) => s + Number(o.cost || 0), 0));
  const shopCount = postedOrders.length;

  return {
    period: bounds.period,
    from: bounds.from,
    to: bounds.to,
    taxLabel: settings.taxLabel || "GST",
    books: {
      collected,
      collectedSales: roundMoney(collectedSales),
      collectedShop: roundMoney(collectedShop),
      collectedOther: roundMoney(collectedOther),
      spent,
      net: roundMoney(collected - spent),
      receivable,
      taxCollected,
    },
    cashbox,
    journal,
    expenses: expenseRows,
    incomes: incomeRows,
    receivables,
    kpis,
    report: {
      shop: {
        roCount: shopCount,
        billed: shopBilled,
        cost: shopCost,
        margin: roundMoney(shopBilled - shopCost),
        avgRo: shopCount ? roundMoney(shopBilled / shopCount) : 0,
        labor: laborSales,
        parts: partsSales,
        sublet: subletSales,
        laborCost: roundMoney(mix.laborCost),
        partsCost: roundMoney(mix.partsCost),
        subletCost: roundMoney(mix.subletCost),
        laborMargin: roundMoney(mix.labor - mix.laborCost),
        partsMargin: roundMoney(mix.parts - mix.partsCost),
        subletMargin: roundMoney(mix.sublet - mix.subletCost),
      },
      sales: {
        units: closedSales.length,
        amount: roundMoney(salesAmount),
        cost: roundMoney(salesCost),
        margin: roundMoney(salesAmount - salesCost),
        byMake: rankMap(makeRank).map((row) => ({
          id: row.id,
          name: row.name,
          units: row.units,
          amount: row.amount,
          margin: row.margin,
        })),
      },
      topParts: rankMap(partRank).slice(0, 8),
      topOps: rankMap(opRank).slice(0, 8),
      techs: [...techRank.values()]
        .map((row) => ({
          id: row.id,
          name: row.name,
          roCount: row.roCount,
          billed: roundMoney(row.billed),
          laborAmount: roundMoney(row.laborAmount),
        }))
        .sort((a, b) => b.billed - a.billed),
      expensesByCategory: ["partes", "renta", "servicios", "sueldos", "otros"].map((category) => ({
        category,
        amount: roundMoney(expenseRows.filter((e) => e.category === category).reduce((s, e) => s + Number(e.amount || 0), 0)),
      })),
      aging: agingBuckets,
      estimates: estimateReport(
        allOrders.filter((o) => (o.kind || "orden") === "presupuesto" && inPeriod(o.createdAt, bounds))
      ),
    },
  };
}

function estimateReport(orders) {
  const rows = orders
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return {
    count: rows.length,
    quoted: roundMoney(rows.reduce((s, o) => s + Number(o.total || 0), 0)),
    declined: roundMoney(rows.reduce((s, o) => s + Number(o.declinedTotal || 0), 0)),
    rows: rows.slice(0, 40).map(dashEstimateRow),
  };
}

const EXPENSE_CATEGORIES = ["partes", "renta", "servicios", "sueldos", "otros"];

function expenseTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return nowIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00`).toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha no válida");
  return parsed.toISOString();
}

function createExpense(data) {
  const amount = Number(data.amount);
  if (!amount || amount <= 0) throw new Error("El monto debe ser mayor a 0");
  const category = EXPENSE_CATEGORIES.includes(data.category) ? data.category : "otros";
  const method = ["efectivo", "tarjeta", "transferencia"].includes(data.method) ? data.method : "efectivo";
  const spentAt = expenseTimestamp(data.spentAt);
  const id = newGuid();
  db()
    .insert(expenses)
    .values({
      id,
      amount,
      category,
      method,
      spentAt,
      notes: String(data.notes || "").trim(),
    })
    .run();
  return db().select().from(expenses).where(eq(expenses.id, id)).get();
}

function removeExpense(id) {
  const row = db().select().from(expenses).where(eq(expenses.id, id)).get();
  if (!row) throw new Error("Gasto no encontrado");
  if (isGone(row)) return { id };
  return markDeleted(expenses, id);
}

function createIncome(data) {
  const amount = Number(data.amount);
  if (!amount || amount <= 0) throw new Error("El monto debe ser mayor a 0");
  const method = ["efectivo", "tarjeta", "transferencia"].includes(data.method) ? data.method : "efectivo";
  const receivedAt = expenseTimestamp(data.receivedAt || data.paidAt);
  const id = newGuid();
  db()
    .insert(incomes)
    .values({
      id,
      amount,
      method,
      receivedAt,
      notes: String(data.notes || "").trim(),
      category: "otros",
    })
    .run();
  return db().select().from(incomes).where(eq(incomes.id, id)).get();
}

function removeIncome(id) {
  const row = db().select().from(incomes).where(eq(incomes.id, id)).get();
  if (!row) throw new Error("Ingreso no encontrado");
  if (isGone(row)) return { id };
  return markDeleted(incomes, id);
}

function collectMoney(data) {
  const kind = String(data.kind || "otro");
  const payload = { ...data, close: data.close === false || data.close === 0 || data.close === "0" ? false : Boolean(data.close) };
  if (kind === "taller") {
    return addWorkOrderPayment(data.id, payload);
  }
  if (kind === "venta") {
    return addSalePayment(data.id, payload);
  }
  return createIncome(data);
}

function isEmpty() {
  const c = db().select({ n: sql`count(*)` }).from(customers).where(alive(customers)).get();
  const v = db().select({ n: sql`count(*)` }).from(vehicles).where(alive(vehicles)).get();
  const p = db().select({ n: sql`count(*)` }).from(parts).where(alive(parts)).get();
  return Number(c?.n) === 0 && Number(v?.n) === 0 && Number(p?.n) === 0;
}

function listOpCodes(q, opts = {}) {
  const query = String(q || "").trim();
  let rows = db().select().from(opCodes).orderBy(opCodes.code).all().filter((r) => !isGone(r));
  if (opts.activeOnly) rows = rows.filter((r) => r.active);
  if (opts.serviceLine === "lavado" || opts.serviceLine === "taller") {
    rows = rows.filter((r) => {
      const washCat = isWashCategory(r.category);
      return opts.serviceLine === "lavado" ? washCat : !washCat;
    });
  }
  if (query) {
    const p = query.toLowerCase();
    rows = rows.filter((r) => `${r.code} ${r.description} ${r.category} ${r.concern}`.toLowerCase().includes(p));
  }
  return rows.map(decorateOpCode);
}

function opcodeParts(opCodeId) {
  const rows = db().select().from(opCodeParts).where(eq(opCodeParts.opCodeId, opCodeId)).all();
  const out = [];
  for (const row of rows) {
    const part = decoratePart(db().select().from(parts).where(eq(parts.id, row.partId)).get());
    if (!part || isGone(part)) continue;
    out.push({
      id: row.id,
      opCodeId,
      partId: part.id,
      qty: Number(row.qty) > 0 ? Number(row.qty) : 1,
      sku: part.sku,
      name: part.name,
      price: part.price,
      stock: part.stock,
    });
  }
  return out;
}

function decorateOpCode(row) {
  if (!row) return null;
  return { ...row, parts: opcodeParts(row.id) };
}

function getOpCode(id) {
  return decorateOpCode(db().select().from(opCodes).where(eq(opCodes.id, id)).get());
}

function replaceOpCodeParts(opCodeId, list) {
  db().delete(opCodeParts).where(eq(opCodeParts.opCodeId, opCodeId)).run();
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const partId = asId(item.partId || item.id);
    if (!partId || seen.has(partId)) continue;
    const part = db().select().from(parts).where(eq(parts.id, partId)).get();
    if (!part) throw new Error("Parte no encontrada");
    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    seen.add(partId);
    db()
      .insert(opCodeParts)
      .values({
        id: newGuid(),
        opCodeId,
        partId,
        qty,
      })
      .run();
  }
}

function opcodePrice(data) {
  const hours = Number(data.laborHours) || 0;
  const rate = Number(data.laborRate) || 0;
  const explicit = Number(data.price);
  if (explicit > 0) return explicit;
  return Math.round(hours * rate * 100) / 100;
}

function createOpCode(data) {
  const code = String(data.code || "").trim().toUpperCase();
  const description = String(data.description || "").trim();
  if (!code || !description) throw new Error("Código y descripción son obligatorios");
  if (!/^[A-Z0-9][A-Z0-9/_-]{0,15}$/.test(code)) {
    throw new Error("El código debe ser corto (letras, números, - / _)");
  }
  const existing = db().select().from(opCodes).where(eq(opCodes.code, code)).get();
  if (existing && !isGone(existing)) throw new Error("Ya existe ese Op Code");
  if (existing && isGone(existing)) buryDeletedUnique("op_codes", "code", code);
  const laborHours = Number(data.laborHours) || 1;
  const laborRate = Number(data.laborRate) || 0;
  const id = newGuid();
  db()
    .insert(opCodes)
    .values({
      id,
      code,
      description,
      category: ensureCatalogValue("opcodeCategories", OP_CATEGORIES, data.category, "mantenimiento", true),
      payType: OP_PAY_TYPES.includes(data.payType) ? data.payType : "cliente",
      laborHours,
      laborRate,
      price: opcodePrice({ ...data, laborHours, laborRate }),
      cost: Number(data.cost) || 0,
      skillLevel: ["A", "B", "C"].includes(data.skillLevel) ? data.skillLevel : "B",
      concern: String(data.concern || "").trim(),
      cause: String(data.cause || "").trim(),
      correction: String(data.correction || "").trim(),
      popular: data.popular ? 1 : 0,
      active: data.active === 0 ? 0 : 1,
      notes: String(data.notes || "").trim(),
      createdAt: nowIso(),
    })
    .run();
  if (data.parts != null) replaceOpCodeParts(id, data.parts);
  return getOpCode(id);
}

function updateOpCode(id, data) {
  const current = getOpCode(id);
  if (!current) throw new Error("Op Code no encontrado");
  const code = data.code != null ? String(data.code).trim().toUpperCase() : current.code;
  if (code !== current.code) {
    const clash = db().select().from(opCodes).where(eq(opCodes.code, code)).get();
    if (clash && asId(clash.id) !== asId(id)) throw new Error("Ya existe ese Op Code");
  }
  const laborHours = data.laborHours != null ? Number(data.laborHours) : current.laborHours;
  const laborRate = data.laborRate != null ? Number(data.laborRate) : current.laborRate;
  db()
    .update(opCodes)
    .set({
      code,
      description: data.description != null ? String(data.description).trim() : current.description,
      category: data.category != null ? ensureCatalogValue("opcodeCategories", OP_CATEGORIES, data.category, current.category, true) : current.category,
      payType: data.payType && OP_PAY_TYPES.includes(data.payType) ? data.payType : current.payType,
      laborHours,
      laborRate,
      price: data.price != null || data.laborHours != null || data.laborRate != null
        ? opcodePrice({ laborHours, laborRate, price: data.price != null ? data.price : current.price })
        : current.price,
      cost: data.cost != null ? Number(data.cost) : current.cost,
      skillLevel: data.skillLevel && ["A", "B", "C"].includes(data.skillLevel) ? data.skillLevel : current.skillLevel,
      concern: data.concern != null ? String(data.concern).trim() : current.concern,
      cause: data.cause != null ? String(data.cause).trim() : current.cause,
      correction: data.correction != null ? String(data.correction).trim() : current.correction,
      popular: data.popular != null ? (data.popular ? 1 : 0) : current.popular,
      active: data.active != null ? (data.active ? 1 : 0) : current.active,
      notes: data.notes != null ? String(data.notes).trim() : current.notes,
    })
    .where(eq(opCodes.id, id))
    .run();
  if (data.parts != null) replaceOpCodeParts(id, data.parts);
  return getOpCode(id);
}

function removeOpCode(id) {
  const current = db().select().from(opCodes).where(eq(opCodes.id, id)).get();
  if (!current) throw new Error("Op Code no encontrado");
  if (isGone(current)) return { id };
  return markDeleted(opCodes, id, { active: 0 });
}

function linkKnownOpcodeParts() {
  const kits = [
    { code: "LOF", skus: [["FIL-ACE-001", 1], ["ACE-5W30-003", 1]] },
    { code: "FIL-A", skus: [["FIL-AIR-004", 1]] },
    { code: "BRK-F", skus: [["PAS-FRE-002", 1]] },
    { code: "BAT", skus: [["BAT-12V-005", 1]] },
    { code: "SPARK", skus: [["BUJ-IR-006", 4]] },
  ];
  for (const kit of kits) {
    const op = db().select().from(opCodes).where(eq(opCodes.code, kit.code)).get();
    if (!op) continue;
    const existing = db().select().from(opCodeParts).where(eq(opCodeParts.opCodeId, op.id)).all();
    if (existing.length) continue;
    const list = [];
    for (const [sku, qty] of kit.skus) {
      const part = db().select().from(parts).where(eq(parts.sku, sku)).get();
      if (part) list.push({ partId: part.id, qty });
    }
    if (list.length) replaceOpCodeParts(op.id, list);
  }
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function serializeSqlValue(value) {
  if (value == null) return null;
  if (typeof value === "bigint") return Number(value);
  if (Buffer.isBuffer(value)) return `<blob ${value.length}>`;
  return value;
}

function serializeSqlRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) out[key] = serializeSqlValue(value);
  return out;
}

function assertReadOnlySql(sql) {
  const raw = String(sql || "").trim();
  if (!raw) throw new Error("Escribe un SELECT");
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*--.*$/gm, " ")
    .trim();
  const parts = stripped.split(";").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) throw new Error("Una sola consulta a la vez");
  const first = parts[0] || "";
  if (!/^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(first)) {
    throw new Error("Solo lectura: SELECT, WITH, PRAGMA o EXPLAIN");
  }
  if (/^PRAGMA\b/i.test(first) && !/^PRAGMA\s+(table_info|index_list|index_info|foreign_key_list|compile_options|database_list|table_list|function_list)\b/i.test(first)) {
    throw new Error("Ese PRAGMA no es de solo lectura");
  }
  return first;
}

function listSqlTables() {
  const tables = getSqlite()
    .prepare(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
    .all();
  return tables.map((t) => {
    const ident = quoteIdent(t.name);
    const count = getSqlite().prepare(`SELECT count(*) AS n FROM ${ident}`).get();
    const columns = getSqlite()
      .prepare(`PRAGMA table_info(${ident})`)
      .all()
      .map((c) => ({ name: c.name, type: c.type || "" }));
    return { name: t.name, type: t.type, rows: Number(count?.n) || 0, columns };
  });
}

function sqlQuery(sql, opts = {}) {
  const statement = assertReadOnlySql(sql);
  const limit = Math.min(Math.max(1, Number(opts.limit) || 500), 2000);
  const stmt = getSqlite().prepare(statement);
  if (stmt.reader === false) throw new Error("Esa sentencia no es de lectura");
  const columns = (stmt.columns() || []).map((c) => c.name);
  const rows = [];
  let truncated = false;
  for (const row of stmt.iterate()) {
    if (rows.length >= limit) {
      truncated = true;
      break;
    }
    rows.push(serializeSqlRow(row));
  }
  const names = columns.length ? columns : rows[0] ? Object.keys(rows[0]) : [];
  return { columns: names, rows, rowCount: rows.length, truncated, limit };
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  removeCustomer,
  findDuplicates,
  addCustomerNote,
  unlinkCustomerVehicle,
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  addVehicleNote,
  removeVehicle,
  listSales,
  getSale,
  createSale,
  updateSale,
  closeSale,
  deliverSale,
  addSalePayment,
  deleteSale,
  listParts,
  getPart,
  createPart,
  updatePart,
  adjustPartStock,
  receivePart,
  orderPart,
  removePart,
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  setWorkOrderStatus,
  addWorkOrderLine,
  updateWorkOrderLine,
  convertEstimate,
  authorizeWorkOrder,
  removeWorkOrderLine,
  removeWorkOrder,
  deliverWorkOrder,
  addWorkOrderPayment,
  setWorkOrderNumber,
  getSettings,
  shopDisplayName,
  offerWashOn,
  offerPartInvoicesOn,
  offerTaxOn,
  updatesAllowed,
  setUpdatesAllowed,
  saveSettings,
  saveWorkOrderNumbering,
  getCatalogs,
  saveCatalogs,
  searchGlobal,
  listStaff,
  dashboardKpis,
  financeSummary,
  createExpense,
  removeExpense,
  createIncome,
  removeIncome,
  collectMoney,
  isEmpty,
  listOpCodes,
  getOpCode,
  createOpCode,
  updateOpCode,
  removeOpCode,
  listWashTypes,
  getWashType,
  createWashType,
  updateWashType,
  removeWashType,
  linkKnownOpcodeParts,
  listSqlTables,
  sqlQuery,
};
