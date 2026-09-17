import { useState } from "react";
import { AppearanceStrip } from "../components/Appearance";
import { BrandMark } from "../components/BrandMark";
import { Button, Card, ErrorText, Field } from "../components/ui";
import { useAuth } from "../lib/auth";
import { LanguageSelect, useI18n } from "../lib/i18n";

export default function LoginGate() {
  const { needsSetup, login, setup } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (needsSetup) await setup(name, username, password);
      else await login(username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_20%_10%,rgba(232,184,109,0.16),transparent_55%)]" />
      <Card className="relative w-full max-w-md p-7">
        <div className="mb-5 flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-gold-400">Dealer DMS</div>
            <div className="text-sm text-slate-400">{t("nav.brand")}</div>
          </div>
        </div>
        <h1 className="text-2xl font-semibold">{needsSetup ? t("login.setupTitle") : t("login.loginTitle")}</h1>
        <p className="mt-2 text-sm text-slate-400">{needsSetup ? t("login.setupHint") : t("login.loginHint")}</p>
        <form
          className="mt-5 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {needsSetup ? (
            <Field label={t("login.name")}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("login.namePlaceholder")} />
            </Field>
          ) : null}
          <Field label={t("login.username")}>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="off" />
          </Field>
          <Field label={t("login.password")}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <LanguageSelect />
          <AppearanceStrip />
          <ErrorText error={error} />
          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy ? t("login.busy") : needsSetup ? t("login.submitSetup") : t("login.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
