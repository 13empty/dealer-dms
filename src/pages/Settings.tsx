import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppearancePanel } from "../components/Appearance";
import { UpdatePanel } from "../components/UpdatePanel";
import { SearchPicker } from "../components/SearchPicker";
import { CatalogEditor } from "../components/CatalogEditor";
import { Button, Card, ErrorText, Field, PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth";
import { catalogLabel, useCatalogs } from "../lib/catalogs";
import { call, customerName, vehicleLabel } from "../lib/format";
import { SHOP_DEFAULTS } from "../lib/canada";
import { useI18n } from "../lib/i18n";
import type { ShopSettings } from "../vite-env";

export default function Settings() {
  const { t } = useI18n();
  const { can } = useAuth();
  const { catalogs, save: saveCatalogs } = useCatalogs();
  const [form, setForm] = useState<ShopSettings | null>(null);
  const [numbering, setNumbering] = useState({ woPrefix: "OT", woNextNumber: "1", woPad: "4", woPreview: "OT-0001" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [numberSaved, setNumberSaved] = useState(false);
  const [changedNumber, setChangedNumber] = useState(false);
  const [pickedWo, setPickedWo] = useState({ id: "", label: "", hint: "" });
  const [newNumber, setNewNumber] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [rateText, setRateText] = useState({ tax: "", labor: "" });

  async function loadSettings() {
    const next = await call(window.dms.settings.get());
    setForm(next);
    setRateText({
      tax: String(next.taxRate ?? SHOP_DEFAULTS.taxRate),
      labor: String(next.laborRate ?? SHOP_DEFAULTS.laborRate),
    });
    setNumbering({
      woPrefix: next.woPrefix || "OT",
      woNextNumber: String(next.woNextNumber || 1),
      woPad: String(next.woPad || 4),
      woPreview: next.woPreview || "",
    });
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadSettings();
        setDbPath(await call(window.dms.meta.dbPath()));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  async function save() {
    if (!form) return;
    try {
      setError(null);
      setSaved(false);
      const savedShop = await call(
        window.dms.settings.save({
          ...form,
          taxRate: Math.max(0, Number(rateText.tax) || 0),
          laborRate: Math.max(0, Number(rateText.labor) || 0),
        })
      );
      setForm(savedShop);
      setRateText({
        tax: String(savedShop.taxRate ?? SHOP_DEFAULTS.taxRate),
        labor: String(savedShop.laborRate ?? SHOP_DEFAULTS.laborRate),
      });
      setSaved(true);
      window.dispatchEvent(new Event("dms-shop"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveServiceMode(mode: "sencillo" | "completo") {
    if (!form) return;
    const next = { ...form, serviceMode: mode };
    setForm(next);
    try {
      setError(null);
      setSaved(false);
      setForm(await call(window.dms.settings.save(next)));
      setSaved(true);
      window.dispatchEvent(new Event("dms-shop"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveOfferWash(on: boolean) {
    if (!form) return;
    const next = { ...form, offerWash: on };
    setForm(next);
    try {
      setError(null);
      setSaved(false);
      setForm(await call(window.dms.settings.save(next)));
      setSaved(true);
      window.dispatchEvent(new Event("dms-shop"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveNumbering() {
    try {
      setError(null);
      setNumberSaved(false);
      const next = await call(
        window.dms.settings.saveNumbering({
          woPrefix: numbering.woPrefix,
          woNextNumber: Number(numbering.woNextNumber) || 1,
          woPad: Number(numbering.woPad) || 4,
        })
      );
      setForm(next);
      setNumbering({
        woPrefix: next.woPrefix || "OT",
        woNextNumber: String(next.woNextNumber || 1),
        woPad: String(next.woPad || 4),
        woPreview: next.woPreview || "",
      });
      setNumberSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function changeExistingNumber() {
    if (!pickedWo.id || !newNumber.trim()) return;
    try {
      setError(null);
      setChangedNumber(false);
      const updated = await call(window.dms.workOrders.setNumber(pickedWo.id, newNumber));
      setPickedWo({ id: String(updated.id), label: updated.number, hint: customerName(updated.customer) });
      setNewNumber("");
      setChangedNumber(true);
      await loadSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!form) {
    return (
      <div className="page">
        <ErrorText error={error} />
        <p className="text-slate-400">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        actions={<Button onClick={() => void save()}>{t("common.save")}</Button>}
      />
      <ErrorText error={error} />
      {saved ? <p className="mb-4 text-sm text-emerald-300">{t("settings.saved")}</p> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
        <Card className="p-5">
          <h2 className="text-lg font-medium">{t("settings.shopTitle")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label={t("settings.name")}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <Field label={t("settings.phone")}>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={t("settings.email")}>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label={t("settings.laborRate")}>
              <input value={rateText.labor} onChange={(e) => setRateText({ ...rateText, labor: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label={t("settings.address")}>
                <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
            <Field label={t("settings.taxLabel")}>
              <input value={form.taxLabel} onChange={(e) => setForm({ ...form, taxLabel: e.target.value })} />
            </Field>
            <Field label={t("settings.taxRate")}>
              <input value={rateText.tax} onChange={(e) => setRateText({ ...rateText, tax: e.target.value })} />
            </Field>
            <Field label={t("settings.gstNumber")}>
              <input
                value={form.gstNumber || ""}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                placeholder="123456789RT0001"
              />
            </Field>
            <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
              {t("settings.taxHintAb")} {t("settings.gstHint")}
            </p>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label={t("settings.invoiceNotes")}>
                <textarea rows={2} value={form.invoiceNotes || ""} onChange={(e) => setForm({ ...form, invoiceNotes: e.target.value })} />
              </Field>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">{t("settings.hint")}</p>
        </Card>

        {can.updates ? (
          <Card className="p-5">
            <UpdatePanel />
          </Card>
        ) : null}
        </div>

        <div className="grid gap-4">
          <Card className="p-5">
            <AppearancePanel />
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-medium">{t("settings.serviceMode")}</h2>
            <p className="mt-1 text-sm text-slate-400">{t("settings.serviceModeHint")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(["sencillo", "completo"] as const).map((mode) => {
                const active = (form.serviceMode || "completo") === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => void saveServiceMode(mode)}
                    className={`rounded-lg border p-3 text-left transition ${
                      active ? "border-gold-400 bg-gold-400/10" : "border-ink-600 bg-ink-900/60 hover:border-gold-400/40"
                    }`}
                  >
                    <div className="font-medium text-slate-100">
                      {t(mode === "sencillo" ? "settings.serviceSimple" : "settings.serviceFull")}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {t(mode === "sencillo" ? "settings.serviceSimpleHint" : "settings.serviceFullHint")}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-medium">{t("settings.offerWash")}</h2>
            <p className="mt-1 text-sm text-slate-400">{t("settings.offerWashHint")}</p>
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-ink-600 bg-ink-900/60 p-3">
              <input
                className="mt-1"
                type="checkbox"
                checked={Boolean(form.offerWash)}
                onChange={(e) => void saveOfferWash(e.target.checked)}
              />
              <span>
                <span className="block font-medium text-slate-100">{t("settings.offerWash")}</span>
                <span className="mt-1 block text-xs text-slate-400">{t("settings.washMenuHint")}</span>
              </span>
            </label>
            <Link className="mt-3 inline-block text-sm text-gold-400 hover:underline" to="/lavado?tipos=1">
              {t("wash.manageTypes")}
            </Link>
          </Card>
          {dbPath ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-medium">{t("settings.backupTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-400">{t("settings.backupHint")}</p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">{dbPath}</p>
                </div>
                <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(dbPath)}>
                  {t("settings.copyPath")}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>

        {can.options ? (
          <Card className="p-5 lg:col-span-2">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="text-lg font-medium">{t("settings.numberingTitle")}</h2>
                <p className="mt-1 text-sm text-slate-400">{t("settings.numberingSubtitle")}</p>
                {numberSaved ? <p className="mt-2 text-sm text-emerald-300">{t("settings.numberingSaved")}</p> : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Field label={t("settings.woPrefix")}>
                    <input value={numbering.woPrefix} onChange={(e) => setNumbering({ ...numbering, woPrefix: e.target.value })} />
                  </Field>
                  <Field label={t("settings.woNext")}>
                    <input value={numbering.woNextNumber} onChange={(e) => setNumbering({ ...numbering, woNextNumber: e.target.value })} />
                  </Field>
                  <Field label={t("settings.woPad")}>
                    <input value={numbering.woPad} onChange={(e) => setNumbering({ ...numbering, woPad: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={() => void saveNumbering()}>{t("common.save")}</Button>
                  <p className="text-sm text-gold-400">{t("settings.woPreview", { number: numbering.woPreview })}</p>
                </div>
              </div>
              <div className="border-t border-ink-600 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h3 className="text-lg font-medium">{t("settings.changeNumberTitle")}</h3>
                <p className="mt-1 text-sm text-slate-400">{t("settings.changeNumberHint")}</p>
                {changedNumber ? <p className="mt-2 text-sm text-emerald-300">{t("settings.numberChanged")}</p> : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label={t("settings.currentNumber")}>
                    <SearchPicker
                      value={pickedWo.id}
                      selectedLabel={pickedWo.label}
                      selectedHint={pickedWo.hint}
                      placeholder={t("search.placeholder")}
                      allowEmpty
                      onChange={(id, option) => {
                        setPickedWo({
                          id,
                          label: option?.label || "",
                          hint: option?.hint || "",
                        });
                        setNewNumber(option?.label || "");
                      }}
                      search={async (query) => {
                        const rows = await call(window.dms.workOrders.list(query, { limit: 8 }));
                        return rows.map((row) => ({
                          id: row.id,
                          label: row.number,
                          hint: [customerName(row.customer), vehicleLabel(row.vehicle)].filter(Boolean).join(" · "),
                          raw: row,
                        }));
                      }}
                    />
                  </Field>
                  <Field label={t("settings.newNumber")}>
                    <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="OT-0100" />
                  </Field>
                </div>
                <div className="mt-4">
                  <Button disabled={!pickedWo.id || !newNumber.trim()} onClick={() => void changeExistingNumber()}>
                    {t("settings.changeNumber")}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {can.finance ? (
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-lg font-medium">{t("settings.catalogsTitle")}</h2>
            <p className="mt-1 text-sm text-slate-400">{t("settings.catalogsSubtitle")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CatalogEditor
                title={t("catalog.opcodeCats")}
                items={(catalogs?.opcodeCategories || []).filter((item) => item.id !== "lavado" && item.id !== "detailing")}
                placeholder={t("catalog.new")}
                canEdit={can.finance}
                labelFor={(id) => catalogLabel(t, "op", id)}
                onChange={(ids) => {
                  const wash = (catalogs?.opcodeCategories || [])
                    .filter((item) => item.id === "lavado" || item.id === "detailing")
                    .map((item) => item.id);
                  return saveCatalogs({ opcodeCategories: [...ids, ...wash] });
                }}
              />
              <CatalogEditor
                title={t("catalog.partCats")}
                items={catalogs?.partCategories || []}
                placeholder={t("catalog.new")}
                canEdit={can.finance}
                labelFor={(id) => catalogLabel(t, "partCat", id)}
                onChange={(ids) => saveCatalogs({ partCategories: ids })}
              />
              <CatalogEditor
                title={t("catalog.uoms")}
                items={catalogs?.partUoms || []}
                placeholder={t("catalog.new")}
                canEdit={can.finance}
                labelFor={(id) => catalogLabel(t, "partUom", id)}
                onChange={(ids) => saveCatalogs({ partUoms: ids })}
              />
              <CatalogEditor
                title={t("catalog.payTypes")}
                hint={t("catalog.payHint")}
                items={catalogs?.payTypes || []}
                placeholder=""
                canEdit={false}
                locked
                labelFor={(id) => catalogLabel(t, "opPay", id)}
                onChange={() => undefined}
              />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
