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

export function unknownCopy(fieldName: string): string {
  const specific = (
    {
      tuition_fee:
        "We have not found a published tuition figure we can cite for this school. That is a gap in our evidence — it does not mean the school hides fees, only that we cannot yet stand behind a number.",
      student_teacher_ratio:
        "We have not found a cited student–teacher ratio for this school. That is missing evidence, not a finding that staffing is poor or unusually high.",
      curriculum:
        "We have not found a cited curriculum statement for this school. Check the school website or admissions office; we will only show a programme when a source names it.",
      class_size:
        "We have not found a cited class-size figure for this school. That is a gap in what we can verify, not a claim that classes are large or small.",
      transportation:
        "We have not found cited transport details (bus, shuttle, or none) for this school. That is missing evidence, not a finding that transport is unavailable.",
      grades_offered:
        "We have not found a cited grade range for this school. That is a gap in our notes, not a claim the school is only for one age group.",
      established_year:
        "We have not found a cited founding year for this school. That is missing evidence, not a judgment about how established the campus is.",
      moe_registration:
        "We have not yet checked this name against the official MoE approved list. That is a gap in our process, not a finding that the school is unregistered.",
    } as const
  )[fieldName];
  return (
    specific ??
    "We do not have a cited value for this field yet. That is a gap in our evidence, not an accusation."
  );
}
