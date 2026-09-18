const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain } = require("electron");
const repo = require("./db/repo.cjs");
const auth = require("./db/auth.cjs");
const { seedDemo } = require("./db/seed.cjs");
const { getDbPath } = require("./db/index.cjs");
const { decodeVin } = require("./vin.cjs");
const updater = require("./updater.cjs");
const logo = require("./logo.cjs");

let sessionUserId = null;
let sessionFile = null;

function setSessionPath(userDataDir) {
  sessionFile = path.join(userDataDir, "session.json");
  try {
    const raw = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    const user = auth.getUser(raw.userId);
    if (user && user.active) sessionUserId = user.id;
  } catch {
    sessionUserId = null;
  }
}

function persistSession() {
  if (!sessionFile) return;
  if (!sessionUserId) {
    try {
      fs.unlinkSync(sessionFile);
    } catch {
      // ignore
    }
    return;
  }
  fs.writeFileSync(sessionFile, JSON.stringify({ userId: sessionUserId }), "utf8");
}

function currentUser() {
  if (!sessionUserId) return null;
  const user = auth.getUser(sessionUserId);
  if (!user || !user.active) {
    sessionUserId = null;
    persistSession();
    return null;
  }
  return user;
}

function wrap(fn, opts = {}) {
  return async (_event, ...args) => {
    try {
      if (opts.public) {
        return { ok: true, data: await fn(...args) };
      }
      const user = currentUser();
      if (!user) throw new Error("Inicia sesión");
      if (opts.minRank && auth.rank(user.role) < opts.minRank) {
        throw new Error("No tienes permiso para esta acción");
      }
      return { ok: true, data: await fn(user, ...args) };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  };
}

function handle(channel, listener) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, listener);
}

