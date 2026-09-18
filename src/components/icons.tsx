export type IconName =
  | "home"
  | "car"
  | "users"
  | "tag"
  | "box"
  | "wrench"
  | "list"
  | "ledger"
  | "settings"
  | "terminal"
  | "shield"
  | "search"
  | "logout"
  | "droplet"
  | "building"
  | "palette"
  | "download"
  | "archive";

const paths: Record<IconName, string> = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z",
  car: "M5 16h14M6.5 16l1.2-5.2A2 2 0 0 1 9.64 9h4.72a2 2 0 0 1 1.94 1.8L17.5 16M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 12h2m12 0h2",
  users: "M16 19v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v1m12.5-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6.5 9v-1a3 3 0 0 0-2.2-2.9M16.5 8.2a3 3 0 0 1 0 5.6",
  tag: "M12 4h7v7l-8.6 8.6a2 2 0 0 1-2.8 0L4.4 16.4a2 2 0 0 1 0-2.8L12 4Zm5 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  box: "M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Zm0 0 8 4.5 8-4.5M12 13v7",
  wrench: "M14.5 6.5a4 4 0 0 0-5.6 5.6L4 17v3h3l4.9-4.9a4 4 0 0 0 5.6-5.6L15 12l-3-3 2.5-2.5Z",
  list: "M8 6h12M8 12h12M8 18h8M4 6h.01M4 12h.01M4 18h.01",
  ledger: "M7 4h11a2 2 0 0 1 2 2v13H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm1 5h8M8 13h8M8 17h5",
  settings:
    "M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7ZM4.6 10.2l1.7-1L5.6 7.5l1.7-1.7 1.7.7 1-1.7h2.4l1 1.7 1.7-.7 1.7 1.7-.7 1.7 1.7 1v2.4l-1.7 1 .7 1.7-1.7 1.7-1.7-.7-1 1.7H9.9l-1-1.7-1.7.7-1.7-1.7.7-1.7-1.7-1v-2.4Z",
  terminal: "M5 8h14v10H5V8Zm3 3 2.5 2L8 15m5 0h4",
  shield: "M12 3 5 6v6c0 4.2 2.8 7.2 7 8.5 4.2-1.3 7-4.3 7-8.5V6l-7-3Z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 2-4-4",
  logout: "M10 6H6v12h4M10 12h9m-3-4 4 4-4 4",
  droplet: "M12 3.2S6 9.2 6 13.5a6 6 0 0 0 12 0C18 9.2 12 3.2 12 3.2Z",
  building: "M5 21V4h8v4h6v13H5Zm2-2h2v-4H7v4Zm4 0h2v-4h-2v4Zm4 0h2v-4h-2v4ZM7 11h2V7H7v4Zm4 0h2V7h-2v4Z",
  palette: "M12 4a8 8 0 1 0 .3 16H14a2 2 0 0 0 0-4h-1.2a1.6 1.6 0 1 1 0-3.2A8 8 0 0 0 20 8.2 8 8 0 0 0 12 4Zm-4 6.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm3-2.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm3.4 1a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2ZM8.4 14.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z",
  download: "M12 4v11m-4-4 4 4 4-4M5 19h14",
  archive: "M4 6h16v3H4V6Zm2 3v11h12V9M9 14h6",
};

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

export function initials(name?: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "U";
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || "")).toUpperCase();
}
