import { useState } from "react";
import type { CatalogItem } from "../vite-env";
import { useI18n } from "../lib/i18n";
import { Button } from "./ui";

export function CatalogEditor({
  title,
  hint,
  items,
  placeholder,
  canEdit,
  locked,
  labelFor,
  onChange,
}: {
  title: string;
  hint?: string;
  items: CatalogItem[];
  placeholder: string;
  canEdit: boolean;
  locked?: boolean;
  labelFor: (id: string) => string;
  onChange: (ids: string[]) => Promise<unknown> | void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const name = draft.trim();
    if (!name || locked || !canEdit || busy) return;
    const exists = items.some((item) => labelFor(item.id).toLowerCase() === name.toLowerCase() || item.id.toLowerCase() === name.toLowerCase());
    setDraft("");
    if (exists) return;
    setBusy(true);
    try {
      await onChange([...items.map((item) => item.id), name]);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const item = items.find((row) => row.id === id);
    if (!item || item.locked || item.inUse > 0 || locked || !canEdit || busy) return;
    setBusy(true);
    try {
      await onChange(items.filter((row) => row.id !== id).map((row) => row.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/50 p-3">
      <h3 className="font-medium">{title}</h3>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-ink-800/70 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate">
              {labelFor(item.id)}
              {item.inUse > 0 ? <span className="ml-2 text-xs text-slate-500">{t("catalog.inUse", { n: item.inUse })}</span> : null}
              {item.locked || locked ? <span className="ml-2 text-xs text-slate-500">{t("catalog.locked")}</span> : null}
            </span>
            {canEdit && !locked && !item.locked ? (
              <button
                className="shrink-0 text-xs text-red-300 disabled:text-slate-600"
                disabled={item.inUse > 0 || busy}
                onClick={() => void remove(item.id)}
              >
                {t("common.remove")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit && !locked ? (
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
          />
          <Button variant="ghost" disabled={!draft.trim() || busy} onClick={() => void add()}>
            {t("catalog.add")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
