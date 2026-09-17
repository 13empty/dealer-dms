import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, Card, ErrorText, PageHeader } from "../components/ui";
import { call } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { SqlQueryResult, SqlTable } from "../vite-env";

function cell(value: unknown) {
  if (value == null) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SqlStudio() {
  const { t } = useI18n();
  const [tables, setTables] = useState<SqlTable[]>([]);
  const [active, setActive] = useState("");
  const [sql, setSql] = useState("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;");
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbPath, setDbPath] = useState("");
  const [running, setRunning] = useState(false);

  async function loadTables() {
    const [rows, path] = await Promise.all([call(window.dms.sql.tables()), call(window.dms.meta.dbPath())]);
    setTables(rows);
    setDbPath(path);
  }

  useEffect(() => {
    void loadTables().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function run(nextSql = sql) {
    try {
      setRunning(true);
      setError(null);
      setResult(await call(window.dms.sql.query(nextSql)));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function openTable(table: SqlTable) {
    const ident = `"${table.name.replace(/"/g, '""')}"`;
    const next = `SELECT * FROM ${ident} LIMIT 200;`;
    setActive(table.name);
    setSql(next);
    void run(next);
  }

  function onKey(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void run();
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-64 shrink-0 overflow-auto border-r border-ink-600 bg-ink-900 p-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">{t("sql.tables")}</div>
        {tables.map((table) => (
          <button
            key={table.name}
            type="button"
            onClick={() => openTable(table)}
            className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-sm ${
              active === table.name ? "bg-gold-400/15 text-gold-400" : "text-slate-300 hover:bg-ink-700"
            }`}
          >
            <div className="truncate font-mono text-xs">{table.name}</div>
            <div className="text-[11px] text-slate-500">
              {table.rows} · {table.columns.length} {t("sql.cols")}
            </div>
          </button>
        ))}
      </aside>
      <div className="min-w-0 flex-1 overflow-auto p-6">
        <PageHeader title={t("sql.title")} subtitle={t("sql.subtitle")} />
        {dbPath ? <p className="mb-3 font-mono text-xs text-slate-500">{dbPath}</p> : null}
        <ErrorText error={error} />
        <textarea
          className="min-h-28 font-mono text-sm"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => void run()} disabled={running}>
            {running ? t("sql.running") : t("sql.run")}
          </Button>
          <span className="text-xs text-slate-500">{t("sql.hint")}</span>
        </div>
        {result ? (
          <Card className="mt-4 overflow-auto">
            <div className="border-b border-ink-600 px-4 py-2 text-xs text-slate-400">
              {t("sql.rows", { n: result.rowCount })}
              {result.truncated ? ` · ${t("sql.truncated", { n: result.limit })}` : ""}
            </div>
            {result.columns.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">{t("sql.empty")}</p>
            ) : (
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-ink-900 text-slate-400">
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-t border-ink-700">
                      {result.columns.map((col) => (
                        <td key={col} className="max-w-xs truncate px-3 py-1.5 font-mono text-xs" title={cell(row[col])}>
                          {cell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
