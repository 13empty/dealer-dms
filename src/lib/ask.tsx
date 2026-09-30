import { useEffect, useState } from "react";
import { Button } from "../components/ui";
import { useI18n } from "./i18n";

type Pending = {
  message: string;
  resolve: (ok: boolean) => void;
};

let openConfirm: ((message: string) => Promise<boolean>) | null = null;

export function askConfirm(message: string): Promise<boolean> {
  if (openConfirm) return openConfirm(message);
  return Promise.resolve(window.confirm(message));
}

export function ConfirmHost() {
  const { t } = useI18n();
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    openConfirm = (message) =>
      new Promise((resolve) => {
        setPending({ message, resolve });
      });
    return () => {
      openConfirm = null;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const current = pending;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPending(null);
        current.resolve(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  if (!pending) return null;

  function finish(ok: boolean) {
    const current = pending;
    setPending(null);
    current?.resolve(ok);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={() => finish(false)}>
      <div
        className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-slate-100">{pending.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => finish(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => finish(true)}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
