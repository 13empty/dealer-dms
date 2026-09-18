import { useEffect, useState } from "react";
import appIcon from "../assets/app-icon.png";
import { call } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { Button } from "./ui";

export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  const [src, setSrc] = useState(appIcon);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const next = await call(window.dms.brand.get());
        if (alive) setSrc(next?.dataUrl || appIcon);
      } catch {
        if (alive) setSrc(appIcon);
      }
    }
    void load();
    const off = window.dms.brand.onChange(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);

  return <img src={src} alt="" className={`rounded-lg object-cover ${className}`} />;
}

export function LogoPicker() {
  const { t } = useI18n();
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const next = await call(window.dms.brand.get());
    setCustom(Boolean(next?.custom));
  }

  useEffect(() => {
    void refresh().catch(() => {});
    return window.dms.brand.onChange(() => {
      void refresh().catch(() => {});
    });
  }, []);

  async function pick() {
    setBusy(true);
    setError(null);
    try {
      const next = await call(window.dms.brand.pick());
      setCustom(Boolean(next?.custom));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await call(window.dms.brand.clear());
      setCustom(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-600 bg-ink-900/60 px-3 py-3">
        <BrandMark className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-100">{t("settings.logo")}</div>
          <p className="mt-0.5 text-xs text-slate-400">{t("settings.logoHint")}</p>
          {custom ? <p className="mt-1 text-xs text-gold-400">{t("settings.logoCustom")}</p> : null}
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void pick()}>
            {t("settings.logoChange")}
          </Button>
          {custom ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void reset()}>
              {t("settings.logoReset")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
