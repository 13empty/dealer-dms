import { useEffect, useState } from "react";
import { call } from "../lib/format";
import { releaseFor, shouldShowChangelog } from "../lib/changelog";
import { k, useI18n } from "../lib/i18n";
import { Button } from "./ui";

const SESSION_KEY = "dms.update.notice.session";

type Kind = "installed" | "available";

function sessionHidden(key: string) {
  try {
    return sessionStorage.getItem(SESSION_KEY) === key;
  } catch {
    return false;
  }
}

function hideSession(key: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, key);
  } catch {
    /* ignore */
  }
}

export function UpdateNotice({
  version,
  onShowMore,
}: {
  version: string;
  onShowMore: (kind: Kind) => void;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind | null>(null);
  const [remote, setRemote] = useState("");

  useEffect(() => {
    if (!version) return;
    let alive = true;
    void (async () => {
      let nextKind: Kind | null = shouldShowChangelog(version) ? "installed" : null;
      let nextRemote = "";
      try {
        const packaged = await call(window.dms.meta.isPackaged());
        if (packaged) {
          const peek = await call(window.dms.updates.peek());
          if (peek.available && peek.version && peek.version !== version) {
            nextKind = "available";
            nextRemote = String(peek.version);
          }
        }
      } catch {
        /* peek can wait until login or network */
      }
      if (!alive || !nextKind) return;
      const token = `${nextKind}:${nextKind === "available" ? nextRemote : version}`;
      if (sessionHidden(token)) return;
      setRemote(nextRemote);
      setKind(nextKind);
    })();
    const off = window.dms.updates.onEvent((event) => {
      if (event.type !== "available" || !event.version || event.version === version) return;
      const token = `available:${event.version}`;
      if (sessionHidden(token)) return;
      setRemote(String(event.version));
      setKind("available");
    });
    return () => {
      alive = false;
      off();
    };
  }, [version]);

  if (!kind || !version) return null;
  if (kind === "available" && !remote) return null;
  const shown = kind === "available" ? remote : version;
  const preview = kind === "installed" ? releaseFor(version)?.items[0] : "";
  const token = `${kind}:${shown}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4 print:hidden">
      <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-gold-400/50 bg-ink-900 px-4 py-3 shadow-lg shadow-black/40">
        <p className="text-sm font-medium text-slate-100">
          {kind === "available"
            ? t("updates.noticeAvailable", { version: shown })
            : t("updates.noticeInstalled", { version: shown })}
        </p>
        {preview ? <p className="mt-1 text-sm text-slate-400">{t(k(preview))}</p> : null}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              hideSession(token);
              setKind(null);
            }}
          >
            {t("common.close")}
          </Button>
          <Button
            onClick={() => {
              setKind(null);
              onShowMore(kind);
            }}
          >
            {t("updates.showMore")}
          </Button>
        </div>
      </div>
    </div>
  );
}
