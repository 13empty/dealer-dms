import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  emptyVehicleForm,
  formFromVehicle,
  vehicleFormPayload,
  VehicleFormFields,
  VEHICLE_STATUSES,
  VEHICLE_CONDITIONS,
  type VehicleFormState,
} from "../components/VehicleForm";
import { Badge, Button, Card, ErrorText, Modal, Page, PageHeader, Toolbar } from "../components/ui";
import { useAuth } from "../lib/auth";
import { call, customerName, customerSearchHint, formatNumber, money, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import type { Vehicle } from "../vite-env";

export default function Vehicles() {
  const { can } = useAuth();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState(() => params.get("kind") || "");
  const [condition, setCondition] = useState("");
  const [aging, setAging] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleFormState>(emptyVehicleForm());
  const [owner, setOwner] = useState({ label: "", hint: "" });

  async function load() {
    try {
      setError(null);
      setRows(
        await call(
          window.dms.vehicles.list(q, status || undefined, {
            kind: kind || undefined,
            condition: condition || undefined,
            aging: aging ? Number(aging) : undefined,
          })
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q, status, kind, condition, aging]);

  function startCreate() {
    setEditing(null);
    setForm(emptyVehicleForm());
    setOwner({ label: "", hint: "" });
    setOpen(true);
  }

  function startEdit(row: Vehicle) {
    setEditing(row);
    setForm(formFromVehicle(row));
    setOwner({
      label: customerName(row.customer),
      hint: customerSearchHint(row.customer),
    });
    setOpen(true);
  }

  async function save() {
    try {
      const payload = vehicleFormPayload(form);
      if (editing) await call(window.dms.vehicles.update(editing.id, payload));
      else await call(window.dms.vehicles.create(payload));
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    if (!askConfirm(t("vehicles.deleteConfirm"))) return;
    try {
      await call(window.dms.vehicles.remove(id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Page>
      <PageHeader
        title={t("vehicles.title")}
        subtitle={t("vehicles.subtitle")}
        actions={<Button onClick={startCreate}>{t("vehicles.new")}</Button>}
      />
      <Toolbar>
        <input className="min-w-[220px] flex-1" autoFocus placeholder={t("vehicles.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="w-40" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">{t("vehicles.kindAll")}</option>
          <option value="inventory">{t("vehicles.kindInventory")}</option>
          <option value="customer">{t("vehicles.kindCustomer")}</option>
          <option value="sold">{t("vehicles.kindSold")}</option>
        </select>
        <select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("vehicles.status")}: {t("common.all")}</option>
          {VEHICLE_STATUSES.map((id) => (
            <option key={id} value={id}>
              {t(k(`vehicle.${id}`))}
            </option>
          ))}
        </select>
        <select className="w-40" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">{t("vehicles.condition")}: {t("common.all")}</option>
          {VEHICLE_CONDITIONS.map((id) => (
            <option key={id} value={id}>
              {t(k(`vehicleCond.${id}`))}
            </option>
          ))}
        </select>
        <select className="w-44" value={aging} onChange={(e) => setAging(e.target.value)}>
          <option value="">{t("vehicles.agingAny")}</option>
          <option value="30">{t("vehicles.agingDays", { n: 30 })}</option>
          <option value="45">{t("vehicles.agingDays", { n: 45 })}</option>
          <option value="60">{t("vehicles.agingDays", { n: 60 })}</option>
          <option value="90">{t("vehicles.agingDays", { n: 90 })}</option>
        </select>
        <div className="ml-auto text-xs text-slate-500">{t("vehicles.count", { n: rows.length })}</div>
      </Toolbar>
      <ErrorText error={error} />
      <Card className="overflow-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">{t("vehicles.stockNumber")}</th>
              <th className="px-4 py-3">{t("vehicles.vehicle")}</th>
              <th className="px-4 py-3">{t("vehicles.owner")}</th>
              <th className="px-4 py-3">{t("vehicles.plate")}</th>
              <th className="px-4 py-3">VIN</th>
              <th className="px-4 py-3">{t("vehicles.km")}</th>
              <th className="px-4 py-3">{t("vehicles.days")}</th>
              <th className="px-4 py-3">{t("vehicles.price")}</th>
              <th className="px-4 py-3">{t("vehicles.status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                  {t("common.emptyList")}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-600">
                <td className="px-4 py-3 font-mono text-xs">{row.stockNumber || t("common.dash")}</td>
                <td className="px-4 py-3">
                  <Link className="text-gold-400 hover:underline" to={`/vehiculos/${row.id}`}>
                    {vehicleLabel(row)}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {[row.color, row.location].filter(Boolean).join(" · ") || t("common.dash")}
                    {row.openOrders ? ` · ${t("vehicles.openRos", { n: row.openOrders })}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.customer ? (
                    <Link className="text-gold-400 hover:underline" to={`/clientes/${row.customer.id}`}>
                      {customerName(row.customer)}
                    </Link>
                  ) : (
                    t("vehicles.none")
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.plate || t("common.dash")}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.vin}</td>
                <td className="px-4 py-3">{formatNumber(row.km)}</td>
                <td className="px-4 py-3">
                  {row.daysInStock ? (
                    <span className={Number(row.daysInStock) >= 45 ? "text-amber-300" : ""}>{row.daysInStock}</span>
                  ) : (
                    t("common.dash")
                  )}
                </td>
                <td className="px-4 py-3">{row.status === "cliente" ? t("common.dash") : money(row.price)}</td>
                <td className="px-4 py-3">
                  <Badge status={row.status} label={t(k(`vehicle.${row.status}`))} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-gold-400" onClick={() => startEdit(row)}>
                    {t("common.edit")}
                  </button>
                  {can.destructive ? (
                    <button className="text-red-300" onClick={() => void remove(row.id)}>
                      {t("common.delete")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open ? (
        <Modal title={editing ? t("vehicles.edit") : t("vehicles.new")} onClose={() => setOpen(false)} wide>
          <VehicleFormFields form={form} setForm={setForm} owner={owner} setOwner={setOwner} t={t} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("common.save")}</Button>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
