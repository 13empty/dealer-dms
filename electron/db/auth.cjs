const crypto = require("crypto");
const { eq, desc, sql } = require("drizzle-orm");
const { users, workOrders } = require("./schema.cjs");
const { getDb } = require("./index.cjs");
const { nowIso, splitEmployeeName } = require("./migrate.cjs");

const ROLES = {
  admin: {
    rank: 100,
    label: "Admin",
    hint: "Dueño de la app. Control total, incluido crear Masters.",
  },
  master: {
    rank: 80,
    label: "Master",
    hint: "Dueño del concesionario. Casi todo, excepto usuarios Admin.",
  },
  gerente: {
    rank: 50,
    label: "Gerente",
    hint: "Opera el concesionario y gestiona empleados.",
  },
  empleado: {
    rank: 20,
    label: "Empleado",
    hint: "Clientes, ventas, inventario y taller. Sin usuarios ni finanzas.",
  },
};

function db() {
  return getDb();
}

function rank(role) {
  return ROLES[role]?.rank || 0;
}

function roleLabel(role) {
  return ROLES[role]?.label || role;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(String(password), salt, 64).toString("hex");
  if (hash.length !== test.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
}

const JOBS = ["tecnico", "asesor", "partes", "ventas", "caja", "otro"];

function jobOf(raw, role) {
  const value = String(raw || "").toLowerCase();
  if (JOBS.includes(value)) return value;
  if (role === "empleado") return "tecnico";
  if (role === "gerente") return "asesor";
  return "otro";
}

function canTechOf(data, job) {
  if (data && data.canTech != null) return Number(data.canTech) ? 1 : 0;
  return job === "tecnico" || job === "asesor" ? 1 : 0;
}

function textField(value) {
  return String(value == null ? "" : value).trim();
}

function composePersonName(data, current = {}) {
  const sentParts = data.firstName != null || data.middleName != null || data.lastName != null;
  let firstName = data.firstName != null ? textField(data.firstName) : String(current.firstName || "");
  let middleName = data.middleName != null ? textField(data.middleName) : String(current.middleName || "");
  let lastName = data.lastName != null ? textField(data.lastName) : String(current.lastName || "");
  const rawName = data.name != null ? textField(data.name) : "";
  if (!sentParts && (rawName || (!firstName && current.name))) {
    const split = splitEmployeeName(rawName || current.name);
    firstName = firstName || split.firstName;
    middleName = middleName || split.middleName;
    lastName = lastName || split.lastName;
  }
  if (sentParts && (!firstName || !lastName)) {
    throw new Error("Primer nombre y apellido son obligatorios");
  }
  const name = [firstName, middleName, lastName].filter(Boolean).join(" ") || rawName || String(current.name || "").trim();
  if (!name) throw new Error("Nombre y usuario son obligatorios");
  return { firstName, middleName, lastName, name };
}

function directoryPatch(data) {
  const patch = {};
  if (data.phone != null) patch.phone = textField(data.phone);
  if (data.email != null) patch.email = textField(data.email);
  if (data.document != null) patch.document = textField(data.document);
  if (data.address != null) patch.address = textField(data.address);
  if (data.city != null) patch.city = textField(data.city);
  if (data.state != null) patch.state = textField(data.state);
  if (data.zip != null) patch.zip = textField(data.zip);
  if (data.notes != null) patch.notes = textField(data.notes);
  return patch;
}

function stripUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  const job = jobOf(user.job, user.role);
  return {
    ...rest,
    job,
    firstName: String(user.firstName || ""),
    middleName: String(user.middleName || ""),
    lastName: String(user.lastName || ""),
    phone: String(user.phone || ""),
    email: String(user.email || ""),
    document: String(user.document || ""),
    address: String(user.address || ""),
    city: String(user.city || ""),
    state: String(user.state || ""),
    zip: String(user.zip || ""),
    notes: String(user.notes || ""),
    laborRate: Number(user.laborRate) || 0,
    canTech: Number(user.canTech) ? 1 : 0,
    roleLabel: roleLabel(user.role),
    permissions: permissionsFor(user.role),
  };
}

