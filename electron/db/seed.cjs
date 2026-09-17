const repo = require("./repo.cjs");

const STARTER_OP_CODE = {
  code: "GEN",
  description: "General",
  category: "otros",
  payType: "cliente",
  laborHours: 1,
  laborRate: 0,
  popular: 1,
  concern: "Trabajo general",
  cause: "",
  correction: "Según inspección",
};

const DEMO_OP_CODES = [
  {
    code: "LOF",
    description: "Cambio de aceite y filtro",
    category: "mantenimiento",
    payType: "cliente",
    laborHours: 0.5,
    laborRate: 145,
    cost: 120,
    skillLevel: "C",
    popular: 1,
    concern: "Mantenimiento de aceite",
    cause: "Intervalo de servicio",
    correction: "Reemplazar aceite y filtro, resetear indicador",
  },
  {
    code: "ROT",
    description: "Rotación de llantas",
    category: "llantas",
    laborHours: 0.4,
    laborRate: 145,
    cost: 80,
    skillLevel: "C",
    popular: 1,
    concern: "Desgaste irregular de llantas",
    correction: "Rotar según patrón del fabricante",
  },
  {
    code: "ALIN",
    description: "Alineación de dirección",
    category: "suspension",
    laborHours: 1.0,
    laborRate: 145,
    cost: 200,
    skillLevel: "B",
    concern: "El vehículo se va a un lado",
    correction: "Alinear ángulos a especificación",
  },
  {
    code: "BRK-F",
    description: "Pastillas de freno delanteras",
    category: "frenos",
    laborHours: 1.2,
    laborRate: 145,
    cost: 280,
    skillLevel: "B",
    popular: 1,
    concern: "Ruido o pedal bajo al frenar",
    cause: "Pastillas desgastadas",
    correction: "Reemplazar pastillas delanteras y revisar discos",
  },
  {
    code: "BRK-R",
    description: "Pastillas de freno traseras",
    category: "frenos",
    laborHours: 1.2,
    laborRate: 145,
    cost: 280,
    skillLevel: "B",
    concern: "Frenado irregular atrás",
    correction: "Reemplazar pastillas traseras",
  },
  {
    code: "DIAG",
    description: "Diagnóstico general / scanner",
    category: "diagnostico",
    laborHours: 0.8,
    laborRate: 160,
    cost: 150,
    skillLevel: "A",
    popular: 1,
    concern: "Luz de falla encendida o síntoma intermitente",
    cause: "Por determinar",
    correction: "Diagnóstico con scanner y prueba de componentes",
  },
  {
    code: "BAT",
    description: "Prueba y reemplazo de batería",
    category: "electrico",
    laborHours: 0.4,
    laborRate: 145,
    cost: 90,
    skillLevel: "C",
    concern: "No arranca o arranque lento",
    correction: "Probar sistema de carga y reemplazar batería si aplica",
  },
  {
    code: "AC-R",
    description: "Recarga de aire acondicionado",
    category: "climatizacion",
    laborHours: 0.8,
    laborRate: 145,
    cost: 180,
    skillLevel: "B",
    concern: "El A/C no enfría",
    correction: "Vacío, recarga de gas y prueba de presiones",
  },
  {
    code: "INSP",
    description: "Inspección multipunto",
    category: "mantenimiento",
    laborHours: 0.5,
    laborRate: 0,
    price: 0,
    cost: 50,
    skillLevel: "C",
    popular: 1,
    concern: "Revisión de seguridad",
    correction: "Inspección de frenos, suspensión, fugas y luces",
  },
  {
    code: "SPARK",
    description: "Cambio de bujías",
    category: "motor",
    laborHours: 1.0,
    laborRate: 145,
    cost: 160,
    skillLevel: "B",
    concern: "Falla de encendido o consumo alto",
    correction: "Reemplazar bujías a especificación",
  },
  {
    code: "FIL-A",
    description: "Cambio de filtro de aire",
    category: "mantenimiento",
    laborHours: 0.2,
    laborRate: 145,
    cost: 40,
    skillLevel: "C",
    concern: "Mantenimiento de motor",
    correction: "Reemplazar filtro de aire",
  },
  {
    code: "WPR",
    description: "Cambio de plumillas",
    category: "otros",
    laborHours: 0.2,
    laborRate: 145,
    cost: 30,
    skillLevel: "C",
    concern: "Rayones o mal barrido",
    correction: "Instalar plumillas nuevas",
  },
];

