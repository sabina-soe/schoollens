/**
 * Conflict detection + confidence scoring.
 * Pure TypeScript port of confidence_engine.py — transparent, auditable math.
 */

export type SourceType = "official" | "school" | "independent" | "community";

export type Claim = {
  id: number;
  field_name?: string;
  grade_band?: string | null;
  value_text: string;
  value_numeric: number | null;
  source_date: string;
  source_type: SourceType;
  base_reliability: number;
};

export type ConfidenceConflict = {
  a: Claim;
  b: Claim;
  note: string;
};

export type ConfidenceResult = {
  tier: "Supported" | "Uncertain" | "Unknown";
  score: number;
  reason: string;
  conflicts: ConfidenceConflict[];
};

export type FieldBandScore = {
  field_name: string;
  grade_band: string | null;
  result: ConfidenceResult;
};

const NUMERIC_CONFLICT_THRESHOLD = 0.15;

export function normalizeGradeBand(
  gradeBand: string | null | undefined,
): string | null {
  if (gradeBand == null) return null;
  const trimmed = gradeBand.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function claimGroupKey(
  fieldName: string | undefined,
  gradeBand: string | null | undefined,
): string {
  return `${fieldName ?? ""}\0${normalizeGradeBand(gradeBand) ?? ""}`;
}

export function groupClaimsByFieldAndBand<
  T extends { field_name: string; grade_band?: string | null },
>(claims: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const claim of claims) {
    const key = claimGroupKey(claim.field_name, claim.grade_band);
    const list = groups.get(key) ?? [];
    list.push(claim);
    groups.set(key, list);
  }
  return groups;
}

function relativeDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
}

function daysSince(dateStr: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return 9999;

  const d = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(d.getTime())) return 9999;

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.round((todayUtc - d.getTime()) / 86_400_000);
}

function detectConflictsWithinGroup(claims: Claim[]): ConfidenceConflict[] {
  const conflicts: ConfidenceConflict[] = [];

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i];
      const b = claims[j];

      if (a.value_numeric != null && b.value_numeric != null) {
        const diff = relativeDiff(a.value_numeric, b.value_numeric);
        if (diff > NUMERIC_CONFLICT_THRESHOLD) {
          conflicts.push({
            a,
            b,
            note: `Numeric values differ by ${(diff * 100).toFixed(0)}% (${a.value_text} vs ${b.value_text})`,
          });
        }
      } else {
        const normA = a.value_text.trim().toLowerCase();
        const normB = b.value_text.trim().toLowerCase();
        if (normA !== normB) {
          conflicts.push({
            a,
            b,
            note: `Text values differ: "${a.value_text}" vs "${b.value_text}"`,
          });
        }
      }
    }
  }

  return conflicts;
}

function detectConflicts(claims: Claim[]): ConfidenceConflict[] {
  const groups = new Map<string, Claim[]>();
  for (const claim of claims) {
    const key = claimGroupKey(claim.field_name, claim.grade_band);
    const list = groups.get(key) ?? [];
    list.push(claim);
    groups.set(key, list);
  }

  const conflicts: ConfidenceConflict[] = [];
  for (const group of groups.values()) {
    conflicts.push(...detectConflictsWithinGroup(group));
  }
  return conflicts;
}

export function computeConfidence(claims: Claim[]): ConfidenceResult {
  if (claims.length === 0) {
    return {
      tier: "Unknown",
      score: 0,
      reason: "No evidence found for this field.",
      conflicts: [],
    };
  }

  const conflicts = detectConflicts(claims);
  const distinctSourceTypes = new Set(claims.map((c) => c.source_type)).size;

  if (conflicts.length > 0) {
    const score = Math.min(55, Math.round(30 + 10 * distinctSourceTypes));
    return {
      tier: "Uncertain",
      score,
      conflicts,
      reason: `${conflicts.length} conflicting claim(s) found across ${distinctSourceTypes} source type(s) — shown as uncertain until resolved.`,
    };
  }

  const mostRecentDays = Math.min(...claims.map((c) => daysSince(c.source_date)));
  const avgReliability =
    claims.reduce((sum, c) => sum + c.base_reliability, 0) / claims.length;

  let score = 25;
  score += Math.min(30, 15 * (distinctSourceTypes - 1));
  score += 20 * avgReliability;
  if (mostRecentDays <= 182) {
    score += 15;
  } else if (mostRecentDays <= 365) {
    score += 5;
  }
  score = Math.min(95, Math.round(score));

  const tier: ConfidenceResult["tier"] =
    score >= 70 ? "Supported" : "Uncertain";

  return {
    tier,
    score,
    conflicts,
    reason: `${claims.length} claim(s) from ${distinctSourceTypes} source type(s), most recent ${mostRecentDays} days old, no conflicts.`,
  };
}

export function scoreClaimsByFieldAndBand(
  claims: Array<Claim & { field_name: string }>,
): FieldBandScore[] {
  return [...groupClaimsByFieldAndBand(claims).values()].map((group) => ({
    field_name: group[0].field_name,
    grade_band: normalizeGradeBand(group[0].grade_band),
    result: computeConfidence(group),
  }));
}
