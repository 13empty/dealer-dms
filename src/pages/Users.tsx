import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, ErrorText, Field, FormSection, Modal, PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth";
import { call } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { CA_PROVINCES, SHOP_DEFAULTS } from "../lib/canada";
import type { AppUser, UserJob, UserRole } from "../vite-env";

const JOBS: UserJob[] = ["tecnico", "asesor", "partes", "ventas", "caja", "otro"];

const emptyForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  username: "",
  password: "",
  role: "empleado" as UserRole,
  job: "tecnico" as UserJob,
  phone: "",
  email: "",
  document: "",
  address: "",
  city: SHOP_DEFAULTS.city,
  state: SHOP_DEFAULTS.province,
  zip: "",
  notes: "",
  laborRate: "",
  canTech: true,
};

function defaultJob(role: UserRole): UserJob {
  if (role === "empleado") return "tecnico";
  if (role === "gerente") return "asesor";
  return "otro";
}

function defaultCanTech(job: UserJob) {
  return job === "tecnico" || job === "asesor";
}

function directoryPayload(form: typeof emptyForm) {
  return {
    firstName: form.firstName,
    middleName: form.middleName,
    lastName: form.lastName,
    phone: form.phone,
    email: form.email,
    document: form.document,
    address: form.address,
    city: form.city,
    state: form.state,
    zip: form.zip,
    notes: form.notes,
  };
}

