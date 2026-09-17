import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui";
import { call } from "../lib/format";
import { useI18n } from "../lib/i18n";

type UpdateState = {
  current: string;
  packaged: boolean;
  available: boolean;
  version: string | null;
  downloaded: boolean;
  backupDir: string | null;
  busy: boolean;
  allowUpdates: boolean;
  note?: string;
};

export function UpdatePanel() {
  const { t } = useI18n();
  const [state, setState] = useState<UpdateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState<"idle" | "checking" | "backing" | "downloading" | "ready">("idle");
  const [saved, setSaved] = useState<string | null>(null);

  async function refresh() {
    const next = await call(window.dms.updates.status());
    setState(next);
    if (next.downloaded && next.allowUpdates) setPhase("ready");
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    const off = window.dms.updates.onEvent((event) => {
      if (event.type === "progress") setPercent(Number(event.percent) || 0);
      if (event.type === "backing") setPhase("backing");
      if (event.type === "downloading") setPhase("downloading");
      if (event.type === "backup") {
        setSaved(String(event.dir || ""));
        setState((prev) => (prev ? { ...prev, backupDir: String(event.dir || prev.backupDir) } : prev));
      }
      if (event.type === "downloaded") {
        setPhase("ready");
        setPercent(100);
        void refresh();
      }
      if (event.type === "available") {
        setState((prev) => (prev ? { ...prev, available: true, version: String(event.version || prev.version) } : prev));
      }
      if (event.type === "current") {
        setState((prev) => (prev ? { ...prev, available: false } : prev));
      }
      if (event.type === "disabled" || event.type === "policy") {
        void refresh();
      }
      if (event.type === "error") setError(String(event.message || t("updates.failed")));
    });
    return off;
  }, [t]);

  async function run<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    try {
      setError(null);
      return await call(fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  async function check() {
    setPhase("checking");
    const next = await run(() => window.dms.updates.check());
    if (next) setState(next);
    setPhase("idle");
  }

  async function apply() {
    setPhase("backing");
    const next = await run(() => window.dms.updates.download());
    if (!next) {
      setPhase("idle");
      return;
    }
    setState(next);
    setPhase("ready");
    await run(() => window.dms.updates.install());
  }

  async function backupNow() {
    const next = await run(() => window.dms.updates.backup());
    if (next?.dir) setSaved(next.dir);
  }

  async function toggleAllow(on: boolean) {
    const next = await run(() => window.dms.updates.setAllow(on));
    if (next) {
      setState(next);
      if (!next.allowUpdates) {
        setPhase("idle");
        setPercent(0);
      }
    }
  }

  const current = state?.current || "…";
  const packaged = Boolean(state?.packaged);
  const allowed = Boolean(state?.allowUpdates);
  const available = Boolean(state?.available);
  const downloaded = Boolean(state?.downloaded);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{t("updates.title")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("updates.hint")}</p>
        </div>
        <p className="shrink-0 text-sm text-slate-300">
          {t("updates.current", { version: current })}
          {allowed && state?.version && available ? ` · ${t("updates.found", { version: state.version })}` : null}
        </p>
      </div>
      <label className="mt-3 flex items-start gap-3 rounded-lg border border-ink-600 bg-ink-900/60 px-3 py-2.5 text-sm normal-case tracking-normal text-slate-100">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={allowed}
          onChange={(e) => void toggleAllow(e.target.checked)}
        />
        <span>
          <span className="block font-medium">{t("updates.allow")}</span>
          <span className="mt-0.5 block text-xs font-normal text-slate-400">{t("updates.allowHint")}</span>
        </span>
      </label>
      {!allowed ? <p className="mt-2 text-sm text-slate-400">{t("updates.off")}</p> : null}
      {!packaged ? <p className="mt-2 text-sm text-amber-300">{t("updates.devOnly")}</p> : null}
      {phase === "backing" ? <p className="mt-2 text-sm text-slate-300">{t("updates.backing")}</p> : null}
      {phase === "downloading" ? (
        <p className="mt-2 text-sm text-slate-300">{t("updates.downloading", { n: percent })}</p>
      ) : null}
      {saved || state?.backupDir ? (
        <p className="mt-2 break-all font-mono text-xs text-slate-500">{saved || state?.backupDir}</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" disabled={!allowed || phase === "checking"} onClick={() => void check()}>
          {phase === "checking" ? t("updates.checking") : t("updates.check")}
        </Button>
        <Button variant="ghost" onClick={() => void backupNow()}>
          {t("updates.backupNow")}
        </Button>
        {packaged && allowed && (available || downloaded) ? (
          <Button disabled={phase === "backing" || phase === "downloading"} onClick={() => void apply()}>
            {downloaded ? t("updates.restart") : t("updates.install")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function UpdateBanner() {
  const { t } = useI18n();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const packaged = await call(window.dms.meta.isPackaged());
        if (!packaged) return;
        const status = await call(window.dms.updates.status());
        if (!status.allowUpdates) return;
        const next = await call(window.dms.updates.check());
        if (alive && next.available && next.version) setVersion(next.version);
      } catch {
        // silent on home
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!version) return null;
  return (
    <div className="mb-5 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm">
      {t("updates.banner", { version })}{" "}
      <Link className="font-medium text-gold-400 hover:underline" to="/ajustes">
        {t("updates.goSettings")}
      </Link>
    </div>
  );
}
