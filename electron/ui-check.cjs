const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { openDatabase } = require("./db/index.cjs");
const { seedDemo } = require("./db/seed.cjs");
const repo = require("./db/repo.cjs");
const auth = require("./db/auth.cjs");
const { registerIpc, setSessionPath, loginAs } = require("./ipc.cjs");

const url = process.argv[2] || "http://localhost:5173";

app.whenReady().then(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-ui-"));
  openDatabase(dir);
  setSessionPath(dir);
  if (repo.isEmpty()) seedDemo();
  const admin = auth.setupAdmin({ name: "Admin", username: "admin", password: "admin12" });
  loginAs(admin.id);
  registerIpc(app);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadURL(url);
  await new Promise((r) => setTimeout(r, 1500));
  const text = await win.webContents.executeJavaScript("document.body.innerText");
  if (!text.includes("Dealer DMS") || !text.includes("Inicio") || !text.includes("Empleados")) {
    throw new Error("La pantalla de inicio no se renderizó: " + text.slice(0, 400));
  }
  if (!/por cobrar|partes bajas|listas para entregar/i.test(text)) {
    throw new Error("Inicio no muestra colas de trabajo: " + text.slice(0, 400));
  }
  const hasSearch = await win.webContents.executeJavaScript(
    "Boolean(document.querySelector('aside input[placeholder]'))"
  );
  if (!hasSearch) throw new Error("Falta el buscador del menú");
  await win.webContents.executeJavaScript("location.hash = '#/ajustes'");
  await new Promise((r) => setTimeout(r, 800));
  const ajustes = await win.webContents.executeJavaScript("document.body.innerText");
  if (!/numeraci[oó]n|prefijo/i.test(ajustes)) {
    throw new Error("Ajustes no muestra numeración de OT: " + ajustes.slice(0, 400));
  }
  if (!/tarifa|mano de obra|labor rate/i.test(ajustes)) {
    throw new Error("Ajustes no muestra tarifa de mano de obra: " + ajustes.slice(0, 400));
  }
  await win.webContents.executeJavaScript("location.hash = '#/ventas'");
  await new Promise((r) => setTimeout(r, 800));
  const sales = await win.webContents.executeJavaScript("document.body.innerText");
  if (!sales.includes("Ventas")) {
    throw new Error("Ventas no se renderizó");
  }
  await win.webContents.executeJavaScript("location.hash = '#/vehiculos'");
  await new Promise((r) => setTimeout(r, 1000));
  const vehiculos = await win.webContents.executeJavaScript("document.body.innerText");
  if (!vehiculos.includes("Inventario") && !vehiculos.includes("STK-") && !vehiculos.includes("Stock")) {
    throw new Error("Vehículos no se renderizó: " + vehiculos.slice(0, 400));
  }
  await win.webContents.executeJavaScript("location.hash = '#/clientes'");
  await new Promise((r) => setTimeout(r, 1000));
  const customers = await win.webContents.executeJavaScript("document.body.innerText");
  if (!/c[oó]digo/i.test(customers) || !customers.includes("Mendoza Logística") || !/flotilla/i.test(customers)) {
    throw new Error("Clientes no mostró el expediente: " + customers.slice(0, 500));
  }
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('button')].find((b) => /nuevo cliente|new customer|nouveau client/i.test(b.innerText))?.click()`
  );
  await new Promise((r) => setTimeout(r, 700));
  const customerModal = await win.webContents.executeJavaScript("document.body.innerText");
  const nameAt = customerModal.search(/primer nombre|first name|pr[eé]nom/i);
  const vehicleAt = customerModal.search(/opcional\. si trae|if they brought|s'il a apport/i);
  if (nameAt < 0 || vehicleAt < 0 || nameAt > vehicleAt) {
    throw new Error("Alta de cliente no muestra Cliente arriba y Vehículo abajo: " + customerModal.slice(0, 800));
  }
  if (!/vin/i.test(customerModal)) throw new Error("Alta de cliente no muestra VIN: " + customerModal.slice(0, 400));
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('button')].find((b) => /^cerrar$|^close$|^fermer$/i.test(b.innerText.trim()))?.click()`
  );
  await new Promise((r) => setTimeout(r, 400));
  await win.webContents.executeJavaScript("location.hash = '#/taller'");
  await new Promise((r) => setTimeout(r, 1000));
  const taller = await win.webContents.executeJavaScript("document.body.innerText");
  if (!taller.includes("Taller") && !taller.includes("OT-") && !taller.includes("Tablero")) {
    throw new Error("Taller no se renderizó: " + taller.slice(0, 400));
  }
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('button')].find((b) => /nueva orden|new work order|nouveau bon/i.test(b.innerText) && !/presupuesto|estimate|devis/i.test(b.innerText))?.click()`
  );
  await new Promise((r) => setTimeout(r, 700));
  const woModal = await win.webContents.executeJavaScript("document.body.innerText");
  if (!/recepci[oó]n|check-in/i.test(woModal) || !/cliente y veh[ií]culo|customer and vehicle/i.test(woModal) || !/trabajo solicitado|requested work|travail demand/i.test(woModal)) {
    throw new Error("Alta de OT no muestra secciones: " + woModal.slice(0, 800));
  }
  const whoAt = woModal.search(/cliente y veh[ií]culo|customer and vehicle/i);
  const workAt = woModal.search(/trabajo solicitado|requested work|travail demand/i);
  if (whoAt < 0 || workAt < 0 || whoAt > workAt) {
    throw new Error("Alta de OT no ordena cliente/vehículo antes del trabajo: " + woModal.slice(0, 800));
  }
  await win.webContents.executeJavaScript("location.hash = '#/partes'");
  await new Promise((r) => setTimeout(r, 1000));
  const partes = await win.webContents.executeJavaScript("document.body.innerText");
  if (!partes.includes("FIL-ACE") && !partes.includes("Filtro") && !partes.includes("SKU")) {
    throw new Error("Partes no se renderizó: " + partes.slice(0, 500));
  }
  const firstPart = repo.listParts()[0];
  await win.webContents.executeJavaScript(`location.hash = '#/partes/${firstPart.id}'`);
  await new Promise((r) => setTimeout(r, 1000));
  const ficha = await win.webContents.executeJavaScript("document.body.innerText");
  if (!ficha.includes(firstPart.sku) || (!ficha.includes("Recibir") && !ficha.includes("Existencias") && !ficha.includes("Ficha"))) {
    throw new Error("Ficha de parte no se renderizó: " + ficha.slice(0, 500));
  }
  if (!ficha.includes("GUID") || !String(firstPart.id || "").length || !ficha.includes(firstPart.id)) {
    throw new Error("Ficha de parte no muestra GUID: " + ficha.slice(0, 500));
  }
  await win.webContents.executeJavaScript("location.hash = '#/sql'");
  await new Promise((r) => setTimeout(r, 1000));
  const sqlPage = await win.webContents.executeJavaScript("document.body.innerText");
  if (!sqlPage.includes("SQL") || (!sqlPage.includes("parts") && !sqlPage.includes("customers"))) {
    throw new Error("SQL Studio no se renderizó: " + sqlPage.slice(0, 500));
  }
  process.stdout.write(JSON.stringify({ ok: true, homeSnippet: text.slice(0, 280), salesHasMazda: sales.includes("Mazda") || sales.includes("CX-5"), tallerHasOt: /OT-/.test(taller), customersHasFleet: customers.includes("Mendoza Logística"), vehiclesHasStock: vehiculos.includes("STK-") || vehiculos.includes("Stock") }, null, 2));
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
