import { Button, ErrorText, Field, FormSection, Modal } from "./ui";
import { VinField, applyVinDecoded } from "./VinField";
import { PHONE_KEYS, k, phoneKey, type Translate } from "../lib/i18n";
import { CA_PROVINCES } from "../lib/canada";
import { useShop } from "../lib/shop-context";
import type { Customer, CustomerContact, CustomerPhone, CustomerSource, CustomerStatus, CustomerType } from "../vite-env";

export const CUSTOMER_TYPES: CustomerType[] = ["particular", "empresa", "flotilla", "seguro", "mayoreo"];
export const CUSTOMER_STATUSES: CustomerStatus[] = ["activo", "inactivo", "bloqueado"];
export const CUSTOMER_SOURCES: CustomerSource[] = ["mostrador", "referido", "web", "facebook", "whatsapp", "otro"];
export const CONTACT_ROLES = ["titular", "autorizado", "chofer", "contabilidad", "otro"] as const;

export type VehicleDraft = {
  vin: string;
  plate: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  km: string;
};

export type CustomerFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  company: string;
  type: CustomerType;
  status: CustomerStatus;
  source: CustomerSource;
  taxExempt: boolean;
  accountOpen: boolean;
  creditLimit: string;
  discountPct: string;
  preferredContact: "phone" | "email" | "whatsapp";
  language: string;
  birthday: string;
  marketing: boolean;
  email: string;
  document: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  phones: CustomerPhone[];
  contacts: CustomerContact[];
  vehicle: VehicleDraft;
};

export function vehicleDraftPayload(v: VehicleDraft) {
  const vin = v.vin.trim();
  const plate = v.plate.trim();
  const make = v.make.trim();
  const model = v.model.trim();
  if (!vin && !plate && !make && !model) return undefined;
  return {
    vin,
    plate,
    year: Number(v.year) || new Date().getFullYear(),
    make,
    model,
    color: v.color.trim(),
    km: Number(v.km) || 0,
    trim: v.trim.trim(),
  };
}

export function emptyVehicleDraft(): VehicleDraft {
  return {
    vin: "",
    plate: "",
    year: String(new Date().getFullYear()),
    make: "",
    model: "",
    trim: "",
    color: "",
    km: "0",
  };
}

export function emptyContact(): CustomerContact {
  return { name: "", role: "autorizado", phone: "", email: "" };
}

export function emptyCustomerForm(): CustomerFormState {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    company: "",
    type: "particular",
    status: "activo",
    source: "mostrador",
    taxExempt: false,
    accountOpen: false,
    creditLimit: "0",
    discountPct: "0",
    preferredContact: "phone",
    language: "",
    birthday: "",
    marketing: true,
    email: "",
    document: "",
    address: "",
    city: "Calgary",
    state: "AB",
    zip: "",
    notes: "",
    phones: [{ label: "mobile", number: "" }],
    contacts: [],
    vehicle: emptyVehicleDraft(),
  };
}

export function customerDraftFromQuery(query: string): CustomerFormState {
  const form = emptyCustomerForm();
  const q = String(query || "").trim();
  if (!q) return form;
  if (/^[\d+()\-\s.]{7,}$/.test(q)) {
    form.phones = [{ label: "mobile", number: q }];
    return form;
  }
  const parts = q.split(/\s+/).filter(Boolean);
  form.firstName = parts[0] || "";
  form.lastName = parts.slice(1).join(" ");
  return form;
}

export function formFromCustomer(row: Customer): CustomerFormState {
  return {
    firstName: row.firstName || "",
    middleName: row.middleName || "",
    lastName: row.lastName || "",
    company: row.company || "",
    type: row.type || "particular",
    status: row.status || "activo",
    source: row.source || "mostrador",
    taxExempt: Boolean(row.taxExempt),
    accountOpen: Boolean(row.accountOpen),
    creditLimit: String(row.creditLimit || 0),
    discountPct: String(row.discountPct || 0),
    preferredContact: row.preferredContact || "phone",
    language: row.language || "",
    birthday: row.birthday || "",
    marketing: row.marketing == null ? true : Boolean(row.marketing),
    email: row.email,
    document: row.document,
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    zip: row.zip || "",
    notes: row.notes || "",
    phones: row.phones?.length
      ? row.phones.map((p) => ({ label: phoneKey(p.label), number: p.number }))
      : [{ label: "mobile", number: row.phone || "" }],
    contacts: row.contacts?.length ? row.contacts.map((c) => ({ ...c })) : [],
    vehicle: emptyVehicleDraft(),
  };
}