function permissionsFor(role) {
  const r = rank(role);
  return {
    users: r >= 50,
    finance: r >= 50,
    destructive: r >= 50,
    demo: r >= 80,
    options: r >= 80,
    updates: r >= 80,
    assignableRoles: assignableRoles(role),
  };
}

function assignableRoles(actorRole) {
  if (actorRole === "admin") return ["admin", "master", "gerente", "empleado"];
  if (actorRole === "master") return ["gerente", "empleado"];
  if (actorRole === "gerente") return ["empleado"];
  return [];
}

function canManage(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === "admin") return true;
  return rank(actor.role) > rank(target.role);
}

function countUsers(role, onlyActive = false) {
  const rows = db().select().from(users).all();
  return rows.filter((u) => (!role || u.role === role) && (!onlyActive || u.active === 1)).length;
}

function userCount() {
  return Number(db().select({ n: sql`count(*)` }).from(users).get()?.n || 0);
}

function listUsers(actor, q) {
  const query = String(q || "").trim().toLowerCase();
  const assigned = new Set(
    db()
      .select({ techUserId: workOrders.techUserId })
      .from(workOrders)
      .all()
      .map((row) => row.techUserId)
      .filter(Boolean)
  );
  let rows = db()
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .all()
    .map((row) => ({ ...stripUser(row), assigned: assigned.has(row.id) }));
  if (actor.role === "master") rows = rows.filter((u) => u.role !== "admin");
  if (actor.role === "gerente") rows = rows.filter((u) => u.role === "empleado");
  if (actor.role === "empleado") rows = rows.filter((u) => u.id === actor.id);
  if (query) {
    rows = rows.filter((u) =>
      `${u.name} ${u.firstName} ${u.middleName} ${u.lastName} ${u.username} ${u.role} ${u.job} ${u.phone} ${u.email} ${u.document} ${u.address} ${u.city}`
        .toLowerCase()
        .includes(query)
    );
  }
  return rows;
}

function getUser(id) {
  return db().select().from(users).where(eq(users.id, id)).get() || null;
}

function getUserByUsername(username) {
  return db()
    .select()
    .from(users)
    .where(eq(users.username, String(username || "").trim().toLowerCase()))
    .get();
}

