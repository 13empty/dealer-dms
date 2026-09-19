import { useState } from "react";
import type { WashType } from "../vite-env";
import { useAuth } from "../lib/auth";
import { call, money } from "../lib/format";
import { k, useI18n } from "../lib/i18n";
import { askConfirm } from "../lib/ask";
import { Button, Field } from "./ui";

const emptyForm = {
  name: "",
  category: "lavado" as "lavado" | "detailing",
  price: "",
  minutes: "",
  active: true,
};

export function WashTypesPanel({
  types,
  onChange,
}: {
  types: WashType[];
  onChange: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  const { can } = useAuth();
  const [editing, setEditing] = useState<WashType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = can.finance;

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
    setError(null);
  }

  function startEdit(row: WashType) {
    setEditing(row);
    setForm({
      name: row.name,
      category: row.category === "detailing" ? "detailing" : "lavado",
      price: String(row.price ?? 0),
      minutes: row.minutes ? String(row.minutes) : "",
      active: row.active,
    });
    setOpen(true);
    setError(null);
  }

  async function save() {
    try {
      setError(null);
      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price) || 0,
        minutes: form.minutes === "" ? undefined : Number(form.minutes) || 0,
        active: form.active,
      };
      if (!payload.name) throw new Error(t("wash.typeNameRequired"));
      if (editing) await call(window.dms.washTypes.update(editing.id, payload));
      else await call(window.dms.washTypes.create(payload));
      setOpen(false);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(row: WashType) {
    if (!askConfirm(t("wash.deleteConfirm", { name: row.name }))) return;
    try {
      setError(null);
      await call(window.dms.washTypes.remove(row.id));
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("wash.types")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("wash.typesHint")}</p>
        </div>
        {canEdit ? <Button onClick={startCreate}>{t("wash.addType")}</Button> : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 overflow-auto rounded-lg border border-ink-600">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">{t("wash.typeName")}</th>
              <th className="px-3 py-2">{t("wash.kind")}</th>
              <th className="px-3 py-2">{t("wash.price")}</th>
              <th className="px-3 py-2">{t("wash.minutes")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  {t("wash.typesEmpty")}
                </td>
              </tr>
            ) : null}
            {types.map((row) => (
              <tr key={row.id} className={`border-t border-ink-600 ${row.active ? "" : "opacity-50"}`}>
                <td className="px-3 py-2">
                  {row.name}
                  {row.active ? null : <div className="text-xs text-slate-500">{t("common.inactive")}</div>}
                </td>
                <td className="px-3 py-2 text-slate-400">{t(k(`op.${row.category}`))}</td>
                <td className="px-3 py-2">{money(row.price)}</td>
                <td className="px-3 py-2 text-slate-400">{row.minutes || t("common.dash")}</td>
                <td className="px-3 py-2 text-right">
                  {canEdit ? (
                    <div className="flex justify-end gap-3">
                      <button className="text-gold-400" onClick={() => startEdit(row)}>
                        {t("common.edit")}
                      </button>
                      <button className="text-red-300" onClick={() => void remove(row)}>
                        {t("common.remove")}
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-ink-600 bg-ink-900/50 p-4 sm:grid-cols-2">
          <Field label={t("wash.typeName")}>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("wash.kind")}>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as "lavado" | "detailing" })}
            >
              <option value="lavado">{t("op.lavado")}</option>
              <option value="detailing">{t("op.detailing")}</option>
            </select>
          </Field>
          <Field label={t("wash.price")}>
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
          </Field>
          <Field label={t("wash.minutes")}>
            <input value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="25" />
          </Field>
          <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            {t("wash.typeActive")}
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()}>{t("common.save")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WashTypePicker({
  types,
  selectedIds,
  onToggle,
  disabled,
  compact,
}: {
  types: WashType[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const active = types.filter((row) => row.active);
  if (!active.length) {
    return <p className="text-sm text-slate-500">{t("wash.noTypesYet")}</p>;
  }
  return (
    <div className={compact ? "flex flex-wrap gap-1.5" : "grid gap-2 sm:grid-cols-2"}>
      {active.map((row) => {
        const on = selectedIds.includes(row.id);
        return (
          <button
            key={row.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(row.id)}
            className={`${
              compact ? "rounded-md border px-2 py-1 text-left text-xs" : "rounded-xl border px-3 py-3 text-left"
            } transition ${
              on ? "border-cyan-400/70 bg-cyan-400/10" : "border-ink-600 bg-ink-900/60 hover:border-ink-500"
            } ${disabled ? "opacity-50" : ""}`}
          >
            {compact ? (
              <span>
                <span className="font-medium text-slate-100">{row.name}</span>
                <span className="ml-1.5 text-cyan-200">{money(row.price)}</span>
              </span>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-100">{row.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{t(k(`op.${row.category}`))}</div>
                </div>
                <div className="shrink-0 text-sm font-medium text-cyan-200">{money(row.price)}</div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
