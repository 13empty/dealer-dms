import { SearchPicker } from "./SearchPicker";
import { Field } from "./ui";
import { VinField, applyVinDecoded } from "./VinField";
import { call, customerName, customerSearchHint } from "../lib/format";
import { k, type Translate } from "../lib/i18n";
import type { Vehicle, VehicleCondition, VehicleStatus } from "../vite-env";

export const VEHICLE_STATUSES: VehicleStatus[] = ["en_stock", "reservado", "vendido", "cliente", "consignacion"];
export const VEHICLE_CONDITIONS: VehicleCondition[] = ["usado", "nuevo", "certificado"];
export const VEHICLE_BODIES = ["", "sedan", "hatch", "suv", "pickup", "van", "coupe", "wagon", "moto", "otro"] as const;
export const VEHICLE_FUELS = ["", "gasolina", "diesel", "hibrido", "electrico", "glp"] as const;
export const VEHICLE_TRANS = ["", "automatico", "manual", "cvt", "dct"] as const;
export const VEHICLE_DRIVE = ["", "FWD", "RWD", "AWD", "4x4"] as const;

export type VehicleFormState = {
  vin: string;
  plate: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  interiorColor: string;
  bodyStyle: string;
  doors: string;
  engine: string;
  transmission: string;
  drivetrain: string;
  fuel: string;
  km: string;
  status: VehicleStatus;
  condition: VehicleCondition;
  customerId: string;
  unitNumber: string;
  stockNumber: string;
  cost: string;
  price: string;
  location: string;
  keyNumber: string;
  acquiredAt: string;
  insurance: string;
  insurancePolicy: string;
  licenseExpiry: string;
  inspectionDue: string;
  productionDate: string;
  alert: string;
  notes: string;
};

export function emptyVehicleForm(): VehicleFormState {
  return {
    vin: "",
    plate: "",
    year: String(new Date().getFullYear()),
    make: "",
    model: "",
    trim: "",
    color: "",
    interiorColor: "",
    bodyStyle: "",
    doors: "",
    engine: "",
    transmission: "",
    drivetrain: "",
    fuel: "",
    km: "0",
    status: "en_stock",
    condition: "usado",
    customerId: "",
    unitNumber: "",
    stockNumber: "",
    cost: "",
    price: "",
    location: "",
    keyNumber: "",
    acquiredAt: "",
    insurance: "",
    insurancePolicy: "",
    licenseExpiry: "",
    inspectionDue: "",
    productionDate: "",
    alert: "",
    notes: "",
  };
}

export function formFromVehicle(row: Vehicle): VehicleFormState {
  return {
    ...emptyVehicleForm(),
    vin: row.vin || "",
    plate: row.plate || "",
    year: String(row.year || ""),
    make: row.make || "",
    model: row.model || "",
    trim: row.trim || "",
    color: row.color || "",
    interiorColor: row.interiorColor || "",
    bodyStyle: row.bodyStyle || "",
    doors: row.doors ? String(row.doors) : "",
    engine: row.engine || "",
    transmission: row.transmission || "",
    drivetrain: row.drivetrain || "",
    fuel: row.fuel || "",
    km: String(row.km || 0),
    status: row.status,
    condition: row.condition || "usado",
    customerId: row.customerId ? String(row.customerId) : "",
    unitNumber: row.unitNumber || "",
    stockNumber: row.stockNumber || "",
    cost: String(row.cost || 0),
    price: String(row.price || 0),
    location: row.location || "",
    keyNumber: row.keyNumber || "",
    acquiredAt: (row.acquiredAt || "").slice(0, 10),
    insurance: row.insurance || "",
    insurancePolicy: row.insurancePolicy || "",
    licenseExpiry: row.licenseExpiry || "",
    inspectionDue: row.inspectionDue || "",
    productionDate: row.productionDate || "",
    alert: row.alert || "",
    notes: row.notes || "",
  };
}

export function vehicleFormPayload(form: VehicleFormState) {
  return {
    vin: form.vin,
    plate: form.plate,
    year: Number(form.year),
    make: form.make,
    model: form.model,
    trim: form.trim,
    color: form.color,
    interiorColor: form.interiorColor,
    bodyStyle: form.bodyStyle,
    doors: Number(form.doors) || 0,
    engine: form.engine,
    transmission: form.transmission,
    drivetrain: form.drivetrain,
    fuel: form.fuel,
    km: Number(form.km) || 0,
    status: form.status,
    condition: form.condition,
    customerId: form.customerId || null,
    unitNumber: form.unitNumber,
    stockNumber: form.stockNumber,
    cost: Number(form.cost) || 0,
    price: Number(form.price) || 0,
    location: form.location,
    keyNumber: form.keyNumber,
    acquiredAt: form.acquiredAt || null,
    insurance: form.insurance,
    insurancePolicy: form.insurancePolicy,
    licenseExpiry: form.licenseExpiry,
    inspectionDue: form.inspectionDue,
    productionDate: form.productionDate,
    alert: form.alert,
    notes: form.notes,
  };
}

