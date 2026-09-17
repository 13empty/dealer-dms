function nhtsaText(value) {
  const text = String(value || "").trim();
  if (!text || /^0+$/.test(text) || /^not applicable$/i.test(text) || /^n\/?a$/i.test(text)) return "";
  return text;
}

function includesAny(text, needles) {
  const hay = String(text || "").toLowerCase();
  return needles.some((item) => hay.includes(item));
}

function mapFuel(raw) {
  const text = nhtsaText(raw);
  if (!text) return "";
  if (includesAny(text, ["diesel"])) return "diesel";
  if (includesAny(text, ["electric"])) return "electrico";
  if (includesAny(text, ["hybrid"])) return "hibrido";
  if (includesAny(text, ["lpg", "propane", "liquefied petroleum"])) return "glp";
  if (includesAny(text, ["gas"])) return "gasolina";
  return "";
}

function mapTrans(raw) {
  const text = nhtsaText(raw);
  if (!text) return "";
  if (includesAny(text, ["cvt", "continuously variable"])) return "cvt";
  if (includesAny(text, ["dual-clutch", "dct", "dual clutch"])) return "dct";
  if (includesAny(text, ["manual"])) return "manual";
  if (includesAny(text, ["automatic"])) return "automatico";
  return "";
}

function mapDrive(raw) {
  const text = nhtsaText(raw);
  if (!text) return "";
  if (includesAny(text, ["4wd", "4x4", "four-wheel", "four wheel"])) return "4x4";
  if (includesAny(text, ["awd", "all-wheel", "all wheel"])) return "AWD";
  if (includesAny(text, ["rwd", "rear-wheel", "rear wheel"])) return "RWD";
  if (includesAny(text, ["fwd", "front-wheel", "front wheel"])) return "FWD";
  return "";
}

function mapBody(raw) {
  const text = nhtsaText(raw);
  if (!text) return "";
  if (includesAny(text, ["pickup", "truck"])) return "pickup";
  if (includesAny(text, ["sport utility", "suv", "mpv", "crossover"])) return "suv";
  if (includesAny(text, ["minivan", "van"])) return "van";
  if (includesAny(text, ["hatch"])) return "hatch";
  if (includesAny(text, ["coupe"])) return "coupe";
  if (includesAny(text, ["wagon", "estate"])) return "wagon";
  if (includesAny(text, ["moto", "cycle"])) return "moto";
  if (includesAny(text, ["sedan", "saloon"])) return "sedan";
  return "otro";
}

function mapEngine(row) {
  const litersRaw = nhtsaText(row.DisplacementL);
  const cyl = nhtsaText(row.EngineCylinders);
  const hp = nhtsaText(row.EngineHP);
  const config = nhtsaText(row.EngineConfiguration);
  const parts = [];
  const liters = Number(litersRaw);
  if (Number.isFinite(liters) && liters > 0) parts.push(`${Math.round(liters * 10) / 10}L`);
  else if (litersRaw) parts.push(`${litersRaw}L`);
  if (cyl) parts.push(`${cyl} cyl`);
  if (config) parts.push(config);
  if (hp) parts.push(`${hp} hp`);
  return parts.join(" ");
}

function mapNhtsaRow(row, vin) {
  const year = Number(nhtsaText(row.ModelYear)) || 0;
  return {
    vin,
    make: nhtsaText(row.Make),
    model: nhtsaText(row.Model),
    year: year ? String(year) : "",
    trim: nhtsaText(row.Trim) || nhtsaText(row.Series),
    engine: mapEngine(row || {}),
    doors: nhtsaText(row.Doors),
    bodyStyle: mapBody(row.BodyClass),
    fuel: mapFuel(row.FuelTypePrimary),
    transmission: mapTrans(row.TransmissionStyle),
    drivetrain: mapDrive(row.DriveType),
  };
}

async function decodeVin(raw) {
  const vin = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
  if (!vin) throw new Error("Escribe un VIN para decodificarlo");
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  let res;
  try {
    res = await fetch(url, { signal: ac.signal });
  } catch {
    throw new Error("No hay conexión para leer el VIN");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error("No se pudo leer ese VIN");
  const json = await res.json();
  const row = Array.isArray(json?.Results) ? json.Results[0] : null;
  if (!row) throw new Error("No se pudo leer ese VIN");
  const decoded = mapNhtsaRow(row, vin);
  if (!decoded.make && !decoded.model && !decoded.year) {
    throw new Error("Ese VIN no trajo marca ni modelo");
  }
  return decoded;
}

module.exports = { decodeVin, mapNhtsaRow };
