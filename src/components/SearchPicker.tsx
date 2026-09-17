import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useI18n } from "../lib/i18n";

export type SearchOption = {
  id: string;
  label: string;
  hint?: string;
  raw?: unknown;
};

export function SearchPicker({
  value,
  selectedLabel,
  selectedHint,
  placeholder,
  allowEmpty,
  emptyText,
  disabled,
  autoFocus,
  onChange,
  search,
  onCreate,
  createText,
}: {
  value: string;
  selectedLabel?: string;
  selectedHint?: string;
  placeholder: string;
  allowEmpty?: boolean;
  emptyText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (id: string, option: SearchOption | null) => void;
  search: (q: string) => Promise<SearchOption[]>;
  onCreate?: (query: string) => void;
  createText?: (query: string) => string;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void searchRef
        .current(q)
        .then((next) => {
          if (!alive) return;
          setRows(next);
          setActive(0);
        })
        .catch((e) => {
          if (!alive) return;
          setRows([]);
          setError(e instanceof Error ? e.message : t("picker.searchFailed"));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (autoFocus && !value) inputRef.current?.focus();
  }, [autoFocus, value]);

  function pick(row: SearchOption) {
    onChange(String(row.id), row);
    setOpen(false);
    setQ("");
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" && !rows.length && onCreate) {
      e.preventDefault();
      onCreate(q);
      setOpen(false);
      setQ("");
      return;
    }
    if (!rows.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row);
    }
  }

  function openSearch() {
    if (disabled) return;
    setQ("");
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const shown = Boolean(value) && !open;

  return (
    <div ref={boxRef} className="relative">
      {shown ? (
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-left"
          onClick={openSearch}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{selectedLabel || t("common.select")}</div>
            {selectedHint ? <div className="truncate text-xs text-slate-500">{selectedHint}</div> : null}
          </div>
          {allowEmpty ? (
            <span
              className="text-xs text-slate-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onChange("", null);
              }}
            >
              {emptyText || t("picker.clear")}
            </span>
          ) : null}
          <span className="text-xs text-gold-400">{t("common.search")}</span>
        </button>
      ) : (
        <input
          ref={inputRef}
          disabled={disabled}
          placeholder={placeholder}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      )}
      {open ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-ink-600 bg-ink-900 shadow-xl">
          {allowEmpty ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-ink-700"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("", null);
                setOpen(false);
                setQ("");
              }}
            >
              {emptyText || t("picker.clear")}
            </button>
          ) : null}
          {loading ? <div className="px-3 py-2 text-xs text-slate-500">{t("common.loading")}</div> : null}
          {error ? <div className="px-3 py-2 text-xs text-red-300">{error}</div> : null}
          {!loading && !error && rows.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">{q.trim() ? t("picker.noMatches") : t("picker.typeToSearch")}</div>
          ) : null}
          {rows.map((row, index) => (
            <button
              key={`${row.id}-${row.label}`}
              type="button"
              className={`block w-full px-3 py-2 text-left ${index === active ? "bg-ink-700" : "hover:bg-ink-700"}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(row)}
            >
              <div className="truncate text-sm">{row.label}</div>
              {row.hint ? <div className="truncate text-xs text-slate-500">{row.hint}</div> : null}
            </button>
          ))}
          {onCreate ? (
            <button
              type="button"
              className="block w-full border-t border-ink-600 px-3 py-2 text-left text-sm text-gold-400 hover:bg-ink-700"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCreate(q);
                setOpen(false);
                setQ("");
              }}
            >
              {createText ? createText(q) : t("customers.new")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
