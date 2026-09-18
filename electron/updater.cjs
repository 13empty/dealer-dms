const { app, BrowserWindow, Notification } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const { backupShopData } = require("./backup.cjs");
const repo = require("./db/repo.cjs");

let userDataDir = "";
let lastInfo = null;
let lastBackup = null;
let downloaded = false;
let busy = false;
let notifiedVersion = "";
let peekTimer = null;

function send(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("updates:event", payload);
    } catch {
      // ignore
    }
  }
}

function explain(error) {
  const msg = String(error?.message || error || "");
  if (/404|Not Found|Cannot find channel|latest.yml/i.test(msg)) {
    return "No hay una actualización publicada, o el canal en GitHub no es público.";
  }
  if (/net::|ENOTFOUND|ECONN|offline|network|getaddrinfo/i.test(msg)) {
    return "Sin internet. Las actualizaciones se consultan en GitHub.";
  }
  if (/sha512|blockmap|checksum/i.test(msg)) {
    return "El paquete bajó incompleto. Reintenta; los datos del taller no se tocaron.";
  }
  if (/desactivad/i.test(msg)) return msg;
  return msg || "No se pudo actualizar";
}

function updatesAllowed() {
  try {
    return repo.updatesAllowed();
  } catch {
    return false;
  }
}

function snapshot() {
  return {
    current: app.getVersion(),
    packaged: app.isPackaged,
    available: Boolean(lastInfo && lastInfo.version && lastInfo.version !== app.getVersion()),
    version: lastInfo?.version || null,
    releaseDate: lastInfo?.releaseDate || null,
    downloaded,
    backupDir: lastBackup?.dir || null,
    busy,
    allowUpdates: updatesAllowed(),
  };
}

function initUpdater(dir) {
  userDataDir = dir;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  if (typeof autoUpdater.verifyUpdateCodeSignature === "function") {
    autoUpdater.verifyUpdateCodeSignature = async () => null;
  }

  autoUpdater.on("download-progress", (progress) => {
    send({ type: "progress", percent: Math.round(progress.percent || 0) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    downloaded = true;
    lastInfo = info;
    busy = false;
    send({ type: "downloaded", version: info.version, backupDir: lastBackup?.dir || null });
  });
  autoUpdater.on("error", (error) => {
    busy = false;
    send({ type: "error", message: explain(error) });
  });
}

function showNotice(version) {
  const body = `Hay una versión nueva (${version}). Ábrela en Ajustes.`;
  if (!Notification.isSupported()) return;
  try {
    const n = new Notification({
      title: "Dealer DMS",
      body,
      icon: path.join(__dirname, "icon.ico"),
    });
    n.on("click", () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      send({ type: "open", version });
    });
    n.show();
  } catch {
    // ignore
  }
}

async function peek({ notify = false } = {}) {
  if (!app.isPackaged) {
    return { ...snapshot(), available: false, note: "dev" };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    lastInfo = result?.updateInfo || null;
    const available = Boolean(result?.isUpdateAvailable);
    if (!available) downloaded = false;
    const version = lastInfo?.version || app.getVersion();
    send({ type: available ? "available" : "current", version });
    if (notify && available && version && version !== notifiedVersion) {
      notifiedVersion = version;
      showNotice(version);
    }
    return { ...snapshot(), available };
  } catch (error) {
    if (notify) return { ...snapshot(), available: false, note: "peek-failed" };
    throw new Error(explain(error));
  }
}

function scheduleNotify() {
  if (peekTimer) return;
  const run = () => {
    void peek({ notify: true }).catch(() => {});
  };
  setTimeout(run, 8000);
  peekTimer = setInterval(run, 6 * 60 * 60 * 1000);
}

async function status() {
  return snapshot();
}

async function setAllow(on) {
  repo.setUpdatesAllowed(Boolean(on));
  if (!updatesAllowed()) {
    lastInfo = null;
    downloaded = false;
  }
  send({ type: "policy", allowUpdates: updatesAllowed() });
  return snapshot();
}

async function check() {
  if (!updatesAllowed()) {
    lastInfo = null;
    downloaded = false;
    send({ type: "disabled" });
    return { ...snapshot(), available: false, note: "disabled" };
  }
  if (!app.isPackaged) {
    return { ...snapshot(), available: false, note: "dev" };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    lastInfo = result?.updateInfo || null;
    const available = Boolean(result?.isUpdateAvailable);
    if (!available) downloaded = false;
    send({ type: available ? "available" : "current", version: lastInfo?.version || app.getVersion() });
    return { ...snapshot(), available };
  } catch (error) {
    throw new Error(explain(error));
  }
}

async function backupOnly(reason = "manual") {
  lastBackup = await backupShopData({
    userDataDir,
    reason,
    version: app.getVersion(),
  });
  send({ type: "backup", dir: lastBackup.dir });
  return lastBackup;
}

async function download() {
  if (!updatesAllowed()) throw new Error("Las actualizaciones están desactivadas en esta PC.");
  if (!app.isPackaged) throw new Error("Las actualizaciones solo corren en la app instalada.");
  if (busy) throw new Error("Ya hay una actualización en curso.");
  busy = true;
  send({ type: "backing" });
  try {
    lastBackup = await backupShopData({
      userDataDir,
      reason: "pre-update",
      version: app.getVersion(),
    });
    send({ type: "backup", dir: lastBackup.dir });
    send({ type: "downloading", percent: 0 });
    await autoUpdater.downloadUpdate();
    return { ...snapshot(), backupDir: lastBackup.dir };
  } catch (error) {
    busy = false;
    throw new Error(explain(error));
  }
}

async function install() {
  if (!updatesAllowed()) throw new Error("Las actualizaciones están desactivadas en esta PC.");
  if (!app.isPackaged) throw new Error("Las actualizaciones solo corren en la app instalada.");
  if (!downloaded) throw new Error("Todavía no se bajó la actualización.");
  if (!lastBackup) {
    lastBackup = await backupShopData({
      userDataDir,
      reason: "pre-install",
      version: app.getVersion(),
    });
  }
  setImmediate(() => {
    autoUpdater.quitAndInstall(true, true);
  });
  return { ok: true, backupDir: lastBackup.dir };
}

module.exports = { initUpdater, status, check, peek, download, install, backupOnly, setAllow, scheduleNotify };
