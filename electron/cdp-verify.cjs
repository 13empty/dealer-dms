const fs = require("fs");
const path = require("path");

(async () => {
  const targets = await fetch("http://127.0.0.1:9222/json/list").then((r) => r.json());
  const t = targets.find((x) => x.type === "page");
  if (!t) throw new Error("no page");
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
  };
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  function send(method, params = {}) {
    const n = ++id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout " + method)), 10000);
      pending.set(n, (msg) => {
        clearTimeout(timer);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  }
  async function evalJs(expression) {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  }
  await send("Runtime.enable");
  await send("Page.enable");
  const outDir = path.join(__dirname, "..", "tmp-shot");
  fs.mkdirSync(outDir, { recursive: true });
  const hash = process.argv[2];
  const name = process.argv[3] || "shot";
  await evalJs(`location.hash = ${JSON.stringify(hash)}; true`);
  await new Promise((r) => setTimeout(r, 1400));
  if (process.argv[4] === "customer-new-ot") {
    await evalJs(`([...document.querySelectorAll("button")].find((b) => /Nueva OT|New RO|Nouveau bon/i.test((b.textContent || "").trim())) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (process.argv[4] === "finance-expense") {
    await evalJs(`([...document.querySelectorAll("button")].find((b) => /Registrar gasto|Add expense|Enregistrer une dépense/i.test((b.textContent || "").trim())) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 800));
  }
  if (process.argv[4] === "finance-collect") {
    await evalJs(`([...document.querySelectorAll("button")].find((b) => /Registrar cobro|Record payment|Enregistrer un encaissement/i.test((b.textContent || "").trim())) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 500));
    await evalJs(`(() => {
      const i = [...document.querySelectorAll("input")].find((el) => /Busca OT|Search RO|Rechercher BR/i.test(el.getAttribute("placeholder") || ""));
      if (!i) return false;
      i.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(i, "OT");
      i.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 700));
    await evalJs(`([...document.querySelectorAll("button")].find((b) => /OT-|RO-/.test(b.textContent || "")) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 500));
  }
  if (process.argv[4] === "click-categorias") {
    await evalJs(`([...document.querySelectorAll("button")].find((b) => /Categorías|Categories|Catégories/i.test((b.textContent || "").trim())) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 800));
  }
  if (process.argv[4] === "click-line") {
    const needle = process.argv[5] || "BAT";
    await evalJs(`([...document.querySelectorAll("tr")].filter((tr) => /Op\\s/.test(tr.textContent || "") && (tr.textContent || "").includes(${JSON.stringify(needle)})).pop() || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 600));
  }
  if (process.argv[4] === "open-first-ot") {
    await evalJs(`([...document.querySelectorAll("a")].find((a) => /OT-|RO-/.test(a.textContent || "")) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 1400));
  }
  if (process.argv[4] === "open-first-sale") {
    await evalJs(`([...document.querySelectorAll("a")].find((a) => a.getAttribute("href") && a.getAttribute("href").includes("/ventas/") && !a.getAttribute("href").includes("imprimir")) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 1400));
  }
  if (process.argv[4] === "pay-close") {
    await evalJs(`([...document.querySelectorAll("button")].find((b) => /Cobrar y entregar|Collect & deliver|Encaisser et livrer/i.test((b.textContent || "").trim())) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 1600));
  }
  if (process.argv[4] === "click-text") {
    const needle = process.argv[5] || "";
    await evalJs(`([...document.querySelectorAll("a,button")].find((el) => (el.textContent || "").includes(${JSON.stringify(needle)})) || {click(){}}).click()`);
    await new Promise((r) => setTimeout(r, 1400));
  }
  const info = await evalJs("({hash: location.hash, text: document.body.innerText.slice(0,700), buttons: [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(Boolean).slice(0,20)})");
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(outDir, name + ".png"), Buffer.from(shot.data, "base64"));
  console.log(JSON.stringify(info));
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
