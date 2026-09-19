import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CustomerFormModal,
  customerFormPayload,
  emptyVehicleDraft,
  formFromCustomer,
  vehicleDraftPayload,
  VehicleDraftFields,
  type CustomerFormState,
  type VehicleDraft,
} from "../components/CustomerForm";
import { SearchPicker } from "../components/SearchPicker";
import { Badge, Button, Card, ErrorText, Field, Modal, PageHeader, GuidCopy } from "../components/ui";
import { call, customerName, customerPerson, dateEs, dateTimeEs, formatAddress, money, vehicleLabel, vehicleSearchHint } from "../lib/format";
import { k, phoneLabel, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import { useShop } from "../lib/shop-context";
import type { Customer } from "../vite-env";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { offerTax } = useShop();
  const [row, setRow] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerFormState | null>(null);
  const [linkId, setLinkId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linking, setLinking] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleDraft>(emptyVehicleDraft());
  const [note, setNote] = useState("");
  const [duplicates, setDuplicates] = useState<Customer[]>([]);
  const [force, setForce] = useState(false);

  async function load() {
    try {
      setError(null);
      const next = await call(window.dms.customers.get(String(id || "")));
      setRow(next);
      if (!next) throw new Error(t("common.notFound"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  function startEdit() {
    if (!row) return;
    setError(null);
    setForm(formFromCustomer(row));
    setDuplicates([]);
    setForce(false);
    setOpen(true);
  }

  async function save() {
    if (!row || !form) return;
    try {
      setError(null);
      const payload = customerFormPayload(form, { force });
      if (!force) {
        const matches = await call(window.dms.customers.findDuplicates({ ...payload, excludeId: row.id }));
        if (matches.length) {
          setDuplicates(matches);
          return;
        }
      }
      await call(window.dms.customers.update(row.id, payload));
      setOpen(false);
      setDuplicates([]);
      setForce(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function createOwnedVehicle() {
    if (!row) return;
    try {
      const payload = vehicleDraftPayload(vehicleForm);
      if (!payload) throw new Error(t("customers.vehicleRequired"));
      await call(
        window.dms.vehicles.create({
          ...payload,
          customerId: row.id,
          status: "cliente",
        })
      );
      setAddingVehicle(false);
      setVehicleForm(emptyVehicleDraft());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function linkVehicle() {
    if (!row || !linkId) return;
    try {
      await call(window.dms.vehicles.update(linkId, { customerId: row.id }));
      setLinkId("");
      setLinkLabel("");
      setLinking(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function unlink(vehicleId: string) {
    if (!row || !askConfirm(t("customers.unlinkConfirm"))) return;
    try {
      await call(window.dms.customers.unlinkVehicle(row.id, vehicleId));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addNote() {
    if (!row || !note.trim()) return;
    try {
      await call(window.dms.customers.addNote(row.id, note.trim()));
      setNote("");
      await load();
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

  const phones = row.phones?.length ? row.phones : row.phone ? [{ label: "main", number: row.phone }] : [];
  const blocked = row.status === "bloqueado";
  const inactive = row.status === "inactivo";
  const canOperate = !blocked && !inactive;

  return (
    <div className="page print:bg-white print:p-0 print:text-black">
      <PageHeader
        title={`${row.code || ""} · ${customerName(row)}`}
        subtitle={row.company ? customerPerson(row) : row.document || t("customers.file")}
        actions={
          <>
            <Button variant="ghost" onClick={() => window.print()}>
              {t("customers.printFile")}
            </Button>
            <Button variant="ghost" disabled={!canOperate} onClick={() => navigate(`/taller?cliente=${row.id}`)}>
              {t("customers.newOrder")}
            </Button>
            <Button variant="ghost" disabled={!canOperate} onClick={() => navigate(`/ventas?cliente=${row.id}`)}>
              {t("customers.newSale")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setVehicleForm(emptyVehicleDraft());
                setAddingVehicle(true);
              }}
            >
              {t("customers.addVehicle")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setLinkId("");
                setLinkLabel("");
                setLinking(true);
              }}
            >
              {t("customers.linkVehicle")}
            </Button>
            <Button onClick={startEdit}>{t("common.edit")}</Button>
          </>
        }
      />
      <div className="mb-4">
        <GuidCopy value={row.id} />
      </div>
      <ErrorText error={error} />
      {blocked ? <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{t("customers.blockedHint")}</p> : null}
      {inactive ? <p className="mb-4 rounded-md bg-slate-500/10 px-3 py-2 text-sm text-slate-300">{t("customers.inactiveHint")}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge status={row.type || "particular"} label={t(k(`customers.type.${row.type || "particular"}`))} />
        <Badge status={row.status || "activo"} label={t(k(`customers.status.${row.status || "activo"}`))} />
        <Badge status={row.source || "mostrador"} label={t(k(`customers.source.${row.source || "mostrador"}`))} />
        {row.taxExempt && offerTax ? <Badge status="lista" label={t("customers.taxExempt")} /> : null}
        {row.accountOpen ? <Badge status="financiado" label={t("customers.accountOpen")} /> : null}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-xs uppercase text-slate-500">{t("customers.lastVisit")}</div>
          <div className="mt-1 text-lg">{dateEs(row.lastVisit)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-slate-500">{t("customers.lifetime")}</div>
          <div className="mt-1 text-lg">{money(row.lifetime)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-slate-500">{t("customers.receivable")}</div>
          <div className="mt-1 text-lg">{Number(row.receivable) > 0 ? money(row.receivable) : t("customers.noBalance")}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-slate-500">{t("customers.openOrders")}</div>
          <div className="mt-1 text-lg">{row.openOrders || 0}</div>
          {row.accountOpen && row.creditLimit ? (
            <div className="mt-1 text-xs text-slate-400">
              {t("customers.creditLeft")}: {money(row.creditLeft)}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("customers.contact")}</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.preferredContact")}</dt>
              <dd>{t(k(`customers.pref.${row.preferredContact || "phone"}`))}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.phones")}</dt>
              <dd>
                {phones.length ? (
                  <ul className="mt-1 space-y-1">
                    {phones.map((p, i) => (
                      <li key={i}>
                        <span className="text-slate-400">{phoneLabel(p.label, t)}:</span> {p.number}
                      </li>
                    ))}
                  </ul>
                ) : (
                  t("common.dash")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.email")}</dt>
              <dd>{row.email || t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.document")}</dt>
              <dd>{row.document || t("common.dash")}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("customers.address")}</h2>
          <p className="text-sm">{formatAddress(row) || t("customers.noAddress")}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.lang")}</dt>
              <dd>{row.language || t("customers.langDefault")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.birthday")}</dt>
              <dd>{row.birthday || t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.created")}</dt>
              <dd>{dateEs(row.createdAt)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("customers.account")}</h2>
          <dl className="space-y-2 text-sm">
            {offerTax ? (
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.taxExempt")}</dt>
              <dd>{row.taxExempt ? t("common.active") : t("common.dash")}</dd>
            </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.discount")}</dt>
              <dd>{Number(row.discountPct) ? `${row.discountPct}%` : t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("customers.creditLimit")}</dt>
              <dd>{row.accountOpen ? money(row.creditLimit) : t("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">{t("common.notes")}</dt>
              <dd className="whitespace-pre-wrap text-slate-300">{row.notes || t("customers.noNotes")}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("customers.contacts")}</h2>
          {(row.contacts || []).length === 0 ? <p className="text-sm text-slate-400">{t("customers.noContacts")}</p> : null}
          <ul className="space-y-2 text-sm">
            {(row.contacts || []).map((c, i) => (
              <li key={i}>
                <div className="font-medium">{c.name || t("common.dash")}</div>
                <div className="text-xs text-slate-400">
                  {t(k(`customers.role.${c.role || "autorizado"}`))} · {c.phone || c.email || t("common.dash")}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-3">
          <h2 className="mb-3 font-medium">{t("customers.vehicles")}</h2>
          {(row.vehicles || []).length === 0 ? <p className="text-sm text-slate-400">{t("customers.noVehicles")}</p> : null}
          <ul className="space-y-2 text-sm">
            {(row.vehicles || []).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3">
                <Link className="text-gold-400 hover:underline" to={`/vehiculos/${v.id}`}>
                  {vehicleLabel(v)} · {v.plate || v.vin}
                </Link>
                <span className="flex items-center gap-3">
                  <Link className="no-print text-xs text-gold-400 hover:underline" to={`/taller?cliente=${row.id}&vehiculo=${v.id}`}>
                    {t("customers.newOrder")}
                  </Link>
                  <Badge status={v.status} label={t(k(`vehicle.${v.status}`))} />
                  <button className="no-print text-xs text-slate-400 hover:text-red-300" onClick={() => void unlink(v.id)}>
                    {t("customers.unlink")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("customers.sales")}</h2>
          {(row.sales || []).length === 0 ? <p className="text-sm text-slate-400">{t("customers.noSales")}</p> : null}
          <ul className="space-y-2 text-sm">
            {(row.sales || []).map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <Link className="text-gold-400" to={`/ventas/${s.id}`}>
                  #{s.id} · {money(s.price)}
                </Link>
                <span className="flex items-center gap-2">
                  {Number(s.balance) > 0 ? <span className="text-xs text-amber-300">{money(s.balance)}</span> : null}
                  <Badge status={s.status} label={t(k(`sale.${s.status}`))} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-medium">{t("customers.orders")}</h2>
          {(row.workOrders || []).length === 0 ? <p className="text-sm text-slate-400">{t("customers.noOrders")}</p> : null}
          <ul className="space-y-2 text-sm">
            {(row.workOrders || []).map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <Link className="text-gold-400" to={`/taller/${o.id}`}>
                  {o.number} · {o.complaint || t("customers.noComplaint")}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{money(o.total || 0)}</span>
                  {Number(o.balance) > 0 ? <span className="text-xs text-amber-300">{money(o.balance)}</span> : null}
                  <Badge status={o.status} label={t(k(`wo.${o.status}`))} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-medium">{t("customers.activity")}</h2>
        <div className="no-print mb-4 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("customers.notePlaceholder")} />
          <Button disabled={!note.trim()} onClick={() => void addNote()}>
            {t("customers.addNote")}
          </Button>
        </div>
        {(row.notesLog || []).length === 0 ? <p className="text-sm text-slate-400">{t("customers.noActivity")}</p> : null}
        <ul className="space-y-3 text-sm">
          {(row.notesLog || []).map((item) => (
            <li key={item.id} className="border-t border-ink-600 pt-3 first:border-0 first:pt-0">
              <div className="text-xs text-slate-500">
                {dateTimeEs(item.createdAt)}
                {item.userName ? ` · ${item.userName}` : ""}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      {addingVehicle ? (
        <Modal title={t("customers.addVehicle")} onClose={() => setAddingVehicle(false)}>
          <p className="mb-3 text-xs text-slate-400">{t("customers.vehicleHint")}</p>
          <VehicleDraftFields form={vehicleForm} setForm={setVehicleForm} t={t} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddingVehicle(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void createOwnedVehicle()}>{t("common.save")}</Button>
          </div>
        </Modal>
      ) : null}
      {linking ? (
        <Modal title={t("customers.linkVehicle")} onClose={() => setLinking(false)}>
          <Field label={t("vehicles.vehicle")}>
            <SearchPicker
              value={linkId}
              selectedLabel={linkLabel}
              placeholder={t("picker.searchVehicle")}
              onChange={(nextId, option) => {
                setLinkId(nextId);
                setLinkLabel(option?.label || "");
              }}
              search={async (query) => {
                const rows = await call(window.dms.vehicles.list(query, undefined, { limit: 25 }));
                return rows
                  .filter((v) => v.customerId !== row.id)
                  .map((v) => ({
                    id: v.id,
                    label: `${vehicleLabel(v)} · ${v.plate || v.vin}`,
                    hint: vehicleSearchHint(v),
                  }));
              }}
            />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLinking(false)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!linkId} onClick={() => void linkVehicle()}>
              {t("common.save")}
            </Button>
          </div>
        </Modal>
      ) : null}
      {open && form ? (
        <CustomerFormModal
          editing
          form={form}
          setForm={setForm}
          onClose={() => setOpen(false)}
          onSave={() => void save()}
          t={t}
          duplicates={duplicates}
          force={force}
          setForce={setForce}
          error={error}
        />
      ) : null}
    </div>
  );
}
