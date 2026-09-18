import { useState, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`page ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-ink-600/80 pb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar mb-4 flex flex-wrap items-end gap-3">{children}</div>;
}

export function Badge({ status, label }: { status: string; label: string }) {
  const cls =
    {
      en_stock: "bg-emerald-500/15 text-emerald-300",
      cerrada: "bg-emerald-500/15 text-emerald-300",
      lista: "bg-emerald-500/15 text-emerald-300",
      pagada: "bg-gold-400/20 text-gold-400",
      reservado: "bg-amber-500/15 text-amber-300",
      en_taller: "bg-amber-500/15 text-amber-300",
      financiado: "bg-amber-500/15 text-amber-300",
      vendido: "bg-sky-500/15 text-sky-300",
      entregada: "bg-sky-500/15 text-sky-300",
      admin: "bg-gold-400/20 text-gold-400",
      master: "bg-sky-500/15 text-sky-300",
      gerente: "bg-violet-500/15 text-violet-300",
      empleado: "bg-slate-500/20 text-slate-300",
      tecnico: "bg-amber-500/15 text-amber-300",
      asesor: "bg-sky-500/15 text-sky-300",
      partes: "bg-violet-500/15 text-violet-300",
      ventas: "bg-emerald-500/15 text-emerald-300",
      caja: "bg-gold-400/20 text-gold-400",
      otro: "bg-slate-500/20 text-slate-300",
      particular: "bg-slate-500/20 text-slate-300",
      empresa: "bg-sky-500/15 text-sky-300",
      flotilla: "bg-violet-500/15 text-violet-300",
      seguro: "bg-amber-500/15 text-amber-300",
      mayoreo: "bg-gold-400/20 text-gold-400",
      activo: "bg-emerald-500/15 text-emerald-300",
      inactivo: "bg-slate-500/20 text-slate-300",
      bloqueado: "bg-red-500/15 text-red-300",
      autorizacion: "bg-amber-500/15 text-amber-300",
      espera_partes: "bg-violet-500/15 text-violet-300",
      en_espera: "bg-orange-500/15 text-orange-300",
      presupuesto: "bg-sky-500/15 text-sky-300",
      urgente: "bg-red-500/15 text-red-300",
      lavado: "bg-cyan-500/15 text-cyan-300",
      consignacion: "bg-violet-500/15 text-violet-300",
      nuevo: "bg-emerald-500/15 text-emerald-300",
      certificado: "bg-sky-500/15 text-sky-300",
      descontinuado: "bg-slate-500/20 text-slate-300",
      cliente: "bg-gold-400/20 text-gold-400",
      garantia: "bg-sky-500/15 text-sky-300",
      interno: "bg-violet-500/15 text-violet-300",
      sublet: "bg-amber-500/15 text-amber-300",
    }[status] || "bg-slate-500/20 text-slate-300";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-gold-400 text-onacc shadow-sm shadow-black/20 hover:bg-gold-500",
    ghost: "border border-ink-600 bg-ink-800 text-slate-100 hover:bg-ink-700",
    danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`rounded-md px-3 py-2 text-sm font-medium transition ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-ink-600 bg-ink-800/90 shadow-sm shadow-black/20 ${className}`}>{children}</div>;
}

export function Modal({
  title,
  children,
  footer,
  onClose,
  wide,
  xl,
  overflowVisible,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
  xl?: boolean;
  overflowVisible?: boolean;
}) {
  const { t } = useI18n();
  const maxW = xl ? "max-w-6xl" : wide ? "max-w-4xl" : "max-w-xl";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/80 p-4 lg:items-center">
      <div className={`my-2 flex w-full max-h-[92vh] flex-col rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-2xl ${maxW}`}>
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-400 hover:bg-ink-700 hover:text-white">
            {t("common.close")}
          </button>
        </div>
        <div className={`min-h-0 flex-1 pr-1 ${overflowVisible ? "overflow-visible" : "overflow-auto"}`}>{children}</div>
        {footer ? <div className="mt-4 flex shrink-0 justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function FormSection({
  title,
  hint,
  extra,
  children,
}: {
  title: string;
  hint?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ink-600 bg-ink-900/50 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-ink-600 px-6 py-12 text-center text-slate-400">{children}</div>;
}

export function GuidCopy({ value }: { value?: string | null }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const guid = String(value || "").trim();
  if (!guid) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(guid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="uppercase tracking-wide text-slate-500">{t("common.guid")}</span>
      <code className="break-all font-mono text-slate-300 print:text-neutral-700">{guid}</code>
      <button type="button" className="no-print text-gold-400 hover:underline" onClick={() => void copy()}>
        {copied ? t("common.copied") : t("common.copy")}
      </button>
    </div>
  );
}
