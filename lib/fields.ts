export const LOCKED_FIELDS = [
  "tuition_fee",
  "student_teacher_ratio",
  "curriculum",
  "class_size",
  "transportation",
  "grades_offered",
  "established_year",
  "moe_registration",
] as const;

export type FieldName = (typeof LOCKED_FIELDS)[number];

export const FIELD_LABELS: Record<FieldName, string> = {
  tuition_fee: "Tuition fee",
  student_teacher_ratio: "Student–teacher ratio",
  curriculum: "Curriculum",
  class_size: "Class size",
  transportation: "Transportation",
  grades_offered: "Grades offered",
  established_year: "Established year",
  moe_registration: "MoE registration",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName as FieldName] ?? fieldName.replaceAll("_", " ");
}

export function gradeBandLabel(gradeBand: string | null | undefined): string {
  const trimmed = gradeBand?.trim();
  return trimmed ? trimmed : "Unspecified";
}

export function displaySchoolName(name: string): string {
  return name.replace(/^EXAMPLE:\s*/i, "").trim();
}
