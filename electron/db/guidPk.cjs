const crypto = require("crypto");

function newGuid() {
  return crypto.randomUUID();
}

const TABLES = [
  "inventory_movements",
  "work_order_payments",
  "work_order_lines",
  "sale_payments",
  "vehicle_notes",
  "customer_notes",
  "sales",
  "work_orders",
  "vehicles",
  "expenses",
  "op_codes",
  "parts",
  "customers",
  "users",
  "shop_settings",
];

const GUID_DDL = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  middle_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  job TEXT NOT NULL DEFAULT 'tecnico',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  document TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  labor_rate REAL NOT NULL DEFAULT 0,
  can_tech INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  middle_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  phones_json TEXT NOT NULL DEFAULT '[]',
  email TEXT NOT NULL DEFAULT '',
  document TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'particular',
  status TEXT NOT NULL DEFAULT 'activo',
  source TEXT NOT NULL DEFAULT 'mostrador',
  tax_exempt INTEGER NOT NULL DEFAULT 0,
  account_open INTEGER NOT NULL DEFAULT 0,
  credit_limit REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  preferred_contact TEXT NOT NULL DEFAULT 'phone',
  language TEXT NOT NULL DEFAULT '',
  birthday TEXT NOT NULL DEFAULT '',
  marketing INTEGER NOT NULL DEFAULT 1,
  contacts_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE customer_notes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  body TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  vin TEXT NOT NULL UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  plate TEXT NOT NULL DEFAULT '',
  km INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'en_stock',
  customer_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  stock_number TEXT NOT NULL DEFAULT '',
  trim TEXT NOT NULL DEFAULT '',
  body_style TEXT NOT NULL DEFAULT '',
  engine TEXT NOT NULL DEFAULT '',
  transmission TEXT NOT NULL DEFAULT '',
  drivetrain TEXT NOT NULL DEFAULT '',
  fuel TEXT NOT NULL DEFAULT '',
  interior_color TEXT NOT NULL DEFAULT '',
  doors INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'usado',
  location TEXT NOT NULL DEFAULT '',
  key_number TEXT NOT NULL DEFAULT '',
  unit_number TEXT NOT NULL DEFAULT '',
  acquired_at TEXT,
  insurance TEXT NOT NULL DEFAULT '',
  insurance_policy TEXT NOT NULL DEFAULT '',
  license_expiry TEXT NOT NULL DEFAULT '',
  inspection_due TEXT NOT NULL DEFAULT '',
  production_date TEXT NOT NULL DEFAULT '',
  alert TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE TABLE vehicle_notes (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  body TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);
CREATE TABLE parts (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  oem TEXT NOT NULL DEFAULT '',
  alts_json TEXT NOT NULL DEFAULT '[]',
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'otros',
  vendor TEXT NOT NULL DEFAULT '',
  core REAL NOT NULL DEFAULT 0,
  taxable INTEGER NOT NULL DEFAULT 1,
  uom TEXT NOT NULL DEFAULT 'pza',
  max_stock INTEGER NOT NULL DEFAULT 0,
  on_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'activo',
  special_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE op_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'mantenimiento',
  pay_type TEXT NOT NULL DEFAULT 'cliente',
  labor_hours REAL NOT NULL DEFAULT 1,
  labor_rate REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  skill_level TEXT NOT NULL DEFAULT 'B',
  concern TEXT NOT NULL DEFAULT '',
  cause TEXT NOT NULL DEFAULT '',
  correction TEXT NOT NULL DEFAULT '',
  popular INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  price REAL NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  down_payment REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'contado',
  status TEXT NOT NULL DEFAULT 'borrador',
  notes TEXT NOT NULL DEFAULT '',
  closed_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);
CREATE TABLE sale_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'efectivo',
  paid_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);
CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recepcion',
  kind TEXT NOT NULL DEFAULT 'orden',
  complaint TEXT NOT NULL DEFAULT '',
  cause TEXT NOT NULL DEFAULT '',
  correction TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  km_in INTEGER NOT NULL DEFAULT 0,
  km_out INTEGER NOT NULL DEFAULT 0,
  promised_at TEXT,
  tech_user_id TEXT,
  tax_rate REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  waiter INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal',
  po_number TEXT NOT NULL DEFAULT '',
  authorized_at TEXT,
  authorized_by TEXT NOT NULL DEFAULT '',
  hold_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  updated_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (tech_user_id) REFERENCES users(id)
);
CREATE TABLE work_order_lines (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  part_id TEXT,
  op_code_id TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  pay_type TEXT NOT NULL DEFAULT 'cliente',
  authorized INTEGER NOT NULL DEFAULT 1,
  complaint TEXT NOT NULL DEFAULT '',
  cause TEXT NOT NULL DEFAULT '',
  correction TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (part_id) REFERENCES parts(id),
  FOREIGN KEY (op_code_id) REFERENCES op_codes(id)
);
CREATE TABLE work_order_payments (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'efectivo',
  paid_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  work_order_line_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (part_id) REFERENCES parts(id),
  FOREIGN KEY (work_order_line_id) REFERENCES work_order_lines(id)
);
CREATE TABLE shop_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Dealer DMS',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  tax_label TEXT NOT NULL DEFAULT 'GST',
  tax_rate REAL NOT NULL DEFAULT 5,
  gst_number TEXT NOT NULL DEFAULT '',
  wo_prefix TEXT NOT NULL DEFAULT 'OT',
  wo_next_number INTEGER NOT NULL DEFAULT 1,
  wo_pad INTEGER NOT NULL DEFAULT 4,
  labor_rate REAL NOT NULL DEFAULT 145,
  invoice_notes TEXT NOT NULL DEFAULT '',
  service_mode TEXT NOT NULL DEFAULT 'completo',
  opcode_categories TEXT NOT NULL DEFAULT '',
  part_categories TEXT NOT NULL DEFAULT '',
  part_uoms TEXT NOT NULL DEFAULT '',
  allow_updates INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'otros',
  method TEXT NOT NULL DEFAULT 'efectivo',
  spent_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_plate ON vehicles(plate);
