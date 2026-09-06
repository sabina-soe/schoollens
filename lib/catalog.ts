import checklist from "../data/school-profiles-checklist.json";
import doris from "../data/doris-myanmar-schools.json";
import locationFile from "../data/school-locations.json";
import seed from "../seed_data_template.json";
import {
  computeConfidence,
  scoreClaimsByFieldAndBand,
  type Claim,
  type ConfidenceResult,
  type SourceType,
} from "@/lib/confidence";
import { LOCKED_FIELDS, displaySchoolName } from "@/lib/fields";
import {
  MOE_SOURCE_DATE,
  MOE_SOURCE_NAME,
  addressFromLookup,
  aliasesFromMoeName,
  cityLabelFromAddress,
  lookupMoeRegistration,
  moeEvidenceNote,
} from "@/lib/moe-list";
import { locationsFromPayload, lookupLocation } from "@/lib/locations";
import {
  CHECKLIST_SOURCE_NAME,
  CHECKLIST_SOURCE_RELIABILITY,
  CHECKLIST_SOURCE_TYPE,
  DORIS_SOURCE_NAME,
  DORIS_SOURCE_RELIABILITY,
  DORIS_SOURCE_TYPE,
  schoolsFromChecklist,
  schoolsFromDoris,
} from "@/lib/scraper-import";

export type CatalogSchool = {
  id: number;
  name: string;
  displayName: string;
  aliases: string | null;
  city: string | null;
  address: string | null;
  curriculumHint: string | null;
  isSynthetic: boolean;
  notes: string | null;
};

export type CatalogClaim = {
  id: number;
  school_id: number;
  field_name: string;
  grade_band: string | null;
  value_text: string;
  value_numeric: number | null;
  status: string;
  source_date: string;
  evidence_note: string | null;
  source_name: string;
  source_type: SourceType;
  base_reliability: number;
};

export type ScoredField = {
  fieldName: string;
  gradeBand: string | null;
  valueText: string;
  result: ConfidenceResult;
  claims: CatalogClaim[];
};

type SeedSource = {
  name: string;
  type: SourceType;
  base_reliability?: number;
};

type SeedClaim = {
  field_name: string;
  grade_band?: string | null;
  value_text: string;
  value_numeric?: number | null;
  source_name: string;
  status?: string;
  source_date: string;
  evidence_note?: string;
};

type SeedSchool = {
  name: string;
  aliases?: string;
  city?: string;
  address?: string;
  curriculum_hint?: string;
  is_synthetic: boolean;
  notes?: string;
  claims?: SeedClaim[];
};

function sourcesByName() {
  const map = new Map<string, SeedSource>();
  for (const source of (seed.sources ?? []) as SeedSource[]) {
    map.set(source.name, source);
  }
  map.set(MOE_SOURCE_NAME, {
    name: MOE_SOURCE_NAME,
    type: "official",
    base_reliability: 0.95,
  });
  map.set(CHECKLIST_SOURCE_NAME, {
    name: CHECKLIST_SOURCE_NAME,
    type: CHECKLIST_SOURCE_TYPE,
    base_reliability: CHECKLIST_SOURCE_RELIABILITY,
  });
  map.set(DORIS_SOURCE_NAME, {
    name: DORIS_SOURCE_NAME,
    type: DORIS_SOURCE_TYPE,
    base_reliability: DORIS_SOURCE_RELIABILITY,
  });
  return map;
}