function registerIpc(app) {
  handle(
    "auth:status",
    wrap(() => {
      const user = currentUser();
      return {
        needsSetup: auth.userCount() === 0,
        user: user ? auth.stripUser(user) : null,
        roles: auth.ROLES,
      };
    }, { public: true })
  );

  handle(
    "auth:setup",
    wrap((data) => {
      const user = auth.setupAdmin(data);
      sessionUserId = user.id;
      persistSession();
      return user;
    }, { public: true })
  );

  handle(
    "auth:login",
    wrap((data) => {
      const user = auth.login(data?.username, data?.password);
      sessionUserId = user.id;
      persistSession();
      return user;
    }, { public: true })
  );

  handle(
    "auth:logout",
    wrap(() => {
      sessionUserId = null;
      persistSession();
      return { ok: true };
    }, { public: true })
  );

  handle("auth:me", wrap((user) => auth.stripUser(user)));

  handle("users:list", wrap((user, q) => auth.listUsers(user, q), { minRank: 50 }));
  handle("users:create", wrap((user, data) => auth.createUser(user, data), { minRank: 50 }));
  handle("users:update", wrap((user, { id, data }) => auth.updateUser(user, id, data), { minRank: 20 }));
  handle("users:setPassword", wrap((user, { id, password }) => auth.setPassword(user, id, password), { minRank: 20 }));
  handle("users:remove", wrap((user, id) => auth.removeUser(user, id), { minRank: 50 }));

  handle("customers:list", wrap((_u, payload) => {
    if (payload && typeof payload === "object") return repo.listCustomers(payload.q, payload);
    return repo.listCustomers(payload);
  }));
  handle("customers:get", wrap((_u, id) => repo.getCustomer(id)));
  handle("customers:create", wrap((_u, data) => repo.createCustomer(data)));
  handle("customers:update", wrap((_u, { id, data }) => repo.updateCustomer(id, data)));
  handle("customers:remove", wrap((_u, id) => repo.removeCustomer(id), { minRank: 50 }));
  handle("customers:findDuplicates", wrap((_u, data) => repo.findDuplicates(data, data?.excludeId)));
  handle("customers:addNote", wrap((user, { id, body }) => repo.addCustomerNote(id, { body, userName: user.name })));
  handle("customers:unlinkVehicle", wrap((_u, { id, vehicleId }) => repo.unlinkCustomerVehicle(id, vehicleId)));

  handle("vehicles:list", wrap((_u, payload = {}) => repo.listVehicles(payload.q, payload.status, payload)));
  handle("vehicles:get", wrap((_u, payload) => {
    const id = typeof payload === "object" && payload ? payload.id : payload;
    const history = typeof payload === "object" ? Boolean(payload?.history) : false;
    return repo.getVehicle(id, { history });
  }));
  handle("vehicles:create", wrap((_u, data) => repo.createVehicle(data)));
  handle("vehicles:update", wrap((_u, { id, data }) => repo.updateVehicle(id, data)));
  handle("vehicles:decodeVin", wrap((_u, vin) => decodeVin(vin)));
  handle("vehicles:addNote", wrap((user, { id, body }) => repo.addVehicleNote(id, { body, userName: user.name })));
  handle("vehicles:remove", wrap((_u, id) => repo.removeVehicle(id), { minRank: 50 }));

  handle("sales:list", wrap((_u, payload) => {
    if (payload && typeof payload === "object") return repo.listSales(payload.q, payload);
    return repo.listSales(payload);
  }));
  handle("sales:get", wrap((_u, id) => repo.getSale(id)));
  handle("sales:create", wrap((_u, data) => repo.createSale(data)));
  handle("sales:update", wrap((_u, { id, data }) => repo.updateSale(id, data)));
  handle("sales:close", wrap((_u, id) => repo.closeSale(id)));
  handle("sales:deliver", wrap((_u, id) => repo.deliverSale(id)));
  handle("sales:addPayment", wrap((_u, { id, data }) => repo.addSalePayment(id, data)));
  handle("sales:remove", wrap((_u, id) => repo.deleteSale(id)));

  handle("parts:list", wrap((_u, payload) => {
    if (payload && typeof payload === "object") return repo.listParts(payload.q, payload);
    return repo.listParts(payload);
  }));
  handle("parts:get", wrap((_u, id) => repo.getPart(id)));
  handle("parts:create", wrap((_u, data) => repo.createPart(data)));
  handle("parts:update", wrap((_u, { id, data }) => repo.updatePart(id, data)));
  handle("parts:adjust", wrap((_u, { id, data }) => repo.adjustPartStock(id, data)));
  handle("parts:receive", wrap((_u, { id, data }) => repo.receivePart(id, data)));
  handle("parts:order", wrap((_u, { id, data }) => repo.orderPart(id, data)));
  handle("parts:remove", wrap((_u, id) => repo.removePart(id), { minRank: 50 }));

  handle("workOrders:list", wrap((_u, payload) => {
    if (payload && typeof payload === "object") return repo.listWorkOrders(payload.q, payload);
    return repo.listWorkOrders(payload);
  }));
  handle("workOrders:get", wrap((_u, id) => repo.getWorkOrder(id)));
  handle("workOrders:create", wrap((_u, data) => repo.createWorkOrder(data)));
  handle("workOrders:update", wrap((_u, { id, data }) => repo.updateWorkOrder(id, data)));
  handle("workOrders:setStatus", wrap((_u, { id, status }) => repo.setWorkOrderStatus(id, status)));
  handle("workOrders:addLine", wrap((_u, { id, data }) => repo.addWorkOrderLine(id, data)));
  handle("workOrders:updateLine", wrap((_u, { lineId, data }) => repo.updateWorkOrderLine(lineId, data)));
  handle("workOrders:removeLine", wrap((_u, lineId) => repo.removeWorkOrderLine(lineId)));
  handle("workOrders:remove", wrap((_u, id) => repo.removeWorkOrder(id)));
  handle("workOrders:deliver", wrap((_u, payload) => {
    if (payload && typeof payload === "object") return repo.deliverWorkOrder(payload.id, payload);
    return repo.deliverWorkOrder(payload);
  }));
  handle("workOrders:addPayment", wrap((_u, { id, data }) => repo.addWorkOrderPayment(id, data)));
  handle("workOrders:authorize", wrap((user, { id, data }) => repo.authorizeWorkOrder(id, { ...(data || {}), authorizedBy: data?.authorizedBy || user.name })));
  handle("workOrders:convert", wrap((_u, id) => repo.convertEstimate(id)));
  handle("workOrders:setNumber", wrap((_u, { id, number }) => repo.setWorkOrderNumber(id, number), { minRank: 80 }));

  handle("settings:get", wrap(() => repo.getSettings()));
  handle("settings:save", wrap((_u, data) => repo.saveSettings(data), { minRank: 50 }));
  handle("settings:saveNumbering", wrap((_u, data) => repo.saveWorkOrderNumbering(data), { minRank: 80 }));
  handle("settings:catalogs", wrap(() => repo.getCatalogs()));
  handle("settings:saveCatalogs", wrap((_u, data) => repo.saveCatalogs(data), { minRank: 50 }));
  handle("search:global", wrap((_u, q) => repo.searchGlobal(q)));
  handle("staff:list", wrap((_u, opts) => repo.listStaff(opts || {})));

  handle("opCodes:list", wrap((_u, payload = {}) => repo.listOpCodes(payload.q, payload)));
  handle("opCodes:get", wrap((_u, id) => repo.getOpCode(id)));
  handle("opCodes:create", wrap((_u, data) => repo.createOpCode(data)));
  handle("opCodes:update", wrap((_u, { id, data }) => repo.updateOpCode(id, data)));
  handle("opCodes:remove", wrap((_u, id) => repo.removeOpCode(id), { minRank: 50 }));

  handle("washTypes:list", wrap((_u, opts) => repo.listWashTypes(opts || {})));
  handle("washTypes:create", wrap((_u, data) => repo.createWashType(data), { minRank: 50 }));
  handle("washTypes:update", wrap((_u, { id, data }) => repo.updateWashType(id, data), { minRank: 50 }));
  handle("washTypes:remove", wrap((_u, id) => repo.removeWashType(id), { minRank: 50 }));

  handle("dashboard:kpis", wrap(() => repo.dashboardKpis()));
  handle("finance:summary", wrap((_u, period) => repo.financeSummary(period), { minRank: 50 }));
  handle("finance:addExpense", wrap((_u, data) => repo.createExpense(data), { minRank: 50 }));
  handle("finance:removeExpense", wrap((_u, id) => repo.removeExpense(id), { minRank: 50 }));
  handle("finance:collect", wrap((_u, data) => repo.collectMoney(data), { minRank: 50 }));
  handle("finance:removeIncome", wrap((_u, id) => repo.removeIncome(id), { minRank: 50 }));
  handle("demo:seed", wrap(() => seedDemo(), { minRank: 80 }));
  handle("demo:isEmpty", wrap(() => repo.isEmpty()));
  handle("meta:dbPath", wrap(() => getDbPath(), { minRank: 50 }));
  handle("meta:isPackaged", wrap(() => app.isPackaged, { public: true }));
  handle("meta:version", wrap(() => app.getVersion(), { public: true }));
  handle("brand:get", wrap(() => logo.getLogo(), { public: true }));
  handle("brand:pick", async (event) => {
    try {
      const user = currentUser();
      if (!user) throw new Error("Inicia sesión");
      if (auth.rank(user.role) < 50) throw new Error("No tienes permiso para esta acción");
      const win = BrowserWindow.fromWebContents(event.sender);
      return { ok: true, data: await logo.pickLogo(win || undefined) };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });
  handle("brand:clear", wrap(() => logo.clearLogo(), { minRank: 50 }));
  handle("updates:status", wrap(() => updater.status(), { minRank: 80 }));
  handle("updates:peek", wrap(() => updater.peek(), { minRank: 80 }));
  handle("updates:check", wrap(() => updater.check(), { minRank: 80 }));
  handle("updates:download", wrap(() => updater.download(), { minRank: 80 }));
  handle("updates:install", wrap(() => updater.install(), { minRank: 80 }));
  handle("updates:backup", wrap(() => updater.backupOnly("manual"), { minRank: 50 }));
  handle("updates:setAllow", wrap((_u, on) => updater.setAllow(on), { minRank: 80 }));
  handle("sql:tables", wrap(() => repo.listSqlTables(), { minRank: 80 }));
  handle("sql:query", wrap((_u, payload) => repo.sqlQuery(payload?.sql, payload), { minRank: 80 }));
}

module.exports = { registerIpc, setSessionPath, loginAs };

function loginAs(userId) {
  sessionUserId = userId;
  persistSession();
}
