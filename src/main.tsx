import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { I18nProvider } from "./lib/i18n";
import { PrefsProvider } from "./lib/prefs-context";
import { bootPrefs } from "./lib/prefs";
import "./index.css";

bootPrefs();

createRoot(document.getElementById("root")!).render(
  <PrefsProvider>
    <I18nProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </I18nProvider>
  </PrefsProvider>
);
