const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const schema = require("./schema.cjs");
const { migrate } = require("./migrate.cjs");

let sqlite;
let db;
let dbPath;

function openDatabase(userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true });
  dbPath = path.join(userDataDir, "dealer.db");
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrate(sqlite);
  db = drizzle(sqlite, { schema });
  return { sqlite, db, dbPath };
}

function getDb() {
  if (!db) throw new Error("La base de datos no está abierta");
  return db;
}

function getSqlite() {
  if (!sqlite) throw new Error("La base de datos no está abierta");
  return sqlite;
}

function getDbPath() {
  return dbPath;
}

module.exports = { openDatabase, getDb, getSqlite, getDbPath };
