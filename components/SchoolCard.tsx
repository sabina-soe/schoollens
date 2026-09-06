import Link from "next/link";
import type { ConfidenceResult } from "@/lib/confidence";
import { fieldLabel } from "@/lib/fields";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const TIER_ICON: Record<ConfidenceResult["tier"], string> = {
  Supported: "🟢",
  Uncertain: "🟡",
  Unknown: "🔴",
};

export type SchoolCardFieldSummary = {
  fieldName: string;
  gradeBand?: string | null;
  tier: ConfidenceResult["tier"];
};

export type SchoolCardProps = {
  id: number;
  name: string;
  city: string | null;
  curriculumHint: string | null;
  isSynthetic: boolean;
  fields: SchoolCardFieldSummary[];
};

export function SchoolCard({
  id,
  name,
  city,
  curriculumHint,
  isSynthetic,
  fields,
}: SchoolCardProps) {
  const summary =
    fields.length > 0
      ? fields
      : [{ fieldName: "_none", tier: "Unknown" as const }];

  return (
    <Link
      href={`/schools/${id}`}
      className="block min-h-11 rounded-xl border border-border/80 bg-white px-4 py-4 transition-colors active:bg-muted/40"
    >
      <div className="flex flex-wrap items-start gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {name}
        </h2>
        {isSynthetic ? (
          <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            {copy.illustrative}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {[city, curriculumHint].filter(Boolean).join(" · ") ||
          "Details on school page"}
      </p>
      <ul
        className="mt-3 flex flex-wrap items-center gap-2"
        aria-label="Confidence summary"
      >
        {summary.map((field) => (
          <li
            key={`${id}-${field.fieldName}-${field.gradeBand ?? ""}-${field.tier}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2 py-1"
          >
            <span aria-hidden className={cn("text-xs leading-none")}>
              {TIER_ICON[field.tier]}
            </span>
            {field.fieldName !== "_none" ? (
              <span className="max-w-36 truncate text-xs text-muted-foreground">
                {fieldLabel(field.fieldName)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                No evidence yet
              </span>
            )}
          </li>
        ))}
      </ul>
    </Link>
  );
}
