const fs = require("fs");
const path = require("path");
const { BrowserWindow, dialog } = require("electron");

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

let userDataDir = "";

function initLogo(dir) {
  userDataDir = dir;
}

function brandDir() {
  return path.join(userDataDir, "brand");
}

function metaPath() {
  return path.join(brandDir(), "logo.json");
}

function send(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("brand:event", payload);
    } catch {
      // ignore
    }
  }
}

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(metaPath(), "utf8"));
  } catch {
    return null;
  }
}

function getLogo() {
  const meta = readMeta();
  if (!meta?.file) return { dataUrl: null, custom: false };
  const file = path.join(brandDir(), path.basename(String(meta.file)));
  if (!fs.existsSync(file)) return { dataUrl: null, custom: false };
  const ext = path.extname(file).toLowerCase();
  const mime = TYPES[ext];
  if (!mime) return { dataUrl: null, custom: false };
  const buf = fs.readFileSync(file);
  return { dataUrl: `data:${mime};base64,${buf.toString("base64")}`, custom: true };
}

function clearLogo() {
  try {
    fs.rmSync(brandDir(), { recursive: true, force: true });
  } catch {
    // ignore
  }
  send({ type: "changed" });
  return getLogo();
}

function setLogoFromFile(src) {
  const ext = path.extname(src).toLowerCase();
  if (!TYPES[ext]) throw new Error("Usa PNG, JPG, WEBP, GIF o ICO.");
  const st = fs.statSync(src);
  if (st.size > MAX_BYTES) throw new Error("El logo no puede pesar más de 2 MB.");
  fs.mkdirSync(brandDir(), { recursive: true });
  for (const name of fs.readdirSync(brandDir())) {
    fs.unlinkSync(path.join(brandDir(), name));
  }
  const destName = `logo${ext}`;
  fs.copyFileSync(src, path.join(brandDir(), destName));
  fs.writeFileSync(metaPath(), JSON.stringify({ file: destName, at: new Date().toISOString() }), "utf8");
  send({ type: "changed" });
  return getLogo();
}

async function pickLogo(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow || undefined, {
    title: "Logo del taller",
    properties: ["openFile"],
    filters: [{ name: "Imagen", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico"] }],
  });
  if (result.canceled || !result.filePaths[0]) return getLogo();
  return setLogoFromFile(result.filePaths[0]);
}

function copyLogoTo(destDir) {
  if (!userDataDir || !fs.existsSync(brandDir())) return false;
  fs.cpSync(brandDir(), path.join(destDir, "brand"), { recursive: true });
  return true;
}

module.exports = { initLogo, getLogo, pickLogo, clearLogo, setLogoFromFile, copyLogoTo, brandDir };
