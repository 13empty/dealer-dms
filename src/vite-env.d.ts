/// <reference types="vite/client" />

type Result<T> = Promise<{ ok: true; data: T } | { ok: false; error: string }>;

export type CustomerPhone = {
  label: string;
  number: string;
};

export type CustomerContact = {
  name: string;
  role: string;
  phone: string;
  email: string;
};

export type CustomerNote = {
  id: string;
  customerId: string;
  body: string;
  userName: string;
  createdAt: string;
};

export type CustomerType = "particular" | "empresa" | "flotilla" | "seguro" | "mayoreo";
export type CustomerStatus = "activo" | "inactivo" | "bloqueado";
export type CustomerSource = "mostrador" | "referido" | "web" | "facebook" | "whatsapp" | "otro";

export type Customer = {
  id: string;
  code?: string;
  name: string;
  firstName: string;
  middleName: string;
  lastName: string;
  company?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  source?: CustomerSource;
  taxExempt?: number;
  accountOpen?: number;
  creditLimit?: number;
  discountPct?: number;
  preferredContact?: "phone" | "email" | "whatsapp";
  language?: string;
  birthday?: string;
  marketing?: number;
  phone: string;
  phones?: CustomerPhone[];
  phonesJson?: string;
  contacts?: CustomerContact[];
  contactsJson?: string;
  email: string;
  document: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
  lastVisit?: string | null;
  lifetime?: number;
  receivable?: number;
  openOrders?: number;
  vehicleCount?: number;
  creditLeft?: number | null;
  sales?: Sale[];
  workOrders?: WorkOrder[];
  vehicles?: Vehicle[];
  notesLog?: CustomerNote[];
};

export type UserRole = "admin" | "master" | "gerente" | "empleado";

export type UserJob = "tecnico" | "asesor" | "partes" | "ventas" | "caja" | "otro";

export type AppUser = {
  id: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  username: string;
  role: UserRole;
  roleLabel: string;
  job?: UserJob;
  phone?: string;
  email?: string;
  document?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  laborRate?: number;
  canTech?: number;
  assigned?: boolean;
  active: number;
  createdAt: string;
  updatedAt: string;
  permissions: {
    users: boolean;
    finance: boolean;
    destructive: boolean;
    demo: boolean;
    options: boolean;
    assignableRoles: UserRole[];
  };
};

export type AuthStatus = {
  needsSetup: boolean;
  user: AppUser | null;
  roles: Record<UserRole, { rank: number; label: string; hint: string }>;
};

export type VehicleStatus = "en_stock" | "reservado" | "vendido" | "cliente" | "consignacion";
export type VehicleCondition = "usado" | "nuevo" | "certificado";

export type VinDecoded = {
  vin: string;
  make?: string;
  model?: string;
  year?: string;
  trim?: string;
  engine?: string;
  doors?: string;
  bodyStyle?: string;
  fuel?: string;
  transmission?: string;
  drivetrain?: string;
};

export type VehicleNote = {
  id: string;
  vehicleId: string;
  body: string;
  userName: string;
  createdAt: string;
};

export type Vehicle = {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  km: number;
  cost: number;
  price: number;
  status: VehicleStatus;
  customerId: string | null;
  notes: string;
  createdAt: string;
  stockNumber?: string;
  trim?: string;
  bodyStyle?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  fuel?: string;
  interiorColor?: string;
  doors?: number;
  condition?: VehicleCondition;
  location?: string;
  keyNumber?: string;
  unitNumber?: string;
  acquiredAt?: string | null;
  insurance?: string;
  insurancePolicy?: string;
  licenseExpiry?: string;
  inspectionDue?: string;
  productionDate?: string;
  alert?: string;
  updatedAt?: string;
  daysInStock?: number;
  lastVisit?: string | null;
  openOrders?: number;
  vinCheckOk?: boolean;
  plateClash?: boolean;
  inspectionOverdue?: boolean;
  licenseOverdue?: boolean;
  customer?: Customer | null;
  workOrders?: WorkOrder[];
  sales?: Sale[];
  notesLog?: VehicleNote[];
};

export type SalePayment = {
  id: string;
  saleId: string;
  amount: number;
  method: string;
  paidAt: string;
  notes: string;
};

