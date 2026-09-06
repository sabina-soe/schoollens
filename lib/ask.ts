import {
  emptyFieldScore,
  fieldScore,
  getSchool,
  type CatalogClaim,
  type ScoredField,
} from "@/lib/catalog";
import { copy } from "@/lib/copy";
import { fieldLabel } from "@/lib/fields";

const FIELD_HINTS: Array<{ field: string; pattern: RegExp }> = [
  { field: "moe_registration", pattern: /\b(moe|ministr|regist|approv|accredit|licence|license)\b/i },
  { field: "tuition_fee", pattern: /\b(tuition|fee|fees|cost|price|how much)\b/i },
  { field: "student_teacher_ratio", pattern: /\b(ratio|teacher|staffing)\b/i },
  { field: "curriculum", pattern: /\b(curriculum|igcse|a-?level|cambridge|ib|american|british)\b/i },
  { field: "class_size", pattern: /\b(class size|pupils per class)\b/i },
  { field: "transportation", pattern: /\b(transport|bus|shuttle)\b/i },
  { field: "grades_offered", pattern: /\b(grade|year|nursery|early years|ages)\b/i },
  { field: "established_year", pattern: /\b(establish|found|started|opened|year)\b/i },
];

export type AskCitation = {
  valueText: string;
  sourceName: string;
  sourceDate: string;
  status: string;
};

export type AskAnswer = {
  answer: string;
  fieldName: string | null;
  tier: ScoredField["result"]["tier"] | null;
  score: number | null;
  citations: AskCitation[];
};

function citationsFrom(field: ScoredField): AskCitation[] {
  return field.claims.map((claim: CatalogClaim) => ({
    valueText: claim.value_text,
    sourceName: claim.source_name,
    sourceDate: claim.source_date,
    status: claim.status,
  }));
}

function detectField(question: string): string | null {
  for (const hint of FIELD_HINTS) {
    if (hint.pattern.test(question)) return hint.field;
  }
  return null;
}

function describeField(field: ScoredField): string {
  const label = fieldLabel(field.fieldName);
  if (field.claims.length === 0) {
    return `${label}: ${copy.unknownNextStep}`;
  }
  if (field.result.conflicts.length > 0) {
    const pairs = field.result.conflicts
      .map((conflict) => `${conflict.a.value_text} vs ${conflict.b.value_text}`)
      .join("; ");
    return `${label} is Uncertain (${field.result.score}/100) because sources disagree: ${pairs}.`;
  }
  return `${label} is ${field.result.tier} (${field.result.score}/100): ${field.valueText}.`;
}

export function answerFromClaims(schoolId: number, question: string): AskAnswer {
  const school = getSchool(schoolId);
  if (!school) {
    return {
      answer: "That school is not in SchoolLens yet.",
      fieldName: null,
      tier: null,
      score: null,
      citations: [],
    };
  }

  const trimmed = question.trim();
  if (!trimmed) {
    return {
      answer: copy.askEmpty,
      fieldName: null,
      tier: null,
      score: null,
      citations: [],
    };
  }

  const fieldName = detectField(trimmed);
  if (!fieldName) {
    return {
      answer: `I can only answer from cited fields for ${school.displayName}: tuition, student–teacher ratio, curriculum, class size, transportation, grades offered, established year, and MoE registration.`,
      fieldName: null,
      tier: null,
      score: null,
      citations: [],
    };
  }

  const field = fieldScore(schoolId, fieldName) ?? emptyFieldScore(fieldName);
  return {
    answer: describeField(field),
    fieldName,
    tier: field.result.tier,
    score: field.result.score,
    citations: citationsFrom(field),
  };
}

type ClaudeContent = { type: string; text?: string };

export async function answerWithClaude(opts: {
  schoolId: number;
  question: string;
}): Promise<AskAnswer> {
  const fallback = answerFromClaims(opts.schoolId, opts.question);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const school = getSchool(opts.schoolId);
  if (!apiKey || !school) return fallback;

  const { claimsForSchool } = await import("@/lib/catalog");
  const claims = claimsForSchool(opts.schoolId).map((claim) => ({
    field_name: claim.field_name,
    grade_band: claim.grade_band,
    value_text: claim.value_text,
    source_name: claim.source_name,
    source_date: claim.source_date,
    status: claim.status,
    evidence_note: claim.evidence_note,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system:
        "You answer parent questions about one Myanmar international school. Use ONLY the provided claims JSON. Never invent facts. If a field has no claim, say it is Unknown and tell the parent to check the school website or admissions office. Mention Supported / Uncertain / Unknown when you can. Cite source_name and source_date. Keep the answer under 180 words.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            school: school.displayName,
            city: school.city,
            question: opts.question,
            claims,
            fallback_answer: fallback.answer,
          }),
        },
      ],
    }),
  });

  if (!response.ok) return fallback;

  const payload = (await response.json()) as { content?: ClaudeContent[] };
  const text = payload.content?.find((part) => part.type === "text")?.text?.trim();
  if (!text) return fallback;

  return { ...fallback, answer: text };
}
