import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  CustomerFormModal,
  customerFormPayload,
  emptyCustomerForm,
  formFromCustomer,
  type CustomerFormState,
} from "../components/CustomerForm";
import { Badge, Button, Card, ErrorText, Page, PageHeader, Toolbar } from "../components/ui";
import { useAuth } from "../lib/auth";
import { call, customerName, dateEs, formatPhones, money, vehicleLabel } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import type { Customer } from "../vite-env";

export default function Customers() {
  const { can } = useAuth();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState(() => (params.get("balance") === "1" ? "" : "activo"));
  const [balanceOnly, setBalanceOnly] = useState(() => params.get("balance") === "1");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm());
  const [duplicates, setDuplicates] = useState<Customer[]>([]);
  const [force, setForce] = useState(false);

  async function load() {
    try {
      setError(null);
      setRows(
        await call(
          window.dms.customers.list(q, {
            type: type || undefined,
            status: status || undefined,
            balance: balanceOnly || undefined,
          })
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q, type, status, balanceOnly]);

  useEffect(() => {
    if (params.get("nuevo") !== "1") return;
    startCreate();
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("nuevo");
        return next;
      },
      { replace: true }
    );
  }, [params.get("nuevo")]);

  function startCreate() {
    setEditing(null);
    setError(null);
    setForm(emptyCustomerForm());
    setDuplicates([]);
    setForce(false);
    setOpen(true);
  }

  function startEdit(row: Customer) {
    setEditing(row);
    setForm(formFromCustomer(row));
    setDuplicates([]);
    setForce(false);
    setOpen(true);
  }

  async function save() {
    try {
      setError(null);
      const payload = customerFormPayload(form, { includeVehicle: !editing, force });
      if (!force) {
        const matches = await call(
          window.dms.customers.findDuplicates({
            ...payload,
            excludeId: editing?.id,
          })
        );
        if (matches.length) {
          setDuplicates(matches);
          return;
        }
      }
      if (editing) await call(window.dms.customers.update(editing.id, payload));
      else await call(window.dms.customers.create(payload));
      setOpen(false);
      setDuplicates([]);
      setForce(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    if (!askConfirm(t("customers.deleteConfirm"))) return;
    try {
      await call(window.dms.customers.remove(id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Page>
      <PageHeader
        title={t("customers.title")}
        subtitle={t("customers.subtitle")}
        actions={<Button onClick={startCreate}>{t("customers.new")}</Button>}
      />
      <Toolbar>
        <div className="min-w-[220px] flex-1">
          <input autoFocus placeholder={t("customers.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="w-40" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("customers.type")}: {t("common.all")}</option>
          {CUSTOMER_TYPES.map((item) => (
            <option key={item} value={item}>
              {t(k(`customers.type.${item}`))}
            </option>
          ))}
        </select>
        <select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("customers.statusLabel")}: {t("common.all")}</option>
          {CUSTOMER_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(k(`customers.status.${item}`))}
            </option>
          ))}
        </select>
        <label className="mb-0 flex items-center gap-2 text-sm normal-case tracking-normal text-slate-300">
          <input type="checkbox" checked={balanceOnly} onChange={(e) => setBalanceOnly(e.target.checked)} />
          {t("customers.filterBalance")}
        </label>
        <div className="ml-auto text-xs text-slate-500">{t("customers.count", { n: rows.length })}</div>
      </Toolbar>
      <ErrorText error={error} />
      <Card className="overflow-auto">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">{t("customers.code")}</th>
              <th className="px-4 py-3">{t("customers.name")}</th>
              <th className="px-4 py-3">{t("customers.type")}</th>
              <th className="px-4 py-3">{t("customers.vehicles")}</th>
              <th className="px-4 py-3">{t("customers.phones")}</th>
              <th className="px-4 py-3">{t("customers.lastVisit")}</th>
              <th className="px-4 py-3">{t("customers.receivable")}</th>
              <th className="px-4 py-3">{t("customers.statusLabel")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  {t("common.emptyList")}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-600">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.code}</td>
                <td className="px-4 py-3">
                  <Link className="text-gold-400 hover:underline" to={`/clientes/${row.id}`}>
                    {customerName(row) || t("common.dash")}
                  </Link>
                  {row.city ? <div className="mt-1 text-xs text-slate-500">{row.city}</div> : null}
                </td>
                <td className="px-4 py-3">
                  <Badge status={row.type || "particular"} label={t(k(`customers.type.${row.type || "particular"}`))} />
                </td>
                <td className="px-4 py-3">
                  {(row.vehicles || []).length ? (
                    <div className="space-y-1">
                      {(row.vehicles || []).map((v) => (
                        <Link key={v.id} className="block text-gold-400 hover:underline" to={`/vehiculos/${v.id}`}>
                          {vehicleLabel(v)}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    t("common.dash")
                  )}
                </td>
                <td className="px-4 py-3">{formatPhones(row, t) || t("common.dash")}</td>
                <td className="px-4 py-3">{dateEs(row.lastVisit)}</td>
                <td className="px-4 py-3">{Number(row.receivable) > 0 ? money(row.receivable) : t("customers.noBalance")}</td>
                <td className="px-4 py-3">
                  <Badge status={row.status || "activo"} label={t(k(`customers.status.${row.status || "activo"}`))} />
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
        <CustomerFormModal
          editing={Boolean(editing)}
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
    </Page>
  );
}
