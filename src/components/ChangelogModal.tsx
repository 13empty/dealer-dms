import { useState } from "react";
import { CHANGELOG, releaseFor } from "../lib/changelog";
import { k, useI18n, type Translate } from "../lib/i18n";
import { Button, Modal } from "./ui";

export function VersionButton({
  version,
  onClick,
  className = "",
}: {
  version: string;
  onClick: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  if (!version) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={t("changelog.clickHint")}
      className={`text-[11px] tabular-nums text-slate-500 transition hover:text-gold-400 hover:underline ${className}`}
    >
      {t("nav.version", { version })}
    </button>
  );
}

export function ChangelogModal({
  version,
  auto,
  onClose,
}: {
  version: string;
  auto?: boolean;
  onClose: (hide: boolean) => void;
}) {
  const { t } = useI18n();
  const [hide, setHide] = useState(false);
  const current = releaseFor(version);
  const older = CHANGELOG.filter((item) => item.version !== version);
  const showHistory = !auto;

  return (
    <Modal
      title={auto ? t("changelog.whatsNew", { version }) : t("changelog.title")}
      onClose={() => onClose(false)}
      footer={
        <>
          {auto ? (
            <label className="mr-auto mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-300">
              <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
              {t("changelog.hide")}
            </label>
          ) : null}
          <Button onClick={() => onClose(auto ? hide : false)}>{t("changelog.ok")}</Button>
        </>
      }
    >
      {current ? (
        <ReleaseBlock version={current.version} items={current.items} t={t} />
      ) : (
        <p className="text-sm text-slate-400">{t("changelog.empty")}</p>
      )}
      {auto ? <p className="mt-4 text-xs text-slate-500">{t("changelog.clickHint")}</p> : null}
      {showHistory && older.length ? (
        <div className="mt-5 space-y-4 border-t border-ink-600 pt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("changelog.history")}</div>
          {older.map((item) => (
            <ReleaseBlock key={item.version} version={item.version} items={item.items} t={t} muted />
          ))}
        </div>
      ) : null}
    </Modal>
  );
}

function ReleaseBlock({
  version,
  items,
  t,
  muted,
}: {
  version: string;
  items: string[];
  t: Translate;
  muted?: boolean;
}) {
  return (
    <div className={muted ? "text-slate-400" : ""}>
      <div className={`font-medium ${muted ? "text-slate-300" : "text-slate-100"}`}>v{version}</div>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
        {items.map((key) => (
          <li key={key}>{t(k(key))}</li>
        ))}
      </ul>
    </div>
  );
}