export function customerFormPayload(form: CustomerFormState, extras: { force?: boolean; includeVehicle?: boolean } = {}) {
  return {
    ...form,
    taxExempt: form.taxExempt ? 1 : 0,
    accountOpen: form.accountOpen ? 1 : 0,
    marketing: form.marketing ? 1 : 0,
    creditLimit: Number(form.creditLimit) || 0,
    discountPct: Number(form.discountPct) || 0,
    phones: form.phones.filter((p) => p.number.trim()),
    contacts: form.contacts.filter((c) => c.name.trim() || c.phone.trim() || c.email.trim()),
    vehicle: extras.includeVehicle ? vehicleDraftPayload(form.vehicle) : undefined,
    force: extras.force,
  };
}

export function CustomerFormModal({
  editing,
  form,
  setForm,
  onClose,
  onSave,
  t,
  duplicates = [],
  force = false,
  setForce,
  error = null,
}: {
  editing: boolean;
  form: CustomerFormState;
  setForm: (form: CustomerFormState) => void;
  onClose: () => void;
  onSave: () => void;
  t: Translate;
  duplicates?: Customer[];
  force?: boolean;
  setForce?: (value: boolean) => void;
  error?: string | null;
}) {
  const needsCompany = form.type !== "particular";
  const { offerTax } = useShop();

  function setPhone(index: number, patch: Partial<CustomerPhone>) {
    setForm({
      ...form,
      phones: form.phones.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  }

  function setContact(index: number, patch: Partial<CustomerContact>) {
    setForm({
      ...form,
      contacts: form.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  }

  return (
    <Modal
      xl
      title={editing ? t("customers.edit") : t("customers.new")}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onSave}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <ErrorText error={error} />
        <FormSection title={t("customers.sectionCustomer")}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label={t("customers.type")}>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CustomerType })}>
                {CUSTOMER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(k(`customers.type.${type}`))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("customers.statusLabel")}>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
                {CUSTOMER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(k(`customers.status.${status}`))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("customers.source")}>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as CustomerSource })}>
                {CUSTOMER_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {t(k(`customers.source.${source}`))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("customers.birthday")}>
              <input value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} placeholder="AAAA-MM-DD" />
            </Field>
            {needsCompany ? (
              <div className="md:col-span-4">
                <Field label={t("customers.company")}>
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder={t("customers.companyHint")}
                  />
                </Field>
              </div>
            ) : null}
            <Field label={t("customers.firstName")}>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label={t("customers.middleName")}>
              <input value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
            </Field>
            <Field label={t("customers.lastName")}>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
            <Field label={t("customers.document")}>
              <input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="grid gap-3 content-start">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("customers.email")}>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label={t("customers.preferredContact")}>
                  <select
                    value={form.preferredContact}
                    onChange={(e) => setForm({ ...form, preferredContact: e.target.value as CustomerFormState["preferredContact"] })}
                  >
                    <option value="phone">{t("customers.pref.phone")}</option>
                    <option value="email">{t("customers.pref.email")}</option>
                    <option value="whatsapp">{t("customers.pref.whatsapp")}</option>
                  </select>
                </Field>
              </div>
              <Field label={t("customers.lang")}>
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="">{t("customers.langDefault")}</option>
                  <option value="es">Español</option>
                  <option value="en-CA">English (Canada)</option>
                  <option value="fr-CA">Français (Canada)</option>
                </select>
              </Field>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="mb-0">{t("customers.phones")}</label>
                  <button
                    className="text-xs text-gold-400"
                    onClick={() => setForm({ ...form, phones: [...form.phones, { label: "mobile", number: "" }] })}
                  >
                    {t("customers.addPhone")}
                  </button>
                </div>
                <div className="grid gap-2">
                  {form.phones.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <select className="max-w-36" value={phoneKey(phone.label)} onChange={(e) => setPhone(index, { label: e.target.value })}>
                        {PHONE_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {t(k(`phone.${key}`))}
                          </option>
                        ))}
                      </select>
                      <input value={phone.number} onChange={(e) => setPhone(index, { number: e.target.value })} placeholder={t("customers.number")} />
                      {form.phones.length > 1 ? (
                        <button className="text-red-300" onClick={() => setForm({ ...form, phones: form.phones.filter((_, i) => i !== index) })}>
                          {t("common.remove")}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 content-start">
              <Field label={t("customers.address")}>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("customers.street")} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
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
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {offerTax ? (
                <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
                  <input type="checkbox" checked={form.taxExempt} onChange={(e) => setForm({ ...form, taxExempt: e.target.checked })} />
                  {t("customers.taxExempt")}
                </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
                  <input type="checkbox" checked={form.accountOpen} onChange={(e) => setForm({ ...form, accountOpen: e.target.checked })} />
                  {t("customers.accountOpen")}
                </label>
                <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-200">
                  <input type="checkbox" checked={form.marketing} onChange={(e) => setForm({ ...form, marketing: e.target.checked })} />
                  {t("customers.marketing")}
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {form.accountOpen ? (
                  <Field label={t("customers.creditLimit")}>
                    <input value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
                  </Field>
                ) : null}
                <Field label={t("customers.discount")}>
                  <input value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-ink-600/80 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("customers.sectionPeople")}</div>
                <p className="text-xs text-slate-500">{t("customers.contactsHint")}</p>
              </div>
              <button className="text-xs text-gold-400" onClick={() => setForm({ ...form, contacts: [...form.contacts, emptyContact()] })}>
                {t("customers.addContact")}
              </button>
            </div>
            {form.contacts.length ? (
              <div className="grid gap-2">
                {form.contacts.map((contact, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-4">
                    <input value={contact.name} onChange={(e) => setContact(index, { name: e.target.value })} placeholder={t("customers.contactName")} />
                    <select value={contact.role} onChange={(e) => setContact(index, { role: e.target.value })}>
                      {CONTACT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(k(`customers.role.${role}`))}
                        </option>
                      ))}
                    </select>
                    <input value={contact.phone} onChange={(e) => setContact(index, { phone: e.target.value })} placeholder={t("customers.contactPhone")} />
                    <div className="flex gap-2">
                      <input value={contact.email} onChange={(e) => setContact(index, { email: e.target.value })} placeholder={t("customers.email")} />
                      <button className="text-red-300" onClick={() => setForm({ ...form, contacts: form.contacts.filter((_, i) => i !== index) })}>
                        {t("common.remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t("customers.noContacts")}</p>
            )}
          </div>

          <div className="mt-4">
            <Field label={t("common.notes")}>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
        </FormSection>

        {!editing ? (
          <FormSection title={t("customers.vehicleSection")} hint={t("customers.vehicleHint")}>
            <VehicleDraftFields form={form.vehicle} setForm={(vehicle) => setForm({ ...form, vehicle })} t={t} />
          </FormSection>
        ) : null}

        {duplicates.length ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            <div className="font-medium">{t("customers.duplicates")}</div>
            <p className="mt-1 text-xs text-amber-200/80">{t("customers.duplicatesHint")}</p>
            <ul className="mt-2 space-y-1">
              {duplicates.map((row) => (
                <li key={row.id}>
                  {row.code} · {row.name} · {row.phone || row.email || row.document}
                </li>
              ))}
            </ul>
            {setForce ? (
              <label className="mt-3 flex items-center gap-2 text-xs normal-case tracking-normal">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                {t("customers.saveAnyway")}
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function VehicleDraftFields({
  form,
  setForm,
  t,
}: {
  form: VehicleDraft;
  setForm: (form: VehicleDraft) => void;
  t: Translate;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <VinField
          value={form.vin}
          onChange={(vin) => setForm({ ...form, vin })}
          apply={(decoded) => setForm(applyVinDecoded(form, decoded))}
          t={t}
        />
      </div>
      <Field label={t("vehicles.plate")}>
        <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
      </Field>
      <Field label={t("vehicles.year")}>
        <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
      </Field>
      <Field label={t("vehicles.kms")}>
        <input value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />
      </Field>
      <Field label={t("vehicles.make")}>
        <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
      </Field>
      <Field label={t("vehicles.model")}>
        <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
      </Field>
      <Field label={t("vehicles.trim")}>
        <input value={form.trim} onChange={(e) => setForm({ ...form, trim: e.target.value })} />
      </Field>
      <Field label={t("vehicles.color")}>
        <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
      </Field>
    </div>
  );
}
