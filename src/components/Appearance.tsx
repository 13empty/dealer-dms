import { THEMES, type DensityId, type ThemeId, type TypeSizeId } from "../lib/prefs";
import { usePrefs } from "../lib/prefs-context";
import { k, useI18n } from "../lib/i18n";
import { Field } from "./ui";

const SWATCH: Record<ThemeId, { bg: string; accent: string }> = {
  oro: { bg: "#0c1017", accent: "#e8b86d" },
  bahia: { bg: "#0e0c0a", accent: "#f59e42" },
  acero: { bg: "#080e14", accent: "#38bdf8" },
  bosque: { bg: "#0a120e", accent: "#a3e635" },
  noche: { bg: "#000000", accent: "#fbbf24" },
  cobre: { bg: "#140c08", accent: "#e07a3d" },
  vino: { bg: "#14080e", accent: "#e11d48" },
  pizarra: { bg: "#101018", accent: "#a78bfa" },
  marina: { bg: "#061016", accent: "#2dd4bf" },
  dia: { bg: "#f5f1e8", accent: "#b47820" },
  niebla: { bg: "#e8ecf2", accent: "#2563eb" },
};

export function AppearancePanel({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { prefs, setPref } = usePrefs();

  return (
    <div className={compact ? "grid gap-3" : "grid gap-5"}>
      <div>
        {!compact ? <h2 className="text-lg font-medium">{t("appearance.title")}</h2> : null}
        <p className={compact ? "text-xs text-slate-400" : "mt-1 text-sm text-slate-400"}>{t("appearance.hint")}</p>
        <div className={`grid gap-2 ${compact ? "mt-2 grid-cols-3" : "mt-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
          {THEMES.map((id) => {
            const active = prefs.theme === id;
            const swatch = SWATCH[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPref("theme", id)}
                className={`flex items-center gap-2 rounded-lg border text-left transition ${
                  compact ? "p-2" : "px-2.5 py-2"
                } ${active ? "border-gold-400 bg-gold-400/10" : "border-ink-600 bg-ink-900/60 hover:border-gold-400/40"}`}
              >
                <span
                  className={`relative shrink-0 overflow-hidden rounded-md border border-ink-600 ${compact ? "h-6 w-6" : "h-7 w-7"}`}
                  style={{ background: swatch.bg }}
                >
                  <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: swatch.accent }} />
                </span>
                <span className="text-sm">{t(k(`appearance.theme.${id}`))}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
        <Field label={t("appearance.size")}>
          <select value={prefs.typeSize} onChange={(e) => setPref("typeSize", e.target.value as TypeSizeId)}>
            <option value="md">{t("appearance.size.md")}</option>
            <option value="lg">{t("appearance.size.lg")}</option>
          </select>
        </Field>
        <Field label={t("appearance.density")}>
          <select value={prefs.density} onChange={(e) => setPref("density", e.target.value as DensityId)}>
            <option value="comodo">{t("appearance.density.comodo")}</option>
            <option value="compacto">{t("appearance.density.compacto")}</option>
          </select>
        </Field>
        <Field label={t("appearance.promised")} hint={t("appearance.promisedHint")}>
          <select value={String(prefs.promisedDays)} onChange={(e) => setPref("promisedDays", Number(e.target.value))}>
            <option value="0">{t("appearance.promised.0")}</option>
            <option value="1">{t("appearance.promised.1")}</option>
            <option value="2">{t("appearance.promised.2")}</option>
            <option value="3">{t("appearance.promised.3")}</option>
            <option value="7">{t("appearance.promised.7")}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm normal-case tracking-normal text-slate-200">
          <input type="checkbox" checked={prefs.showUnitSales} onChange={(e) => setPref("showUnitSales", e.target.checked)} />
          {t("appearance.unitSales")}
        </label>
      </div>
      {!compact ? <p className="text-xs text-slate-500">{t("appearance.unitSalesHint")}</p> : null}
    </div>
  );
}

export function AppearanceStrip() {
  const { t } = useI18n();
  const { prefs, setPref } = usePrefs();
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <select value={prefs.theme} onChange={(e) => setPref("theme", e.target.value as ThemeId)} className="py-1.5 text-xs" title={t("appearance.theme")}>
        {THEMES.map((id) => (
          <option key={id} value={id}>
            {t(k(`appearance.theme.${id}`))}
          </option>
        ))}
      </select>
      <select value={prefs.typeSize} onChange={(e) => setPref("typeSize", e.target.value as TypeSizeId)} className="py-1.5 text-xs" title={t("appearance.size")}>
        <option value="md">{t("appearance.size.md")}</option>
        <option value="lg">{t("appearance.size.lg")}</option>
      </select>
    </div>
  );
}
