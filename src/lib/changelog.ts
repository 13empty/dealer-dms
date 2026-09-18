export type ChangelogRelease = {
  version: string;
  items: string[];
};

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "1.0.10",
    items: ["changelog.110.locales"],
  },
  {
    version: "1.0.9",
    items: ["changelog.109.menu"],
  },
  {
    version: "1.0.8",
    items: ["changelog.108.menu"],
  },
  {
    version: "1.0.7",
    items: ["changelog.107.archive"],
  },
  {
    version: "1.0.6",
    items: ["changelog.106.click", "changelog.106.popup"],
  },
  {
    version: "1.0.5",
    items: ["changelog.105.types", "changelog.105.queue", "changelog.105.ro"],
  },
  {
    version: "1.0.4",
    items: ["changelog.104.menu", "changelog.104.version"],
  },
  {
    version: "1.0.3",
    items: ["changelog.103.print"],
  },
  {
    version: "1.0.2",
    items: ["changelog.102.themes"],
  },
  {
    version: "1.0.1",
    items: ["changelog.101.updates"],
  },
  {
    version: "1.0.0",
    items: ["changelog.100.first"],
  },
];

const SEEN_KEY = "dms.changelog.seen";

export function changelogSeen() {
  try {
    return String(localStorage.getItem(SEEN_KEY) || "");
  } catch {
    return "";
  }
}

export function markChangelogSeen(version: string) {
  const value = String(version || "").trim();
  if (!value) return;
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    /* ignore */
  }
}

export function shouldShowChangelog(version: string) {
  const current = String(version || "").trim();
  if (!current) return false;
  return changelogSeen() !== current;
}

export function releaseFor(version: string) {
  const current = String(version || "").trim();
  return CHANGELOG.find((item) => item.version === current) || null;
}
