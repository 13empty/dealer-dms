const DEFAULT_OPEN = 8 * 60;
const DEFAULT_CLOSE = 18 * 60;

function pad(n) {
  return String(n).padStart(2, "0");
}

function localDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function clock(minutes) {
  const n = Math.max(0, Math.min(24 * 60, Math.round(Number(minutes) || 0)));
  return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
}

function parseClock(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return fallback;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 23 || mm > 59) return fallback;
  return hh * 60 + mm;
}

function parseDays(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value || "");
  const days = [...new Set(raw.split(",").map((part) => Number(String(part).trim())).filter((n) => n >= 0 && n <= 6))];
  return days.length ? days.sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nthWeekday(year, month, weekday, n) {
  const date = new Date(year, month, 1);
  let seen = 0;
  while (date.getMonth() === month) {
    if (date.getDay() === weekday) {
      seen += 1;
      if (seen === n) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }
  return new Date(year, month, 1);
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function observed(date) {
  if (date.getDay() !== 0) return date;
  return addDays(date, 1);
}

function victoriaDay(year) {
  const date = new Date(year, 4, 24);
  while (date.getDay() !== 1) date.setDate(date.getDate() - 1);
  return date;
}

function albertaHolidays(year) {
  const goodFriday = addDays(easterSunday(year), -2);
  return [
    { id: "new-year", date: localDate(observed(new Date(year, 0, 1))), name: "Año Nuevo" },
    { id: "family", date: localDate(nthWeekday(year, 1, 1, 3)), name: "Family Day" },
    { id: "good-friday", date: localDate(goodFriday), name: "Viernes Santo" },
    { id: "victoria", date: localDate(victoriaDay(year)), name: "Victoria Day" },
    { id: "canada", date: localDate(observed(new Date(year, 6, 1))), name: "Canada Day" },
    { id: "labour", date: localDate(nthWeekday(year, 8, 1, 1)), name: "Labour Day" },
    { id: "thanksgiving", date: localDate(nthWeekday(year, 9, 1, 2)), name: "Thanksgiving" },
    { id: "remembrance", date: localDate(observed(new Date(year, 10, 11))), name: "Remembrance Day" },
    { id: "christmas", date: localDate(observed(new Date(year, 11, 25))), name: "Navidad" },
  ];
}

function readShopHolidays(raw) {
  try {
    const parsed = JSON.parse(String(raw || ""));
    if (!parsed || typeof parsed !== "object") return { removed: [], custom: [], edits: [] };
    return {
      removed: Array.isArray(parsed.removed) ? parsed.removed.map(String) : [],
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      edits: Array.isArray(parsed.edits) ? parsed.edits : [],
    };
  } catch {
    return { removed: [], custom: [], edits: [] };
  }
}

function validHolidayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function holidayList(settings, years, book = readShopHolidays(settings.shopHolidays)) {
  const removed = new Set(book.removed);
  const edits = new Map(book.edits.map((row) => [String(row.key), row]));
  const skip = new Set(
    String(settings.holidaySkip || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
  const observe = Number(settings.observeHolidays) !== 0;
  const list = [];
  for (const year of years) {
    for (const holiday of albertaHolidays(year)) {
      const key = `${holiday.id}:${year}`;
      if (removed.has(key)) continue;
      const edit = edits.get(key);
      const date = edit && edit.date ? String(edit.date) : holiday.date;
      const name = edit && edit.name ? String(edit.name) : holiday.name;
      const closed = edit && edit.closed != null ? Boolean(edit.closed) : observe && !skip.has(date) && !skip.has(holiday.date);
      list.push({ id: key, baseId: holiday.id, date, name, closed, custom: false, year });
    }
  }
  for (const custom of book.custom) {
    const date = String(custom.date || "");
    const name = String(custom.name || "").trim();
    if (!validHolidayDate(date) || !name) continue;
    list.push({
      id: String(custom.id || `custom-${date}-${name}`),
      baseId: "",
      date,
      name,
      closed: custom.closed !== false,
      custom: true,
      year: Number(date.slice(0, 4)),
    });
  }
  list.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return list;
}

function packHolidays(rows, observeHolidays = 1) {
  const observe = observeHolidays !== 0 && observeHolidays !== false && Number(observeHolidays) !== 0;
  const incoming = Array.isArray(rows) ? rows : [];
  for (const row of incoming) {
    if (!validHolidayDate(row && row.date) || !String((row && row.name) || "").trim()) {
      throw new Error("Cada feriado necesita una fecha real (AAAA-MM-DD) y un nombre");
    }
  }
  const clean = incoming.map((row) => ({
    id: String(row.id || ""),
    baseId: String(row.baseId || ""),
    date: String(row.date || "").trim(),
    name: String(row.name || "").trim(),
    closed: row.closed !== false,
    custom: Boolean(row.custom),
  }));
  const years = new Set([new Date().getFullYear(), new Date().getFullYear() + 1]);
  for (const row of clean) {
    if (row.custom) continue;
    const year = Number(String(row.id).split(":")[1]);
    if (year >= 2000 && year <= 2100) years.add(year);
  }
  const removed = [];
  const edits = [];
  const custom = [];
  const byId = new Map(clean.filter((row) => !row.custom).map((row) => [row.id, row]));
  for (const year of years) {
    for (const holiday of albertaHolidays(year)) {
      const key = `${holiday.id}:${year}`;
      const row = byId.get(key);
      if (!row) {
        removed.push(key);
        continue;
      }
      if (row.date !== holiday.date || row.name !== holiday.name || row.closed !== observe) {
        edits.push({ key, date: row.date, name: row.name, closed: row.closed });
      }
    }
  }
  for (const row of clean.filter((item) => item.custom)) {
    custom.push({ id: row.id || `custom-${row.date}`, date: row.date, name: row.name, closed: row.closed });
  }
  return JSON.stringify({ removed, edits, custom });
}

function fromSettings(settings = {}) {
  const openMin = parseClock(settings.openTime, DEFAULT_OPEN);
  let closeMin = parseClock(settings.closeTime, DEFAULT_CLOSE);
  if (closeMin <= openMin) closeMin = Math.min(24 * 60, openMin + 60);
  const now = new Date();
  const book = readShopHolidays(settings.shopHolidays);
  return {
    openMin,
    closeMin,
    openTime: clock(openMin),
    closeTime: clock(closeMin),
    openDays: parseDays(settings.openDays),
    observeHolidays: Number(settings.observeHolidays) !== 0,
    holidaySkip: String(settings.holidaySkip || ""),
    shopHolidays: String(settings.shopHolidays || ""),
    removedKeys: book.removed,
    editedKeys: book.edits.map((row) => String(row.key)),
    holidays: holidayList(settings, [now.getFullYear(), now.getFullYear() + 1], book),
  };
}

function closedHoliday(date, cal) {
  const key = localDate(date);
  const listed = (cal.holidays || []).filter((row) => row.date === key);
  if (listed.length) return listed.find((row) => row.closed) || null;
  if (!cal.observeHolidays) return null;
  const skip = new Set(
    String(cal.holidaySkip || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
  const found = albertaHolidays(date.getFullYear()).find((row) => row.date === key);
  if (!found) return null;
  const statKey = `${found.id}:${date.getFullYear()}`;
  if ((cal.removedKeys || []).includes(statKey) || (cal.editedKeys || []).includes(statKey)) return null;
  if (found && !skip.has(found.date)) return { ...found, closed: true };
  return null;
}

function slotReason(date, durationMin, cal) {
  const start = date.getHours() * 60 + date.getMinutes();
  const holiday = closedHoliday(date, cal);
  if (holiday) return `Feriado: ${holiday.name}. El taller está cerrado`;
  if (!cal.openDays.includes(date.getDay())) return "Ese día el taller está cerrado";
  if (start < cal.openMin || start + durationMin > cal.closeMin) {
    return `Fuera de horario (${cal.openTime}–${cal.closeTime})`;
  }
  return "";
}

module.exports = {
  DEFAULT_OPEN,
  DEFAULT_CLOSE,
  clock,
  parseClock,
  parseDays,
  localDate,
  albertaHolidays,
  packHolidays,
  fromSettings,
  slotReason,
};
