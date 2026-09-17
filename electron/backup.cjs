const fs = require("fs");
const path = require("path");
const { getSqlite, getDbPath } = require("./db/index.cjs");

const KEEP = 10;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function backupsRoot(userDataDir) {
  return path.join(userDataDir, "backups");
}

function pruneBackups(userDataDir) {
  const root = backupsRoot(userDataDir);
  if (!fs.existsSync(root)) return;
  const dirs = fs
    .readdirSync(root)
    .map((name) => {
      const dir = path.join(root, name);
      let st;
      try {
        st = fs.statSync(dir);
      } catch {
        return null;
      }
      if (!st.isDirectory()) return null;
      return { dir, mtime: st.mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  for (const extra of dirs.slice(KEEP)) {
    fs.rmSync(extra.dir, { recursive: true, force: true });
  }
}

async function backupShopData({ userDataDir, reason = "manual", version = "" }) {
  if (!userDataDir) throw new Error("No hay carpeta de datos para respaldar");
  const sqlite = getSqlite();
  sqlite.pragma("wal_checkpoint(PASSIVE)");
  const dir = path.join(backupsRoot(userDataDir), `${reason}-${stamp()}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "dealer.db");
  await sqlite.backup(file);
  const info = {
    reason,
    version,
    at: new Date().toISOString(),
    source: getDbPath(),
  };
  fs.writeFileSync(path.join(dir, "backup.json"), JSON.stringify(info, null, 2), "utf8");
  pruneBackups(userDataDir);
  return { dir, file, ...info };
}

module.exports = { backupShopData, backupsRoot, pruneBackups };
