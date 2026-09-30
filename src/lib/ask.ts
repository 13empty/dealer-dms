function wakeWindow() {
  try {
    window.focus();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.dms?.app?.refocus();
  } catch {
    /* ignore */
  }
}

export function askConfirm(message: string) {
  const ok = window.confirm(message);
  wakeWindow();
  window.setTimeout(wakeWindow, 80);
  return ok;
}
