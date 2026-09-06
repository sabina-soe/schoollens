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

const YANGON_MARKERS = ["ရန်ကုန်", "yangon", "yankin", "ရန်ကင်း"];
const MANDALAY_MARKERS = ["မန္တလေး", "mandalay"];

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

function cityOfAddress(address: string): "yangon" | "mandalay" | "other" {
  const lower = address.toLowerCase();
  if (YANGON_MARKERS.some((marker) => address.includes(marker) || lower.includes(marker))) {
    return "yangon";
  }
  if (MANDALAY_MARKERS.some((marker) => address.includes(marker) || lower.includes(marker))) {
    return "mandalay";
  }
  return "other";
}

function cityOfSchool(city?: string | null): "yangon" | "mandalay" | "other" {
  const lower = (city ?? "").toLowerCase();
  if (lower.includes("yangon") || lower.includes("yankin")) return "yangon";
  if (lower.includes("mandalay")) return "mandalay";
  return "other";
}

function listingMatches(
  listing: MoeListing,
  name: string,
  aliases: string[],
): boolean {
  const schoolCore = coreName(name);
  const listingCore = coreName(listing.name);
  if (schoolCore && listingCore && schoolCore === listingCore) return true;

  const listingAcronyms = new Set(acronyms(listing.name));
  const schoolAcronyms = acronyms(name);
  if (schoolAcronyms.some((token) => listingAcronyms.has(token))) return true;
  if (aliases.some((token) => listingAcronyms.has(token))) return true;
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
  if (city === "yangon") return "Yangon";
  if (city === "mandalay") return "Mandalay";
  return null;
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
