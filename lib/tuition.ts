export type TuitionSplit = {
  annual: string;
  semester1: string;
  semester2: string;
};

function pick(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

export function parseTuitionSplit(
  valueText: string,
  evidenceNote?: string | null,
): TuitionSplit {
  const blob = [valueText, evidenceNote].filter(Boolean).join(" · ");
  const semester1 = pick(blob, [
    /sem(?:ester)?\s*1[:\s]+([^·|;]+)/i,
    /term\s*1[:\s]+([^·|;]+)/i,
  ]);
  const semester2 = pick(blob, [
    /sem(?:ester)?\s*2[:\s]+([^·|;]+)/i,
    /term\s*2[:\s]+([^·|;]+)/i,
  ]);
  return {
    annual: valueText,
    semester1: semester1 ?? "—",
    semester2: semester2 ?? "—",
  };
}