export type Sale = {
  id: string;
  customerId: string;
  vehicleId: string;
  price: number;
  taxRate?: number;
  tax?: number;
  total?: number;
  downPayment: number;
  paymentMethod: "contado" | "financiado";
  status: "borrador" | "cerrada" | "entregada";
  notes: string;
  closedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  customer?: Customer;
  vehicle?: Vehicle;
  payments?: SalePayment[];
  paid?: number;
  balance?: number;
};

export type Part = {
  id: string;
  sku: string;
  name: string;
  description: string;
  location: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  createdAt: string;
  oem?: string;
  altsJson?: string;
  alts?: string[];
  brand?: string;
  category?: string;
  vendor?: string;
  core?: number;
  taxable?: number;
  uom?: string;
  maxStock?: number;
  onOrder?: number;
  status?: "activo" | "descontinuado";
  specialOrder?: number;
  notes?: string;
  updatedAt?: string;
  reorderQty?: number;
  low?: boolean;
  margin?: number;
  marginPct?: number;
  lastSold?: string | null;
  lastReceived?: string | null;
  movements?: InventoryMovement[];
  usage?: Array<WorkOrderLine & { workOrder?: { id: string; number: string; status: string; kind?: string } | null }>;
};

export type InventoryMovement = {
  id: string;
  partId: string;
  qty: number;
  reason: string;
  workOrderLineId: string | null;
  notes: string;
  createdAt: string;
};

export type OpCodePart = {
  id?: string;
  opCodeId?: string;
  partId: string;
  qty: number;
  sku?: string;
  name?: string;
  price?: number;
  stock?: number;
};

export type OpCode = {
  id: string;
  code: string;
  description: string;
  category: string;
  payType: string;
  laborHours: number;
  laborRate: number;
  price: number;
  cost: number;
  skillLevel: "A" | "B" | "C";
  concern: string;
  cause: string;
  correction: string;
  popular: number;
  active: number;
  notes: string;
  createdAt: string;
  parts?: OpCodePart[];
};

export type WorkOrderLine = {
  id: string;
  workOrderId: string;
  type: "labor" | "part";
  description: string;
  partId: string | null;
  opCodeId: string | null;
  qty: number;
  unitPrice: number;
  unitCost: number;
  payType?: "cliente" | "garantia" | "interno" | "sublet";
  authorized?: number;
  complaint?: string;
  cause?: string;
  correction?: string;
  opcode?: OpCode | null;
};

export type WorkOrderPayment = {
  id: string;
  workOrderId: string;
  amount: number;
  method: string;
  paidAt: string;
  notes: string;
};

export type WorkOrderStatus =
  | "recepcion"
  | "autorizacion"
  | "espera_partes"
  | "en_taller"
  | "en_espera"
  | "lista"
  | "entregada";

export type WorkOrder = {
  id: string;
  number: string;
  customerId: string;
  vehicleId: string;
  status: WorkOrderStatus;
  kind?: "orden" | "presupuesto";
  complaint: string;
  cause?: string;
  correction?: string;
  notes: string;
  kmIn: number;
  kmOut?: number;
  promisedAt: string | null;
  techUserId: string | null;
  taxRate: number;
  discountPct?: number;
  waiter?: number;
  priority?: "normal" | "urgente";
  poNumber?: string;
  authorizedAt?: string | null;
  authorizedBy?: string;
  holdReason?: string;
  createdAt: string;
  deliveredAt: string | null;
  customer?: Customer;
  vehicle?: Vehicle;
  tech?: { id: string; name: string; username: string; laborRate?: number } | null;
  lines?: WorkOrderLine[];
  payments?: WorkOrderPayment[];
  history?: WorkOrder[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  paid?: number;
  balance?: number;
  total?: number;
  cost?: number;
  margin?: number;
  warrantyTotal?: number;
  internalTotal?: number;
  declinedTotal?: number;
  overdue?: boolean;
};

export type ShopSettings = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  taxLabel: string;
  taxRate: number;
  gstNumber?: string;
  woPrefix?: string;
  woNextNumber?: number;
  woPad?: number;
  woPreview?: string;
  laborRate?: number;
  invoiceNotes?: string;
  serviceMode?: "sencillo" | "completo";
  opcodeCategories?: string[];
  partCategories?: string[];
  partUoms?: string[];
  catalogs?: ShopCatalogs;
};

