export const SETTINGS_SECTIONS = ["taller", "operaciones", "apariencia", "actualizaciones", "respaldo"] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return Boolean(value && (SETTINGS_SECTIONS as readonly string[]).includes(value));
}
