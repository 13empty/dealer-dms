export type ChangelogRelease = {
  version: string;
  items: string[];
};

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "1.0.42",
    items: ["changelog.142.board"],
  },
  {
    version: "1.0.41",
    items: ["changelog.141.safe"],
  },
  {
    version: "1.0.40",
    items: ["changelog.140.agenda"],
  },
  {
    version: "1.0.39",
    items: ["changelog.139.guard"],
  },
  {
    version: "1.0.38",
    items: ["changelog.138.reports"],
  },
  {
    version: "1.0.37",
    items: ["changelog.137.reports"],
  },
  {
    version: "1.0.36",
    items: ["changelog.136.reports"],
  },
  {
    version: "1.0.35",
    items: ["changelog.135.dates"],
  },
  {
    version: "1.0.34",
    items: ["changelog.134.names"],
  },
  {
    version: "1.0.33",
    items: ["changelog.133.shortcutPick"],
  },
  {
    version: "1.0.32",
    items: ["changelog.132.shortcuts"],
  },
  {
    version: "1.0.31",
    items: ["changelog.131.quick"],
  },
  {
    version: "1.0.30",
    items: ["changelog.130.print"],
  },
  {
    version: "1.0.29",
    items: ["changelog.129.vehicle"],
  },
  {
    version: "1.0.28",
    items: ["changelog.128.focus"],
  },
  {
    version: "1.0.27",
    items: ["changelog.127.focus"],
  },
  {
    version: "1.0.26",
    items: ["changelog.126.delete"],
  },
  {
    version: "1.0.25",
    items: ["changelog.125.estimates"],
  },
  {
    version: "1.0.24",
    items: ["changelog.124.stock", "changelog.124.delete", "changelog.124.speed"],
  },
  {
    version: "1.0.23",
    items: ["changelog.123.closed"],
  },
  {
    version: "1.0.22",
    items: ["changelog.122.dash", "changelog.122.delete"],
  },
  {
    version: "1.0.21",
    items: ["changelog.121.notice"],
  },
  {
    version: "1.0.20",
    items: ["changelog.120.paid"],
  },
  {
    version: "1.0.19",
    items: ["changelog.119.lines"],
  },
  {
    version: "1.0.18",
    items: ["changelog.118.line"],
  },
  {
    version: "1.0.17",
    items: [
      "changelog.117.click",
      "changelog.117.delete",
      "changelog.117.numbers",
      "changelog.117.print",
      "changelog.117.parts",
      "changelog.117.tax",
    ],
  },
  {
    version: "1.0.16",
    items: ["changelog.116.ro"],
  },
  {
    version: "1.0.15",
    items: ["changelog.115.print"],
  },
  {
    version: "1.0.14",
    items: ["changelog.114.sidebar", "changelog.114.wash"],
  },
  {
    version: "1.0.13",
    items: ["changelog.113.settings", "changelog.113.lang"],
  },
  {
    version: "1.0.12",
    items: ["changelog.112.name"],
  },
  {
    version: "1.0.11",
    items: ["changelog.111.logo", "changelog.111.notify"],
  },
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
