import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { SearchPicker } from "../components/SearchPicker";
import { Button, Card, ErrorText, Field, Page, PageHeader } from "../components/ui";
import { call, customerName, customerSearchHint, money, workOrderPath } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { useShop } from "../lib/shop-context";
import type { Part } from "../vite-env";

type Line = { partId: string; label: string; qty: string; price: string };

export default function PartInvoice() {
  const { t } = useI18n();
  const { offerPartInvoices } = useShop();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!offerPartInvoices) return <Navigate to="/partes" replace />;

  async function save() {
    try {
      setBusy(true);
      setError(null);
      if (!customerId) throw new Error(t("workshop.needCustomer"));
      const parts = lines.filter((line) => line.partId && Number(line.qty) > 0);
      if (!parts.length) throw new Error(t("invoice.emptyLines"));
      const order = await call(
        window.dms.workOrders.create({
          kind: "factura_partes",
          customerId,
          complaint: t("parts.invoice"),
        })
      );
      for (const line of parts) {
        await call(
          window.dms.workOrders.addLine(order.id, {
            type: "part",
            partId: line.partId,
            qty: Number(line.qty) || 1,
            unitPrice: line.price === "" ? undefined : Number(line.price),
            payType: "cliente",
          })
        );
      }
      navigate(workOrderPath(order));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title={t("parts.invoiceNew")}
        subtitle={t("parts.invoiceHint")}
        actions={
          <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/partes">
            {t("opcodes.back")}
          </Link>
        }
      />
      <ErrorText error={error} />
      <Card className="max-w-3xl p-5">
        <Field label={t("workshop.customer")}>
          <SearchPicker
            value={customerId}
            selectedLabel={customerLabel}
            placeholder={t("picker.searchCustomer")}
            onChange={(id, option) => {
              setCustomerId(id);
              setCustomerLabel(option?.label || "");
            }}
            search={async (query) => {
              const rows = await call(window.dms.customers.list(query, { limit: 8 }));
              return rows.map((row) => ({
                id: row.id,
                label: customerName(row),
                hint: customerSearchHint(row),
              }));
            }}
          />
        </Field>
        <div className="mt-4 space-y-2">
          {lines.map((line, index) => (
            <div key={`${line.partId}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]">
              <div className="text-sm">{line.label}</div>
              <input value={line.qty} onChange={(e) => setLines((prev) => prev.map((item, i) => (i === index ? { ...item, qty: e.target.value } : item)))} />
              <input value={line.price} onChange={(e) => setLines((prev) => prev.map((item, i) => (i === index ? { ...item, price: e.target.value } : item)))} />
              <button className="text-sm text-red-300" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                {t("common.remove")}
              </button>
            </div>
          ))}
          <SearchPicker
            value=""
            placeholder={t("picker.searchPart")}
            onChange={(_id, option) => {
              const part = option?.raw as Part | undefined;
              if (!part?.id) return;
              setLines((prev) => [...prev, { partId: part.id, label: `${part.sku} ${part.name}`, qty: "1", price: String(part.price ?? "") }]);
            }}
            search={async (query) => {
              const found = await call(window.dms.parts.list(query, { limit: 8, activeOnly: true }));
              return found.map((p) => ({
                id: p.id,
                label: `${p.sku} ${p.name}`,
                hint: `${p.stock} · ${money(p.price)}`,
                raw: p,
              }));
            }}
          />
        </div>
        <div className="mt-5">
          <Button disabled={busy} onClick={() => void save()}>
            {t("common.create")}
          </Button>
        </div>
      </Card>
    </Page>
  );
}