CREATE INDEX idx_vehicles_stock ON vehicles(stock_number);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_parts_sku ON parts(sku);
CREATE INDEX idx_parts_oem ON parts(oem);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_op_codes_code ON op_codes(code);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_vehicle ON work_orders(vehicle_id);
CREATE INDEX idx_work_order_lines_wo ON work_order_lines(work_order_id);
CREATE INDEX idx_work_order_payments_wo ON work_order_payments(work_order_id);
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
`;

function tableExists(sqlite, table) {
  return Boolean(sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table));
}

function idMap(sqlite, table) {
  const map = new Map();
  if (!tableExists(sqlite, table)) return map;
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const hasUuid = cols.includes("uuid");
  const rows = sqlite.prepare(`SELECT id${hasUuid ? ", uuid" : ""} FROM ${table}`).all();
  for (const row of rows) {
    const guid = hasUuid && String(row.uuid || "").trim() ? String(row.uuid) : newGuid();
    map.set(String(row.id), guid);
  }
  return map;
}

function mapped(map, oldId) {
  if (oldId == null || oldId === "") return null;
  return map.get(String(oldId)) || null;
}

function g(row, key, fallback = "") {
  const value = row[key];
  return value == null ? fallback : value;
}

function rebuildGuidPrimaryKeys(sqlite) {
  const users = idMap(sqlite, "users");
  const customers = idMap(sqlite, "customers");
  const vehicles = idMap(sqlite, "vehicles");
  const parts = idMap(sqlite, "parts");
  const opcodes = idMap(sqlite, "op_codes");
  const sales = idMap(sqlite, "sales");
  const workOrders = idMap(sqlite, "work_orders");
  const lines = idMap(sqlite, "work_order_lines");
  const notesC = idMap(sqlite, "customer_notes");
  const notesV = idMap(sqlite, "vehicle_notes");
  const salePays = idMap(sqlite, "sale_payments");
  const woPays = idMap(sqlite, "work_order_payments");
  const moves = idMap(sqlite, "inventory_movements");
  const expenses = idMap(sqlite, "expenses");
  const settings = idMap(sqlite, "shop_settings");

  sqlite.pragma("foreign_keys = OFF");
  sqlite.exec("BEGIN");
  try {
    for (const table of TABLES) {
      if (tableExists(sqlite, table)) sqlite.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy`);
    }
    const indexes = sqlite.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`
    ).all();
    for (const idx of indexes) {
      sqlite.exec(`DROP INDEX IF EXISTS "${String(idx.name).replace(/"/g, '""')}"`);
    }
    sqlite.exec(GUID_DDL);

    if (tableExists(sqlite, "users_legacy")) {
      const insUsers = sqlite.prepare(
        `INSERT INTO users (id, name, first_name, middle_name, last_name, username, password_hash, role, job, phone, email, document, address, city, state, zip, notes, labor_rate, can_tech, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      for (const row of sqlite.prepare("SELECT * FROM users_legacy").all()) {
        insUsers.run(
          users.get(String(row.id)),
          row.name,
          g(row, "first_name"),
          g(row, "middle_name"),
          g(row, "last_name"),
          row.username,
          row.password_hash,
          row.role,
          g(row, "job", "tecnico") || "tecnico",
          g(row, "phone"),
          g(row, "email"),
          g(row, "document"),
          g(row, "address"),
          g(row, "city"),
          g(row, "state"),
          g(row, "zip"),
          g(row, "notes"),
          Number(g(row, "labor_rate", 0)) || 0,
          Number(g(row, "can_tech", 1)) ? 1 : 0,
          row.active,
          row.created_at,
          row.updated_at
        );
      }
    }

    const insCustomers = sqlite.prepare(
      `INSERT INTO customers (id, code, name, first_name, middle_name, last_name, phone, phones_json, email, document, address, city, state, zip, notes, company, type, status, source, tax_exempt, account_open, credit_limit, discount_pct, preferred_contact, language, birthday, marketing, contacts_json, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM customers_legacy").all()) {
      insCustomers.run(
        customers.get(String(row.id)),
        g(row, "code") || `C-${String(row.id).padStart(4, "0")}`,
        row.name,
        g(row, "first_name"),
        g(row, "middle_name"),
        g(row, "last_name"),
        g(row, "phone"),
        g(row, "phones_json", "[]"),
        g(row, "email"),
        g(row, "document"),
        g(row, "address"),
        g(row, "city"),
        g(row, "state"),
        g(row, "zip"),
        g(row, "notes"),
        g(row, "company"),
        g(row, "type", "particular"),
        g(row, "status", "activo"),
        g(row, "source", "mostrador"),
        g(row, "tax_exempt", 0),
        g(row, "account_open", 0),
        g(row, "credit_limit", 0),
        g(row, "discount_pct", 0),
        g(row, "preferred_contact", "phone"),
        g(row, "language"),
        g(row, "birthday"),
        g(row, "marketing", 1),
        g(row, "contacts_json", "[]"),
        row.created_at,
        g(row, "updated_at")
      );
    }

    const insParts = sqlite.prepare(
      `INSERT INTO parts (id, sku, name, description, location, stock, min_stock, cost, price, created_at, oem, alts_json, brand, category, vendor, core, taxable, uom, max_stock, on_order, status, special_order, notes, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM parts_legacy").all()) {
      insParts.run(
        parts.get(String(row.id)),
        row.sku,
        row.name,
        g(row, "description"),
        g(row, "location"),
        g(row, "stock", 0),
        g(row, "min_stock", 0),
        g(row, "cost", 0),
        g(row, "price", 0),
        row.created_at,
        g(row, "oem"),
        g(row, "alts_json", "[]"),
        g(row, "brand"),
        g(row, "category", "otros"),
        g(row, "vendor"),
        g(row, "core", 0),
        g(row, "taxable", 1),
        g(row, "uom", "pza"),
        g(row, "max_stock", 0),
        g(row, "on_order", 0),
        g(row, "status", "activo"),
        g(row, "special_order", 0),
        g(row, "notes"),
        g(row, "updated_at")
      );
    }

    const insOp = sqlite.prepare(
      `INSERT INTO op_codes (id, code, description, category, pay_type, labor_hours, labor_rate, price, cost, skill_level, concern, cause, correction, popular, active, notes, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    if (tableExists(sqlite, "op_codes_legacy")) {
      for (const row of sqlite.prepare("SELECT * FROM op_codes_legacy").all()) {
        insOp.run(
          opcodes.get(String(row.id)),
          row.code,
          row.description,
          g(row, "category", "mantenimiento"),
          g(row, "pay_type", "cliente"),
          g(row, "labor_hours", 1),
          g(row, "labor_rate", 0),
          g(row, "price", 0),
          g(row, "cost", 0),
          g(row, "skill_level", "B"),
          g(row, "concern"),
          g(row, "cause"),
          g(row, "correction"),
          g(row, "popular", 0),
          g(row, "active", 1),
          g(row, "notes"),
          row.created_at
        );
      }
    }

    const insSettings = sqlite.prepare(
      `INSERT INTO shop_settings (id, name, phone, email, address, tax_label, tax_rate, gst_number, wo_prefix, wo_next_number, wo_pad, labor_rate, invoice_notes, service_mode, opcode_categories, part_categories, part_uoms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM shop_settings_legacy").all()) {
      insSettings.run(
        settings.get(String(row.id)),
        g(row, "name", "Dealer DMS"),
        g(row, "phone"),
        g(row, "email"),
        g(row, "address"),
        g(row, "tax_label", "GST"),
        g(row, "tax_rate", 5),
        g(row, "gst_number"),
        g(row, "wo_prefix", "OT"),
        g(row, "wo_next_number", 1),
        g(row, "wo_pad", 4),
        g(row, "labor_rate", 145),
        g(row, "invoice_notes"),
        g(row, "service_mode", "completo"),
        g(row, "opcode_categories"),
        g(row, "part_categories"),
        g(row, "part_uoms")
      );
    }

    const insExp = sqlite.prepare(
      `INSERT INTO expenses (id, amount, category, method, spent_at, notes) VALUES (?,?,?,?,?,?)`
    );
    if (tableExists(sqlite, "expenses_legacy")) {
      for (const row of sqlite.prepare("SELECT * FROM expenses_legacy").all()) {
        insExp.run(expenses.get(String(row.id)), row.amount, g(row, "category", "otros"), g(row, "method", "efectivo"), row.spent_at, g(row, "notes"));
      }
    }

    const insVehicles = sqlite.prepare(
      `INSERT INTO vehicles (id, vin, make, model, year, color, plate, km, cost, price, status, customer_id, notes, created_at, stock_number, trim, body_style, engine, transmission, drivetrain, fuel, interior_color, doors, condition, location, key_number, unit_number, acquired_at, insurance, insurance_policy, license_expiry, inspection_due, production_date, alert, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM vehicles_legacy").all()) {
      insVehicles.run(
        vehicles.get(String(row.id)),
        row.vin,
        row.make,
        row.model,
        row.year,
        g(row, "color"),
        g(row, "plate"),
        g(row, "km", 0),
        g(row, "cost", 0),
        g(row, "price", 0),
        g(row, "status", "en_stock"),
        mapped(customers, row.customer_id),
        g(row, "notes"),
        row.created_at,
        g(row, "stock_number"),
        g(row, "trim"),
        g(row, "body_style"),
        g(row, "engine"),
        g(row, "transmission"),
        g(row, "drivetrain"),
        g(row, "fuel"),
        g(row, "interior_color"),
        g(row, "doors", 0),
        g(row, "condition", "usado"),
        g(row, "location"),
        g(row, "key_number"),
        g(row, "unit_number"),
        row.acquired_at ?? null,
        g(row, "insurance"),
        g(row, "insurance_policy"),
        g(row, "license_expiry"),
        g(row, "inspection_due"),
        g(row, "production_date"),
        g(row, "alert"),
        g(row, "updated_at")
      );
    }

    const insSales = sqlite.prepare(
      `INSERT INTO sales (id, customer_id, vehicle_id, price, tax_rate, tax, down_payment, payment_method, status, notes, closed_at, delivered_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM sales_legacy").all()) {
      insSales.run(
        sales.get(String(row.id)),
        mapped(customers, row.customer_id),
        mapped(vehicles, row.vehicle_id),
        row.price,
        Number(g(row, "tax_rate", 0)) || 0,
        Number(g(row, "tax", 0)) || 0,
        g(row, "down_payment", 0),
        g(row, "payment_method", "contado"),
        g(row, "status", "borrador"),
        g(row, "notes"),
        row.closed_at ?? null,
        row.delivered_at ?? null,
        row.created_at
      );
    }

    const insWo = sqlite.prepare(
      `INSERT INTO work_orders (id, number, customer_id, vehicle_id, status, kind, complaint, cause, correction, notes, km_in, km_out, promised_at, tech_user_id, tax_rate, discount_pct, waiter, priority, po_number, authorized_at, authorized_by, hold_reason, created_at, delivered_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM work_orders_legacy").all()) {
      insWo.run(
        workOrders.get(String(row.id)),
        row.number,
        mapped(customers, row.customer_id),
        mapped(vehicles, row.vehicle_id),
        g(row, "status", "recepcion"),
        g(row, "kind", "orden"),
        g(row, "complaint"),
        g(row, "cause"),
        g(row, "correction"),
        g(row, "notes"),
        g(row, "km_in", 0),
        g(row, "km_out", 0),
        row.promised_at ?? null,
        mapped(users, row.tech_user_id),
        g(row, "tax_rate", 0),
        g(row, "discount_pct", 0),
        g(row, "waiter", 0),
        g(row, "priority", "normal"),
        g(row, "po_number"),
        row.authorized_at ?? null,
        g(row, "authorized_by"),
        g(row, "hold_reason"),
        row.created_at,
        row.delivered_at ?? null,
        g(row, "updated_at")
      );
    }

    const insCn = sqlite.prepare(
      `INSERT INTO customer_notes (id, customer_id, body, user_name, created_at) VALUES (?,?,?,?,?)`
    );
    if (tableExists(sqlite, "customer_notes_legacy")) {
      for (const row of sqlite.prepare("SELECT * FROM customer_notes_legacy").all()) {
        insCn.run(notesC.get(String(row.id)), mapped(customers, row.customer_id), row.body, g(row, "user_name"), row.created_at);
      }
    }

    const insVn = sqlite.prepare(
      `INSERT INTO vehicle_notes (id, vehicle_id, body, user_name, created_at) VALUES (?,?,?,?,?)`
    );
    if (tableExists(sqlite, "vehicle_notes_legacy")) {
      for (const row of sqlite.prepare("SELECT * FROM vehicle_notes_legacy").all()) {
        insVn.run(notesV.get(String(row.id)), mapped(vehicles, row.vehicle_id), row.body, g(row, "user_name"), row.created_at);
      }
    }

    const insSp = sqlite.prepare(
      `INSERT INTO sale_payments (id, sale_id, amount, method, paid_at, notes) VALUES (?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM sale_payments_legacy").all()) {
      insSp.run(salePays.get(String(row.id)), mapped(sales, row.sale_id), row.amount, g(row, "method", "efectivo"), row.paid_at, g(row, "notes"));
    }

    const insLine = sqlite.prepare(
      `INSERT INTO work_order_lines (id, work_order_id, type, description, part_id, op_code_id, qty, unit_price, unit_cost, pay_type, authorized, complaint, cause, correction)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const row of sqlite.prepare("SELECT * FROM work_order_lines_legacy").all()) {
      insLine.run(
        lines.get(String(row.id)),
        mapped(workOrders, row.work_order_id),
        row.type,
        row.description,
        mapped(parts, row.part_id),
        mapped(opcodes, row.op_code_id),
        g(row, "qty", 1),
        g(row, "unit_price", 0),
        g(row, "unit_cost", 0),
        g(row, "pay_type", "cliente"),
        g(row, "authorized", 1),
        g(row, "complaint"),
        g(row, "cause"),
        g(row, "correction")
      );
    }

    const insWp = sqlite.prepare(
      `INSERT INTO work_order_payments (id, work_order_id, amount, method, paid_at, notes) VALUES (?,?,?,?,?,?)`
    );
    if (tableExists(sqlite, "work_order_payments_legacy")) {
      for (const row of sqlite.prepare("SELECT * FROM work_order_payments_legacy").all()) {
        insWp.run(woPays.get(String(row.id)), mapped(workOrders, row.work_order_id), row.amount, g(row, "method", "efectivo"), row.paid_at, g(row, "notes"));
      }
    }

    const insMv = sqlite.prepare(
      `INSERT INTO inventory_movements (id, part_id, qty, reason, work_order_line_id, notes, created_at) VALUES (?,?,?,?,?,?,?)`
    );
    if (tableExists(sqlite, "inventory_movements_legacy")) {
      for (const row of sqlite.prepare("SELECT * FROM inventory_movements_legacy").all()) {
        insMv.run(
          moves.get(String(row.id)),
          mapped(parts, row.part_id),
          row.qty,
          row.reason,
          mapped(lines, row.work_order_line_id),
          g(row, "notes"),
          row.created_at
        );
      }
    }

    for (const table of TABLES) {
      if (tableExists(sqlite, `${table}_legacy`)) sqlite.exec(`DROP TABLE ${table}_legacy`);
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}

module.exports = { rebuildGuidPrimaryKeys, tableExists };
