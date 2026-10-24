const { app, BrowserWindow, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const { openDatabase } = require("./db/index.cjs");
const repo = require("./db/repo.cjs");
const { seedStarter } = require("./db/seed.cjs");
const { registerIpc, setSessionPath } = require("./ipc.cjs");
const { initUpdater, scheduleNotify } = require("./updater.cjs");
const { initLogo } = require("./logo.cjs");

const isDev = !app.isPackaged;

app.setName("DealerDMS");
app.setAppUserModelId("com.dealerdms.app");
app.setPath("userData", path.join(app.getPath("appData"), "DealerDMS"));

function appIcon() {
  return path.join(__dirname, "icon.ico");
}

function shopTitle() {
  try {
    return repo.shopDisplayName();
  } catch {
    return "Dealer DMS";
  }
}

function isAllowedAppUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") return true;
    if (
      isDev &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      parsed.port === "5173"
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function hardenWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const guard = (event, url) => {
    if (!isAllowedAppUrl(url)) event.preventDefault();
  };
  win.webContents.on("will-navigate", guard);
  win.webContents.on("will-redirect", guard);
  if (app.isPackaged) {
    win.webContents.on("devtools-opened", () => {
      try {
        win.webContents.closeDevTools();
      } catch {
        // ignore
      }
    });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0c1017",
    title: shopTitle(),
    icon: appIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });
  hardenWindow(win);

  win.setMenuBarVisibility(false);
  win.once("ready-to-show", () => win.show());
  win.on("focus", () => {
    try {
      win.webContents.focus();
    } catch {
      // ignore
    }
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    try {
      fs.appendFileSync(
        path.join(app.getPath("userData"), "window.log"),
        `${new Date().toISOString()} renderer-gone ${JSON.stringify(details)}\n`
      );
    } catch {
      // ignore
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  if (app.isPackaged) Menu.setApplicationMenu(null);
  const userData = app.getPath("userData");
  openDatabase(userData);
  setSessionPath(userData);
  try {
    seedStarter();
  } catch {
    // Si el arranque limpio falla, la app igual abre.
  }
  registerIpc(app);
  initLogo(userData);
  initUpdater(userData);
  createWindow();
  scheduleNotify();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