export type CatalogItem = {
  id: string;
  inUse: number;
  locked?: boolean;
};

export type ShopCatalogs = {
  opcodeCategories: CatalogItem[];
  partCategories: CatalogItem[];
  partUoms: CatalogItem[];
  payTypes: CatalogItem[];
};

export type GlobalSearchHit = {
  type: "customer" | "vehicle" | "workOrder" | "part" | "sale";
  id: string;
  href: string;
  label: string;
  hint?: string;
};

export type GlobalSearchResult = {
  customers: GlobalSearchHit[];
  vehicles: GlobalSearchHit[];
  workOrders: GlobalSearchHit[];
  parts: GlobalSearchHit[];
  sales: GlobalSearchHit[];
};

export type StaffUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  job?: string;
  laborRate?: number;
  canTech?: number;
  active: number;
};

export type DashboardKpis = {
  vehiclesInStock: number;
  vehiclesReserved: number;
  salesThisMonth: number;
  salesAmount: number;
  salesMargin: number;
  openWorkOrders: number;
  readyWorkOrders: number;
  unpaidOpenOrders: number;
  unpaidAmount: number;
  lowStockCount: number;
  lowStock: Part[];
  workshopRevenue: number;
  workshopMargin: number;
  totalMargin: number;
  inShopCount?: number;
  waitingPartsCount?: number;
  waitingAuthCount?: number;
  estimatesOpen?: number;
  overdueCount?: number;
  deliveredThisMonth?: number;
};

export type Expense = {
  id: string;
  amount: number;
  category: "partes" | "renta" | "servicios" | "sueldos" | "otros";
  method: string;
  spentAt: string;
  notes: string;
};

export type FinanceCashbox = {
  method: string;
  in: number;
  out: number;
  net: number;
};

export type FinanceJournalEntry = {
  id: string;
  at: string;
  type: "ingreso" | "gasto";
  source: "venta" | "taller" | "gasto" | "ingreso";
  label: string;
  method: string;
  amount: number;
  href: string | null;
  expenseId?: string;
  incomeId?: string;
  category?: string;
};

export type FinancePeriod = "today" | "week" | "month" | "year" | "range";

export type FinanceReceivable = {
  kind: "taller" | "venta";
  id: string;
  number: string;
  customer?: Customer;
  total?: number;
  paid?: number;
  balance?: number;
  since?: string;
  bucket?: "0-30" | "31-60" | "61-90" | "90+";
};

export type FinanceRankRow = {
  id: string;
  sku?: string;
  code?: string;
  name: string;
  qty?: number;
  units?: number;
  amount: number;
  cost?: number;
  margin?: number;
};

export type FinanceTechRow = {
  id: string;
  name: string;
  roCount: number;
  billed: number;
  laborAmount: number;
};

export type FinanceReport = {
  shop: {
    roCount: number;
    billed: number;
    cost: number;
    margin: number;
    avgRo: number;
    labor: number;
    parts: number;
    sublet: number;
    laborCost: number;
    partsCost: number;
    subletCost: number;
    laborMargin: number;
    partsMargin: number;
    subletMargin: number;
  };
  sales: {
    units: number;
    amount: number;
    cost: number;
    margin: number;
    byMake: Array<{ id: string; name: string; units: number; amount: number; margin: number }>;
  };
  topParts: FinanceRankRow[];
  topOps: FinanceRankRow[];
  techs: FinanceTechRow[];
  expensesByCategory: Array<{ category: Expense["category"]; amount: number }>;
  aging: Array<{ bucket: "0-30" | "31-60" | "61-90" | "90+"; count: number; amount: number }>;
};

export type FinanceSummary = {
  period: FinancePeriod;
  from?: string;
  to?: string;
  taxLabel: string;
  books: {
    collected: number;
    collectedSales: number;
    collectedShop: number;
    collectedOther?: number;
    spent: number;
    net: number;
    receivable: number;
    taxCollected: number;
  };
  cashbox: FinanceCashbox[];
  journal: FinanceJournalEntry[];
  expenses: Expense[];
  incomes?: Array<{ id: string; amount: number; method: string; receivedAt: string; notes: string }>;
  receivables: FinanceReceivable[];
  kpis: DashboardKpis;
  report?: FinanceReport;
};

