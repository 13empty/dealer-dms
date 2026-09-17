const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function findRcedit(projectDir) {
  const local = path.join(projectDir, "build", "rcedit-x64.exe");
  if (fs.existsSync(local)) return local;
  const cache = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache", "winCodeSign");
  const found = [];
  function walk(dir, depth) {
    if (depth > 4 || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p, depth + 1);
      else if (name === "rcedit-x64.exe") found.push(p);
    }
  }
  walk(cache, 0);
  if (!found.length) {
    throw new Error("Falta build/rcedit-x64.exe para pegar el icono en el .exe");
  }
  return found[0];
}

function stampIcon(exe, projectDir) {
  const ico = path.join(projectDir, "build", "icon.ico");
  if (!fs.existsSync(exe) || !fs.existsSync(ico)) return;
  execFileSync(findRcedit(projectDir), [exe, "--set-icon", ico]);
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  stampIcon(exe, context.packager.projectDir);
};

