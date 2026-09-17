import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { call } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { GlobalSearchHit, GlobalSearchResult } from "../vite-env";

const empty: GlobalSearchResult = { customers: [], vehicles: [], workOrders: [], parts: [], sales: [] };

export function GlobalSearch() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<GlobalSearchResult>(empty);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const flat = useMemo(
    () => [...hits.customers, ...hits.vehicles, ...hits.workOrders, ...hits.parts, ...hits.sales],
    [hits]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!open) return;
    if (!query) {
      setHits(empty);
      setLoading(false);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void call(window.dms.search.global(query))
        .then((next) => {
          if (!alive) return;
          setHits(next);
          setActive(0);
        })
        .catch(() => {
          if (alive) setHits(empty);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 160);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q, open]);

  function go(hit: GlobalSearchHit) {
    navigate(hit.href);
    setOpen(false);
    setQ("");
    setHits(empty);
    inputRef.current?.blur();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) go(hit);
    }
  }

  const groups: { key: keyof GlobalSearchResult; label: string }[] = [
    { key: "customers", label: t("search.customers") },
    { key: "vehicles", label: t("search.vehicles") },
    { key: "workOrders", label: t("search.workOrders") },
    { key: "parts", label: t("search.parts") },
    { key: "sales", label: t("search.sales") },
  ];

  let index = -1;

  return (
    <div ref={boxRef} className="relative">
      <div className="pointer-events-none absolute left-2.5 top-2 text-slate-500">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-4-4" strokeLinecap="round" />
        </svg>
      </div>
      <input
        ref={inputRef}
        value={q}
        placeholder={t("search.placeholder")}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="search-field w-full rounded-lg border border-ink-600 bg-ink-950 py-1.5 pr-2.5 text-sm"
      />
      <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{t("search.hint")}</div>
      {open ? (
        <div className="absolute left-0 z-40 mt-1 max-h-80 w-[22rem] overflow-auto rounded-xl border border-ink-600 bg-ink-900 shadow-2xl">
          {loading ? <div className="px-3 py-2 text-xs text-slate-500">{t("common.loading")}</div> : null}
          {!loading && !q.trim() ? <div className="px-3 py-2 text-xs text-slate-500">{t("search.empty")}</div> : null}
          {!loading && q.trim() && flat.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">{t("search.noMatches")}</div>
          ) : null}
          {groups.map((group) => {
            const rows = hits[group.key] || [];
            if (!rows.length) return null;
            return (
              <div key={group.key}>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-500">{group.label}</div>
                {rows.map((row) => {
                  index += 1;
                  const current = index;
                  return (
                    <button
                      key={`${row.type}-${row.id}`}
                      type="button"
                      className={`block w-full px-3 py-2 text-left ${current === active ? "bg-gold-400/10 text-gold-400" : "hover:bg-ink-700"}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(current)}
                      onClick={() => go(row)}
                    >
                      <div className="truncate text-sm">{row.label}</div>
                      {row.hint ? <div className="truncate text-xs text-slate-500">{row.hint}</div> : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
