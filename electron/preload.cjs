const { contextBridge, ipcRenderer } = require("electron");

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).catch((error) => {
    const message = String(error?.message || error);
    if (message.includes("No handler registered")) {
      return { ok: false, error: "La app se quedó a medias. Cierra Dealer DMS y ábrela de nuevo con npm run dev." };
    }
    return { ok: false, error: message };
  });
}

contextBridge.exposeInMainWorld("dms", {
  auth: {
    status: () => invoke("auth:status"),
    setup: (data) => invoke("auth:setup", data),
    login: (data) => invoke("auth:login", data),
    logout: () => invoke("auth:logout"),
    me: () => invoke("auth:me"),
  },
  users: {
    list: (q) => invoke("users:list", q),
    create: (data) => invoke("users:create", data),
    update: (id, data) => invoke("users:update", { id, data }),
    setPassword: (id, password) => invoke("users:setPassword", { id, password }),
    remove: (id) => invoke("users:remove", id),
  },
  customers: {
    list: (q, opts) => invoke("customers:list", { q, ...(opts || {}) }),
    get: (id) => invoke("customers:get", id),
    create: (data) => invoke("customers:create", data),
    update: (id, data) => invoke("customers:update", { id, data }),
    remove: (id) => invoke("customers:remove", id),
    findDuplicates: (data) => invoke("customers:findDuplicates", data),
    addNote: (id, body) => invoke("customers:addNote", { id, body }),
    unlinkVehicle: (id, vehicleId) => invoke("customers:unlinkVehicle", { id, vehicleId }),
  },
  vehicles: {
    list: (q, status, opts) => invoke("vehicles:list", { q, status, ...(opts || {}) }),
    get: (id, opts) => invoke("vehicles:get", { id, ...(opts || {}) }),
    create: (data) => invoke("vehicles:create", data),
    update: (id, data) => invoke("vehicles:update", { id, data }),
    decodeVin: (vin) => invoke("vehicles:decodeVin", vin),
    addNote: (id, body) => invoke("vehicles:addNote", { id, body }),
    remove: (id) => invoke("vehicles:remove", id),
  },
  sales: {
    list: (q, opts) => invoke("sales:list", { q, ...(opts || {}) }),
    get: (id) => invoke("sales:get", id),
    create: (data) => invoke("sales:create", data),
    update: (id, data) => invoke("sales:update", { id, data }),
    close: (id) => invoke("sales:close", id),
    deliver: (id) => invoke("sales:deliver", id),
    addPayment: (id, data) => invoke("sales:addPayment", { id, data }),
    remove: (id) => invoke("sales:remove", id),
  },
  parts: {
    list: (q, opts) => invoke("parts:list", { q, ...(opts || {}) }),
    get: (id) => invoke("parts:get", id),
    create: (data) => invoke("parts:create", data),
    update: (id, data) => invoke("parts:update", { id, data }),
    adjust: (id, data) => invoke("parts:adjust", { id, data }),
    receive: (id, data) => invoke("parts:receive", { id, data }),
    order: (id, data) => invoke("parts:order", { id, data }),
    remove: (id) => invoke("parts:remove", id),
  },
  workOrders: {
    list: (q, opts) => invoke("workOrders:list", { q, ...(opts || {}) }),
    get: (id) => invoke("workOrders:get", id),
    create: (data) => invoke("workOrders:create", data),
    update: (id, data) => invoke("workOrders:update", { id, data }),
    setStatus: (id, status) => invoke("workOrders:setStatus", { id, status }),
    addLine: (id, data) => invoke("workOrders:addLine", { id, data }),
    updateLine: (lineId, data) => invoke("workOrders:updateLine", { lineId, data }),
    removeLine: (lineId) => invoke("workOrders:removeLine", lineId),
    remove: (id) => invoke("workOrders:remove", id),
    deliver: (id, data) => invoke("workOrders:deliver", { id, ...(data || {}) }),
    addPayment: (id, data) => invoke("workOrders:addPayment", { id, data }),
    authorize: (id, data) => invoke("workOrders:authorize", { id, data }),
    convert: (id) => invoke("workOrders:convert", id),
    setNumber: (id, number) => invoke("workOrders:setNumber", { id, number }),
  },
  settings: {
    get: () => invoke("settings:get"),
    save: (data) => invoke("settings:save", data),
    saveNumbering: (data) => invoke("settings:saveNumbering", data),
    catalogs: () => invoke("settings:catalogs"),
    saveCatalogs: (data) => invoke("settings:saveCatalogs", data),
  },
  search: {
    global: (q) => invoke("search:global", q),
  },
  staff: {
    list: () => invoke("staff:list"),
  },
  opCodes: {
    list: (q, opts) => invoke("opCodes:list", { q, ...(opts || {}) }),
    get: (id) => invoke("opCodes:get", id),
    create: (data) => invoke("opCodes:create", data),
    update: (id, data) => invoke("opCodes:update", { id, data }),
    remove: (id) => invoke("opCodes:remove", id),
  },
  dashboard: {
    kpis: () => invoke("dashboard:kpis"),
  },
  finance: {
    summary: (period) => invoke("finance:summary", period),
    addExpense: (data) => invoke("finance:addExpense", data),
    removeExpense: (id) => invoke("finance:removeExpense", id),
    collect: (data) => invoke("finance:collect", data),
    removeIncome: (id) => invoke("finance:removeIncome", id),
  },
  demo: {
    seed: () => invoke("demo:seed"),
    isEmpty: () => invoke("demo:isEmpty"),
  },
  meta: {
    dbPath: () => invoke("meta:dbPath"),
    isPackaged: () => invoke("meta:isPackaged"),
    version: () => invoke("meta:version"),
  },
  updates: {
    status: () => invoke("updates:status"),
    check: () => invoke("updates:check"),
    download: () => invoke("updates:download"),
    install: () => invoke("updates:install"),
    backup: () => invoke("updates:backup"),
    setAllow: (allow) => invoke("updates:setAllow", allow),
    onEvent: (cb) => {
      const listener = (_event, data) => cb(data);
      ipcRenderer.on("updates:event", listener);
      return () => ipcRenderer.removeListener("updates:event", listener);
    },
  },
  sql: {
    tables: () => invoke("sql:tables"),
    query: (sql, opts) => invoke("sql:query", { sql, ...(opts || {}) }),
  },
});
