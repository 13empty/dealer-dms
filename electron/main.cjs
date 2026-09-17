const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const { openDatabase } = require("./db/index.cjs");
const { seedStarter } = require("./db/seed.cjs");
const { registerIpc, setSessionPath } = require("./ipc.cjs");

const isDev = !app.isPackaged;

app.setName("DealerDMS");
app.setAppUserModelId("com.dealerdms.app");
app.setPath("userData", path.join(app.getPath("appData"), "DealerDMS"));

function appIcon() {
  return path.join(__dirname, "icon.ico");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0c1017",
    title: "Dealer DMS",
    icon: appIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.once("ready-to-show", () => win.show());
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
  const userData = app.getPath("userData");
  openDatabase(userData);
  setSessionPath(userData);
  try {
    seedStarter();
  } catch {
    // Si el arranque limpio falla, la app igual abre.
  }
  registerIpc(app);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