function schoolKey(name: string, aliases?: string | null): string {
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

function seedSchools(): SeedSchool[] {
  return ((seed.schools ?? []) as SeedSchool[]).map((school) => ({
    ...school,
    is_synthetic: school.is_synthetic,
  }));
}

function applyPlaces(rows: SeedSchool[]): SeedSchool[] {
  const locations = locationsFromPayload(locationFile);
  return rows.map((school) => {
    const location = lookupLocation(locations, {
      name: school.name,
      aliases: school.aliases,
    });
    const moe = lookupMoeRegistration({
      name: school.name,
      aliases: school.aliases ?? null,
      city: location?.city ?? school.city ?? null,
    });
    const moeAddress = addressFromLookup(moe);
    return {
      ...school,
      aliases: school.aliases ?? aliasesFromMoeName(school.name) ?? undefined,
      city:
        location?.city ??
        school.city ??
        cityLabelFromAddress(moeAddress ?? "") ??
        undefined,
      address: location?.address ?? school.address ?? moeAddress ?? undefined,
    };
  });
}

function importedAsSeed(
  schools: ReturnType<typeof schoolsFromChecklist>,
): SeedSchool[] {
  return schools.map((school) => ({
    name: school.name,
    aliases: school.aliases,
    city: school.city,
    address: school.address,
    curriculum_hint: school.curriculum_hint,
    is_synthetic: school.is_synthetic,
    notes: school.notes,
    claims: school.claims,
  }));
}

function checklistAsSeed(): SeedSchool[] {
  return importedAsSeed(schoolsFromChecklist(checklist));
}

function dorisAsSeed(): SeedSchool[] {
  return importedAsSeed(schoolsFromDoris(doris));
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
  // Do not merge "ILBC International School" with "ILBC International School Mandalay".
  return !extra.some((token) => CAMPUS_TOKENS.has(token));
}

function mergeSeedClaims(base: SeedSchool[], extras: SeedSchool[]): SeedSchool[] {
  const extraByKey = extras.map((school) => ({
    key: schoolKey(school.name, school.aliases),
    school,
  }));
  return base.map((school) => {
    const key = schoolKey(school.name, school.aliases);
    const match = extraByKey.find((row) => namesMatch(row.key, key));
    if (!match) return school;
    return {
      ...school,
      aliases: school.aliases ?? match.school.aliases,
      city: school.city ?? match.school.city,
      address: school.address ?? match.school.address,
      curriculum_hint: school.curriculum_hint ?? match.school.curriculum_hint,
      notes: school.notes ?? match.school.notes,
      claims: [...(school.claims ?? []), ...(match.school.claims ?? [])],
    };
  });
}

/** Merge matching extras onto base, then append extras that are not already listed. */
function mergeAndAppend(base: SeedSchool[], extras: SeedSchool[]): SeedSchool[] {
  const used = new Set<number>();
  const merged = base.map((school) => {
    const key = schoolKey(school.name, school.aliases);
    const matchIndex = extras.findIndex((extra, index) => {
      if (used.has(index)) return false;
      return namesMatch(schoolKey(extra.name, extra.aliases), key);
    });
    if (matchIndex < 0) return school;
    used.add(matchIndex);
    const match = extras[matchIndex];
    if (!match) return school;
    return {
      ...school,
      aliases: school.aliases ?? match.aliases,
      city: school.city ?? match.city,
      address: school.address ?? match.address,
      curriculum_hint: school.curriculum_hint ?? match.curriculum_hint,
      notes: school.notes ?? match.notes,
      claims: [...(school.claims ?? []), ...(match.claims ?? [])],
    };
  });
  extras.forEach((school, index) => {
    if (!used.has(index)) merged.push(school);
  });
  return merged;
}

function buildCatalog() {
  const sourceMap = sourcesByName();
  const schools: CatalogSchool[] = [];
  const claims: CatalogClaim[] = [];
  let claimId = 1;

  const fromChecklist = checklistAsSeed();
  const fromSeed = seedSchools();
  const fromDoris = dorisAsSeed();
  const primary =
    fromChecklist.length > 0
      ? mergeSeedClaims(fromChecklist, fromSeed)
      : fromSeed;
  const rows = applyPlaces(mergeAndAppend(primary, fromDoris));

  rows.forEach((school, index) => {
    const id = index + 1;
    const catalogSchool: CatalogSchool = {
      id,
      name: school.name,
      displayName: displaySchoolName(school.name),
      aliases: school.aliases ?? null,
      city: school.city ?? null,
      address: school.address ?? null,
      curriculumHint: school.curriculum_hint ?? null,
      isSynthetic: school.is_synthetic,
      notes: school.notes ?? null,
    };
    schools.push(catalogSchool);

    for (const claim of school.claims ?? []) {
      const source = sourceMap.get(claim.source_name);
      if (!source) continue;
      claims.push({
        id: claimId++,
        school_id: id,
        field_name: claim.field_name,
        grade_band: claim.grade_band ?? null,
        value_text: claim.value_text,
        value_numeric: claim.value_numeric ?? null,
        status: claim.status ?? "unverified",
        source_date: claim.source_date,
        evidence_note: claim.evidence_note ?? null,
        source_name: source.name,
        source_type: source.type,
        base_reliability: source.base_reliability ?? 0.5,
      });
    }

    const moe = lookupMoeRegistration({
      name: catalogSchool.displayName,
      aliases: catalogSchool.aliases,
      city: catalogSchool.city,
    });
    claims.push({
      id: claimId++,
      school_id: id,
      field_name: "moe_registration",
      grade_band: null,
      value_text: moe.status,
      value_numeric: null,
      status: "official",
      source_date: MOE_SOURCE_DATE,
      evidence_note: moeEvidenceNote(moe),
      source_name: MOE_SOURCE_NAME,
      source_type: "official",
      base_reliability: 0.95,
    });
  });

  return { schools, claims };
}

const catalog = buildCatalog();

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

export function queryFromSearchParams(
  searchParams: { q?: string | string[] } | null | undefined,
): string {
  return firstParam(searchParams?.q);
}

function searchTokens(school: CatalogSchool): string[] {
  const aliases = (school.aliases ?? "")
    .split(/[,/;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return [school.name, school.displayName, ...aliases]
    .map((part) => part.toLowerCase())
    .filter(Boolean);
}

export function listSchools(): CatalogSchool[] {
  return catalog.schools;
}

export function searchSchools(query: string): CatalogSchool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog.schools.filter((school) => {
    const tokens = searchTokens(school);
    const words = tokens.flatMap((token) => token.split(/\s+/)).filter(Boolean);
    return [...tokens, ...words].some(
      (token) => token.includes(q) || (q.length >= 3 && token.startsWith(q)),
    );
  });
}

export function getSchool(id: number): CatalogSchool | null {
  return catalog.schools.find((school) => school.id === id) ?? null;
}

export function claimsForSchool(schoolId: number): CatalogClaim[] {
  return catalog.claims.filter((claim) => claim.school_id === schoolId);
}

export function toEngineClaim(claim: CatalogClaim): Claim & { field_name: string } {
  return {
    id: claim.id,
    field_name: claim.field_name,
    grade_band: claim.grade_band,
    value_text: claim.value_text,
    value_numeric: claim.value_numeric,
    source_date: claim.source_date,
    source_type: claim.source_type,
    base_reliability: claim.base_reliability,
  };
}

export function scoreSchool(schoolId: number): ScoredField[] {
  const rows = claimsForSchool(schoolId);
  const scored = scoreClaimsByFieldAndBand(rows.map(toEngineClaim));
  return scored.map((group) => {
    const groupClaims = rows.filter(
      (row) =>
        row.field_name === group.field_name &&
        (row.grade_band ?? "") === (group.grade_band ?? ""),
    );
    const uniqueValues = [
      ...new Set(groupClaims.map((row) => row.value_text.trim())),
    ];
    return {
      fieldName: group.field_name,
      gradeBand: group.grade_band,
      valueText: uniqueValues.join(" · ") || "—",
      result: group.result,
      claims: groupClaims,
    };
  });
}

export function overviewCounts(schoolId: number) {
  const scored = scoreSchool(schoolId);
  const counts = { Supported: 0, Uncertain: 0, Unknown: 0 };
  for (const field of LOCKED_FIELDS) {
    const bands = scored.filter((row) => row.fieldName === field);
    if (bands.length === 0) {
      counts.Unknown += 1;
      continue;
    }
    if (bands.some((row) => row.result.tier === "Uncertain")) {
      counts.Uncertain += 1;
    } else if (bands.every((row) => row.result.tier === "Supported")) {
      counts.Supported += 1;
    } else if (bands.every((row) => row.result.tier === "Unknown")) {
      counts.Unknown += 1;
    } else {
      counts.Uncertain += 1;
    }
  }
  return counts;
}

export function fieldScores(schoolId: number, fieldName: string): ScoredField[] {
  return scoreSchool(schoolId).filter((row) => row.fieldName === fieldName);
}

export function fieldScore(
  schoolId: number,
  fieldName: string,
): ScoredField | null {
  return fieldScores(schoolId, fieldName)[0] ?? null;
}

export function sourcesForSchool(schoolId: number) {
  const seen = new Set<string>();
  const sources: Array<{
    name: string;
    status: string;
    sourceDate: string;
    fieldName: string;
  }> = [];
  for (const claim of claimsForSchool(schoolId)) {
    const key = `${claim.source_name}|${claim.source_date}|${claim.field_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      name: claim.source_name,
      status: claim.status,
      sourceDate: claim.source_date,
      fieldName: claim.field_name,
    });
  }
  return sources;
}

export function emptyFieldScore(fieldName: string): ScoredField {
  return {
    fieldName,
    gradeBand: null,
    valueText: "—",
    result: computeConfidence([]),
    claims: [],
  };
}
