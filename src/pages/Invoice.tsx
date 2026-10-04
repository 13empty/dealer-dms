import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PrintDoc, PrintShopHead } from "../components/PrintDoc";
import { Button, ErrorText } from "../components/ui";
import { call, customerBillingName, dateEs, formatAddress, formatNumber, formatPhones, money, vehicleLabel, workOrderPath } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { useShop } from "../lib/shop-context";
import type { ShopSettings, WorkOrder, WorkOrderLine } from "../vite-env";

function isEstimate(order: WorkOrder) {
  return order.kind === "presupuesto";
}

function isReceipt(order: WorkOrder) {
  if (isEstimate(order)) return false;
  if (order.status === "entregada") return true;
  return Number(order.paid || 0) > 0.009;
}

function payOf(line: WorkOrderLine) {
  return line.payType || "cliente";
}

function clientVisible(line: WorkOrderLine, estimate: boolean, shopCopy: boolean) {
  if (shopCopy) return true;
  if (payOf(line) === "interno") return false;
  if (!estimate && Number(line.authorized) === 0) return false;
  return true;
}

function norm(value: unknown) {
  return String(value || "").trim();
}

function sameText(a: unknown, b: unknown) {
  return norm(a).toLocaleLowerCase() === norm(b).toLocaleLowerCase();
}

function clientDescription(line: WorkOrderLine) {
  const raw = norm(line.description);
  if (line.type === "part" || !line.opCodeId) return raw;
  const stripped = raw.replace(/^[A-Z0-9][A-Z0-9/_-]{0,15}\s*[·:–-]\s+/i, "").trim();
  return stripped || raw;
}

function opcodeStory(line: WorkOrderLine, text: string) {
  if (!text) return false;
  return [line.opcode?.concern, line.opcode?.cause, line.opcode?.correction].some((item) => norm(item) && sameText(text, item));
}

function customerOrderNote(order: WorkOrder, lines: WorkOrderLine[], field: "complaint" | "cause" | "correction") {
  const text = norm(order[field]);
  if (!text) return "";
  const opcodeField = field === "complaint" ? "concern" : field;
  const copied = lines.some((line) => line.type !== "part" && norm(line.opcode?.[opcodeField]) && sameText(text, line.opcode?.[opcodeField]));
  return copied ? "" : text;
}

function visibleLineNote(line: WorkOrderLine, field: "complaint" | "cause" | "correction", shopCopy: boolean) {
  const text = norm(line[field]);
  if (!text || !shopCopy) return "";
  if (line.type === "part" && opcodeStory(line, text)) return "";
  return text;
}

function lineCharge(line: WorkOrderLine) {
  if (Number(line.authorized) === 0) return 0;
  const pay = payOf(line);
  if (pay === "garantia" || pay === "interno") return 0;
  return Number(line.qty || 0) * Number(line.unitPrice || 0);
}

