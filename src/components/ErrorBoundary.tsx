import { Component, type ErrorInfo, type ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { Button } from "./ui";

type Props = { children: ReactNode };
type State = { error: Error | null };

function Fallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="page">
      <h1 className="text-xl font-semibold text-white">{t("app.crashTitle")}</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-400">{t("app.crashHint")}</p>
      <pre className="mt-4 max-w-xl overflow-auto rounded-lg bg-ink-900 p-3 text-xs text-red-300">{error.message}</pre>
      <Button className="mt-4" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <Fallback error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