interface DmsApi {
  auth: {
    status: () => Result<AuthStatus>;
    setup: (data: { name: string; username: string; password: string }) => Result<AppUser>;
    login: (data: { username: string; password: string }) => Result<AppUser>;
    logout: () => Result<{ ok: boolean }>;
    me: () => Result<AppUser>;
  };
  users: {
    list: (q?: string) => Result<AppUser[]>;
    create: (data: {
      name?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      username: string;
      password: string;
      role: UserRole;
      job?: UserJob;
      phone?: string;
      email?: string;
      document?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      notes?: string;
      laborRate?: number;
      canTech?: number;
    }) => Result<AppUser>;
    update: (
      id: string,
      data: Partial<
        Pick<
          AppUser,
          | "name"
          | "firstName"
          | "middleName"
          | "lastName"
          | "username"
          | "role"
          | "active"
          | "job"
          | "phone"
          | "email"
          | "document"
          | "address"
          | "city"
          | "state"
          | "zip"
          | "notes"
          | "laborRate"
          | "canTech"
        >
      >
    ) => Result<AppUser>;
    setPassword: (id: string, password: string) => Result<{ id: string }>;
    remove: (id: string) => Result<{ id: string }>;
  };
  customers: {
    list: (q?: string, opts?: { limit?: number; lite?: boolean; type?: string; status?: string; balance?: boolean }) => Result<Customer[]>;
    get: (id: string) => Result<Customer | null>;
    create: (data: Partial<Customer> & { vehicle?: Partial<Vehicle>; force?: boolean; contacts?: CustomerContact[] }) => Result<Customer>;
    update: (id: string, data: Partial<Customer> & { force?: boolean; contacts?: CustomerContact[] }) => Result<Customer>;
    remove: (id: string) => Result<{ id: string }>;
    findDuplicates: (data: Partial<Customer> & { excludeId?: string }) => Result<Customer[]>;
    addNote: (id: string, body: string) => Result<Customer>;
    unlinkVehicle: (id: string, vehicleId: string) => Result<Customer>;
  };
  vehicles: {
    list: (
      q?: string,
      status?: string,
      opts?: { limit?: number; customerId?: string; kind?: string; aging?: number; condition?: string }
    ) => Result<Vehicle[]>;
    get: (id: string, opts?: { history?: boolean }) => Result<Vehicle | null>;
    create: (data: Partial<Vehicle>) => Result<Vehicle>;
    update: (id: string, data: Partial<Vehicle>) => Result<Vehicle>;
    decodeVin: (vin: string) => Result<VinDecoded>;
    addNote: (id: string, body: string) => Result<Vehicle>;
    remove: (id: string) => Result<{ id: string }>;
  };
  sales: {
    list: (q?: string, opts?: { unpaid?: boolean; status?: string; limit?: number }) => Result<Sale[]>;
    get: (id: string) => Result<Sale | null>;
    create: (data: Partial<Sale>) => Result<Sale>;
    update: (id: string, data: Partial<Sale>) => Result<Sale>;
    close: (id: string) => Result<Sale>;
    deliver: (id: string) => Result<Sale>;
    addPayment: (id: string, data: Partial<SalePayment> & { close?: boolean }) => Result<Sale>;
    remove: (id: string) => Result<{ id: string }>;
  };
  parts: {
    list: (
      q?: string,
      opts?: { limit?: number; category?: string; status?: string; low?: boolean; reorder?: boolean; activeOnly?: boolean }
    ) => Result<Part[]>;
    get: (id: string) => Result<Part | null>;
    create: (data: Partial<Part> & { alts?: string[] | string }) => Result<Part>;
    update: (id: string, data: Partial<Part> & { alts?: string[] | string }) => Result<Part>;
    adjust: (id: string, data: { qty: number; notes?: string; reason?: string }) => Result<Part>;
    receive: (id: string, data: { qty: number; cost?: number; vendor?: string; notes?: string }) => Result<Part>;
    order: (id: string, data: { qty: number; vendor?: string }) => Result<Part>;
    remove: (id: string) => Result<{ id: string }>;
  };
  workOrders: {
    list: (
      q?: string,
      opts?: { status?: string; kind?: string; techUserId?: string; unpaid?: boolean; overdue?: boolean; open?: boolean; limit?: number }
    ) => Result<WorkOrder[]>;
    get: (id: string) => Result<WorkOrder | null>;
    create: (data: Partial<WorkOrder>) => Result<WorkOrder>;
    update: (id: string, data: Partial<WorkOrder>) => Result<WorkOrder>;
    setStatus: (id: string, status: WorkOrder["status"]) => Result<WorkOrder>;
    addLine: (
      id: string,
      data: Partial<WorkOrderLine> & { partId?: string; opCodeId?: string }
    ) => Result<WorkOrder>;
    updateLine: (lineId: string, data: Partial<WorkOrderLine>) => Result<WorkOrder>;
    removeLine: (lineId: string) => Result<WorkOrder>;
    remove: (id: string) => Result<{ id: string }>;
    deliver: (id: string, data?: { kmOut?: number; force?: boolean }) => Result<WorkOrder>;
    addPayment: (id: string, data: Partial<WorkOrderPayment> & { close?: boolean; kmOut?: number }) => Result<WorkOrder>;
    authorize: (id: string, data?: { authorizedBy?: string }) => Result<WorkOrder>;
    convert: (id: string) => Result<WorkOrder>;
    setNumber: (id: string, number: string) => Result<WorkOrder>;
  };
  settings: {
    get: () => Result<ShopSettings>;
    save: (data: Partial<ShopSettings>) => Result<ShopSettings>;
    saveNumbering: (data: { woPrefix?: string; woNextNumber?: number; woPad?: number }) => Result<ShopSettings>;
    catalogs: () => Result<ShopCatalogs>;
    saveCatalogs: (data: {
      opcodeCategories?: string[] | CatalogItem[];
      partCategories?: string[] | CatalogItem[];
      partUoms?: string[] | CatalogItem[];
    }) => Result<ShopCatalogs>;
  };
  search: {
    global: (q: string) => Result<GlobalSearchResult>;
  };
  staff: {
    list: () => Result<StaffUser[]>;
  };
  opCodes: {
    list: (q?: string, opts?: { activeOnly?: boolean }) => Result<OpCode[]>;
    get: (id: string) => Result<OpCode | null>;
    create: (data: Partial<OpCode> & { parts?: Array<{ partId: string; qty?: number }> }) => Result<OpCode>;
    update: (id: string, data: Partial<OpCode> & { parts?: Array<{ partId: string; qty?: number }> }) => Result<OpCode>;
    remove: (id: string) => Result<{ id: string; deactivated?: boolean }>;
  };
  dashboard: { kpis: () => Result<DashboardKpis> };
  finance: {
    summary: (period?: FinancePeriod | { period: FinancePeriod; from?: string; to?: string }) => Result<FinanceSummary>;
    addExpense: (data: Partial<Expense>) => Result<Expense>;
    removeExpense: (id: string) => Result<{ id: string }>;
    collect: (data: {
      kind: "taller" | "venta" | "otro";
      id?: string;
      amount?: number | string;
      method?: string;
      paidAt?: string;
      notes?: string;
      close?: boolean;
    }) => Result<unknown>;
    removeIncome: (id: string) => Result<{ id: string }>;
  };
  demo: {
    seed: () => Result<unknown>;
    isEmpty: () => Result<boolean>;
  };
  meta: {
    dbPath: () => Result<string>;
    isPackaged: () => Result<boolean>;
  };
  sql: {
    tables: () => Result<SqlTable[]>;
    query: (sql: string, opts?: { limit?: number }) => Result<SqlQueryResult>;
  };
}

export type SqlTable = {
  name: string;
  type: string;
  rows: number;
  columns: Array<{ name: string; type: string }>;
};

export type SqlQueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  limit: number;
};

declare global {
  interface Window {
    dms: DmsApi;
  }
}

export {};
