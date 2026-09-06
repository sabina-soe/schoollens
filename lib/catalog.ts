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
  lookupMoeRegistration,
  moeEvidenceNote,
} from "@/lib/moe-list";

export type CatalogSchool = {
  id: number;
  name: string;
  displayName: string;
  aliases: string | null;
  city: string | null;
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
  return map;
}

function buildCatalog() {
  const sourceMap = sourcesByName();
  const schools: CatalogSchool[] = [];
  const claims: CatalogClaim[] = [];
  let claimId = 1;

  ((seed.schools ?? []) as SeedSchool[]).forEach((school, index) => {
    const id = index + 1;
    const catalogSchool: CatalogSchool = {
      id,
      name: school.name,
      displayName: displaySchoolName(school.name),
      aliases: school.aliases ?? null,
      city: school.city ?? "Yangon",
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

export function searchSchools(query: string): CatalogSchool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog.schools.filter((school) => {
    const tokens = searchTokens(school);
    return tokens.some(
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
  const present = new Set(scored.map((row) => row.fieldName));
  const counts = { Supported: 0, Uncertain: 0, Unknown: 0 };
  for (const row of scored) counts[row.result.tier] += 1;
  for (const field of LOCKED_FIELDS) {
    if (!present.has(field)) counts.Unknown += 1;
  }
  return counts;
}

export function fieldScore(
  schoolId: number,
  fieldName: string,
): ScoredField | null {
  return (
    scoreSchool(schoolId).find((row) => row.fieldName === fieldName) ?? null
  );
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
