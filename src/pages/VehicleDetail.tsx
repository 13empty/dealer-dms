import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  formFromVehicle,
  vehicleFormPayload,
  VehicleFormFields,
  type VehicleFormState,
} from "../components/VehicleForm";
import { Badge, Button, Card, ErrorText, Modal, PageHeader, GuidCopy } from "../components/ui";
import { call, customerName, customerSearchHint, dateEs, formatNumber, money, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import type { Vehicle } from "../vite-env";

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [row, setRow] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VehicleFormState | null>(null);
  const [owner, setOwner] = useState({ label: "", hint: "" });
  const [note, setNote] = useState("");

  async function load() {
    try {
      setError(null);
      const next = await call(window.dms.vehicles.get(String(id || ""), { history: true }));
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
      setRow(await call(window.dms.vehicles.update(row.id, vehicleFormPayload(form))));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addNote() {
    if (!row || !note.trim()) return;
    try {
      setRow(await call(window.dms.vehicles.addNote(row.id, note)));
      setNote("");
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

  const inventory = row.status === "en_stock" || row.status === "reservado" || row.status === "consignacion";
  const canSale = inventory;
  const newOtTo = `/taller?${new URLSearchParams({
    ...(row.customerId ? { cliente: String(row.customerId) } : {}),
    vehiculo: String(row.id),
  }).toString()}`;

  return (
    <div className="page">
      <PageHeader
        title={vehicleLabel(row)}
        subtitle={[row.stockNumber, row.plate, row.vin].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link className="rounded-md border border-ink-600 px-3 py-2 text-sm" to={`/vehiculos/${row.id}/imprimir`}>
              {t("common.print")}
            </Link>
            {canSale ? (
              <Button variant="ghost" onClick={() => navigate(`/ventas?vehiculo=${row.id}`)}>
                {t("vehicles.newSale")}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                setForm(formFromVehicle(row));
                setOwner({ label: customerName(row.customer), hint: customerSearchHint(row.customer) });
                setOpen(true);
              }}
            >
              {t("common.edit")}
            </Button>
            <Button onClick={() => navigate(newOtTo)}>{t("vehicles.newRo")}</Button>
          </>
        }
      />
      <div className="mb-4">
        <GuidCopy value={row.id} />
      </div>
      <ErrorText error={error} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge status={row.status} label={t(k(`vehicle.${row.status}`))} />
        <Badge status={row.condition || "usado"} label={t(k(`vehicleCond.${row.condition || "usado"}`))} />
        {row.openOrders ? <Badge status="en_taller" label={t("vehicles.openRos", { n: row.openOrders })} /> : null}
        {Number(row.daysInStock) >= 45 ? <Badge status="urgente" label={t("vehicles.agingLabel", { n: row.daysInStock || 0 })} /> : null}
      </div>
      {row.alert || row.vinCheckOk === false || row.plateClash || row.inspectionOverdue || row.licenseOverdue ? (
        <Card className="mb-4 p-4 text-sm">
          <div className="mb-1 text-xs uppercase text-slate-500">{t("vehicles.alerts")}</div>
          {row.alert ? <p className="text-amber-300">{row.alert}</p> : null}
          {row.vinCheckOk === false ? <p className="text-amber-300">{t("vehicles.vinWarn")}</p> : null}
          {row.plateClash ? <p className="text-amber-300">{t("vehicles.plateClash")}</p> : null}
          {row.inspectionOverdue ? <p className="text-amber-300">{t("vehicles.inspectionOverdue")}</p> : null}
          {row.licenseOverdue ? <p className="text-amber-300">{t("vehicles.licenseOverdue")}</p> : null}
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("vehicles.sectionIdentity")}</h2>
          <dl className="space-y-2 text-sm">
            <Spec label={t("vehicles.plate")} value={row.plate || t("common.dash")} />
            <Spec label="VIN" value={row.vin} />
            <Spec label={t("vehicles.color")} value={row.color || t("common.dash")} />
            <Spec label={t("vehicles.interior")} value={row.interiorColor || t("common.dash")} />
            <Spec label={t("vehicles.body")} value={row.bodyStyle ? t(k(`vehicleBody.${row.bodyStyle}`)) : t("common.dash")} />
            <Spec label={t("vehicles.engine")} value={row.engine || t("common.dash")} />
            <Spec label={t("vehicles.transmission")} value={row.transmission ? t(k(`vehicleTrans.${row.transmission}`)) : t("common.dash")} />
            <Spec label={t("vehicles.drivetrain")} value={row.drivetrain || t("common.dash")} />
            <Spec label={t("vehicles.fuel")} value={row.fuel ? t(k(`vehicleFuel.${row.fuel}`)) : t("common.dash")} />
            <Spec label={t("vehicles.kms")} value={formatNumber(row.km)} />
            <Spec label={t("vehicles.unitNumber")} value={row.unitNumber || t("common.dash")} />
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{inventory ? t("vehicles.sectionInventory") : t("vehicles.owner")}</h2>
          <dl className="space-y-2 text-sm">
            {inventory ? (
              <>
                <Spec label={t("vehicles.stockNumber")} value={row.stockNumber || t("common.dash")} />
                <Spec label={t("vehicles.lot")} value={row.location || t("common.dash")} />
                <Spec label={t("vehicles.keyNumber")} value={row.keyNumber || t("common.dash")} />
                <Spec label={t("vehicles.days")} value={String(row.daysInStock || 0)} />
                <Spec label={t("vehicles.cost")} value={money(row.cost)} />
                <Spec label={t("vehicles.price")} value={money(row.price)} />
                <Spec label={t("vehicles.acquired")} value={dateEs(row.acquiredAt) !== "—" ? dateEs(row.acquiredAt) : dateEs(row.createdAt)} />
              </>
            ) : null}
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("vehicles.owner")}</dt>
              <dd>
                {row.customer ? (
                  <Link className="text-gold-400 hover:underline" to={`/clientes/${row.customer.id}`}>
                    {customerName(row.customer)}
                  </Link>
                ) : (
                  t("vehicles.none")
                )}
              </dd>
            </div>
            <Spec label={t("vehicles.insurance")} value={row.insurance || t("common.dash")} />
            <Spec label={t("vehicles.policy")} value={row.insurancePolicy || t("common.dash")} />
            <Spec label={t("vehicles.licenseExpiry")} value={row.licenseExpiry || t("common.dash")} />
            <Spec label={t("vehicles.inspectionDue")} value={row.inspectionDue || t("common.dash")} />
            <Spec label={t("vehicles.lastVisit")} value={row.lastVisit ? dateEs(row.lastVisit) : t("common.dash")} />
          </dl>
          {row.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{row.notes}</p> : null}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-600 px-5 py-3">
            <div className="font-medium">{t("vehicles.history")}</div>
            <Button variant="ghost" onClick={() => navigate(newOtTo)}>
              {t("vehicles.newRo")}
            </Button>
          </div>
          {(row.workOrders || []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">{t("vehicles.noHistory")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2">{t("workshop.wo")}</th>
                  <th className="px-5 py-2">{t("workshop.status")}</th>
                  <th className="px-5 py-2">{t("workshop.total")}</th>
                </tr>
              </thead>
              <tbody>
                {(row.workOrders || []).map((o) => (
                  <tr key={o.id} className="border-t border-ink-600">
                    <td className="px-5 py-2">
                      <Link className="text-gold-400 hover:underline" to={`/taller/${o.id}`}>
                        {o.number}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {dateEs(o.createdAt)} · {o.complaint || t("workshop.noComplaint")}
                      </div>
                    </td>
                    <td className="px-5 py-2">
                      <Badge status={o.kind === "presupuesto" ? "presupuesto" : o.status} label={t(k(o.kind === "presupuesto" ? "wo.presupuesto" : `wo.${o.status}`))} />
                    </td>
                    <td className="px-5 py-2">{money(o.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-600 px-5 py-3 font-medium">{t("vehicles.sales")}</div>
          {(row.sales || []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">{t("vehicles.noSales")}</p>
          ) : (
            <ul className="divide-y divide-ink-600 text-sm">
              {(row.sales || []).map((sale) => (
                <li key={sale.id} className="flex items-center justify-between px-5 py-3">
                  <Link className="text-gold-400 hover:underline" to={`/ventas/${sale.id}`}>
                    {t("sales.sale", { id: sale.id })}
                  </Link>
                  <span className="text-slate-400">
                    {money(sale.price)} · {t(k(`sale.${sale.status}`))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("vehicles.notesLog")}</h2>
          <div className="mb-3 flex gap-2">
            <input className="flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("vehicles.notePlaceholder")} />
            <Button variant="ghost" disabled={!note.trim()} onClick={() => void addNote()}>
              {t("common.save")}
            </Button>
          </div>
          {(row.notesLog || []).length === 0 ? <p className="text-sm text-slate-400">{t("vehicles.noNotes")}</p> : null}
          <ul className="space-y-3 text-sm">
            {(row.notesLog || []).map((item) => (
              <li key={item.id}>
                <div className="text-xs text-slate-500">
                  {dateEs(item.createdAt)} {item.userName ? `· ${item.userName}` : ""}
                </div>
                <p className="whitespace-pre-wrap text-slate-200">{item.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {open && form ? (
        <Modal title={t("vehicles.edit")} onClose={() => setOpen(false)} wide>
          <VehicleFormFields form={form} setForm={setForm} owner={owner} setOwner={setOwner} t={t} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("common.save")}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
