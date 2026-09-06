import { LOCKED_FIELDS, type FieldName } from "@/lib/fields";

export const CHECKLIST_SOURCE_NAME = "School profile checklist";
export const CHECKLIST_SOURCE_TYPE = "independent" as const;
export const CHECKLIST_SOURCE_RELIABILITY = 0.55;

export const DORIS_SOURCE_NAME = "doris.school";
export const DORIS_SOURCE_TYPE = "independent" as const;
export const DORIS_SOURCE_RELIABILITY = 0.65;

export type ImportSourceOptions = {
  sourceName: string;
  status?: string;
};

export type ImportedClaim = {
  field_name: FieldName;
  grade_band?: string | null;
  value_text: string;
  value_numeric?: number | null;
  source_name: string;
  status?: string;
  source_date: string;
  evidence_note?: string;
};

export type ImportedSchool = {
  name: string;
  aliases?: string;
  city?: string;
  curriculum_hint?: string;
  is_synthetic: boolean;
  notes?: string;
  website?: string;
  claims: ImportedClaim[];
};

const FIELD_ALIASES: Record<string, FieldName> = {
  tuition_fee: "tuition_fee",
  tuition: "tuition_fee",
  fees: "tuition_fee",
  fee: "tuition_fee",
  annual_fee: "tuition_fee",
  annual_fees: "tuition_fee",
  annual_tuition: "tuition_fee",
  school_fees: "tuition_fee",
  fee_range: "tuition_fee",
  student_teacher_ratio: "student_teacher_ratio",
  student_teacher: "student_teacher_ratio",
  pupil_teacher_ratio: "student_teacher_ratio",
  teacher_ratio: "student_teacher_ratio",
  ratio: "student_teacher_ratio",
  staffing: "student_teacher_ratio",
  curriculum: "curriculum",
  curricula: "curriculum",
  programme: "curriculum",
  program: "curriculum",
  class_size: "class_size",
  classsize: "class_size",
  average_class_size: "class_size",
  avg_class_size: "class_size",
  transportation: "transportation",
  transport: "transportation",
  bus: "transportation",
  school_bus: "transportation",
  bus_service: "transportation",
  grades_offered: "grades_offered",
  grades: "grades_offered",
  ages: "grades_offered",
  age_range: "grades_offered",
  age_range_offered: "grades_offered",
  year_groups: "grades_offered",
  year_groups_offered: "grades_offered",
  grade_range: "grades_offered",
  years: "grades_offered",
  established_year: "established_year",
  established: "established_year",
  founded: "established_year",
  year_founded: "established_year",
  founded_year: "established_year",
  year_established: "established_year",
  year_opened: "established_year",
  moe_registration: "moe_registration",
  moe: "moe_registration",
  moe_approved: "moe_registration",
  moe_status: "moe_registration",
  registration: "moe_registration",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstString(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(
  record: Record<string, unknown> | null,
  keys: string[],
): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function lockedField(key: string): FieldName | null {
  const normalized = normalizeKey(key);
  return FIELD_ALIASES[normalized] ?? null;
}

function schoolRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of [
    "schools",
    "profiles",
    "items",
    "results",
    "data",
    "listings",
    "myanmar_schools",
    "international_schools",
    "records",
  ]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    const nested = asRecord(value);
    if (nested) {
      const nestedRows = schoolRows(nested);
      if (nestedRows.length) return nestedRows;
    }
  }
  return [];
}

