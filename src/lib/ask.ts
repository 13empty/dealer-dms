export function askConfirm(message: string) {
  const ok = window.confirm(message);
  try {
    window.focus();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  } catch {
    /* ignore */
  }
  return ok;
}