export function VehicleFormFields({
  form,
  setForm,
  owner,
  setOwner,
  t,
}: {
  form: VehicleFormState;
  setForm: (form: VehicleFormState) => void;
  owner: { label: string; hint: string };
  setOwner: (owner: { label: string; hint: string }) => void;
  t: Translate;
}) {
  const inventory = form.status === "en_stock" || form.status === "reservado" || form.status === "consignacion";

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-300">{t("vehicles.sectionIdentity")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <VinField
            value={form.vin}
            onChange={(vin) => setForm({ ...form, vin })}
            apply={(decoded) => setForm(applyVinDecoded(form, decoded))}
            t={t}
          />
          <Field label={t("vehicles.plate")}>
            <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
          </Field>
          <Field label={t("vehicles.year")}>
            <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
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
          <Field label={t("vehicles.interior")}>
            <input value={form.interiorColor} onChange={(e) => setForm({ ...form, interiorColor: e.target.value })} />
          </Field>
          <Field label={t("vehicles.body")}>
            <select value={form.bodyStyle} onChange={(e) => setForm({ ...form, bodyStyle: e.target.value })}>
              {VEHICLE_BODIES.map((id) => (
                <option key={id || "none"} value={id}>
                  {id ? t(k(`vehicleBody.${id}`)) : t("common.select")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vehicles.doors")}>
            <input value={form.doors} onChange={(e) => setForm({ ...form, doors: e.target.value })} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-300">{t("vehicles.sectionSpecs")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("vehicles.engine")}>
            <input value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} />
          </Field>
          <Field label={t("vehicles.transmission")}>
            <select value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })}>
              {VEHICLE_TRANS.map((id) => (
                <option key={id || "none"} value={id}>
                  {id ? t(k(`vehicleTrans.${id}`)) : t("common.select")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vehicles.drivetrain")}>
            <select value={form.drivetrain} onChange={(e) => setForm({ ...form, drivetrain: e.target.value })}>
              {VEHICLE_DRIVE.map((id) => (
                <option key={id || "none"} value={id}>
                  {id || t("common.select")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vehicles.fuel")}>
            <select value={form.fuel} onChange={(e) => setForm({ ...form, fuel: e.target.value })}>
              {VEHICLE_FUELS.map((id) => (
                <option key={id || "none"} value={id}>
                  {id ? t(k(`vehicleFuel.${id}`)) : t("common.select")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vehicles.kms")}>
            <input value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />
          </Field>
          <Field label={t("vehicles.productionDate")}>
            <input value={form.productionDate} onChange={(e) => setForm({ ...form, productionDate: e.target.value })} placeholder="YYYY-MM" />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-300">{t("vehicles.sectionStatus")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("vehicles.status")}>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}>
              {VEHICLE_STATUSES.map((id) => (
                <option key={id} value={id}>
                  {t(k(`vehicle.${id}`))}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vehicles.condition")}>
            <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as VehicleCondition })}>
              {VEHICLE_CONDITIONS.map((id) => (
                <option key={id} value={id}>
                  {t(k(`vehicleCond.${id}`))}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("vehicles.owner")}>
            <SearchPicker
              value={form.customerId}
              selectedLabel={owner.label}
              selectedHint={owner.hint}
              placeholder={t("picker.searchCustomer")}
              allowEmpty
              emptyText={t("vehicles.none")}
              onChange={(id, option) => {
                setForm({ ...form, customerId: id });
                setOwner({ label: option?.label || "", hint: option?.hint || "" });
              }}
              search={async (query) => {
                const rows = await call(window.dms.customers.list(query, { limit: 25, lite: true }));
                return rows.map((c) => ({
                  id: c.id,
                  label: customerName(c),
                  hint: customerSearchHint(c),
                }));
              }}
            />
          </Field>
          <Field label={t("vehicles.unitNumber")}>
            <input value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} />
          </Field>
        </div>
      </section>

      {inventory ? (
        <section>
          <h3 className="mb-3 text-sm font-medium text-slate-300">{t("vehicles.sectionInventory")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("vehicles.stockNumber")}>
              <input value={form.stockNumber} onChange={(e) => setForm({ ...form, stockNumber: e.target.value })} placeholder="STK-0001" />
            </Field>
            <Field label={t("vehicles.acquired")}>
              <input value={form.acquiredAt} onChange={(e) => setForm({ ...form, acquiredAt: e.target.value })} placeholder="AAAA-MM-DD" />
            </Field>
            <Field label={t("vehicles.cost")}>
              <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </Field>
            <Field label={t("vehicles.price")}>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label={t("vehicles.lot")}>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label={t("vehicles.keyNumber")}>
              <input value={form.keyNumber} onChange={(e) => setForm({ ...form, keyNumber: e.target.value })} />
            </Field>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-300">{t("vehicles.sectionService")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("vehicles.insurance")}>
            <input value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} />
          </Field>
          <Field label={t("vehicles.policy")}>
            <input value={form.insurancePolicy} onChange={(e) => setForm({ ...form, insurancePolicy: e.target.value })} />
          </Field>
          <Field label={t("vehicles.licenseExpiry")}>
            <input value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} placeholder="AAAA-MM-DD" />
          </Field>
          <Field label={t("vehicles.inspectionDue")}>
            <input value={form.inspectionDue} onChange={(e) => setForm({ ...form, inspectionDue: e.target.value })} placeholder="AAAA-MM-DD" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("vehicles.alert")}>
              <input value={form.alert} onChange={(e) => setForm({ ...form, alert: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("common.notes")}>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
        </div>
      </section>
    </div>
  );
}
