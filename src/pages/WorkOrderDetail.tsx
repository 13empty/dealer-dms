import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SearchPicker } from "../components/SearchPicker";
import { Badge, Button, Card, ErrorText, Field, Page, PageHeader, GuidCopy } from "../components/ui";
import { SHOP_DEFAULTS } from "../lib/canada";
import { call, customerName, dateEs, fromDateTimeLocal, money, toDateTimeLocal, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import type { StaffUser, WorkOrder, WorkOrderLine, WorkOrderStatus } from "../vite-env";

const FULL_FLOW: WorkOrderStatus[] = ["recepcion", "autorizacion", "espera_partes", "en_taller", "en_espera", "lista"];
const SIMPLE_FLOW: WorkOrderStatus[] = ["en_taller", "lista"];
const PAYS = ["cliente", "garantia", "interno", "sublet"] as const;

function lineCcc(line: WorkOrderLine) {
  return {
    complaint: line.complaint || line.opcode?.concern || "",
    cause: line.cause || line.opcode?.cause || "",
    correction: line.correction || line.opcode?.correction || "",
  };
}

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [taxLabel, setTaxLabel] = useState(SHOP_DEFAULTS.taxLabel);
  const [laborRate, setLaborRate] = useState(SHOP_DEFAULTS.laborRate);
  const [simple, setSimple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labor, setLabor] = useState({ description: "", unitPrice: "", payType: "cliente" });
  const [opPicked, setOpPicked] = useState({ id: "", label: "", payType: "cliente" });
  const [partPicked, setPartPicked] = useState({ id: "", label: "", qty: "1", payType: "cliente" });
  const [job, setJob] = useState({
    kmIn: "",
    kmOut: "",
    promisedAt: "",
    techUserId: "",
    complaint: "",
    cause: "",
    correction: "",
    notes: "",
    poNumber: "",
    holdReason: "",
    waiter: false,
    priority: "normal",
    discountPct: "0",
  });
  const [pay, setPay] = useState({ amount: "", method: "efectivo" });
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [lineJob, setLineJob] = useState({ complaint: "", cause: "", correction: "" });

  async function load() {
    try {
      setError(null);
      const [wo, staffRows, settings] = await Promise.all([
        call(window.dms.workOrders.get(String(id || ""))),
        call(window.dms.staff.list()),
        call(window.dms.settings.get()),
      ]);
      setOrder(wo);
      if (!wo) throw new Error(t("workshop.missing"));
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
            job: "tecnico",
          });
        }
        return list;
      });
      setTaxLabel(settings?.taxLabel || SHOP_DEFAULTS.taxLabel);
      setLaborRate(Number(settings?.laborRate) || SHOP_DEFAULTS.laborRate);
      setSimple(settings?.serviceMode === "sencillo");
      if (wo) {
        setJob({
          kmIn: String(wo.kmIn || 0),
          kmOut: String(wo.kmOut || 0),
          promisedAt: toDateTimeLocal(wo.promisedAt),
          techUserId: wo.techUserId ? String(wo.techUserId) : "",
          complaint: wo.complaint || "",
          cause: wo.cause || "",
          correction: wo.correction || "",
          notes: wo.notes || "",
          poNumber: wo.poNumber || "",
          holdReason: wo.holdReason || "",
          waiter: Boolean(wo.waiter),
          priority: wo.priority || "normal",
          discountPct: String(wo.discountPct || 0),
        });
        setPay((prev) => ({ ...prev, amount: wo.balance && wo.balance > 0 ? String(wo.balance) : prev.amount }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    setSelectedLineId(null);
    void load();
  }, [id]);

  async function act(fn: () => Promise<WorkOrder>) {
    try {
      const next = await fn();
      setOrder(next);
      setJob({
        kmIn: String(next.kmIn || 0),
        kmOut: String(next.kmOut || 0),
        promisedAt: toDateTimeLocal(next.promisedAt),
        techUserId: next.techUserId ? String(next.techUserId) : "",
        complaint: next.complaint || "",
        cause: next.cause || "",
        correction: next.correction || "",
        notes: next.notes || "",
        poNumber: next.poNumber || "",
        holdReason: next.holdReason || "",
        waiter: Boolean(next.waiter),
        priority: next.priority || "normal",
        discountPct: String(next.discountPct || 0),
      });
      if (next.balance && next.balance > 0) setPay((prev) => ({ ...prev, amount: String(next.balance) }));
      setSelectedLineId((current) => {
        if (!current) return current;
        const line = (next.lines || []).find((item) => item.id === current);
        if (!line) return null;
        setLineJob(lineCcc(line));
        return current;
      });
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
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/taller">
              {t("opcodes.back")}
            </Link>
          }
        />
        <ErrorText error={error} />
      </Page>
    );
  }

  const locked = order.status === "entregada";
  const estimate = order.kind === "presupuesto";
  const customer = order.customer;
  const due = Number(order.balance || 0);
  const paidOff = due <= 0.009;
  const accountOpen = Boolean(customer?.accountOpen);
  const canDeliver = paidOff || accountOpen;
  const flow = simple ? SIMPLE_FLOW : FULL_FLOW;
  const flowIndex = flow.indexOf(order.status);
  const nextStatus = estimate
    ? null
    : flowIndex >= 0 && flowIndex < flow.length - 1
      ? flow[flowIndex + 1]
      : simple && order.status !== "entregada" && flowIndex < 0
        ? "en_taller"
        : null;
  const alerts = [
    order.vehicle?.alert,
    customer?.notes,
    Number(customer?.receivable) > 0 ? `${t("customers.receivable")}: ${money(customer?.receivable)}` : "",
    customer?.taxExempt ? t("customers.taxExempt") : "",
    Number(customer?.discountPct) ? `${t("workshop.discount")}: ${customer?.discountPct}%` : "",
    customer?.accountOpen ? t("customers.accountOpen") : "",
    order.vehicle?.inspectionOverdue ? t("vehicles.inspectionOverdue") : "",
    order.vehicle?.vinCheckOk === false ? t("vehicles.vinWarn") : "",
  ].filter(Boolean);

  function saveJob() {
    if (!order) return;
    void act(async () => {
      const next = await call(
        window.dms.workOrders.update(order.id, {
          complaint: job.complaint,
          cause: job.cause,
          correction: job.correction,
          notes: job.notes,
          kmIn: Number(job.kmIn) || 0,
          kmOut: Number(job.kmOut) || 0,
          promisedAt: fromDateTimeLocal(job.promisedAt),
          techUserId: job.techUserId || null,
          poNumber: job.poNumber,
          holdReason: job.holdReason,
          waiter: job.waiter ? 1 : 0,
          priority: job.priority as "normal" | "urgente",
          discountPct: Number(job.discountPct) || 0,
        })
      );
      if (!selectedLineId) return next;
      return call(
        window.dms.workOrders.updateLine(selectedLineId, {
          complaint: lineJob.complaint,
          cause: lineJob.cause,
          correction: lineJob.correction,
        })
      );
    });
  }

  function paySelect(value: string, onChange: (value: string) => void, extraClass = "") {
    return (
      <select disabled={locked} className={`min-w-[7.5rem] ${extraClass}`} value={value} onChange={(e) => onChange(e.target.value)}>
        {PAYS.map((p) => (
          <option key={p} value={p}>
            {t(k(`woPay.${p}`))}
          </option>
        ))}
      </select>
    );
  }

  const selectedLine = (order.lines || []).find((line) => line.id === selectedLineId) || null;
  const ccc = selectedLine ? lineJob : { complaint: job.complaint, cause: job.cause, correction: job.correction };
  const selectedPay = (selectedLine?.payType || "cliente") as (typeof PAYS)[number];
  const techRate = Number(staff.find((u) => u.id === job.techUserId)?.laborRate) || Number(order.tech?.laborRate) || laborRate;
  function setCcc(patch: Partial<typeof ccc>) {
    if (selectedLine) setLineJob({ ...lineJob, ...patch });
    else setJob({ ...job, ...patch });
  }

  function selectLine(line: WorkOrderLine | null) {
    if (!line || selectedLineId === line.id) {
      setSelectedLineId(null);
      return;
    }
    setSelectedLineId(line.id);
    setLineJob(lineCcc(line));
  }

  async function addAndSelect(fn: () => Promise<WorkOrder>) {
    if (!order) return;
    const before = new Set((order.lines || []).map((line) => line.id));
    const next = await act(fn);
    if (!next) return;
    const added = (next.lines || []).find((line) => !before.has(line.id));
    if (added) {
      setSelectedLineId(added.id);
      setLineJob(lineCcc(added));
    }
  }

  return (
    <div className="page flex flex-col gap-3">
      <PageHeader
        title={`${order.number}${estimate ? ` · ${t("workshop.estimate")}` : ""}`}
        actions={
          <>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to="/taller">
              {t("opcodes.back")}
            </Link>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/taller/${order.id}/imprimir`}>
              {t("common.print")}
            </Link>
            {estimate && !locked ? (
              <Button onClick={() => void act(() => call(window.dms.workOrders.convert(order.id)))}>{t("workshop.convert")}</Button>
            ) : null}
            {!locked && (estimate || order.status === "recepcion" || (simple && order.status === "en_taller")) && Number(order.paid || 0) <= 0.009 ? (
              <Button
                variant="danger"
                onClick={() =>
                  void act(async () => {
                    if (!confirm(t("workshop.deleteConfirm"))) return order;
                    await call(window.dms.workOrders.remove(order.id));
                    navigate("/taller");
                    return order;
                  })
                }
              >
                {t("workshop.deleteOrder")}
              </Button>
            ) : null}
            {!simple && !locked && !order.authorizedAt ? (
              <Button variant="ghost" onClick={() => void act(() => call(window.dms.workOrders.authorize(order.id)))}>
                {t("workshop.authorize")}
              </Button>
            ) : null}
            {!locked && !estimate ? (
              <>
                {nextStatus ? (
                  <Button onClick={() => void act(() => call(window.dms.workOrders.setStatus(order.id, nextStatus)))}>
                    {t("workshop.next")}: {t(k(`wo.${nextStatus}`))}
                  </Button>
                ) : null}
                {!simple ? (
                  <select
                    className="w-40"
                    value={order.status}
                    onChange={(e) => void act(() => call(window.dms.workOrders.setStatus(order.id, e.target.value as WorkOrderStatus)))}
                  >
                    {flow.map((s) => (
                      <option key={s} value={s}>
                        {t(k(`wo.${s}`))}
                      </option>
                    ))}
                  </select>
                ) : null}
                {canDeliver ? (
                  <Button
                    variant={paidOff || order.status === "lista" ? "primary" : "ghost"}
                    onClick={() => void act(() => call(window.dms.workOrders.deliver(order.id, { kmOut: Number(job.kmOut) || 0 })))}
                  >
                    {t("workshop.deliver")}
                  </Button>
                ) : null}
              </>
            ) : null}
          </>
        }
      />
      <ErrorText error={error} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Badge status={estimate ? "presupuesto" : order.status} label={t(k(estimate ? "wo.presupuesto" : `wo.${order.status}`))} />
        {!estimate && paidOff && !locked ? <Badge status="pagada" label={t("workshop.paidOff")} /> : null}
        {order.priority === "urgente" ? <Badge status="urgente" label={t("workshop.priority.urgente")} /> : null}
        {!simple && order.waiter ? <Badge status="lista" label={t("workshop.waiter")} /> : null}
        {order.overdue ? <Badge status="bloqueado" label={t("workshop.overdue")} /> : null}
        <Link className="text-gold-400 hover:underline" to={`/clientes/${order.customerId}`}>
          {customerName(order.customer)}
        </Link>
        {order.vehicle ? (
          <Link className="text-gold-400 hover:underline" to={`/vehiculos/${order.vehicle.id}`}>
            {vehicleLabel(order.vehicle)}
          </Link>
        ) : null}
        <span className="text-slate-500">{t("workshop.opened", { date: dateEs(order.createdAt) })}</span>
        {simple ? null : order.authorizedAt ? (
          <span className="text-emerald-300">{t("workshop.authorized", { date: dateEs(order.authorizedAt), name: order.authorizedBy || t("common.dash") })}</span>
        ) : (
          <span className="text-amber-300">{t("workshop.notAuthorized")}</span>
        )}
        <GuidCopy value={order.id} />
      </div>

      {alerts.length ? (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
          {alerts.join(" · ")}
        </div>
      ) : null}

      <Card className="p-3">
        <div className={`grid gap-2 sm:grid-cols-2 ${simple ? "lg:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-6"}`}>
          <Field label={t("workshop.kmIn")}>
            <input type="text" disabled={locked} value={job.kmIn} onChange={(e) => setJob({ ...job, kmIn: e.target.value })} />
          </Field>
          <Field label={t("workshop.kmOut")}>
            <input type="text" disabled={locked} value={job.kmOut} onChange={(e) => setJob({ ...job, kmOut: e.target.value })} />
          </Field>
          <Field label={t("workshop.tech")}>
            <select disabled={locked} value={job.techUserId} onChange={(e) => setJob({ ...job, techUserId: e.target.value })}>
              <option value="">{t("workshop.noTech")}</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.job ? ` · ${t(k(`job.${u.job}`))}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {!simple ? (
            <>
              <Field label={t("workshop.priority")}>
                <select disabled={locked} value={job.priority} onChange={(e) => setJob({ ...job, priority: e.target.value })}>
                  <option value="normal">{t("workshop.priority.normal")}</option>
                  <option value="urgente">{t("workshop.priority.urgente")}</option>
                </select>
              </Field>
              <Field label={t("workshop.promised")}>
                <input type="text" disabled={locked} value={job.promisedAt} onChange={(e) => setJob({ ...job, promisedAt: e.target.value })} placeholder="2026-09-16T09:00" />
              </Field>
              <Field label={t("workshop.po")}>
                <input type="text" disabled={locked} value={job.poNumber} onChange={(e) => setJob({ ...job, poNumber: e.target.value })} />
              </Field>
            </>
          ) : null}
        </div>
        {simple ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
            <Field label={t("workshop.complaint")}>
              <textarea disabled={locked} rows={3} value={job.complaint} onChange={(e) => setJob({ ...job, complaint: e.target.value })} />
            </Field>
            <Field label={t("workshop.quickAdd")}>
              <SearchPicker
                value=""
                placeholder={t("workshop.quickAddSearch")}
                disabled={locked}
                onChange={(_id, option) => {
                  const raw = option?.raw as { kind?: string; id?: string; payType?: string } | undefined;
                  if (!raw?.id || !raw.kind) return;
                  void addAndSelect(async () => {
                    if (job.complaint || job.notes || job.kmIn || job.techUserId) {
                      await call(
                        window.dms.workOrders.update(order.id, {
                          complaint: job.complaint,
                          notes: job.notes,
                          kmIn: Number(job.kmIn) || 0,
                          kmOut: Number(job.kmOut) || 0,
                          techUserId: job.techUserId || null,
                          discountPct: Number(job.discountPct) || 0,
                        })
                      );
                    }
                    if (raw.kind === "op") {
                      return call(
                        window.dms.workOrders.addLine(order.id, {
                          type: "labor",
                          opCodeId: raw.id,
                          payType: (raw.payType as (typeof PAYS)[number]) || "cliente",
                          complaint: job.complaint,
                        })
                      );
                    }
                    return call(
                      window.dms.workOrders.addLine(order.id, {
                        type: "part",
                        partId: raw.id,
                        qty: 1,
                        payType: "cliente",
                      })
                    );
                  });
                }}
                search={async (query) => {
                  const [ops, foundParts] = await Promise.all([
                    call(window.dms.opCodes.list(query, { activeOnly: true })),
                    call(window.dms.parts.list(query, { limit: 8, activeOnly: true })),
                  ]);
                  return [
                    ...ops.slice(0, 8).map((op) => ({
                      id: op.id,
                      label: `${op.popular ? "★ " : ""}${op.code} · ${op.description}`,
                      hint: `${t("workshop.operation")} · ${op.laborHours} h · ${money(op.price)}`,
                      raw: { kind: "op", id: op.id, payType: op.payType },
                    })),
                    ...foundParts.map((p) => ({
                      id: p.id,
                      label: `${p.sku} ${p.name}`,
                      hint: `${t("workshop.part")} · ${p.location || ""} · ${p.stock} · ${money(p.price)}`,
                      raw: { kind: "part", id: p.id },
                    })),
                  ];
                }}
              />
              <p className="mt-1 text-xs text-slate-500">{t("workshop.quickAddHint")}</p>
            </Field>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-end gap-3">
          {!simple ? (
            <label className="mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
              <input disabled={locked} type="checkbox" checked={job.waiter} onChange={(e) => setJob({ ...job, waiter: e.target.checked })} />
              {t("workshop.waiter")}
            </label>
          ) : null}
          {!simple && (order.status === "en_espera" || job.holdReason) ? (
            <div className="min-w-[16rem] flex-1">
              <Field label={t("workshop.holdReason")}>
                <input type="text" disabled={locked} value={job.holdReason} onChange={(e) => setJob({ ...job, holdReason: e.target.value })} />
              </Field>
            </div>
          ) : null}
          <div className="min-w-[16rem] flex-1">
            <Field label={t("common.notes")}>
              <input type="text" disabled={locked} value={job.notes} onChange={(e) => setJob({ ...job, notes: e.target.value })} />
            </Field>
          </div>
          {!locked ? (
            <Button onClick={saveJob}>{selectedLine ? t("workshop.saveLine") : t("workshop.saveJob")}</Button>
          ) : null}
        </div>
      </Card>

      {simple && !selectedLine ? null : (
      <Card className="p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {selectedLine
                ? t("workshop.lineJob", {
                    code: selectedLine.opcode?.code || (selectedLine.type === "part" ? t("workshop.part") : t("workshop.labor")),
                    pay: t(k(`woPay.${selectedPay}`)),
                  })
                : t("workshop.job")}
            </span>
            {selectedLine ? <Badge status={selectedPay} label={t(k(`woPay.${selectedPay}`))} /> : null}
          </div>
          <span className="text-xs text-slate-500">{t("workshop.clickLine")}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("workshop.complaint")}>
            <textarea disabled={locked} rows={3} value={ccc.complaint} onChange={(e) => setCcc({ complaint: e.target.value })} />
          </Field>
          <Field label={t("workshop.cause")}>
            <textarea disabled={locked} rows={3} value={ccc.cause} onChange={(e) => setCcc({ cause: e.target.value })} />
          </Field>
          <Field label={t("workshop.correction")}>
            <textarea disabled={locked} rows={3} value={ccc.correction} onChange={(e) => setCcc({ correction: e.target.value })} />
          </Field>
        </div>
      </Card>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600 px-4 py-2">
            <div className="font-medium">{t("workshop.lines")}</div>
            {simple ? null : (
            <div className="min-w-[16rem] flex-1">
              <SearchPicker
                value=""
                placeholder={t("workshop.quickAddSearch")}
                disabled={locked}
                onChange={(_id, option) => {
                  const raw = option?.raw as { kind?: string; id?: string; payType?: string } | undefined;
                  if (!raw?.id || !raw.kind) return;
                  void addAndSelect(async () => {
                    if (raw.kind === "op") {
                      return call(
                        window.dms.workOrders.addLine(order.id, {
                          type: "labor",
                          opCodeId: raw.id,
                          payType: (raw.payType as (typeof PAYS)[number]) || "cliente",
                        })
                      );
                    }
                    return call(
                      window.dms.workOrders.addLine(order.id, {
                        type: "part",
                        partId: raw.id,
                        qty: 1,
                        payType: "cliente",
                      })
                    );
                  });
                }}
                search={async (query) => {
                  const [ops, foundParts] = await Promise.all([
                    call(window.dms.opCodes.list(query, { activeOnly: true })),
                    call(window.dms.parts.list(query, { limit: 8, activeOnly: true })),
                  ]);
                  return [
                    ...ops.slice(0, 8).map((op) => ({
                      id: op.id,
                      label: `${op.popular ? "★ " : ""}${op.code} · ${op.description}`,
                      hint: `${t("workshop.operation")} · ${op.laborHours} h · ${money(op.price)}`,
                      raw: { kind: "op", id: op.id, payType: op.payType },
                    })),
                    ...foundParts.map((p) => ({
                      id: p.id,
                      label: `${p.sku} ${p.name}`,
                      hint: `${t("workshop.part")} · ${p.location || ""} · ${p.stock} · ${money(p.price)}`,
                      raw: { kind: "part", id: p.id },
                    })),
                  ];
                }}
              />
            </div>
            )}
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-4 py-2">{t("workshop.type")}</th>
                  <th className="px-4 py-2">{t("workshop.description")}</th>
                  <th className="px-4 py-2">{t("workshop.payType")}</th>
                  <th className="px-4 py-2">{t("workshop.qty")}</th>
                  <th className="px-4 py-2">{t("workshop.amount")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(order.lines || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                      {t("workshop.quickAddHint")}
                    </td>
                  </tr>
                ) : null}
                {(order.lines || []).map((line) => {
                  const pay = (line.payType || "cliente") as (typeof PAYS)[number];
                  const concern = line.complaint || line.opcode?.concern || "";
                  return (
                  <tr
                    key={line.id}
                    className={`cursor-pointer border-t border-ink-600 ${selectedLineId === line.id ? "bg-gold-400/10" : ""} ${Number(line.authorized) === 0 ? "opacity-50" : ""}`}
                    onClick={() => selectLine(line)}
                  >
                    <td className="px-4 py-2">
                      {line.type === "part" ? t("workshop.part") : line.opcode ? t("workshop.op", { code: line.opcode.code }) : t("workshop.labor")}
                      {Number(line.authorized) === 0 ? <div className="text-xs text-red-300">{t("workshop.declined")}</div> : null}
                    </td>
                    <td className="px-4 py-2">
                      <div>{line.description}</div>
                      {concern ? <div className="text-xs text-slate-400">{concern}</div> : null}
                    </td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={pay} label={t(k(`woPay.${pay}`))} />
                        {locked ? null : paySelect(pay, (value) =>
                          void act(() =>
                            call(
                              window.dms.workOrders.updateLine(line.id, {
                                payType: value as "cliente" | "garantia" | "interno" | "sublet",
                              })
                            )
                          ), "min-w-28")}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {locked ? (
                        line.qty
                      ) : (
                        <input
                          className="w-16"
                          defaultValue={String(line.qty)}
                          key={`${line.id}-${line.qty}`}
                          onBlur={(e) => {
                            const qty = Number(e.target.value);
                            if (!qty || qty === Number(line.qty)) return;
                            void act(() => call(window.dms.workOrders.updateLine(line.id, { qty })));
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2">{money(line.qty * line.unitPrice)}</td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {!locked ? (
                        <div className="flex justify-end gap-3">
                          {!simple ? (
                          <button
                            className="text-xs text-gold-400"
                            onClick={() => {
                              if (Number(line.authorized) !== 0 && !confirm(t("workshop.declineConfirm"))) return;
                              void act(() =>
                                call(window.dms.workOrders.updateLine(line.id, { authorized: Number(line.authorized) === 0 ? 1 : 0 }))
                              );
                            }}
                          >
                            {Number(line.authorized) === 0 ? t("workshop.restore") : t("workshop.decline")}
                          </button>
                          ) : null}
                          <button
                            className="text-red-300"
                            onClick={() => {
                              if (!confirm(t("workshop.removeLine"))) return;
                              void act(() => call(window.dms.workOrders.removeLine(line.id)));
                            }}
                          >
                            {t("common.remove")}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 border-t border-ink-600 p-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("workshop.addOp")}</div>
              <SearchPicker
                value={opPicked.id}
                selectedLabel={opPicked.label}
                placeholder={t("picker.searchOp")}
                disabled={locked}
                onChange={(nextId, option) =>
                  setOpPicked({ id: nextId, label: option?.label || "", payType: String((option?.raw as { payType?: string } | undefined)?.payType || "cliente") })
                }
                search={async (query) => {
                  const found = await call(window.dms.opCodes.list(query, { activeOnly: true }));
                  return found.slice(0, 25).map((op) => ({
                    id: op.id,
                    label: `${op.popular ? "★ " : ""}${op.code} · ${op.description}`,
                    hint: [
                      `${op.laborHours} h`,
                      money(op.price),
                      op.parts?.length ? t("opcodes.partsCount", { n: op.parts.length }) : "",
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    raw: op,
                  }));
                }}
              />
              <div className="mt-2 flex gap-2">
                {paySelect(opPicked.payType, (value) => setOpPicked({ ...opPicked, payType: value }))}
                <Button
                  disabled={locked || !opPicked.id}
                  onClick={() =>
                    void addAndSelect(async () => {
                      const next = await call(
                        window.dms.workOrders.addLine(order.id, {
                          type: "labor",
                          opCodeId: opPicked.id,
                          payType: opPicked.payType as (typeof PAYS)[number],
                        })
                      );
                      setOpPicked({ id: "", label: "", payType: "cliente" });
                      return next;
                    })
                  }
                >
                  {t("workshop.add")}
                </Button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("workshop.freeLabor")}</div>
              <input disabled={locked} placeholder={t("workshop.description")} value={labor.description} onChange={(e) => setLabor({ ...labor, description: e.target.value })} />
              <div className="mt-2 flex gap-2">
                <input
                  disabled={locked}
                  placeholder={String(techRate)}
                  value={labor.unitPrice}
                  onChange={(e) => setLabor({ ...labor, unitPrice: e.target.value })}
                />
                {paySelect(labor.payType, (value) => setLabor({ ...labor, payType: value }))}
                <Button
                  disabled={locked}
                  onClick={() =>
                    void act(async () => {
                      const next = await call(
                        window.dms.workOrders.addLine(order.id, {
                          type: "labor",
                          description: labor.description,
                          qty: 1,
                          unitPrice: Number(labor.unitPrice || techRate),
                          payType: labor.payType as (typeof PAYS)[number],
                        })
                      );
                      setLabor({ description: "", unitPrice: "", payType: "cliente" });
                      return next;
                    })
                  }
                >
                  {t("workshop.add")}
                </Button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("workshop.addPart")}</div>
              <SearchPicker
                value={partPicked.id}
                selectedLabel={partPicked.label}
                placeholder={t("picker.searchPart")}
                disabled={locked}
                onChange={(nextId, option) => setPartPicked({ ...partPicked, id: nextId, label: option?.label || "" })}
                search={async (query) => {
                  const found = await call(window.dms.parts.list(query, { limit: 25, activeOnly: true }));
                  return found.map((p) => ({
                    id: p.id,
                    label: `${p.sku} ${p.name}`,
                    hint: [p.location, p.oem, `${p.stock}`, money(p.price)].filter(Boolean).join(" · "),
                  }));
                }}
              />
              <div className="mt-2 flex gap-2">
                <input className="w-16" disabled={locked} value={partPicked.qty} onChange={(e) => setPartPicked({ ...partPicked, qty: e.target.value })} />
                {paySelect(partPicked.payType, (value) => setPartPicked({ ...partPicked, payType: value }))}
                <Button
                  disabled={locked || !partPicked.id}
                  onClick={() =>
                    void act(async () => {
                      const next = await call(
                        window.dms.workOrders.addLine(order.id, {
                          type: "part",
                          partId: partPicked.id,
                          qty: Number(partPicked.qty),
                          payType: partPicked.payType as (typeof PAYS)[number],
                        })
                      );
                      setPartPicked({ id: "", label: "", qty: "1", payType: "cliente" });
                      return next;
                    })
                  }
                >
                  {t("workshop.add")}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3 xl:sticky xl:top-3 xl:self-start">
          <Card className="p-4 text-sm">
            <div className="flex justify-between">
              <span>{t("workshop.subtotal")}</span>
              <span>{money(order.subtotal || 0)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-slate-400">
              <label className="mb-0 flex items-center gap-1.5 text-sm normal-case tracking-normal text-slate-400">
                {t("workshop.discount")}
                <input
                  type="text"
                  className="w-14"
                  disabled={locked}
                  value={job.discountPct}
                  onChange={(e) => setJob({ ...job, discountPct: e.target.value })}
                  onBlur={(e) => {
                    if (locked) return;
                    const pct = Number(e.target.value) || 0;
                    if (pct === Number(order.discountPct || 0)) return;
                    void act(() => call(window.dms.workOrders.update(order.id, { discountPct: pct })));
                  }}
                />
                %
              </label>
              <span>{Number(order.discount) > 0 ? `-${money(order.discount)}` : money(0)}</span>
            </div>
            {Number(order.taxRate) > 0 ? (
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
            )}
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
            {Number(order.warrantyTotal) > 0 ? (
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{t("workshop.warranty")}</span>
                <span>{money(order.warrantyTotal)}</span>
              </div>
            ) : null}
            {Number(order.internalTotal) > 0 ? (
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{t("workshop.internal")}</span>
                <span>{money(order.internalTotal)}</span>
              </div>
            ) : null}
            {Number(order.declinedTotal) > 0 ? (
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{t("workshop.declined")}</span>
                <span>{money(order.declinedTotal)}</span>
              </div>
            ) : null}
            <div className="mt-2 text-right text-xs text-slate-500">{t("workshop.margin", { amount: money(order.margin || 0) })}</div>
          </Card>
          {!estimate ? (
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
              ) : locked && !paidOff ? (
                <>
                  <p className="mb-2 text-xs text-amber-200">{t("workshop.deliveredOpenBalance")}</p>
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
                  <Button
                    className="mt-2 w-full"
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
                </>
              ) : paidOff ? (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-300">{t("workshop.paidReady")}</p>
                  <Button
                    className="w-full"
                    onClick={() => void act(() => call(window.dms.workOrders.deliver(order.id, { kmOut: Number(job.kmOut) || 0 })))}
                  >
                    {t("workshop.deliver")}
                  </Button>
                </div>
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
                              kmOut: Number(job.kmOut) || 0,
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
                  {accountOpen ? (
                    <p className="mt-2 text-xs text-slate-500">{t("workshop.accountCanDeliver")}</p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">{t("workshop.payToDeliver")}</p>
                  )}
                </>
              )}
            </Card>
          ) : null}
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-medium">{t("workshop.history")}</h2>
            {(order.history || []).length === 0 ? <p className="text-sm text-slate-400">{t("workshop.noHistory")}</p> : null}
            <ul className="space-y-1 text-sm">
              {(order.history || []).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <Link className="truncate text-gold-400" to={`/taller/${h.id}`}>
                    {h.number}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500">{dateEs(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
