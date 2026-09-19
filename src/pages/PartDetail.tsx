import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PART_ADJUST_REASONS,
  formFromPart,
  partFormPayload,
  PartFormFields,
  type PartFormState,
} from "../components/PartForm";
import { Badge, Button, Card, ErrorText, Field, Modal, PageHeader, GuidCopy } from "../components/ui";
import { useAuth } from "../lib/auth";
import { catalogLabel, useCatalogs } from "../lib/catalogs";
import { call, dateEs, dateTimeEs, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import { useShop } from "../lib/shop-context";
import type { Part } from "../vite-env";

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function PartDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { t } = useI18n();
  const { offerTax } = useShop();
  const { catalogs } = useCatalogs();
  const [row, setRow] = useState<Part | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PartFormState | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("conteo");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [vendor, setVendor] = useState("");

  async function load() {
    try {
      setError(null);
      const next = await call(window.dms.parts.get(String(id || "")));
      setRow(next);
      if (!next) throw new Error(t("common.notFound"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function save() {
    if (!row || !form) return;
    try {
      setError(null);
      setRow(await call(window.dms.parts.update(row.id, partFormPayload(form, { includeStock: true }))));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function adjust() {
    if (!row) return;
    try {
      setRow(await call(window.dms.parts.adjust(row.id, { qty: Number(qty), reason, notes })));
      setAdjustOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function receive() {
    if (!row) return;
    try {
      setRow(
        await call(
          window.dms.parts.receive(row.id, {
            qty: Number(qty),
            cost: cost === "" ? undefined : Number(cost),
            vendor,
            notes,
          })
        )
      );
      setReceiveOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function order() {
    if (!row) return;
    try {
      setRow(await call(window.dms.parts.order(row.id, { qty: Number(qty), vendor })));
      setOrderOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove() {
    if (!row) return;
    if (!askConfirm(t("parts.deleteConfirm"))) return;
    try {
      await call(window.dms.parts.remove(row.id));
      navigate("/partes");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!row) {
    return (
      <div className="page">
        <ErrorText error={error} />
        <p className="text-slate-400">{error ? t("common.notFound") : t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={`${row.sku} · ${row.name}`}
        subtitle={[row.oem, row.brand, row.location].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/partes/${row.id}/imprimir`}>
              {t("common.print")}
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                setQty(String(Math.max(1, row.reorderQty || 1)));
                setVendor(row.vendor || "");
                setOrderOpen(true);
              }}
            >
              {t("parts.order")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setQty(String(Math.max(1, row.reorderQty || 1)));
                setCost(String(row.cost ?? ""));
                setVendor(row.vendor || "");
                setNotes("");
                setReceiveOpen(true);
              }}
            >
              {t("parts.receive")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setQty("1");
                setReason("conteo");
                setNotes("");
                setAdjustOpen(true);
              }}
            >
              {t("parts.adjust")}
            </Button>
            <Button
              onClick={() => {
                setForm(formFromPart(row));
                setOpen(true);
              }}
            >
              {t("common.edit")}
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <GuidCopy value={row.id} />
      </div>
      <ErrorText error={error} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge status={row.status || "activo"} label={t(k(`partStatus.${row.status || "activo"}`))} />
        <Badge status="usado" label={catalogLabel(t, "partCat", row.category || "otros")} />
        {row.low ? <Badge status="reservado" label={t("parts.low")} /> : null}
        {row.specialOrder ? <Badge status="consignacion" label={t("parts.specialOrder")} /> : null}
        {(row.reorderQty || 0) > 0 ? <Badge status="en_taller" label={t("parts.reorderQty", { n: row.reorderQty || 0 })} /> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("parts.sectionFile")}</h2>
          <dl className="space-y-2 text-sm">
            <Spec label="SKU" value={row.sku} />
            <Spec label={t("parts.oem")} value={row.oem || t("common.dash")} />
            <Spec label={t("parts.alts")} value={(row.alts || []).join(", ") || t("common.dash")} />
            <Spec label={t("parts.brand")} value={row.brand || t("common.dash")} />
            <Spec label={t("parts.vendor")} value={row.vendor || t("common.dash")} />
            <Spec label={t("parts.uom")} value={catalogLabel(t, "partUom", row.uom || "pza")} />
            {offerTax ? <Spec label={t("parts.taxable")} value={row.taxable === 0 ? t("common.inactive") : t("common.active")} /> : null}
          </dl>
          {row.description ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{row.description}</p> : null}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("parts.sectionStock")}</h2>
          <dl className="space-y-2 text-sm">
            <Spec label={t("parts.location")} value={row.location || t("common.dash")} />
            <Spec label={t("parts.stock")} value={String(row.stock)} />
            <Spec label={t("parts.min")} value={String(row.minStock)} />
            <Spec label={t("parts.max")} value={String(row.maxStock || 0)} />
            <Spec label={t("parts.onOrder")} value={String(row.onOrder || 0)} />
            <Spec label={t("parts.lastSold")} value={row.lastSold ? dateEs(row.lastSold) : t("common.dash")} />
            <Spec label={t("parts.lastReceived")} value={row.lastReceived ? dateEs(row.lastReceived) : t("common.dash")} />
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("parts.sectionPrice")}</h2>
          <dl className="space-y-2 text-sm">
            <Spec label={t("parts.cost")} value={money(row.cost)} />
            <Spec label={t("parts.price")} value={money(row.price)} />
            <Spec label={t("parts.core")} value={money(row.core)} />
            <Spec label={t("parts.margin")} value={`${money(row.margin)} (${row.marginPct || 0}%)`} />
          </dl>
          {row.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{row.notes}</p> : null}
          {can.destructive ? (
            <div className="mt-4">
              <Button variant="danger" onClick={() => void remove()}>
                {t("common.delete")}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="mt-4 overflow-auto">
        <div className="border-b border-ink-600 px-5 py-3 font-medium">{t("parts.usage")}</div>
        {(row.usage || []).length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">{t("parts.noUsage")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900 text-slate-400">
              <tr>
                <th className="px-5 py-2">{t("workshop.wo")}</th>
                <th className="px-5 py-2">{t("parts.qty")}</th>
                <th className="px-5 py-2">{t("workshop.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(row.usage || []).map((line) => (
                <tr key={line.id} className="border-t border-ink-600">
                  <td className="px-5 py-2">
                    {line.workOrder ? (
                      <Link className="text-gold-400 hover:underline" to={`/taller/${line.workOrder.id}`}>
                        {line.workOrder.number}
                      </Link>
                    ) : (
                      t("common.dash")
                    )}
                  </td>
                  <td className="px-5 py-2">{line.qty}</td>
                  <td className="px-5 py-2">
                    {line.workOrder ? t(k(`wo.${line.workOrder.status}`)) : t("common.dash")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-4 overflow-auto">
        <div className="border-b border-ink-600 px-5 py-3 font-medium">{t("parts.movements")}</div>
        {(row.movements || []).length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">{t("parts.noMovements")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900 text-slate-400">
              <tr>
                <th className="px-5 py-2">{t("parts.when")}</th>
                <th className="px-5 py-2">{t("parts.qty")}</th>
                <th className="px-5 py-2">{t("parts.reason")}</th>
                <th className="px-5 py-2">{t("common.notes")}</th>
              </tr>
            </thead>
            <tbody>
              {(row.movements || []).map((m) => (
                <tr key={m.id} className="border-t border-ink-600">
                  <td className="px-5 py-2">{dateTimeEs(m.createdAt)}</td>
                  <td className="px-5 py-2">{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                  <td className="px-5 py-2">{t(k(`partMove.${m.reason}`))}</td>
                  <td className="px-5 py-2">{m.notes || t("common.dash")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {open && form ? (
        <Modal title={t("parts.edit")} onClose={() => setOpen(false)} wide>
          <PartFormFields
            form={form}
            setForm={setForm}
            t={t}
            includeStock
            categories={catalogs?.partCategories.map((item) => item.id)}
            uoms={catalogs?.partUoms.map((item) => item.id)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("common.save")}</Button>
          </div>
        </Modal>
      ) : null}

      {adjustOpen ? (
        <Modal title={t("parts.adjust")} onClose={() => setAdjustOpen(false)}>
          <p className="mb-3 text-sm text-slate-400">{t("parts.adjustHint")}</p>
          <div className="grid gap-3">
            <Field label={t("parts.qty")}>
              <input value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label={t("parts.reason")}>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                {PART_ADJUST_REASONS.map((id) => (
                  <option key={id} value={id}>
                    {t(k(`partAdj.${id}`))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("common.notes")}>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void adjust()}>{t("parts.apply")}</Button>
          </div>
        </Modal>
      ) : null}

      {receiveOpen ? (
        <Modal title={t("parts.receive")} onClose={() => setReceiveOpen(false)}>
          <p className="mb-3 text-sm text-slate-400">{t("parts.receiveHint")}</p>
          <div className="grid gap-3">
            <Field label={t("parts.qty")}>
              <input value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label={t("parts.cost")}>
              <input value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
            <Field label={t("parts.vendor")}>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
            <Field label={t("common.notes")}>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReceiveOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void receive()}>{t("parts.apply")}</Button>
          </div>
        </Modal>
      ) : null}

      {orderOpen ? (
        <Modal title={t("parts.order")} onClose={() => setOrderOpen(false)}>
          <p className="mb-3 text-sm text-slate-400">{t("parts.orderHint")}</p>
          <div className="grid gap-3">
            <Field label={t("parts.qty")}>
              <input value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label={t("parts.vendor")}>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOrderOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void order()}>{t("parts.apply")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