function createUser(actor, data) {
  const username = String(data.username || "").trim().toLowerCase();
  const profile = composePersonName(data);
  const role = data.role;
  const password = String(data.password || "");
  if (!username || !profile.name) throw new Error("Nombre y usuario son obligatorios");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error("El usuario solo puede tener letras, números, punto, _ o - (3 a 32)");
  }
  if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
  if (!ROLES[role]) throw new Error("Rol no válido");
  if (actor) {
    if (!assignableRoles(actor.role).includes(role)) {
      throw new Error("No puedes asignar ese rol");
    }
  } else if (role !== "admin") {
    throw new Error("El primer usuario debe ser Admin (dueño de la app)");
  }
  if (getUserByUsername(username)) throw new Error("Ese usuario ya existe");
  const job = jobOf(data.job, role);
  const id = crypto.randomUUID();
  db()
    .insert(users)
    .values({
      id,
      ...profile,
      username,
      passwordHash: hashPassword(password),
      role,
      job,
      phone: textField(data.phone),
      email: textField(data.email),
      document: textField(data.document),
      address: textField(data.address),
      city: textField(data.city),
      state: textField(data.state),
      zip: textField(data.zip),
      notes: textField(data.notes),
      laborRate: Math.max(0, Number(data.laborRate) || 0),
      canTech: canTechOf(data, job),
      active: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    .run();
  return stripUser(getUser(id));
}

function updateUser(actor, id, data) {
  const target = getUser(id);
  if (!target) throw new Error("Usuario no encontrado");
  if (!canManage(actor, target) && actor.id !== target.id) throw new Error("Sin permiso");

  const patch = { updatedAt: nowIso() };
  if (data.firstName != null || data.middleName != null || data.lastName != null || data.name != null) {
    Object.assign(patch, composePersonName(data, target));
  }
  Object.assign(patch, directoryPatch(data));
  if (data.active != null) {
    if (actor.id === target.id) throw new Error("No puedes desactivar tu propia cuenta");
    if (!canManage(actor, target)) throw new Error("Sin permiso");
    if (target.role === "admin" && target.active === 1 && Number(data.active) === 0 && countUsers("admin", true) <= 1) {
      throw new Error("Debe quedar al menos un Admin activo");
    }
    patch.active = Number(data.active) ? 1 : 0;
  }
  if (data.role != null && data.role !== target.role) {
    if (actor.id === target.id) throw new Error("No puedes cambiar tu propio rol");
    if (!canManage(actor, target)) throw new Error("Sin permiso");
    if (!assignableRoles(actor.role).includes(data.role)) throw new Error("No puedes asignar ese rol");
    if (target.role === "admin" && data.role !== "admin" && countUsers("admin", true) <= 1) {
      throw new Error("Debe quedar al menos un Admin");
    }
    patch.role = data.role;
  }
  if (data.username != null) {
    const username = String(data.username).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Usuario no válido");
    const taken = getUserByUsername(username);
    if (taken && taken.id !== id) throw new Error("Ese usuario ya existe");
    patch.username = username;
  }
  if (canManage(actor, target) || actor.role === "admin") {
    if (data.job != null) {
      patch.job = jobOf(data.job, data.role || target.role);
      if (data.canTech == null) patch.canTech = canTechOf({}, patch.job);
    }
    if (data.laborRate != null) patch.laborRate = Math.max(0, Number(data.laborRate) || 0);
    if (data.canTech != null) patch.canTech = Number(data.canTech) ? 1 : 0;
  }
  db().update(users).set(patch).where(eq(users.id, id)).run();
  return stripUser(getUser(id));
}

function setPassword(actor, id, password) {
  const target = getUser(id);
  if (!target) throw new Error("Usuario no encontrado");
  const self = actor.id === target.id;
  if (!self && !canManage(actor, target)) throw new Error("Sin permiso");
  if (String(password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
  db()
    .update(users)
    .set({ passwordHash: hashPassword(password), updatedAt: nowIso() })
    .where(eq(users.id, id))
    .run();
  return { id };
}

function removeUser(actor, id) {
  const target = getUser(id);
  if (!target) throw new Error("Usuario no encontrado");
  if (actor.id === id) throw new Error("No puedes borrar tu propia cuenta");
  if (!canManage(actor, target)) throw new Error("Sin permiso");
  if (target.role === "admin" && countUsers("admin", true) <= 1) {
    throw new Error("Debe quedar al menos un Admin");
  }
  const assigned = db().select().from(workOrders).where(eq(workOrders.techUserId, id)).get();
  if (assigned) {
    throw new Error("Este empleado tiene órdenes asignadas. Desactívalo en lugar de borrarlo.");
  }
  db().delete(users).where(eq(users.id, id)).run();
  return { id };
}

function login(username, password) {
  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Usuario o contraseña incorrectos");
  }
  if (!user.active) throw new Error("Esta cuenta está desactivada");
  return stripUser(user);
}

function setupAdmin(data) {
  if (userCount() > 0) throw new Error("Ya existe un usuario Admin");
  return createUser(null, { ...data, role: "admin" });
}

module.exports = {
  ROLES,
  JOBS,
  rank,
  roleLabel,
  permissionsFor,
  assignableRoles,
  canManage,
  userCount,
  listUsers,
  getUser,
  stripUser,
  createUser,
  updateUser,
  setPassword,
  removeUser,
  login,
  setupAdmin,
};
