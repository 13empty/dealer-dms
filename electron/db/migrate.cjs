const crypto = require("crypto");
const { rebuildGuidPrimaryKeys } = require("./guidPk.cjs");

function nowIso() {
  return new Date().toISOString();
}

function newGuid() {
  return crypto.randomUUID();
}

function addColumnIfMissing(sqlite, table, column, ddl) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    return true;
  }
  return false;
}

function migrate(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT NOT NULL UNIQUE,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      km INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'en_stock',
      customer_id INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      price REAL NOT NULL,
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

    CREATE TABLE IF NOT EXISTS sale_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'efectivo',
      paid_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'recepcion',
      complaint TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS work_order_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      part_id INTEGER,
      op_code_id INTEGER,
      qty REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
      FOREIGN KEY (part_id) REFERENCES parts(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      reason TEXT NOT NULL,
      work_order_line_id INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (part_id) REFERENCES parts(id)
    );

    CREATE TABLE IF NOT EXISTS op_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    CREATE TABLE IF NOT EXISTS shop_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Dealer DMS',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      tax_label TEXT NOT NULL DEFAULT 'GST',
      tax_rate REAL NOT NULL DEFAULT 5,
      wo_prefix TEXT NOT NULL DEFAULT 'OT',
      wo_next_number INTEGER NOT NULL DEFAULT 1,
      wo_pad INTEGER NOT NULL DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS work_order_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'efectivo',
      paid_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'otros',
      method TEXT NOT NULL DEFAULT 'efectivo',
      spent_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'efectivo',
      received_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'otros'
    );

    CREATE TABLE IF NOT EXISTS customer_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS vehicle_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
    CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
    CREATE INDEX IF NOT EXISTS idx_parts_sku ON parts(sku);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_op_codes_code ON op_codes(code);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
  `);

  addColumnIfMissing(sqlite, "customers", "phones_json", "phones_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(sqlite, "customers", "address", "address TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "city", "city TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "state", "state TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "zip", "zip TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "first_name", "first_name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "middle_name", "middle_name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "last_name", "last_name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "company", "company TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "type", "type TEXT NOT NULL DEFAULT 'particular'");
  addColumnIfMissing(sqlite, "customers", "status", "status TEXT NOT NULL DEFAULT 'activo'");
  addColumnIfMissing(sqlite, "customers", "source", "source TEXT NOT NULL DEFAULT 'mostrador'");
  addColumnIfMissing(sqlite, "customers", "tax_exempt", "tax_exempt INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "customers", "account_open", "account_open INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "customers", "credit_limit", "credit_limit REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "customers", "discount_pct", "discount_pct REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "customers", "preferred_contact", "preferred_contact TEXT NOT NULL DEFAULT 'phone'");
  addColumnIfMissing(sqlite, "customers", "language", "language TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "birthday", "birthday TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "customers", "marketing", "marketing INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(sqlite, "customers", "contacts_json", "contacts_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(sqlite, "customers", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_order_lines", "op_code_id", "op_code_id INTEGER");
  addColumnIfMissing(sqlite, "vehicles", "plate", "plate TEXT NOT NULL DEFAULT ''");
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate)`);
  addColumnIfMissing(sqlite, "vehicles", "stock_number", "stock_number TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "trim", "trim TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "body_style", "body_style TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "engine", "engine TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "transmission", "transmission TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "drivetrain", "drivetrain TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "fuel", "fuel TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "interior_color", "interior_color TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "doors", "doors INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "vehicles", "condition", "condition TEXT NOT NULL DEFAULT 'usado'");
  addColumnIfMissing(sqlite, "vehicles", "location", "location TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "key_number", "key_number TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "unit_number", "unit_number TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "acquired_at", "acquired_at TEXT");
  addColumnIfMissing(sqlite, "vehicles", "insurance", "insurance TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "insurance_policy", "insurance_policy TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "license_expiry", "license_expiry TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "inspection_due", "inspection_due TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "production_date", "production_date TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "alert", "alert TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "vehicles", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''");
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_vehicles_stock ON vehicles(stock_number)`);
  addColumnIfMissing(sqlite, "parts", "oem", "oem TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "parts", "alts_json", "alts_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(sqlite, "parts", "brand", "brand TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "parts", "category", "category TEXT NOT NULL DEFAULT 'otros'");
  addColumnIfMissing(sqlite, "parts", "vendor", "vendor TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "parts", "core", "core REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "parts", "taxable", "taxable INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(sqlite, "parts", "uom", "uom TEXT NOT NULL DEFAULT 'pza'");
  addColumnIfMissing(sqlite, "parts", "max_stock", "max_stock INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "parts", "on_order", "on_order INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "parts", "status", "status TEXT NOT NULL DEFAULT 'activo'");
  addColumnIfMissing(sqlite, "parts", "special_order", "special_order INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "parts", "notes", "notes TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "parts", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''");
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_parts_oem ON parts(oem)`);
  const missingStock = sqlite.prepare("SELECT id, created_at FROM vehicles WHERE status IN ('en_stock','reservado','consignacion') AND (stock_number IS NULL OR stock_number = '') ORDER BY id").all();
  if (missingStock.length) {
    const taken = sqlite.prepare("SELECT stock_number FROM vehicles WHERE stock_number LIKE 'STK-%'").all();
    let max = 0;
    for (const row of taken) {
      const n = Number(String(row.stock_number || "").replace(/\D/g, "")) || 0;
      if (n > max) max = n;
    }
    const assign = sqlite.prepare("UPDATE vehicles SET stock_number = ?, acquired_at = COALESCE(acquired_at, ?) WHERE id = ?");
    for (const row of missingStock) {
      max += 1;
      assign.run(`STK-${String(max).padStart(4, "0")}`, row.created_at || null, row.id);
    }
  }
  addColumnIfMissing(sqlite, "work_orders", "km_in", "km_in INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "work_orders", "promised_at", "promised_at TEXT");
  addColumnIfMissing(sqlite, "work_orders", "tech_user_id", "tech_user_id INTEGER");
  addColumnIfMissing(sqlite, "work_orders", "tax_rate", "tax_rate REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "work_orders", "kind", "kind TEXT NOT NULL DEFAULT 'orden'");
  addColumnIfMissing(sqlite, "work_orders", "cause", "cause TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_orders", "correction", "correction TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_orders", "km_out", "km_out INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "work_orders", "discount_pct", "discount_pct REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "work_orders", "waiter", "waiter INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "work_orders", "priority", "priority TEXT NOT NULL DEFAULT 'normal'");
  addColumnIfMissing(sqlite, "work_orders", "po_number", "po_number TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_orders", "authorized_at", "authorized_at TEXT");
  addColumnIfMissing(sqlite, "work_orders", "authorized_by", "authorized_by TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_orders", "hold_reason", "hold_reason TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_orders", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_order_lines", "pay_type", "pay_type TEXT NOT NULL DEFAULT 'cliente'");
  addColumnIfMissing(sqlite, "work_order_lines", "authorized", "authorized INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(sqlite, "work_order_lines", "complaint", "complaint TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_order_lines", "cause", "cause TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "work_order_lines", "correction", "correction TEXT NOT NULL DEFAULT ''");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS op_code_parts (
      id TEXT PRIMARY KEY,
      op_code_id TEXT NOT NULL,
      part_id TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_op_code_parts_op ON op_code_parts(op_code_id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle ON work_orders(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_work_order_lines_wo ON work_order_lines(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_work_order_payments_wo ON work_order_payments(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
  `);
  addColumnIfMissing(sqlite, "shop_settings", "wo_prefix", "wo_prefix TEXT NOT NULL DEFAULT 'OT'");
  addColumnIfMissing(sqlite, "shop_settings", "wo_pad", "wo_pad INTEGER NOT NULL DEFAULT 4");
  addColumnIfMissing(sqlite, "customers", "code", "code TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "shop_settings", "labor_rate", "labor_rate REAL NOT NULL DEFAULT 145");
  addColumnIfMissing(sqlite, "shop_settings", "invoice_notes", "invoice_notes TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "shop_settings", "service_mode", "service_mode TEXT NOT NULL DEFAULT 'completo'");
  addColumnIfMissing(sqlite, "shop_settings", "opcode_categories", "opcode_categories TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "shop_settings", "part_categories", "part_categories TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "shop_settings", "part_uoms", "part_uoms TEXT NOT NULL DEFAULT ''");
  if (isIntegerPk(sqlite, "shop_settings")) {
    sqlite.exec(`INSERT OR IGNORE INTO shop_settings (id, name, tax_label, tax_rate) VALUES (1, 'Dealer DMS', 'GST', 5)`);
  }
  const addedWoNext = addColumnIfMissing(
    sqlite,
    "shop_settings",
    "wo_next_number",
    "wo_next_number INTEGER NOT NULL DEFAULT 1"
  );
  if (addedWoNext) {
    const numbers = sqlite.prepare("SELECT number FROM work_orders").all();
    let max = 0;
    for (const row of numbers) {
      const n = Number(String(row.number || "").replace(/\D/g, "")) || 0;
      if (n > max) max = n;
    }
    sqlite.prepare("UPDATE shop_settings SET wo_next_number = ?").run(max + 1);
  }
  ensureLegacyUuids(sqlite);
  backfillCustomerCodes(sqlite);
  if (isIntegerPk(sqlite, "customers")) {
    rebuildGuidPrimaryKeys(sqlite);
  }
  addColumnIfMissing(sqlite, "shop_settings", "service_mode", "service_mode TEXT NOT NULL DEFAULT 'completo'");
  const addedJob = addColumnIfMissing(sqlite, "users", "job", "job TEXT NOT NULL DEFAULT 'tecnico'");
  addColumnIfMissing(sqlite, "users", "phone", "phone TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "labor_rate", "labor_rate REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "users", "can_tech", "can_tech INTEGER NOT NULL DEFAULT 1");
  if (addedJob) {
    sqlite.exec(`
      UPDATE users SET
        job = CASE role
          WHEN 'empleado' THEN 'tecnico'
          WHEN 'gerente' THEN 'asesor'
          ELSE 'otro'
        END,
        can_tech = CASE WHEN role IN ('empleado', 'gerente') THEN 1 ELSE 0 END
    `);
  }
  addColumnIfMissing(sqlite, "users", "first_name", "first_name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "middle_name", "middle_name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "last_name", "last_name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "email", "email TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "document", "document TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "address", "address TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "city", "city TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "state", "state TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "zip", "zip TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "users", "notes", "notes TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "shop_settings", "gst_number", "gst_number TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, "sales", "tax_rate", "tax_rate REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "sales", "tax", "tax REAL NOT NULL DEFAULT 0");
  ensureShopSettingsRow(sqlite);
  applyCanadaShopDefaults(sqlite);
  backfillCustomerNames(sqlite);
  backfillUserNames(sqlite);
}

function isIntegerPk(sqlite, table) {
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
    const id = cols.find((c) => c.name === "id");
    return Boolean(id && /int/i.test(String(id.type || "")));
  } catch {
    return false;
  }
}

function tableExists(sqlite, table) {
  return Boolean(sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table));
}

const LEGACY_UUID_TABLES = [
  "users",
  "customers",
  "vehicles",
  "parts",
  "work_orders",
  "sales",
  "customer_notes",
  "vehicle_notes",
  "sale_payments",
  "work_order_lines",
  "work_order_payments",
  "inventory_movements",
  "op_codes",
  "expenses",
  "shop_settings",
];

function ensureLegacyUuids(sqlite) {
  for (const table of LEGACY_UUID_TABLES) {
    if (!tableExists(sqlite, table) || !isIntegerPk(sqlite, table)) continue;
    addColumnIfMissing(sqlite, table, "uuid", "uuid TEXT NOT NULL DEFAULT ''");
    const missing = sqlite.prepare(`SELECT id FROM ${table} WHERE uuid = '' OR uuid IS NULL`).all();
    const upd = sqlite.prepare(`UPDATE ${table} SET uuid = ? WHERE id = ?`);
    for (const row of missing) upd.run(newGuid(), row.id);
  }
}

function backfillCustomerCodes(sqlite) {
  if (!tableExists(sqlite, "customers")) return;
  const rows = sqlite.prepare("SELECT id, code FROM customers").all();
  const upd = sqlite.prepare("UPDATE customers SET code = ? WHERE id = ?");
  rows.forEach((row, index) => {
    if (String(row.code || "").trim()) return;
    const n = Number(String(row.id).replace(/\D/g, "")) || index + 1;
    upd.run(`C-${String(n).padStart(4, "0")}`, row.id);
  });
}

function ensureShopSettingsRow(sqlite) {
  const count = sqlite.prepare("SELECT COUNT(*) AS n FROM shop_settings").get();
  if (Number(count?.n) > 0) return;
  sqlite
    .prepare(
      `INSERT INTO shop_settings (id, name, tax_label, tax_rate, wo_prefix, wo_next_number, wo_pad, labor_rate, invoice_notes)
       VALUES (?, 'Dealer DMS', 'GST', 5, 'OT', 1, 4, 145, 'Prices in CAD. GST 5% (Alberta — no provincial sales tax).')`
    )
    .run(newGuid());
}

function applyCanadaShopDefaults(sqlite) {
  const row = sqlite.prepare(
    "SELECT id, tax_label, tax_rate, labor_rate, address, invoice_notes FROM shop_settings LIMIT 1"
  ).get();
  if (!row) return;
  const patch = {};
  if (!row.tax_label || row.tax_label === "IVA") patch.tax_label = "GST";
  if (!Number(row.tax_rate)) patch.tax_rate = 5;
  if (Number(row.labor_rate) === 850) patch.labor_rate = 145;
  if (!String(row.address || "").trim()) patch.address = "Calgary, AB, Canada";
  if (!String(row.invoice_notes || "").trim()) {
    patch.invoice_notes = "Prices in CAD. GST 5% (Alberta — no provincial sales tax).";
  }
  const keys = Object.keys(patch);
  if (!keys.length) return;
  sqlite.prepare(`UPDATE shop_settings SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
    ...keys.map((k) => patch[k]),
    row.id
  );
}

function splitLegacyName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: parts[0] };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts[parts.length - 1] };
}

function splitEmployeeName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts[parts.length - 1] };
}

function backfillCustomerNames(sqlite) {
  const rows = sqlite.prepare("SELECT id, name, first_name, last_name FROM customers").all();
  const update = sqlite.prepare(
    "UPDATE customers SET first_name = ?, middle_name = ?, last_name = ?, name = ? WHERE id = ?"
  );
  for (const row of rows) {
    if (row.first_name && row.last_name) continue;
    const split = splitLegacyName(row.name);
    const full = [split.firstName, split.middleName, split.lastName].filter(Boolean).join(" ");
    update.run(split.firstName, split.middleName, split.lastName, full || row.name, row.id);
  }
}

function backfillUserNames(sqlite) {
  const rows = sqlite.prepare("SELECT id, name, first_name, last_name FROM users").all();
  const update = sqlite.prepare("UPDATE users SET first_name = ?, middle_name = ?, last_name = ? WHERE id = ?");
  for (const row of rows) {
    if (row.first_name || row.last_name) continue;
    const split = splitEmployeeName(row.name);
    update.run(split.firstName, split.middleName, split.lastName, row.id);
  }
}

module.exports = { migrate, nowIso, splitLegacyName, splitEmployeeName, newGuid };
