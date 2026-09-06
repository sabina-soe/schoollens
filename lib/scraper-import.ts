import { LOCKED_FIELDS, type FieldName } from "@/lib/fields";

export const CHECKLIST_SOURCE_NAME = "School profile checklist";
export const CHECKLIST_SOURCE_TYPE = "independent" as const;
export const CHECKLIST_SOURCE_RELIABILITY = 0.55;

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
  annual_tuition: "tuition_fee",
  student_teacher_ratio: "student_teacher_ratio",
  student_teacher: "student_teacher_ratio",
  ratio: "student_teacher_ratio",
  staffing: "student_teacher_ratio",
  curriculum: "curriculum",
  programme: "curriculum",
  program: "curriculum",
  class_size: "class_size",
  classsize: "class_size",
  transportation: "transportation",
  transport: "transportation",
  bus: "transportation",
  grades_offered: "grades_offered",
  grades: "grades_offered",
  year_groups: "grades_offered",
  years: "grades_offered",
  established_year: "established_year",
  established: "established_year",
  founded: "established_year",
  year_founded: "established_year",
  moe_registration: "moe_registration",
  moe: "moe_registration",
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
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function lockedField(key: string): FieldName | null {
  const normalized = normalizeKey(key);
  return FIELD_ALIASES[normalized] ?? null;
}

function schoolRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of ["schools", "profiles", "items", "results", "data", "listings"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function aliasesFrom(record: Record<string, unknown>): string | undefined {
  const raw = record.aliases ?? record.alias ?? record.aka ?? record.short_name;
  if (Array.isArray(raw)) {
    const parts = raw.map((part) => String(part).trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : undefined;
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return undefined;
}

function claimValue(raw: unknown): {
  value_text: string;
  value_numeric: number | null;
  grade_band: string | null;
  evidence_note: string | null;
  source_date: string | null;
} | null {
  if (raw == null) return null;
  if (typeof raw === "string" || typeof raw === "number") {
    const value_text = String(raw).trim();
    if (!value_text) return null;
    const asNumber = typeof raw === "number" ? raw : Number(value_text.replace(/,/g, ""));
    return {
      value_text,
      value_numeric: Number.isFinite(asNumber) ? asNumber : null,
      grade_band: null,
      evidence_note: null,
      source_date: null,
    };
  }
  const record = asRecord(raw);
  if (!record) return null;
  if (record.found === false || record.available === false) return null;
  const value_text = firstString(record, [
    "value_text",
    "value",
    "text",
    "display",
    "answer",
  ]);
  if (!value_text) return null;
  return {
    value_text,
    value_numeric: firstNumber(record, ["value_numeric", "numeric", "amount"]),
    grade_band: firstString(record, ["grade_band", "band", "level"]),
    evidence_note: firstString(record, [
      "evidence_note",
      "note",
      "notes",
      "source_url",
      "url",
      "citation",
    ]),
    source_date: firstString(record, ["source_date", "date", "as_of"]),
  };
}

function claimsFromRecord(
  record: Record<string, unknown>,
  sourceDate: string,
): ImportedClaim[] {
  const claims: ImportedClaim[] = [];
  const bags = [record.fields, record.checklist, record.profile, record.claims, record]
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
        claims.push({
          field_name: field,
          grade_band: parsed.grade_band,
          value_text: parsed.value_text,
          value_numeric: parsed.value_numeric,
          source_name: CHECKLIST_SOURCE_NAME,
          status: "independent",
          source_date: parsed.source_date ?? sourceDate,
          evidence_note: parsed.evidence_note ?? undefined,
        });
      }
    }

    for (const [key, value] of Object.entries(bag)) {
      const field = lockedField(key);
      if (!field) continue;
      const parsed = claimValue(value);
      if (!parsed) continue;
      claims.push({
        field_name: field,
        grade_band: parsed.grade_band,
        value_text: parsed.value_text,
        value_numeric: parsed.value_numeric,
        source_name: CHECKLIST_SOURCE_NAME,
        status: "independent",
        source_date: parsed.source_date ?? sourceDate,
        evidence_note: parsed.evidence_note ?? undefined,
      });
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

function importOne(raw: unknown, sourceDate: string): ImportedSchool | null {
  const record = asRecord(raw);
  if (!record) return null;
  const name = firstString(record, [
    "name",
    "school_name",
    "official_name",
    "display_name",
    "title",
    "school",
  ]);
  if (!name) return null;

  const website = firstString(record, ["website", "url", "homepage", "site"]);
  const notes = [firstString(record, ["notes", "note", "about", "summary"]), website]
    .filter(Boolean)
    .join(" ");

  return {
    name,
    aliases: aliasesFrom(record),
    city:
      firstString(record, ["city", "location", "township", "town", "region"]) ??
      undefined,
    curriculum_hint:
      firstString(record, [
        "curriculum_hint",
        "curriculum",
        "programme",
        "program",
      ]) ?? undefined,
    is_synthetic: Boolean(record.is_synthetic),
    notes: notes || undefined,
    website: website ?? undefined,
    claims: claimsFromRecord(record, sourceDate),
  };
}

export function schoolsFromChecklist(payload: unknown): ImportedSchool[] {
  const root = asRecord(payload);
  const sourceDate =
    firstString(root, ["source_date", "generated_at", "exported_at", "date"]) ??
    "2026-09-06";
  return schoolRows(payload)
    .map((row) => importOne(row, sourceDate))
    .filter((row): row is ImportedSchool => row != null);
}