function aliasesFrom(record: Record<string, unknown>): string | undefined {
  const raw =
    record.aliases ??
    record.alias ??
    record.aka ??
    record.short_name ??
    record.shortName;
  if (Array.isArray(raw)) {
    const parts = raw.map((part) => String(part).trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : undefined;
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return undefined;
}

function composedValueText(record: Record<string, unknown>): string | null {
  const currency = firstString(record, ["currency", "ccy"]) ?? "";
  const annual = firstString(record, [
    "annual",
    "annual_fee",
    "annualFee",
    "per_year",
    "perYear",
    "year",
    "tuition",
  ]);
  if (annual) {
    return currency ? `${annual} ${currency} / year` : `${annual} / year`;
  }
  const min = firstString(record, ["min", "from", "low", "tuition_from"]);
  const max = firstString(record, ["max", "to", "high", "tuition_to"]);
  if (min && max) {
    return currency ? `${min}–${max} ${currency}` : `${min}–${max}`;
  }
  if (min) return currency ? `from ${min} ${currency}` : `from ${min}`;
  if (max) return currency ? `up to ${max} ${currency}` : `up to ${max}`;
  return null;
}

function claimValue(raw: unknown): {
  value_text: string;
  value_numeric: number | null;
  grade_band: string | null;
  evidence_note: string | null;
  source_date: string | null;
} | null {
  if (raw == null) return null;
  if (typeof raw === "boolean") return null;
  if (typeof raw === "string" || typeof raw === "number") {
    const value_text = String(raw).trim();
    if (!value_text) return null;
    const asNumber =
      typeof raw === "number" ? raw : Number(value_text.replace(/,/g, ""));
    return {
      value_text,
      value_numeric: Number.isFinite(asNumber) ? asNumber : null,
      grade_band: null,
      evidence_note: null,
      source_date: null,
    };
  }
  if (Array.isArray(raw)) {
    if (
      raw.every(
        (item) => typeof item === "string" || typeof item === "number",
      )
    ) {
      const parts = raw.map((item) => String(item).trim()).filter(Boolean);
      if (!parts.length) return null;
      return {
        value_text: parts.join(", "),
        value_numeric: null,
        grade_band: null,
        evidence_note: null,
        source_date: null,
      };
    }
    return null;
  }
  const record = asRecord(raw);
  if (!record) return null;
  if (record.found === false || record.available === false) return null;
  const value_text =
    firstString(record, [
      "value_text",
      "value",
      "text",
      "display",
      "answer",
    ]) ?? composedValueText(record);
  if (!value_text) return null;
  return {
    value_text,
    value_numeric: firstNumber(record, [
      "value_numeric",
      "numeric",
      "amount",
      "annual",
    ]),
    grade_band: firstString(record, [
      "grade_band",
      "gradeBand",
      "band",
      "level",
    ]),
    evidence_note: firstString(record, [
      "evidence_note",
      "note",
      "notes",
      "source_url",
      "sourceUrl",
      "url",
      "citation",
    ]),
    source_date: firstString(record, ["source_date", "sourceDate", "date", "as_of"]),
  };
}

function pushClaim(
  claims: ImportedClaim[],
  field: FieldName,
  parsed: NonNullable<ReturnType<typeof claimValue>>,
  sourceDate: string,
  options: ImportSourceOptions,
) {
  claims.push({
    field_name: field,
    grade_band: parsed.grade_band,
    value_text: parsed.value_text,
    value_numeric: parsed.value_numeric,
    source_name: options.sourceName,
    status: options.status ?? "independent",
    source_date: parsed.source_date ?? sourceDate,
    evidence_note: parsed.evidence_note ?? undefined,
  });
}

function claimsFromRecord(
  record: Record<string, unknown>,
  sourceDate: string,
  options: ImportSourceOptions,
): ImportedClaim[] {
  const claims: ImportedClaim[] = [];
  const bags = [
    record.fields,
    record.checklist,
    record.profile,
    record.claims,
    record,
  ]
    .map(asRecord)
    .filter((bag): bag is Record<string, unknown> => bag != null);

  for (const bag of bags) {
    if (Array.isArray(bag.claims)) {
      for (const item of bag.claims) {
        const row = asRecord(item);
        if (!row) continue;
        const field = lockedField(
          firstString(row, ["field_name", "field", "name"]) ?? "",
        );
        const parsed = claimValue(row);
        if (!field || !parsed) continue;
        pushClaim(claims, field, parsed, sourceDate, options);
      }
    }

    for (const [key, value] of Object.entries(bag)) {
      const field = lockedField(key);
      if (!field) continue;
      if (Array.isArray(value) && value.some((item) => asRecord(item))) {
        for (const item of value) {
          const parsed = claimValue(item);
          if (!parsed) continue;
          pushClaim(claims, field, parsed, sourceDate, options);
        }
        continue;
      }
      const parsed = claimValue(value);
      if (!parsed) continue;
      pushClaim(claims, field, parsed, sourceDate, options);
    }
  }

  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.field_name}:${claim.grade_band ?? ""}:${claim.value_text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return LOCKED_FIELDS.includes(claim.field_name);
  });
}

function importOne(
  raw: unknown,
  sourceDate: string,
  options: ImportSourceOptions,
): ImportedSchool | null {
  const record = asRecord(raw);
  if (!record) return null;
  const name = firstString(record, [
    "name",
    "school_name",
    "schoolName",
    "official_name",
    "officialName",
    "display_name",
    "displayName",
    "title",
    "school",
  ]);
  if (!name) return null;

  const website = firstString(record, [
    "website",
    "url",
    "homepage",
    "site",
    "doris_url",
    "dorisUrl",
  ]);
  const notes = [
    firstString(record, ["notes", "note", "about", "summary"]),
    website,
  ]
    .filter(Boolean)
    .join(" ");

  const curriculumHint = firstString(record, [
    "curriculum_hint",
    "curriculumHint",
  ]);
  const curriculumRaw = record.curriculum ?? record.programme ?? record.program;
  const curriculumFromArray = Array.isArray(curriculumRaw)
    ? curriculumRaw.map((part) => String(part).trim()).filter(Boolean).join(", ")
    : typeof curriculumRaw === "string"
      ? curriculumRaw.trim()
      : "";

  return {
    name,
    aliases: aliasesFrom(record),
    city:
      firstString(record, [
        "city",
        "location",
        "township",
        "town",
        "region",
      ]) ?? undefined,
    curriculum_hint: curriculumHint || curriculumFromArray || undefined,
    is_synthetic: Boolean(record.is_synthetic),
    notes: notes || undefined,
    website: website ?? undefined,
    claims: claimsFromRecord(record, sourceDate, options),
  };
}

export function schoolsFromExport(
  payload: unknown,
  options: ImportSourceOptions,
): ImportedSchool[] {
  const root = asRecord(payload);
  const sourceDate =
    firstString(root, [
      "source_date",
      "generated_at",
      "exported_at",
      "date",
      "updated_at",
    ]) ?? "2026-09-06";
  return schoolRows(payload)
    .map((row) => importOne(row, sourceDate, options))
    .filter((row): row is ImportedSchool => row != null);
}

export function schoolsFromChecklist(payload: unknown): ImportedSchool[] {
  return schoolsFromExport(payload, {
    sourceName: CHECKLIST_SOURCE_NAME,
    status: "independent",
  });
}

export function schoolsFromDoris(payload: unknown): ImportedSchool[] {
  return schoolsFromExport(payload, {
    sourceName: DORIS_SOURCE_NAME,
    status: "independent",
  });
}
