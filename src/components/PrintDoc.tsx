import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { Button, PageHeader } from "./ui";
import { useI18n } from "../lib/i18n";

export function PrintDoc({
  title,
  subtitle,
  backTo,
  backLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  backTo: string;
  backLabel: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-full bg-ink-950 p-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 max-w-[800px]">
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm text-slate-100" to={backTo}>
                {backLabel}
              </Link>
              <Button onClick={() => window.print()}>{t("common.print")}</Button>
            </>
          }
        />
      </div>
      <div className="print-doc mx-auto max-w-[800px] bg-white p-10 text-neutral-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}

export function PrintShopHead({
  shop,
  docLabel,
  number,
  date,
  extra,
}: {
  shop: { name: string; address?: string; phone?: string; email?: string; gstNumber?: string };
  docLabel: string;
  number?: string;
  date: string;
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-5">
      <div className="flex items-start gap-4">
        <BrandMark className="h-14 w-14 shrink-0 rounded-md" />
        <div>
          <div className="text-xl font-semibold tracking-tight">{shop.name}</div>
          {shop.address ? <div className="mt-1 text-sm text-neutral-600">{shop.address}</div> : null}
          <div className="mt-1 text-sm text-neutral-600">{[shop.phone, shop.email].filter(Boolean).join(" · ")}</div>
          {shop.gstNumber ? (
            <div className="mt-1 text-sm text-neutral-600">{t("invoice.gstNumber", { number: shop.gstNumber })}</div>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{docLabel}</div>
        {number ? <div className="mt-1 text-2xl font-semibold">{number}</div> : null}
        <div className="mt-1 text-sm text-neutral-600">{date}</div>
        {extra}
      </div>
    </div>
  );
}