export default function Invoice() {
  const { id } = useParams();
  const { t } = useI18n();
  const { offerTax } = useShop();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shopCopy, setShopCopy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [wo, settings] = await Promise.all([
          call(window.dms.workOrders.get(String(id || ""))),
          call(window.dms.settings.get()),
        ]);
        setOrder(wo);
        setShop(settings);
        if (!wo) throw new Error(t("workshop.missing"));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id, t]);

  const estimate = Boolean(order && isEstimate(order));
  const receipt = Boolean(order && isReceipt(order));
  const lines = useMemo(
    () => (order?.lines || []).filter((line) => clientVisible(line, estimate, shopCopy)),
    [order, estimate, shopCopy]
  );

  if (!order || !shop) {
    return (
      <div className="p-8">
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("workshop.missing") : t("common.loading")}</p>
      </div>
    );
  }

  const docLabel = `${estimate ? t("invoice.docEstimate") : receipt ? t("invoice.docReceipt") : t("invoice.docWork")}${
    shopCopy ? ` · ${t("invoice.shopCopy")}` : ` · ${t("invoice.customerCopy")}`
  }`;
  const title = estimate
    ? t("invoice.estimateTitle", { number: order.number })
    : receipt
      ? t("invoice.receiptTitle", { number: order.number })
      : t("invoice.workTitle", { number: order.number });
  const paidOff = Number(order.balance || 0) <= 0.009 && Number(order.paid || 0) > 0.009;
  const date = dateEs(receipt ? order.deliveredAt || order.createdAt : order.createdAt);
  const storyLines = order.lines || [];
  const headerComplaint = shopCopy ? norm(order.complaint) : customerOrderNote(order, storyLines, "complaint");
  const headerCause = shopCopy ? norm(order.cause) : customerOrderNote(order, storyLines, "cause");
  const headerCorrection = shopCopy ? norm(order.correction) : customerOrderNote(order, storyLines, "correction");

  return (
    <PrintDoc
      title={title}
      subtitle={t("invoice.subtitle")}
      backTo={workOrderPath(order)}
      backLabel={t("invoice.back")}
      extraActions={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setShopCopy(false);
              window.setTimeout(() => window.print(), 50);
            }}
          >
            {t("invoice.printCustomer")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setShopCopy(true);
              window.setTimeout(() => window.print(), 50);
            }}
          >
            {t("invoice.printShop")}
          </Button>
        </>
      }
    >
      <ErrorText error={error} />
      <PrintShopHead
        shop={offerTax ? shop : { ...shop, gstNumber: "" }}
        docLabel={docLabel}
        number={order.number}
        date={date}
        extra={
          <>
            {estimate && order.promisedAt ? (
              <div className="mt-1 text-sm text-neutral-600">{t("workshop.promisedOn", { date: dateEs(order.promisedAt) })}</div>
            ) : null}
            {order.poNumber ? <div className="mt-1 text-sm text-neutral-600">{t("invoice.po", { number: order.poNumber })}</div> : null}
            {receipt && paidOff ? (
              <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">{t("invoice.paidFull")}</div>
            ) : null}
          </>
        }
      />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("workshop.customer")}</div>
          <div className="mt-1 font-medium">{customerBillingName(order.customer) || t("common.dash")}</div>
          {order.customer ? (
            <>
              {formatAddress(order.customer) ? <div className="mt-1 text-sm text-neutral-600">{formatAddress(order.customer)}</div> : null}
              {formatPhones(order.customer) ? <div className="text-sm text-neutral-600">{formatPhones(order.customer)}</div> : null}
              {order.customer.email ? <div className="text-sm text-neutral-600">{order.customer.email}</div> : null}
            </>
          ) : null}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("workshop.vehicle")}</div>
          <div className="mt-1 font-medium">{vehicleLabel(order.vehicle) || t("common.dash")}</div>
          {order.vehicle?.plate ? (
            <div className="mt-1 text-sm text-neutral-600">
              {t("vehicles.plate")}: {order.vehicle.plate}
            </div>
          ) : null}
          {order.vehicle?.vin ? <div className="text-sm text-neutral-600">VIN: {order.vehicle.vin}</div> : null}
          <div className="text-sm text-neutral-600">
            {t("workshop.kmIn")}: {formatNumber(order.kmIn || 0)}
            {receipt && Number(order.kmOut) > 0 ? ` · ${t("workshop.kmOut")}: ${formatNumber(order.kmOut || 0)}` : ""}
          </div>
        </div>
      </div>

      {shopCopy || headerComplaint ? (
        <p className="mt-6 text-sm">
          <span className="font-medium text-neutral-500">{t("workshop.complaint")}: </span>
          {headerComplaint || t("workshop.noComplaint")}
        </p>
      ) : null}
      {headerCause ? (
        <p className="mt-1 text-sm">
          <span className="font-medium text-neutral-500">{t("workshop.cause")}: </span>
          {headerCause}
        </p>
      ) : null}
      {headerCorrection ? (
        <p className="mt-1 text-sm">
          <span className="font-medium text-neutral-500">{t("workshop.correction")}: </span>
          {headerCorrection}
        </p>
      ) : null}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-3 font-semibold">{t("workshop.description")}</th>
            <th className="py-2 pr-3 font-semibold">{t("workshop.qty")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("invoice.unit")}</th>
            <th className="py-2 text-right font-semibold">{t("workshop.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? (
            lines.map((line) => {
              const charge = lineCharge(line);
              const warranty = payOf(line) === "garantia";
              const declined = Number(line.authorized) === 0;
              const complaintNote = visibleLineNote(line, "complaint", shopCopy);
              const causeNote = visibleLineNote(line, "cause", shopCopy);
              const correctionNote = visibleLineNote(line, "correction", shopCopy);
              return (
                <tr key={line.id} className="border-b border-neutral-200">
                  <td className="py-2.5 pr-3">
                    <div>{clientDescription(line)}</div>
                    <div className="text-xs text-neutral-500">
                      {line.type === "part" ? t("workshop.part") : t("workshop.labor")}
                      {warranty ? ` · ${t("invoice.warrantyLine")}` : ""}
                      {declined ? ` · ${t("invoice.notApproved")}` : ""}
                    </div>
                    {complaintNote ? (
                      <div className="mt-1 text-xs text-neutral-600">
                        {t("workshop.complaint")}: {complaintNote}
                      </div>
                    ) : null}
                    {causeNote ? (
                      <div className="text-xs text-neutral-600">
                        {t("workshop.cause")}: {causeNote}
                      </div>
                    ) : null}
                    {correctionNote ? (
                      <div className="text-xs text-neutral-600">
                        {t("workshop.correction")}: {correctionNote}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 align-top">{line.qty}</td>
                  <td className="py-2.5 pr-3 text-right align-top">{declined || warranty ? t("invoice.noCharge") : money(line.unitPrice)}</td>
                  <td className="py-2.5 text-right align-top">{declined || warranty ? t("invoice.noCharge") : money(charge)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="py-4 text-sm text-neutral-500" colSpan={4}>
                {t("invoice.emptyLines")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-5 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>{t("workshop.subtotal")}</span>
          <span>{money(order.subtotal || 0)}</span>
        </div>
        {Number(order.discount) > 0 ? (
          <div className="flex justify-between text-neutral-600">
            <span>
              {t("workshop.discount")} {order.discountPct}%
            </span>
            <span>-{money(order.discount)}</span>
          </div>
        ) : null}
        {offerTax ? (
        <div className="flex justify-between">
          <span>
            {shop.taxLabel || "GST"}
            {Number(order.taxRate) > 0 ? ` ${order.taxRate}%` : ""}
          </span>
          <span>{order.customer?.taxExempt && !(Number(order.taxRate) > 0) ? t("invoice.gstExempt") : money(order.tax || 0)}</span>
        </div>
        ) : null}
        <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-semibold">
          <span>{t("workshop.total")}</span>
          <span>{money(order.total || 0)}</span>
        </div>
        {!estimate ? (
          <>
            <div className="flex justify-between text-neutral-600">
              <span>{t("workshop.paid")}</span>
              <span>{money(order.paid || 0)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>{t("workshop.balance")}</span>
              <span>{money(order.balance || 0)}</span>
            </div>
          </>
        ) : null}
      </div>

      {!estimate && (order.payments || []).length > 0 ? (
        <div className="mt-6 text-sm">
          <div className="mb-2 font-medium">{t("workshop.payments")}</div>
          {(order.payments || []).map((p) => (
            <div key={p.id} className="flex justify-between text-neutral-600">
              <span>
                {dateEs(p.paidAt)} · {t(k(`pay.${p.method}`))}
              </span>
              <span>{money(p.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {estimate ? <p className="mt-8 text-xs text-neutral-500">{t("invoice.estimateNote")}</p> : null}
      {shop.invoiceNotes ? <p className="mt-6 whitespace-pre-wrap text-xs text-neutral-500">{shop.invoiceNotes}</p> : null}
      <p className="mt-4 text-xs text-neutral-500">{t("invoice.thanks")}</p>
    </PrintDoc>
  );
}