function seedDefaultOpCodes() {
  if (repo.listOpCodes().length) return { skipped: true };
  repo.createOpCode(STARTER_OP_CODE);
  return { ok: true, count: 1 };
}

function seedStarter() {
  const auth = require("./auth.cjs");
  if (auth.userCount() === 0) {
    auth.setupAdmin({
      name: "Admin",
      username: "admin",
      password: "Admin123",
      job: "otro",
      canTech: 1,
    });
  }
  if (!repo.listCustomers("", { limit: 1, lite: true }).length) {
    repo.createCustomer({
      type: "empresa",
      company: "Taller",
      source: "mostrador",
      accountOpen: 1,
      city: "Calgary",
      state: "AB",
      notes: "Cuenta interna del taller.",
    });
  }
  seedDefaultOpCodes();
  return { ok: true };
}

function seedDemo() {
  if (!repo.isEmpty()) {
    throw new Error("La base ya tiene datos. El ejemplo solo se carga en un taller vacío.");
  }

  const ana = repo.createCustomer({
    firstName: "Ana",
    middleName: "Lucía",
    lastName: "López",
    type: "particular",
    source: "whatsapp",
    preferredContact: "whatsapp",
    phones: [
      { label: "Móvil", number: "403 555 3344" },
      { label: "WhatsApp", number: "403 555 3344" },
    ],
    email: "ana.lopez@correo.com",
    document: "AB-850112",
    address: "123 8 Ave SW",
    city: "Calgary",
    state: "AB",
    zip: "T2P 1J9",
    notes: "Prefiere contacto por WhatsApp. Interesada en SUV.",
  });
  const carlos = repo.createCustomer({
    firstName: "Carlos",
    middleName: "",
    lastName: "Mendoza",
    type: "flotilla",
    company: "Mendoza Logística",
    accountOpen: 1,
    creditLimit: 50000,
    taxExempt: 1,
    source: "referido",
    contacts: [{ name: "Laura Mendoza", role: "contabilidad", phone: "403 555 4400", email: "facturas@mendoza.local" }],
    phones: [
      { label: "Móvil", number: "403 555 1122" },
      { label: "Trabajo", number: "403 555 4400" },
    ],
    email: "cmendoza@mail.com",
    document: "AB-790204",
    address: "220 4 St SE",
    city: "Calgary",
    state: "AB",
    zip: "T2G 1T7",
    notes: "Flotilla de 2 unidades. Factura a nombre de Mendoza Logística.",
  });
  const maria = repo.createCustomer({
    firstName: "María",
    middleName: "Elena",
    lastName: "Fernández",
    type: "particular",
    source: "mostrador",
    discountPct: 5,
    phones: [
      { label: "Móvil", number: "403 555 7788" },
      { label: "Casa", number: "403 555 1200" },
    ],
    email: "mfernandez@mail.com",
    document: "AB-920608",
    address: "45 Valley Ridge Dr NW",
    city: "Calgary",
    state: "AB",
    zip: "T3B 5T3",
    notes: "Cliente de taller frecuente. Unidad Jetta 2019.",
  });
  const roberto = repo.createCustomer({
    firstName: "Roberto",
    middleName: "",
    lastName: "Díaz",
    type: "particular",
    source: "web",
    phones: [{ label: "Móvil", number: "403 555 5566" }],
    email: "rdiaz@mail.com",
    document: "AB-880101",
    address: "890 17 Ave SW",
    city: "Calgary",
    state: "AB",
    zip: "T2T 0A1",
    notes: "Pidió prueba de manejo en Corolla.",
  });
  repo.addCustomerNote(maria.id, { body: "Cliente frecuente. Prefiere citas por la mañana.", userName: "Sistema" });

  const corolla = repo.createVehicle({
    vin: "1NXBR32E85Z123456",
    make: "Toyota",
    model: "Corolla",
    trim: "LE",
    year: 2022,
    color: "Blanco",
    interiorColor: "Gris",
    bodyStyle: "sedan",
    engine: "1.8L",
    transmission: "cvt",
    drivetrain: "FWD",
    fuel: "gasolina",
    plate: "PUE-1245",
    km: 28400,
    cost: 245000,
    price: 289000,
    status: "en_stock",
    location: "Patio A",
    keyNumber: "A-12",
    condition: "usado",
  });
  const civic = repo.createVehicle({
    vin: "2HGFC2F59MH123457",
    make: "Honda",
    model: "Civic",
    trim: "EX",
    year: 2021,
    color: "Gris",
    bodyStyle: "sedan",
    transmission: "cvt",
    fuel: "gasolina",
    plate: "PUE-8821",
    km: 41200,
    cost: 268000,
    price: 315000,
    status: "en_stock",
    location: "Patio A",
  });
  repo.createVehicle({
    vin: "3N1CN8EV8PL123458",
    make: "Nissan",
    model: "Versa",
    year: 2023,
    color: "Rojo",
    plate: "PUE-3309",
    km: 15300,
    cost: 198000,
    price: 239000,
    status: "en_stock",
    location: "Patio B",
  });
  repo.createVehicle({
    vin: "1FTER4EH0LLA12345",
    make: "Ford",
    model: "Ranger",
    trim: "XLT",
    year: 2020,
    color: "Azul",
    bodyStyle: "pickup",
    drivetrain: "4x4",
    fuel: "diesel",
    plate: "PUE-7740",
    km: 67800,
    cost: 320000,
    price: 379000,
    status: "en_stock",
    location: "Taller recon",
    alert: "Falta llave de rueda",
  });
  const jetta = repo.createVehicle({
    vin: "3VW2K7AJ5KM123459",
    make: "Volkswagen",
    model: "Jetta",
    year: 2019,
    color: "Negro",
    plate: "PUE-4418",
    km: 89000,
    cost: 0,
    price: 0,
    status: "cliente",
    customerId: maria.id,
    notes: "Unidad del cliente para taller",
    insurance: "Intact",
    insurancePolicy: "Q-4418",
    unitNumber: "MAR-01",
  });
  const mazda = repo.createVehicle({
    vin: "JM3KFBCM5N0123460",
    make: "Mazda",
    model: "CX-5",
    trim: "Signature",
    year: 2022,
    color: "Rojo vino",
    bodyStyle: "suv",
    plate: "PUE-2196",
    km: 22100,
    cost: 355000,
    price: 419000,
    status: "en_stock",
    location: "Showroom",
  });

  const filtro = repo.createPart({
    sku: "FIL-ACE-001",
    name: "Filtro de aceite",
    description: "Universal 3/4-16",
    location: "A-12",
    stock: 24,
    minStock: 8,
    maxStock: 40,
    cost: 85,
    price: 160,
    oem: "15400-PLM-A02",
    alts: ["PH7317", "W71381"],
    brand: "Fram",
    category: "filtros",
    vendor: "NAPA",
  });
  repo.createPart({
    sku: "PAS-FRE-002",
    name: "Pastillas de freno delanteras",
    location: "B-03",
    stock: 10,
    minStock: 4,
    maxStock: 16,
    cost: 420,
    price: 790,
    oem: "45022-S5A-000",
    brand: "Akebono",
    category: "frenos",
    vendor: "NAPA",
    core: 80,
  });
  const aceite = repo.createPart({
    sku: "ACE-5W30-003",
    name: "Aceite 5W-30 sintético 4L",
    location: "A-01",
    stock: 18,
    minStock: 6,
    maxStock: 24,
    cost: 310,
    price: 520,
    brand: "Mobil",
    category: "fluidos",
    vendor: "NAPA",
    uom: "pza",
  });
  repo.createPart({
    sku: "FIL-AIR-004",
    name: "Filtro de aire",
    location: "A-14",
    stock: 12,
    minStock: 5,
    cost: 140,
    price: 260,
    oem: "17220-P2A-000",
    brand: "Fram",
    category: "filtros",
    vendor: "NAPA",
  });
  repo.createPart({
    sku: "BAT-12V-005",
    name: "Batería 12V 600 A",
    location: "C-02",
    stock: 3,
    minStock: 3,
    maxStock: 6,
    cost: 1450,
    price: 2290,
    brand: "LTH",
    category: "electrico",
    vendor: "LTH",
    core: 250,
  });
  repo.createPart({
    sku: "BUJ-IR-006",
    name: "Bujía iridio",
    location: "A-20",
    stock: 40,
    minStock: 16,
    cost: 95,
    price: 180,
    oem: "IZFR6K11",
    brand: "NGK",
    category: "motor",
    vendor: "NGK",
  });
  repo.createPart({
    sku: "AMP-H7-007",
    name: "Foco H7",
    location: "D-08",
    stock: 2,
    minStock: 6,
    maxStock: 20,
    cost: 45,
    price: 95,
    oem: "H7-12V",
    brand: "Philips",
    category: "electrico",
    vendor: "Philips",
    onOrder: 12,
  });

  for (const op of DEMO_OP_CODES) repo.createOpCode(op);
  repo.linkKnownOpcodeParts();
  const lof = repo.listOpCodes().find((o) => o.code === "LOF");
  const brk = repo.listOpCodes().find((o) => o.code === "BRK-F");

  const saleMazda = repo.createSale({
    customerId: ana.id,
    vehicleId: mazda.id,
    price: 415000,
    downPayment: 80000,
    paymentMethod: "financiado",
    notes: "Financiamiento 36 meses",
  });
  repo.closeSale(saleMazda.id);

  const saleCivic = repo.createSale({
    customerId: carlos.id,
    vehicleId: civic.id,
    price: 310000,
    downPayment: 310000,
    paymentMethod: "contado",
  });
  repo.closeSale(saleCivic.id);
  repo.deliverSale(saleCivic.id);

  const ot1 = repo.createWorkOrder({
    customerId: maria.id,
    vehicleId: jetta.id,
    complaint: "Cambio de aceite y revisión de frenos",
  });
  repo.addWorkOrderLine(ot1.id, { type: "labor", opCodeId: lof.id });
  repo.addWorkOrderLine(ot1.id, { type: "part", partId: aceite.id, qty: 1 });
  repo.addWorkOrderLine(ot1.id, { type: "part", partId: filtro.id, qty: 1 });
  repo.setWorkOrderStatus(ot1.id, "lista");

  const quote = repo.createWorkOrder({
    customerId: maria.id,
    vehicleId: jetta.id,
    kind: "presupuesto",
    complaint: "Cambio de balatas delanteras",
    cause: "Desgaste",
  });
  repo.addWorkOrderLine(quote.id, { type: "labor", opCodeId: brk.id });

  const ot2 = repo.createWorkOrder({
    customerId: roberto.id,
    vehicleId: corolla.id,
    complaint: "Ruido al frenar, cliente de stock en prueba de ruta",
  });
  repo.addWorkOrderLine(ot2.id, { type: "labor", opCodeId: brk.id });

  return { ok: true };
}

module.exports = { seedDemo, seedDefaultOpCodes, seedStarter };
