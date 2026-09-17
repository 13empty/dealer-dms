import { useState } from "react";
import { Button, Field } from "./ui";
import { call } from "../lib/format";
import type { Translate } from "../lib/i18n";
import type { VinDecoded } from "../vite-env";

export function applyVinDecoded<T extends { vin: string; make?: string; model?: string; year?: string; trim?: string }>(
  form: T,
  decoded: VinDecoded
): T {
  return {
    ...form,
    vin: decoded.vin || form.vin,
    make: decoded.make || form.make,
    model: decoded.model || form.model,
    year: decoded.year || form.year,
    ...("trim" in form ? { trim: decoded.trim || form.trim } : {}),
    ...("engine" in form ? { engine: decoded.engine || (form as { engine?: string }).engine } : {}),
    ...("doors" in form ? { doors: decoded.doors || (form as { doors?: string }).doors } : {}),
    ...("bodyStyle" in form ? { bodyStyle: decoded.bodyStyle || (form as { bodyStyle?: string }).bodyStyle } : {}),
    ...("fuel" in form ? { fuel: decoded.fuel || (form as { fuel?: string }).fuel } : {}),
    ...("transmission" in form ? { transmission: decoded.transmission || (form as { transmission?: string }).transmission } : {}),
    ...("drivetrain" in form ? { drivetrain: decoded.drivetrain || (form as { drivetrain?: string }).drivetrain } : {}),
  };
}

export function VinField({
  value,
  onChange,
  apply,
  t,
}: {
  value: string;
  onChange: (vin: string) => void;
  apply: (decoded: VinDecoded) => void;
  t: Translate;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decode() {
    try {
      setBusy(true);
      setError(null);
      setMsg(null);
      const decoded = await call(window.dms.vehicles.decodeVin(value));
      apply(decoded);
      setMsg(t("vehicles.decodeVinOk"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label="VIN">
      <div className="flex gap-2">
        <input className="min-w-0 flex-1" value={value} onChange={(e) => onChange(e.target.value)} />
        <Button type="button" variant="ghost" className="shrink-0" disabled={busy || !value.trim()} onClick={() => void decode()}>
          {busy ? t("common.loading") : t("vehicles.decodeVin")}
        </Button>
      </div>
      {msg ? <p className="mt-1 text-xs text-emerald-300">{msg}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </Field>
  );
}
