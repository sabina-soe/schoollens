import catalog from "../data/moe-approve-list.json";

export const MOE_SOURCE_NAME =
  "MoE approved list of private international-curriculum schools";

export const MOE_SOURCE_DATE = catalog.source_date;

export type MoeListing = {
  seq: string | null;
  name: string;
  address: string;
  period: string;
};

export type MoeLookup = {
  status: "Registered" | "Not listed";
  matches: MoeListing[];
};

const CITY_MARKERS: Array<{ label: string; markers: string[] }> = [
  { label: "Yangon", markers: ["ရန်ကုန်", "yangon", "yankin", "ရန်ကင်း"] },
  { label: "Mandalay", markers: ["မန္တလေး", "mandalay"] },
  { label: "Taunggyi", markers: ["တောင်ကြီး", "taunggyi"] },
  { label: "Myitkyina", markers: ["မြစ်ကြီးနား", "myitkyina"] },
  { label: "Myeik", markers: ["မြိတ်", "myeik"] },
  { label: "Lashio", markers: ["လားရှိုး", "lashio"] },
  { label: "Naypyidaw", markers: ["နေပြည်တော်", "naypyidaw", "nay pyi taw", "naypyitaw"] },
  { label: "Monywa", markers: ["မုံရွာ", "monywa"] },
  { label: "Sagaing", markers: ["စစ်ကိုင်း", "sagaing"] },
  { label: "Bago", markers: ["ပဲခူး", "bago"] },
  { label: "Hpa-an", markers: ["ဘားအံ", "hpa-an", "hpaan"] },
  { label: "Dawei", markers: ["ထားဝယ်", "dawei"] },
];

export function normalizeMoeName(value: string): string {
  return value
    .replace(/^example:\s*/i, "")
    .replace(/\u00a0/g, " ")
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9+&() ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coreName(value: string): string {
  return normalizeMoeName(value.replace(/\([^)]*\)/g, " "));
}

function acronyms(value: string): string[] {
  return [...value.matchAll(/\(([^)]+)\)/g)]
    .map((match) => normalizeMoeName(match[1]))
    .filter((token) => token.length >= 3);
}

function aliasTokens(aliases?: string | null): string[] {
  if (!aliases) return [];
  return aliases
    .split(",")
    .map((part) => normalizeMoeName(part))
    .filter((token) => token.length >= 3);
}

function cityOfAddress(address: string): string {
  const lower = address.toLowerCase();
  for (const city of CITY_MARKERS) {
    if (city.markers.some((marker) => address.includes(marker) || lower.includes(marker))) {
      return city.label.toLowerCase();
    }
  }
  return "other";
}

function cityOfSchool(city?: string | null): string {
  const lower = (city ?? "").toLowerCase();
  for (const row of CITY_MARKERS) {
    if (row.markers.some((marker) => lower.includes(marker))) return row.label.toLowerCase();
  }
  return "other";
}

function listingBrandKeys(listing: MoeListing): string[] {
  const keys = new Set<string>(acronyms(listing.name));
  const core = coreName(listing.name);
  if (core) keys.add(core);
  const firstWord = listing.name.trim().split(/\s+/)[0] ?? "";
  if (/^[A-Z]{3,8}$/.test(firstWord)) {
    keys.add(normalizeMoeName(firstWord));
  }
  return [...keys];
}

function listingMatches(
  listing: MoeListing,
  name: string,
  aliases: string[],
): boolean {
  const schoolCore = coreName(name);
  const listingCore = coreName(listing.name);
  if (schoolCore && listingCore && schoolCore === listingCore) return true;

  const listingKeys = new Set(listingBrandKeys(listing));
  const schoolAcronyms = acronyms(name);
  if (schoolAcronyms.some((token) => listingKeys.has(token))) return true;
  if (aliases.some((token) => listingKeys.has(token))) return true;
  if (
    schoolCore &&
    [...listingKeys].some(
      (key) =>
        key.length >= 3 &&
        (schoolCore === key || schoolCore.startsWith(`${key} `)),
    )
  ) {
    return true;
  }
  return false;
}

export function lookupMoeRegistration(opts: {
  name: string;
  aliases?: string | null;
  city?: string | null;
}): MoeLookup {
  const aliases = aliasTokens(opts.aliases);
  const matches = (catalog.listings as MoeListing[]).filter((listing) =>
    listingMatches(listing, opts.name, aliases),
  );
  const preferred = cityOfSchool(opts.city);
  const used =
    preferred === "other"
      ? matches
      : matches.filter((listing) => cityOfAddress(listing.address) === preferred);

  return {
    status: used.length > 0 ? "Registered" : "Not listed",
    matches: used,
  };
}

export function moeListings(): MoeListing[] {
  return catalog.listings as MoeListing[];
}

export function cityLabelFromAddress(address: string): string | null {
  const city = cityOfAddress(address);
  if (city === "other") return null;
  const match = CITY_MARKERS.find((row) => row.label.toLowerCase() === city);
  return match?.label ?? null;
}

export function addressFromLookup(lookup: MoeLookup): string | null {
  const address = lookup.matches.map((row) => row.address).find(Boolean);
  return address || null;
}

export function aliasesFromMoeName(name: string): string | null {
  const tokens = new Set<string>(acronyms(name));
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  if (/^[A-Z]{3,}$/.test(firstWord)) {
    tokens.add(firstWord);
  }
  return tokens.size > 0 ? [...tokens].join(", ") : null;
}

export function moeEvidenceNote(lookup: MoeLookup): string {
  if (lookup.status === "Not listed") {
    return `Not found on the MoE approved list of private schools teaching the international curriculum (${catalog.source_file}, ${catalog.source_date}).`;
  }
  return lookup.matches
    .map((listing) => {
      const period = listing.period ? ` Approval period: ${listing.period}.` : "";
      const address = listing.address ? `, ${listing.address}` : "";
      return `Listed as "${listing.name}"${address}.${period}`;
    })
    .join(" ");
}
