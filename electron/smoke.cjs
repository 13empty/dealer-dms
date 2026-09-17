const { app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { openDatabase } = require("./db/index.cjs");
const { seedDemo } = require("./db/seed.cjs");
const repo = require("./db/repo.cjs");
const auth = require("./db/auth.cjs");

app.whenReady().then(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-smoke-"));
  openDatabase(dir);
  seedDemo();

  const customers = repo.listCustomers();
  const opcodes = repo.listOpCodes();
  if (opcodes.length < 8) throw new Error("Faltan Op Codes de taller");
  const stock = repo.listVehicles("", "en_stock");
  if (!customers.length || !stock.length) throw new Error("Seed incompleto");
  const shopGst = repo.getSettings();
  if (shopGst.taxLabel !== "GST" || Number(shopGst.taxRate) !== 5) {
    throw new Error("El taller no arrancó con GST 5% de Alberta");
  }
  const ana = customers.find((c) => c.name.includes("Ana"));
  if (!ana?.phones?.length || !ana.address || !ana.firstName || !ana.middleName || !ana.lastName) {
    throw new Error("El cliente no guardó nombre partido, teléfonos o dirección");
  }

  const admin = auth.setupAdmin({ name: "Dueño App", username: "admin", password: "admin12" });
  const master = auth.createUser(admin, { name: "Dueño concesionario", username: "master", password: "master1", role: "master" });
  auth.createUser(master, { name: "Vendedor", username: "empleado", password: "emplea1", role: "empleado" });
  let denied = false;
  try {
    auth.createUser(master, { name: "Hacker", username: "hacker", password: "hacker1", role: "admin" });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error("Master no debería crear Admin");
  if (auth.listUsers(master).some((u) => u.role === "admin")) throw new Error("Master no debería ver Admins");

  const sale = repo.createSale({
    customerId: ana.id,
    vehicleId: stock[0].id,
    price: stock[0].price,
    downPayment: 1500,
    paymentMethod: "contado",
  });
  if (Number(sale.taxRate) !== 5) throw new Error("La venta no tomó GST 5%");
  const expectedSaleTax = Math.round(Number(sale.price) * 0.05 * 100) / 100;
  if (Math.abs(Number(sale.tax) - expectedSaleTax) > 0.02) throw new Error("El GST de la venta no cuadra");
  if (Math.abs(Number(sale.total) - (Number(sale.price) + Number(sale.tax))) > 0.02) {
    throw new Error("El total de la venta no incluye GST");
  }
  repo.closeSale(sale.id);
  const closed = repo.getSale(sale.id);
  const saleDue = Number(closed.price) + Number(closed.tax);
  if (Number(closed.paid) > saleDue + 0.009) throw new Error("El enganche superó el total con GST");
  const sold = repo.getVehicle(stock[0].id);
  if (closed.status !== "cerrada") throw new Error("La venta no se cerró");
  if (sold.status !== "vendido") throw new Error("El vehículo no pasó a vendido");
  const saleCustomer = repo.getCustomer(ana.id);
  if (Number(closed.balance) > 0.009 && Number(saleCustomer.receivable) + 0.05 < Number(closed.balance)) {
    throw new Error("El saldo del cliente no incluye GST de la venta");
  }

  const openWo = repo.listWorkOrders().find((o) => o.status !== "entregada");
  if (!openWo) throw new Error("No hay OT abierta");
  const lof = opcodes.find((o) => o.code === "LOF");
  if (!lof) throw new Error("Falta el Op Code LOF");
  const custom = repo.createOpCode({
    code: "CUST1",
    description: "Operación de prueba",
    category: "otros",
    payType: "cliente",
    laborHours: 1,
    laborRate: 800,
    skillLevel: "B",
  });
  if (custom.price !== 800) throw new Error("El precio del Op Code no se calculó");
  repo.addWorkOrderLine(openWo.id, { type: "labor", opCodeId: custom.id });
  const withOp = repo.getWorkOrder(openWo.id);
  if (!withOp.lines?.some((l) => l.opCodeId === custom.id)) throw new Error("No se agregó el Op Code a la OT");
  const kitPart = repo.listParts().find((p) => Number(p.stock) >= 2) || repo.listParts()[0];
  if (!kitPart) throw new Error("Falta una parte para el kit");
  const kit = repo.createOpCode({
    code: "KIT1",
    description: "Servicio con partes",
    category: "mantenimiento",
    laborHours: 0.5,
    laborRate: 800,
    parts: [{ partId: kitPart.id, qty: 2 }],
  });
  if (!kit.parts?.some((p) => p.partId === kitPart.id && Number(p.qty) === 2)) throw new Error("El Op Code no guardó las partes");
  const kitWo = repo.createWorkOrder({ customerId: openWo.customerId, vehicleId: openWo.vehicleId, complaint: "Kit" });
  repo.addWorkOrderLine(kitWo.id, { type: "labor", opCodeId: kit.id });
  const kitLoaded = repo.getWorkOrder(kitWo.id);
  if (!kitLoaded.lines?.some((l) => l.type === "labor" && l.opCodeId === kit.id)) throw new Error("El kit no agregó mano de obra");
  if (!kitLoaded.lines?.some((l) => l.type === "part" && l.partId === kitPart.id && Number(l.qty) === 2)) {
    throw new Error("El kit no agregó las partes a la OT");
  }

  repo.saveSettings({ name: "Taller Demo", phone: "2221110000", email: "taller@demo.local", address: "Calle 1", taxLabel: "IVA", taxRate: 16 });
  const settings = repo.getSettings();
  if (settings.taxRate !== 16) throw new Error("No se guardó el impuesto");
  const plated = repo.listVehicles().find((v) => v.plate === "PUE-4418");
  if (!plated) throw new Error("Falta la placa en el vehículo de ejemplo");
  if (!repo.listVehicles("PUE-4418", null, { limit: 5 }).length) throw new Error("No busca por placa");
  const stockUnit = repo.listVehicles("", "en_stock")[0];
  if (!String(stockUnit?.stockNumber || "").startsWith("STK-")) throw new Error("Falta número de stock");
  repo.updateVehicle(stockUnit.id, { trim: stockUnit.trim || "LE", location: "Patio A", alert: "Revisar llanta de refacción" });
  const aged = new Date(Date.now() - 40 * 86400000).toISOString();
  repo.updateVehicle(stockUnit.id, { acquiredAt: aged });
  if (!repo.listVehicles("", null, { aging: 30, kind: "inventory" }).some((v) => v.id === stockUnit.id)) {
    throw new Error("El filtro de antigüedad no funcionó");
  }
  if (!repo.listVehicles(stockUnit.stockNumber, null, { limit: 5 }).length) throw new Error("No busca por stock");
  repo.addVehicleNote(stockUnit.id, { body: "Inspección de compra", userName: "smoke" });
  const vehicleFile = repo.getVehicle(stockUnit.id, { history: true });
  if (!vehicleFile?.notesLog?.length || !vehicleFile.alert) throw new Error("Falta el expediente de vehículo");
  if (vehicleFile.daysInStock < 30) throw new Error("No calculó días en lote");
  let dupVin = false;
  try {
    repo.createVehicle({ vin: stockUnit.vin, make: "X", model: "Y" });
  } catch {
    dupVin = true;
  }
  if (!dupVin) throw new Error("Dejó crear un VIN duplicado");
  const messy = repo.createVehicle({ vin: "IOQ pendiente-12", make: "X", model: "Y", status: "en_stock" });
  if (messy.vin !== "IOQPENDIENTE12") throw new Error("No guardó un VIN libre");
  const vinDecode = require("./vin.cjs");
  const mapped = vinDecode.mapNhtsaRow(
    {
      Make: "HONDA",
      Model: "Accord",
      ModelYear: "2003",
      Trim: "EX",
      DisplacementL: "3.0",
      EngineCylinders: "6",
      FuelTypePrimary: "Gasoline",
      TransmissionStyle: "Automatic",
      DriveType: "Front-Wheel Drive (FWD)",
      BodyClass: "Sedan/Saloon",
      Doors: "4",
    },
    "1HGCM82633A004352"
  );
  if (mapped.make !== "HONDA" || mapped.model !== "Accord" || mapped.year !== "2003") {
    throw new Error("El decoder no mapeó marca/modelo");
  }
  if (mapped.fuel !== "gasolina" || mapped.transmission !== "automatico" || mapped.drivetrain !== "FWD" || mapped.bodyStyle !== "sedan") {
    throw new Error("El decoder no mapeó specs");
  }
  if (repo.listCustomers("", { limit: 2, lite: true }).length > 2) throw new Error("El buscador de clientes no limitó resultados");
  if (!repo.listCustomers("PUE-4418").length) throw new Error("No busca clientes por placa");
  const fleet = repo.listCustomers("", { type: "flotilla" });
  if (!fleet.some((c) => c.company === "Mendoza Logística" && c.taxExempt && c.contacts?.length)) {
    throw new Error("Falta el expediente de flotilla");
  }
  const customerFile = repo.getCustomer(fleet[0].id);
  if (!customerFile.code || !customerFile.notesLog) throw new Error("El expediente no armó código o bitácora");
  repo.addCustomerNote(customerFile.id, { body: "Llamó para programar servicio", userName: "smoke" });
  if (!repo.getCustomer(customerFile.id).notesLog?.some((n) => n.body.includes("programar"))) {
    throw new Error("No se guardó la nota del cliente");
  }
  let dupeBlocked = false;
  try {
    repo.createCustomer({ firstName: "Copia", lastName: "Ana", email: "ana.lopez@correo.com" });
  } catch {
    dupeBlocked = true;
  }
  if (!dupeBlocked) throw new Error("Debió detectar el cliente duplicado");
  const forced = repo.createCustomer({
    firstName: "Copia",
    lastName: "Ana",
    email: "ana.lopez@correo.com",
    force: true,
  });
  if (!forced?.id) throw new Error("No dejó forzar el alta con duplicado");
  repo.updateCustomer(forced.id, { status: "bloqueado" });
  const blockedCar = repo.createVehicle({
    vin: "1HGCM82633A009999",
    make: "Honda",
    model: "Civic",
    year: 2016,
    status: "cliente",
    customerId: forced.id,
  });
  let hold = false;
  try {
    repo.createWorkOrder({ customerId: forced.id, vehicleId: blockedCar.id, complaint: "no" });
  } catch {
    hold = true;
  }
  if (!hold) throw new Error("Un cliente bloqueado no debería abrir OT");
  const taxFree = repo.createWorkOrder({
    customerId: customerFile.id,
    vehicleId: repo.listVehicles("", null, { customerId: customerFile.id })[0]?.id || plated.id,
    complaint: "Revisión flotilla",
  });
  if (Number(taxFree.taxRate) !== 0) throw new Error("La flotilla exenta no tomó impuesto 0");

  const withCar = repo.createCustomer({
    firstName: "Luis",
    lastName: "Pérez",
    vehicle: {
      vin: "1HGCM82633A004352",
      plate: "PUE-9999",
      make: "Honda",
      model: "Accord",
      year: 2018,
      km: 50000,
    },
  });
  if (!withCar.vehicles?.some((v) => v.plate === "PUE-9999" && v.status === "cliente")) {
    throw new Error("El cliente nuevo no guardó su vehículo");
  }
  const billedWo = repo.createWorkOrder({
    customerId: plated.customerId,
    vehicleId: plated.id,
    complaint: "Ruido al frenar",
    kmIn: 90000,
    discountPct: 0,
  });
  if (billedWo.taxRate !== 16) throw new Error("La OT no tomó el impuesto del taller");
  repo.addWorkOrderLine(billedWo.id, { type: "labor", description: "Diagnóstico", qty: 1, unitPrice: 100 });
  const withTax = repo.getWorkOrder(billedWo.id);
  if (Math.abs(Number(withTax.tax) - 16) > 0.05) throw new Error("El impuesto de la OT no cuadra");
  repo.addWorkOrderPayment(billedWo.id, { amount: 50, method: "efectivo" });
  const collected = repo.getWorkOrder(billedWo.id);
  if (Math.abs(Number(collected.paid) - 50) > 0.05) throw new Error("No se registró el cobro de taller");
  const history = repo.getVehicle(plated.id, { history: true });
  if (!history?.workOrders?.length) throw new Error("Falta el historial del vehículo");

  const expense = repo.createExpense({ amount: 500, category: "renta", method: "transferencia", notes: "Local" });
  const books = repo.financeSummary("month");
  if (!books.expenses.some((e) => e.id === expense.id)) throw new Error("El gasto no quedó en contaduría");
  if (books.books.spent < 500) throw new Error("Los gastos del periodo no suman");
  if (typeof books.books.receivable !== "number") throw new Error("Falta el por cobrar");
  if (!books.cashbox.some((c) => c.method === "efectivo")) throw new Error("Falta el desglose de caja");
  const extraCash = repo.collectMoney({ kind: "otro", amount: 80, method: "efectivo", notes: "Ingreso suelto" });
  const booksIn = repo.financeSummary("month");
  if (!booksIn.incomes?.some((row) => row.id === extraCash.id)) throw new Error("El cobro no quedó en contaduría");
  if (Number(booksIn.books.collectedOther || 0) < 80) throw new Error("El ingreso suelto no sumó a caja");
  const weekBooks = repo.financeSummary("week");
  if (!weekBooks.report || !Array.isArray(weekBooks.report.topParts)) throw new Error("Falta el reporte de partes");
  if (!weekBooks.report.aging || weekBooks.report.aging.length !== 4) throw new Error("Falta la antigüedad por cobrar");
  if (!weekBooks.from || !weekBooks.to) throw new Error("El reporte no trae rango de fechas");
  const yearBooks = repo.financeSummary("year");
  if (yearBooks.period !== "year") throw new Error("No filtró el año");

  const beforeStock = repo.listParts()[0];
  const quotePart = repo.createWorkOrder({
    customerId: plated.customerId,
    vehicleId: plated.id,
    kind: "presupuesto",
    complaint: "Presupuesto de pieza",
  });
  const quoted = repo.addWorkOrderLine(quotePart.id, { type: "part", partId: beforeStock.id, qty: 1 });
  if (repo.getPart(beforeStock.id).stock !== beforeStock.stock) throw new Error("El presupuesto no debe descontar stock");
  repo.updateWorkOrderLine(quoted.lines[0].id, { authorized: 0 });
  if (Number(repo.getWorkOrder(quotePart.id).declinedTotal) <= 0) throw new Error("La línea declinada no se apartó del total");
  repo.updateWorkOrderLine(quoted.lines[0].id, { authorized: 1 });
  const converted = repo.convertEstimate(quotePart.id);
  if (converted.kind !== "orden") throw new Error("No se convirtió el presupuesto");
  if (repo.getPart(beforeStock.id).stock !== beforeStock.stock - 1) throw new Error("Al convertir no descontó la parte");
  repo.authorizeWorkOrder(converted.id, { authorizedBy: "smoke" });
  if (!repo.getWorkOrder(converted.id).authorizedAt) throw new Error("No se autorizó la OT");

  repo.saveWorkOrderNumbering({ woPrefix: "RO", woNextNumber: 42, woPad: 4 });
  const numbered = repo.createWorkOrder({
    customerId: plated.customerId,
    vehicleId: plated.id,
    complaint: "Numeración",
  });
  if (numbered.number !== "RO-0042") throw new Error("No aplicó el número de OT: " + numbered.number);
  const renamed = repo.setWorkOrderNumber(numbered.id, "RO-99");
  if (renamed.number !== "RO-0099") throw new Error("No cambió el número de OT");
  const again = repo.createWorkOrder({
    customerId: plated.customerId,
    vehicleId: plated.id,
    complaint: "Siguiente",
  });
  if (again.number !== "RO-0100") throw new Error("El siguiente número no avanzó: " + again.number);
  const hits = repo.searchGlobal("RO-0100");
  if (!hits.workOrders.some((h) => h.id === again.id)) throw new Error("El buscador global no halla la OT");
  if (!repo.searchGlobal(ana.firstName || "Ana").customers.length) throw new Error("El buscador global no halla clientes");
  if (!repo.searchGlobal("PUE-4418").vehicles.length) throw new Error("El buscador global no halla vehículos");
  if (!repo.searchGlobal("Mazda").sales.length && !repo.searchGlobal("CX-5").sales.length) throw new Error("El buscador global no halla ventas");
  if (!admin.permissions.options || !master.permissions.options) throw new Error("Admin/Master deben poder numerar OT");
  const gerente = auth.createUser(master, { name: "Gerente", username: "gerente", password: "gerente1", role: "gerente" });
  if (gerente.permissions.options) throw new Error("Gerente no debe cambiar numeración");
  if (gerente.job !== "asesor" || !gerente.canTech) throw new Error("Gerente debe ser asesor de taller");

  const techEmp = auth.createUser(master, {
    firstName: "Técnico",
    middleName: "Luis",
    lastName: "Uno",
    username: "tecnico1",
    password: "tecnic1",
    role: "empleado",
    job: "tecnico",
    laborRate: 900,
    phone: "33 1111 2222",
    email: "tecnico@taller.local",
    document: "CURP-TECH",
    address: "Calle Taller 12",
    city: "Puebla",
    state: "PUE",
    zip: "72000",
  });
  if (techEmp.name !== "Técnico Luis Uno" || techEmp.firstName !== "Técnico" || techEmp.lastName !== "Uno") {
    throw new Error("El técnico no guardó el nombre partido");
  }
  if (techEmp.job !== "tecnico" || !techEmp.canTech || Number(techEmp.laborRate) !== 900) {
    throw new Error("El técnico no guardó puesto, tarifa o taller");
  }
  if (techEmp.email !== "tecnico@taller.local" || techEmp.city !== "Puebla" || techEmp.phone !== "33 1111 2222") {
    throw new Error("El técnico no guardó contacto o dirección");
  }
  const salesEmp = auth.createUser(master, {
    name: "Ventas Uno",
    username: "ventas1",
    password: "ventas1",
    role: "empleado",
    job: "ventas",
  });
  if (salesEmp.canTech) throw new Error("Ventas no debe salir en el taller");
  const staff = repo.listStaff();
  if (!staff.some((s) => s.id === techEmp.id)) throw new Error("listStaff no incluye al técnico");
  if (staff.some((s) => s.id === salesEmp.id)) throw new Error("listStaff no debe incluir ventas");
  const assignedWo = repo.createWorkOrder({
    customerId: plated.customerId,
    vehicleId: plated.id,
    complaint: "Asignado a técnico",
    techUserId: techEmp.id,
  });
  if (assignedWo.techUserId !== techEmp.id) throw new Error("No asignó el técnico a la OT");
  let blockedDel = false;
  try {
    auth.removeUser(master, techEmp.id);
  } catch (e) {
    blockedDel = /asignad/i.test(String(e.message));
  }
  if (!blockedDel) throw new Error("No debe borrar empleado con OT asignadas");
  const off = auth.updateUser(master, techEmp.id, { active: 0 });
  if (off.active) throw new Error("No desactivó al técnico");
  if (!auth.listUsers(master).find((u) => u.id === techEmp.id)?.assigned) {
    throw new Error("El directorio no marca órdenes asignadas");
  }
  auth.removeUser(master, salesEmp.id);

  const due = repo.getWorkOrder(openWo.id);
  if (Number(due.balance) > 50) {
    const partial = repo.addWorkOrderPayment(openWo.id, { amount: 50, method: "efectivo", close: true });
    if (partial.status === "entregada") throw new Error("Un abono no debe entregar la OT");
  }
  const remaining = repo.getWorkOrder(openWo.id);
  const closedWo =
    Number(remaining.balance) > 0.009
      ? repo.addWorkOrderPayment(openWo.id, { amount: remaining.balance, method: "efectivo", close: true })
      : repo.deliverWorkOrder(openWo.id);
  if (closedWo.status !== "entregada") throw new Error("La OT no se entregó al cobrar");
  let payBlocked = false;
  try {
    repo.addWorkOrderPayment(openWo.id, { amount: 10, method: "efectivo" });
  } catch {
    payBlocked = true;
  }
  if (!payBlocked) throw new Error("No debe cobrar una OT ya entregada");

  const liveSale = repo.getSale(closed.id);
  if (Number(liveSale.balance) > 0.009) {
    let saleBlocked = false;
    try {
      repo.deliverSale(liveSale.id);
    } catch (e) {
      saleBlocked = /saldo/i.test(String(e.message));
    }
    if (!saleBlocked) throw new Error("No debe entregar venta de contado con saldo");
    const paidSale = repo.addSalePayment(liveSale.id, { amount: liveSale.balance, method: "efectivo", close: true });
    if (paidSale.status !== "entregada") throw new Error("La venta no se entregó al cobrar");
  } else if (liveSale.status !== "entregada") {
    const paidSale = repo.deliverSale(liveSale.id);
    if (paidSale.status !== "entregada") throw new Error("La venta pagada no se entregó");
  }

  const collectWo = repo.createWorkOrder({
    customerId: plated.customerId,
    vehicleId: plated.id,
    complaint: "Cobro caja",
  });
  repo.addWorkOrderLine(collectWo.id, { type: "labor", description: "Alineación", qty: 1, unitPrice: 200 });
  const collectDue = repo.getWorkOrder(collectWo.id);
  repo.collectMoney({ kind: "taller", id: collectWo.id, amount: collectDue.balance, method: "efectivo", close: true });
  if (repo.getWorkOrder(collectWo.id).status !== "entregada") throw new Error("Caja no cerró la OT al cobrar");

  const overPaid = repo.getWorkOrder(billedWo.id);
  repo.addWorkOrderPayment(billedWo.id, { amount: 99999, method: "efectivo" });
  const capped = repo.getWorkOrder(billedWo.id);
  if (Number(capped.balance) < -0.009) throw new Error("El abono no debe dejar saldo negativo");
  if (Number(capped.paid) + 0.009 < Number(overPaid.paid)) throw new Error("El tope del cobro no registró");

  const special = repo.createPart({
    sku: "SO-SMOKE",
    name: "Pedido especial",
    stock: 0,
    specialOrder: 1,
    price: 40,
    cost: 20,
    taxable: 0,
  });
  const soWo = repo.createWorkOrder({ customerId: plated.customerId, vehicleId: plated.id, complaint: "Especial" });
  repo.addWorkOrderLine(soWo.id, { type: "part", partId: special.id, qty: 1 });
  const soLoaded = repo.getWorkOrder(soWo.id);
  if (!soLoaded.lines?.some((l) => l.partId === special.id)) throw new Error("No agregó la parte de pedido especial");
  if (Number(soLoaded.tax) > 0.009) throw new Error("La parte exenta no debe llevar GST");
  if (repo.getPart(special.id).stock !== 0) throw new Error("Pedido especial no debe ir a stock negativo");
  let qtyBlocked = false;
  try {
    repo.addWorkOrderLine(soWo.id, { type: "part", partId: special.id, qty: -2 });
  } catch (e) {
    qtyBlocked = /cantidad/i.test(String(e.message));
  }
  if (!qtyBlocked) throw new Error("No debe aceptar cantidad negativa");

  const soStock = repo.createPart({
    sku: "SO-REST",
    name: "Especial con stock",
    stock: 2,
    specialOrder: 1,
    price: 40,
    cost: 20,
    taxable: 0,
  });
  const restWo = repo.createWorkOrder({ customerId: plated.customerId, vehicleId: plated.id, complaint: "Reverso especial" });
  repo.addWorkOrderLine(restWo.id, { type: "part", partId: soStock.id, qty: 10 });
  const restLine = repo.getWorkOrder(restWo.id).lines.find((l) => l.partId === soStock.id);
  if (repo.getPart(soStock.id).stock !== 0) throw new Error("El pedido especial no consumió el stock disponible");
  repo.updateWorkOrderLine(restLine.id, { authorized: 0 });
  if (repo.getPart(soStock.id).stock !== 2) throw new Error("Al declinar no debe inflar el stock del pedido especial");

  const moreStock = repo.listVehicles("", "en_stock")[0];
  if (moreStock) {
    const fin = repo.createSale({
      customerId: plated.customerId,
      vehicleId: moreStock.id,
      price: 8000,
      downPayment: 1000,
      paymentMethod: "financiado",
    });
    repo.closeSale(fin.id);
    const deliveredFin = repo.deliverSale(fin.id);
    if (deliveredFin.status !== "entregada") throw new Error("La venta financiada no se entregó");
    const later = repo.addSalePayment(fin.id, { amount: 500, method: "efectivo" });
    const expectedBal = Number(later.total || 0) - 1500;
    if (Math.abs(Number(later.balance) - expectedBal) > 0.05) throw new Error("No cobró después de entregar la financiada");
  }

  const part = repo.listParts()[0];
  const before = part.stock;
  repo.adjustPartStock(part.id, { qty: 2, notes: "smoke", reason: "conteo" });
  const afterPart = repo.listParts().find((p) => p.id === part.id);
  if (afterPart.stock !== before + 2) throw new Error("El ajuste de stock falló");

  const lamp = repo.listParts("AMP-H7")[0];
  if (!lamp) throw new Error("Falta la parte de ejemplo AMP-H7");
  const onOrderBefore = Number(lamp.onOrder || 0);
  const ordered = repo.orderPart(lamp.id, { qty: 10, vendor: "Philips" });
  if (Number(ordered.onOrder) !== onOrderBefore + 10) throw new Error("No marcó cantidad en pedido");
  const received = repo.receivePart(lamp.id, { qty: 4, cost: 48, vendor: "Philips" });
  if (Number(received.onOrder) !== onOrderBefore + 6) throw new Error("El recibo no bajó el pedido");
  if (Number(received.cost) !== 48) throw new Error("El recibo no actualizó el coste");
  if (Number(received.stock) !== Number(lamp.stock) + 4) throw new Error("El recibo no sumó stock");
  if (!repo.listParts("15400-PLM").length) throw new Error("No busca por OEM");
  if (!repo.listParts("PH7317").length) throw new Error("No busca por número alterno");
  if (!repo.searchGlobal(lamp.sku).parts.some((h) => h.id === lamp.id)) throw new Error("El buscador global no halla partes");
  if (!repo.listParts("", { low: true }).some((p) => p.low)) throw new Error("Falta el filtro de bajo mínimo");
  if (!repo.getPart(lamp.id).movements.some((m) => m.reason === "recibo")) throw new Error("Falta el movimiento de recibo");

  const shop = repo.getSettings();
  repo.saveSettings({ ...shop, laborRate: 925, invoiceNotes: "Garantía 30 días" });
  const savedShop = repo.getSettings();
  if (Number(savedShop.laborRate) !== 925) throw new Error("No se guardó la tarifa de mano de obra");
  if (!String(savedShop.invoiceNotes).includes("Garantía")) throw new Error("No se guardó el pie de factura");
  repo.saveSettings({ ...savedShop, serviceMode: "sencillo" });
  if (repo.getSettings().serviceMode !== "sencillo") throw new Error("No se guardó el modo sencillo");
  const simpleWo = repo.createWorkOrder({ customerId: plated.customerId, vehicleId: plated.id, complaint: "Modo sencillo" });
  if (simpleWo.status !== "en_taller" || !simpleWo.authorizedAt) throw new Error("Modo sencillo no abre la OT en taller");
  repo.removeWorkOrder(simpleWo.id);
  repo.saveSettings({ ...savedShop, serviceMode: "completo" });
  if (repo.getSettings().serviceMode !== "completo") throw new Error("No se restauró el modo completo");
  const sqlOne = repo.sqlQuery("SELECT 1 AS n");
  if (sqlOne.rows[0].n !== 1) throw new Error("SQL Studio no ejecutó SELECT");
  if (!repo.listSqlTables().some((t) => t.name === "parts")) throw new Error("SQL Studio no lista tablas");

  const guidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const guidRows = [ana, stockUnit, lamp, closed, openWo];
  for (const row of guidRows) {
    if (!guidRe.test(row.id || "")) throw new Error(`Falta GUID PK en ${row.id}`);
  }
  if (new Set(customers.map((c) => c.id)).size !== customers.length) throw new Error("GUIDs de clientes duplicados");
  if (!guidRe.test(closed.customerId) || !guidRe.test(closed.vehicleId)) throw new Error("La venta no enlaza por GUID");
  if (!guidRe.test(openWo.customerId) || !guidRe.test(openWo.vehicleId)) throw new Error("La OT no enlaza por GUID");
  if (!guidRe.test(String(savedShop.id || ""))) throw new Error("shop_settings no usa GUID");
  if (!repo.listCustomers(ana.id).some((c) => c.id === ana.id)) throw new Error("No busca cliente por GUID");
  if (!repo.listVehicles(stockUnit.id).some((v) => v.id === stockUnit.id)) throw new Error("No busca vehículo por GUID");
  if (!repo.listParts(lamp.id).some((p) => p.id === lamp.id)) throw new Error("No busca parte por GUID");
  if (!repo.listSales(closed.id).some((s) => s.id === closed.id)) throw new Error("No busca venta por GUID");
  if (!repo.listWorkOrders(openWo.id).some((o) => o.id === openWo.id)) throw new Error("No busca OT por GUID");

  const kpis = repo.dashboardKpis();
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        customers: customers.length,
        phones: ana.phones.length,
        address: ana.address,
        roles: { admin: admin.role, master: master.role },
        sale: closed.status,
        vehicle: sold.status,
        workOrder: closedWo.status,
        kpis,
        db: dir,
      },
      null,
      2
    )
  );
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