export default function Users() {
  const { user: me, can, refresh } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<AppUser[]>([]);
  const [q, setQ] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState("");

  const editingSelf = Boolean(editing && me?.id === editing.id);
  const canEditShop = !editingSelf || me?.role === "admin";
  const visible = useMemo(
    () => (jobFilter ? rows.filter((row) => (row.job || "tecnico") === jobFilter) : rows),
    [rows, jobFilter]
  );

  async function load() {
    try {
      setError(null);
      setRows(await call(window.dms.users.list(q)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [q]);

  function startCreate() {
    const role = (can.assignableRoles[can.assignableRoles.length - 1] || "empleado") as UserRole;
    const job = defaultJob(role);
    setEditing(null);
    setError(null);
    setForm({
      ...emptyForm,
      role,
      job,
      canTech: defaultCanTech(job),
    });
    setNewPassword("");
    setOpen(true);
  }

  function startEdit(row: AppUser) {
    const job = (row.job || defaultJob(row.role)) as UserJob;
    setEditing(row);
    setError(null);
    setForm({
      firstName: row.firstName || "",
      middleName: row.middleName || "",
      lastName: row.lastName || "",
      username: row.username,
      password: "",
      role: row.role,
      job,
      phone: row.phone || "",
      email: row.email || "",
      document: row.document || "",
      address: row.address || "",
      city: row.city || "",
      state: row.state || "",
      zip: row.zip || "",
      notes: row.notes || "",
      laborRate: row.laborRate ? String(row.laborRate) : "",
      canTech: Boolean(row.canTech),
    });
    setNewPassword("");
    setOpen(true);
  }

  async function save() {
    try {
      setError(null);
      const shop = canEditShop
        ? {
            job: form.job,
            laborRate: Number(form.laborRate) || 0,
            canTech: form.canTech ? 1 : 0,
          }
        : {};
      const directory = directoryPayload(form);
      if (editing) {
        await call(
          window.dms.users.update(editing.id, {
            username: form.username,
            ...directory,
            ...(canEditShop ? shop : {}),
            ...(!editingSelf && canEditShop ? { role: form.role } : {}),
          })
        );
        if (newPassword.trim()) await call(window.dms.users.setPassword(editing.id, newPassword));
        if (me?.id === editing.id) await refresh();
      } else {
        await call(
          window.dms.users.create({
            username: form.username,
            password: form.password,
            role: form.role,
            ...directory,
            ...shop,
          })
        );
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleActive(row: AppUser) {
    if (row.active) {
      const msg = row.assigned ? t("users.deactivateAssigned") : t("users.deactivateConfirm");
      if (!confirm(msg)) return;
    }
    try {
      await call(window.dms.users.update(row.id, { active: row.active ? 0 : 1 }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(row: AppUser) {
    if (row.assigned) {
      setError(t("users.deleteBlocked"));
      return;
    }
    if (!confirm(t("users.deleteConfirm"))) return;
    try {
      await call(window.dms.users.remove(row.id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={can.assignableRoles.length ? <Button onClick={startCreate}>{t("users.add")}</Button> : null}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <input className="min-w-[16rem] flex-1" placeholder={t("users.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
          <option value="">{t("users.job")}: {t("common.all")}</option>
          {JOBS.map((job) => (
            <option key={job} value={job}>
              {t(k(`job.${job}`))}
            </option>
          ))}
        </select>
      </div>
      <ErrorText error={open ? null : error} />
      <Card className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">{t("users.name")}</th>
              <th className="px-4 py-3">{t("users.username")}</th>
              <th className="px-4 py-3">{t("users.job")}</th>
              <th className="px-4 py-3">{t("users.role")}</th>
              <th className="px-4 py-3">{t("users.phone")}</th>
              <th className="px-4 py-3">{t("customers.email")}</th>
              <th className="px-4 py-3">{t("users.status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                  {t("common.emptyList")}
                </td>
              </tr>
            ) : null}
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-ink-600">
                <td className="px-4 py-3">
                  {row.name}
                  {me?.id === row.id ? <span className="ml-2 text-xs text-slate-500">{t("common.you")}</span> : null}
                  {row.assigned ? (
                    <span className="ml-2 text-[11px] text-slate-500">{t("users.assigned")}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.username}</td>
                <td className="px-4 py-3">
                  <Badge status={row.job || "tecnico"} label={t(k(`job.${row.job || "tecnico"}`))} />
                </td>
                <td className="px-4 py-3">
                  <Badge status={row.role} label={t(k(`role.${row.role}`))} />
                </td>
                <td className="px-4 py-3 text-slate-300">{row.phone || "—"}</td>
                <td className="px-4 py-3 text-slate-300">{row.email || "—"}</td>
                <td className="px-4 py-3">{row.active ? t("common.active") : t("common.inactive")}</td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-gold-400" onClick={() => startEdit(row)}>
                    {t("common.edit")}
                  </button>
                  {me?.id !== row.id ? (
                    <>
                      <button className="mr-3 text-gold-400" onClick={() => void toggleActive(row)}>
                        {row.active ? t("users.deactivate") : t("users.activate")}
                      </button>
                      {row.assigned ? null : (
                        <button className="text-red-300" onClick={() => void remove(row)}>
                          {t("users.remove")}
                        </button>
                      )}
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open ? (
        <Modal wide title={editing ? t("users.edit") : t("users.new")} onClose={() => setOpen(false)}>
          <div className="grid gap-4">
            <ErrorText error={error} />
            <FormSection title={t("users.sectionPerson")}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("customers.firstName")}>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </Field>
                <Field label={t("customers.middleName")}>
                  <input value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
                </Field>
                <Field label={t("customers.lastName")}>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label={t("customers.document")}>
                  <input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
                </Field>
              </div>
            </FormSection>

            <FormSection title={t("users.sectionContact")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("users.phone")}>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label={t("customers.email")}>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label={t("customers.address")}>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder={t("customers.street")}
                  />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label={t("customers.city")}>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label={t("customers.region")}>
                  <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    {CA_PROVINCES.some((p) => p.code === form.state) ? null : (
                      <option value={form.state}>{form.state || t("common.select")}</option>
                    )}
                    {CA_PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("customers.postal")}>
                  <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="T2P 1J9" />
                </Field>
              </div>
              <div className="mt-3">
                <Field label={t("common.notes")}>
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>
            </FormSection>

            <FormSection title={t("users.sectionAccess")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("users.loginName")}>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </Field>
                {editing ? (
                  <Field label={t("users.newPassword")}>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </Field>
                ) : (
                  <Field label={t("users.password")}>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </Field>
                )}
              </div>
              {canEditShop ? (
                <div className="mt-3 grid gap-3">
                  {!editingSelf ? (
                    <Field label={t("users.role")} hint={t("users.roleHint")}>
                      <select
                        value={form.role}
                        onChange={(e) => {
                          const role = e.target.value as UserRole;
                          const job = defaultJob(role);
                          setForm({ ...form, role, job, canTech: defaultCanTech(job) });
                        }}
                      >
                        {(editing && !can.assignableRoles.includes(editing.role)
                          ? [editing.role, ...can.assignableRoles]
                          : can.assignableRoles
                        ).map((role) => (
                          <option key={role} value={role}>
                            {t(k(`role.${role}`))} — {t(k(`roleHint.${role}`))}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("users.job")} hint={t("users.jobHint")}>
                      <select
                        value={form.job}
                        onChange={(e) => {
                          const job = e.target.value as UserJob;
                          setForm({ ...form, job, canTech: defaultCanTech(job) });
                        }}
                      >
                        {JOBS.map((job) => (
                          <option key={job} value={job}>
                            {t(k(`job.${job}`))}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("users.laborRate")} hint={t("users.laborRateHint")}>
                      <input
                        inputMode="decimal"
                        value={form.laborRate}
                        onChange={(e) => setForm({ ...form, laborRate: e.target.value })}
                        placeholder="0"
                      />
                    </Field>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.canTech}
                      onChange={(e) => setForm({ ...form, canTech: e.target.checked })}
                    />
                    <span>
                      <span className="block font-medium text-white">{t("users.canTech")}</span>
                      <span className="text-xs text-slate-500">{t("users.canTechHint")}</span>
                    </span>
                  </label>
                </div>
              ) : null}
            </FormSection>
          </div>
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
