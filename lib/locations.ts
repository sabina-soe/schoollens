export type SchoolLocation = {
  name: string;
  aliases?: string;
  city?: string;
  address?: string;
  township?: string;
  latitude?: string;
  longitude?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const lower = Object.keys(record).find(
      (candidate) => candidate.toLowerCase().replace(/[^a-z0-9]+/g, "_") === key,
    );
    if (!lower) continue;
    const value = record[lower];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function locationRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of ["schools", "locations", "items", "rows", "data"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  if (current || row.length) {
    row.push(current.trim());
    if (row.some((cell) => cell)) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  );
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = cells[index] ?? "";
    });
    return record;
  });
}

function fromRecord(raw: unknown): SchoolLocation | null {
  const record = asRecord(raw);
  if (!record) return null;
  const name = firstString(record, [
    "name",
    "school",
    "school_name",
    "official_name",
    "title",
  ]);
  if (!name) return null;
  const aliases = firstString(record, ["aliases", "alias", "aka", "short_name"]);
  const city = firstString(record, ["city", "town", "location_city"]);
  const township = firstString(record, ["township", "town_ship", "quarter"]);
  const address = firstString(record, [
    "address",
    "location",
    "street",
    "full_address",
    "school_address",
  ]);
  const composedAddress = (() => {
    if (!address && !township) return undefined;
    if (!address) return township;
    if (
      township &&
      township !== city &&
      !address.toLowerCase().includes(township.toLowerCase())
    ) {
      return `${address}, ${township}`;
    }
    return address;
  })();
  return {
    name,
    aliases,
    city: city ?? township,
    address: composedAddress,
    township,
    latitude: firstString(record, ["latitude", "lat"]),
    longitude: firstString(record, ["longitude", "lng", "lon"]),
  };
}

export function locationsFromPayload(payload: unknown): SchoolLocation[] {
  return locationRows(payload)
    .map(fromRecord)
    .filter((row): row is SchoolLocation => row != null);
}

export function locationsFromCsv(text: string): SchoolLocation[] {
  return locationsFromPayload(parseCsv(text));
}

function key(name: string, aliases?: string): string {
  return [name, aliases]
    .filter(Boolean)
    .join(" ")
    .replace(/^example:\s*/i, "")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CAMPUS_TOKENS = new Set([
  "yangon",
  "mandalay",
  "taunggyi",
  "myitkyina",
  "lashio",
  "myeik",
  "naypyidaw",
  "naypyitaw",
  "tachileik",
  "campus",
]);

function namesMatch(left: string, right: string): boolean {
  if (left === right) return true;
  const [longer, shorter] =
    left.length >= right.length ? [left, right] : [right, left];
  if (!longer.includes(shorter)) return false;
  const extra = longer
    .split(" ")
    .filter((token) => !shorter.split(" ").includes(token));
  return !extra.some((token) => CAMPUS_TOKENS.has(token));
}

export function lookupLocation(
  locations: SchoolLocation[],
  opts: { name: string; aliases?: string | null },
): SchoolLocation | null {
  const school = key(opts.name, opts.aliases ?? undefined);
  if (!school) return null;
  return (
    locations.find((row) => namesMatch(key(row.name, row.aliases), school)) ??
    null
  );
}
