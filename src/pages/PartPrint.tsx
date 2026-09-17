import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button, ErrorText, PageHeader, GuidCopy } from "../components/ui";
import { call, dateEs, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import type { Part, ShopSettings } from "../vite-env";

export default function PartPrint() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { t } = useI18n();
  const [row, setRow] = useState<Part | null>(null);
  const [rows, setRows] = useState<Part[]>([]);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mode = search.get("modo") || "catalogo";

  useEffect(() => {
    void (async () => {
      try {
        const settings = await call(window.dms.settings.get());
        setShop(settings);
        if (id) {
          const part = await call(window.dms.parts.get(String(id || "")));
          setRow(part);
          if (!part) throw new Error(t("common.notFound"));
          return;
        }
        setRows(
          await call(
            window.dms.parts.list(search.get("q") || "", {
              category: search.get("category") || undefined,
              status: search.get("status") || undefined,
              low: search.get("low") === "1",
              reorder: search.get("reorder") === "1" || mode === "reorden",
            })
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id, search, mode]);

  if (!shop || (id && !row)) {
    return (
      <div className="p-8">
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("common.notFound") : t("common.loading")}</p>
      </div>
    );
  }

  if (row) {
    return (
      <div className="p-8 print:bg-white print:p-0 print:text-black">
        <div className="no-print mb-6">
          <PageHeader
            title={t("parts.printCard")}
            actions={
              <>
                <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/partes/${row.id}`}>
                  {t("parts.view")}
                </Link>
                <Button onClick={() => window.print()}>{t("common.print")}</Button>
              </>
            }
          />
        </div>
        <div className="mx-auto max-w-3xl rounded-lg border border-ink-600 p-8 print:border-black">
          <div className="mb-6 flex justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-gold-400 print:text-black">{shop.name}</div>
              <h1 className="mt-1 text-2xl font-semibold">{row.sku}</h1>
              <p className="text-sm text-slate-400 print:text-neutral-600">{row.name}</p>
              <div className="mt-2">
                <GuidCopy value={row.id} />
              </div>
            </div>
            <div className="text-right text-sm">
              <div>{t(k(`partStatus.${row.status || "activo"}`))}</div>
              <div>{t(k(`partCat.${row.category || "otros"}`))}</div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.oem")}</dt>
              <dd>{row.oem || t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.alts")}</dt>
              <dd>{(row.alts || []).join(", ") || t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.brand")}</dt>
              <dd>{row.brand || t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.location")}</dt>
              <dd>{row.location || t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.stock")}</dt>
              <dd>{row.stock}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.min")}</dt>
              <dd>{row.minStock}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.price")}</dt>
              <dd>{money(row.price)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500 print:text-neutral-500">{t("parts.vendor")}</dt>
              <dd>{row.vendor || t("common.dash")}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  const title = mode === "conteo" ? t("parts.printCount") : mode === "reorden" ? t("parts.printReorder") : t("parts.printCatalog");
  const list = mode === "reorden" ? rows.filter((p) => (p.reorderQty || 0) > 0 || p.low) : rows;

  return (
    <div className="p-8 print:bg-white print:p-0 print:text-black">
      <div className="no-print mb-6">
        <PageHeader
          title={title}
          actions={
            <>
              <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/partes">
                {t("nav.parts")}
              </Link>
              <Button onClick={() => window.print()}>{t("common.print")}</Button>
            </>
          }
        />
      </div>
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <div className="text-xs uppercase tracking-widest text-gold-400 print:text-black">{shop.name}</div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-400 print:text-neutral-600">{dateEs(new Date().toISOString())}</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-600 print:border-black">
              <th className="py-2">SKU</th>
              <th className="py-2">{t("parts.part")}</th>
              <th className="py-2">{t("parts.location")}</th>
              {mode === "reorden" ? <th className="py-2">{t("parts.vendor")}</th> : null}
              <th className="py-2">{t("parts.stock")}</th>
              {mode === "conteo" ? <th className="py-2">{t("parts.counted")}</th> : null}
              {mode === "reorden" ? <th className="py-2">{t("parts.onOrder")}</th> : null}
              {mode === "reorden" ? <th className="py-2">{t("parts.orderQty")}</th> : null}
              {mode !== "conteo" ? <th className="py-2">{t("parts.price")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-ink-700 print:border-neutral-300">
                <td className="py-2 font-mono text-xs">{p.sku}</td>
                <td className="py-2">
                  {p.name}
                  {p.oem ? <div className="text-xs text-slate-500 print:text-neutral-500">{p.oem}</div> : null}
                </td>
                <td className="py-2">{p.location || t("common.dash")}</td>
                {mode === "reorden" ? <td className="py-2">{p.vendor || t("common.dash")}</td> : null}
                <td className="py-2">{p.stock}</td>
                {mode === "conteo" ? <td className="py-2">________</td> : null}
                {mode === "reorden" ? <td className="py-2">{p.onOrder || 0}</td> : null}
                {mode === "reorden" ? <td className="py-2">{p.reorderQty || 0}</td> : null}
                {mode !== "conteo" ? <td className="py-2">{money(p.price)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
