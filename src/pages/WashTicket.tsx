import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { WashTypePicker } from "../components/WashTypesPanel";
import { Badge, Button, Card, ErrorText, Field, Page, PageHeader } from "../components/ui";
import { SHOP_DEFAULTS } from "../lib/canada";
import { call, customerName, dateEs, isWashCategory, money, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import { useShop } from "../lib/shop-context";
import type { StaffUser, WashType, WorkOrder } from "../vite-env";

export default function WashTicket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { offerTax } = useShop();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [types, setTypes] = useState<WashType[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [taxLabel, setTaxLabel] = useState(SHOP_DEFAULTS.taxLabel);
  const [error, setError] = useState<string | null>(null);
  const [techUserId, setTechUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState({ amount: "", method: "efectivo" });

  async function load() {
    try {
      setError(null);
      const [wo, settings, washTypes, staffRows] = await Promise.all([
        call(window.dms.workOrders.get(String(id || ""))),
        call(window.dms.settings.get()),
        call(window.dms.washTypes.list()),
        call(window.dms.staff.list({ line: "lavado" })),
      ]);
      if (!wo) throw new Error(t("workshop.missing"));
      setOrder(wo);
      setTypes(Array.isArray(washTypes) ? washTypes : []);
      setStaff(() => {
        const list = Array.isArray(staffRows) ? [...staffRows] : [];
        if (wo?.tech && !list.some((u) => u.id === wo.tech?.id)) {
          list.push({
            id: wo.tech.id,
            name: wo.tech.name,
            username: wo.tech.username || "",
            role: "empleado",
            active: 1,
            laborRate: Number(wo.tech.laborRate) || 0,
            job: "lavado",
          });
        }
        return list;
      });
      setTaxLabel(settings?.taxLabel || SHOP_DEFAULTS.taxLabel);
      setTechUserId(wo.techUserId ? String(wo.techUserId) : "");
      setNotes(wo.notes || "");
      setPay((prev) => ({ ...prev, amount: wo.balance && wo.balance > 0 ? String(wo.balance) : prev.amount }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function act(fn: () => Promise<WorkOrder>) {
    try {
      const next = await fn();
      setOrder(next);
      setTechUserId(next.techUserId ? String(next.techUserId) : "");
      setNotes(next.notes || "");
      if (next.balance && next.balance > 0) setPay((prev) => ({ ...prev, amount: String(next.balance) }));
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  if (!order) {
    return (
      <Page>
        <PageHeader
          title={error ? t("workshop.missing") : t("common.loading")}
          actions={
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/lavado">
              {t("opcodes.back")}
            </Link>
          }
        />
        <ErrorText error={error} />
      </Page>
    );
  }

  if (order.serviceLine !== "lavado") {
    return <Navigate to={`/taller/${order.id}`} replace />;
  }

  const archived = Number(order.deleted) === 1;
  const locked = order.status === "entregada" || archived;
  const due = Number(order.balance || 0);
  const paidOff = due <= 0.009;
  const accountOpen = Boolean(order.customer?.accountOpen);
  const canDeliver = paidOff || accountOpen;
  const selectedIds = (order.lines || [])
    .map((line) => line.opCodeId)
    .filter((value): value is string => Boolean(value));

  async function toggleType(typeId: string) {
    if (!order || locked) return;
    const existing = (order.lines || []).find((line) => line.opCodeId === typeId);
    if (existing) {
      if (!askConfirm(t("workshop.removeLine"))) return;
      await act(() => call(window.dms.workOrders.removeLine(existing.id)));
      return;
    }
    await act(() =>
      call(
        window.dms.workOrders.addLine(order.id, {
          type: "labor",
          opCodeId: typeId,
          payType: "cliente",
        })
      )
    );
  }

  function saveMeta() {
    if (!order || locked) return;
    void act(() =>
      call(
        window.dms.workOrders.update(order.id, {
          notes,
          techUserId: techUserId || null,
        })
      )
    );
  }

  const washStatus =
    order.status === "entregada" ? t("wash.status.delivered") : order.status === "lista" ? t("wash.status.ready") : t("wash.status.inProgress");

  return (
    <div className="page flex flex-col gap-3">
      <PageHeader
        title={`${order.number} · ${t("wash.ticket")}`}
        actions={
          <>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/lavado">
              {t("opcodes.back")}
            </Link>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/lavado/${order.id}/imprimir`}>
              {t("common.print")}
            </Link>
            {!locked && Number(order.paid || 0) <= 0.009 ? (
              <Button
                variant="danger"
                onClick={() =>
                  void act(async () => {
                    if (!askConfirm(t("workshop.deleteConfirm"))) return order;
                    const pruneCategories = askConfirm(t("workshop.deleteCats"));
                    await call(window.dms.workOrders.remove(order.id, { pruneCategories }));
                    navigate("/lavado");
                    return order;
                  })
                }
              >
                {t("workshop.deleteOrder")}
              </Button>
            ) : null}
            {!locked && order.status !== "lista" ? (
              <Button onClick={() => void act(() => call(window.dms.workOrders.setStatus(order.id, "lista")))}>
                {t("wash.markReady")}
              </Button>
            ) : null}
            {!locked && canDeliver ? (
              <Button onClick={() => void act(() => call(window.dms.workOrders.deliver(order.id)))}>
                {t("workshop.deliver")}
              </Button>
            ) : null}
          </>
        }
      />
      <ErrorText error={error} />
      {archived ? <Card className="border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">{t("workshop.deletedHint")}</Card> : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Badge status={order.status === "lista" ? "lista" : "lavado"} label={washStatus} />
        {!locked && paidOff ? <Badge status="pagada" label={t("workshop.paidOff")} /> : null}
        <Link className="text-gold-400 hover:underline" to={`/clientes/${order.customerId}`}>
          {customerName(order.customer)}
        </Link>
        {order.vehicle ? (
          <Link className="text-gold-400 hover:underline" to={`/vehiculos/${order.vehicle.id}`}>
            {vehicleLabel(order.vehicle)}
          </Link>
        ) : null}
        <span className="text-slate-500">{t("workshop.opened", { date: dateEs(order.createdAt) })}</span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-3">
          <Card className="p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">{t("wash.pickTypes")}</div>
            <WashTypePicker types={types} selectedIds={selectedIds} onToggle={(typeId) => void toggleType(typeId)} disabled={locked} />
            {(order.lines || []).filter((line) => !isWashCategory(line.opcode?.category)).length ? (
              <ul className="mt-3 space-y-1 text-sm text-slate-400">
                {(order.lines || [])
                  .filter((line) => !isWashCategory(line.opcode?.category))
                  .map((line) => (
                    <li key={line.id} className="flex justify-between gap-2">
                      <span>{line.description}</span>
                      <span>{money(line.qty * line.unitPrice)}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
          </Card>
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("workshop.washTech")}>
                <select disabled={locked} value={techUserId} onChange={(e) => setTechUserId(e.target.value)}>
                  <option value="">{t("workshop.noTech")}</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.job ? ` · ${t(k(`job.${u.job}`))}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("common.notes")}>
                <input disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            {!locked ? (
              <Button className="mt-3" onClick={saveMeta}>
                {t("workshop.saveJob")}
              </Button>
            ) : null}
          </Card>
        </div>

        <div className="space-y-3 xl:sticky xl:top-3 xl:self-start">
          <Card className="p-4 text-sm">
            <div className="flex justify-between">
              <span>{t("workshop.subtotal")}</span>
              <span>{money(order.subtotal || 0)}</span>
            </div>
            {offerTax ? (
              Number(order.taxRate) > 0 ? (
                <div className="mt-1 flex justify-between text-slate-400">
                  <span>
                    {taxLabel} {order.taxRate}%
                  </span>
                  <span>{money(order.tax || 0)}</span>
                </div>
              ) : (
                <div className="mt-1 flex justify-between text-slate-400">
                  <span>{taxLabel}</span>
                  <span>{order.customer?.taxExempt ? t("customers.taxExempt") : money(0)}</span>
                </div>
              )
            ) : null}
            <div className="mt-1 flex justify-between font-medium">
              <span>{t("workshop.total")}</span>
              <span>{money(order.total || 0)}</span>
            </div>
            <div className="mt-1 flex justify-between text-slate-400">
              <span>{t("workshop.paid")}</span>
              <span>{money(order.paid || 0)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>{t("workshop.balance")}</span>
              <span>{money(order.balance || 0)}</span>
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-medium">{t("workshop.payments")}</h2>
            <div className="mb-2 space-y-1 text-sm">
              {(order.payments || []).length === 0 ? <p className="text-slate-400">{t("workshop.noPayments")}</p> : null}
              {(order.payments || []).map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>
                    {dateEs(p.paidAt)} · {t(k(`pay.${p.method}`))}
                  </span>
                  <span>{money(p.amount)}</span>
                </div>
              ))}
            </div>
            {locked && paidOff ? (
              <p className="text-sm text-emerald-300">{t("workshop.closedPaid")}</p>
            ) : paidOff ? (
              <Button className="w-full" onClick={() => void act(() => call(window.dms.workOrders.deliver(order.id)))}>
                {t("workshop.deliver")}
              </Button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("sales.amount")}>
                    <input value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                  </Field>
                  <Field label={t("sales.payMethod")}>
                    <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                      <option value="efectivo">{t("pay.efectivo")}</option>
                      <option value="tarjeta">{t("pay.tarjeta")}</option>
                      <option value="transferencia">{t("pay.transferencia")}</option>
                    </select>
                  </Field>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void act(async () => {
                        const next = await call(
                          window.dms.workOrders.addPayment(order.id, {
                            amount: Number(pay.amount),
                            method: pay.method,
                          })
                        );
                        setPay({ amount: next.balance && next.balance > 0 ? String(next.balance) : "", method: pay.method });
                        return next;
                      })
                    }
                  >
                    {t("workshop.deposit")}
                  </Button>
                  <Button
                    onClick={() =>
                      void act(async () => {
                        const next = await call(
                          window.dms.workOrders.addPayment(order.id, {
                            amount: due,
                            method: pay.method,
                            close: true,
                          })
                        );
                        setPay({ amount: next.balance && next.balance > 0 ? String(next.balance) : "", method: pay.method });
                        return next;
                      })
                    }
                  >
                    {t("workshop.payAndDeliver")}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
