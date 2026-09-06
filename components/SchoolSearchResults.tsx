"use client";

import { useSearchParams } from "next/navigation";
import { SchoolCard } from "@/components/SchoolCard";
import { scoreSchool, searchSchools } from "@/lib/catalog";
import { copy } from "@/lib/copy";

type SchoolSearchResultsProps = {
  initialQuery?: string;
};

export function SchoolSearchResults({
  initialQuery = "",
}: SchoolSearchResultsProps) {
  const params = useSearchParams();
  const query = (params.get("q") ?? initialQuery).trim();
  const schools = query ? searchSchools(query) : [];

  if (!query) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="search-hint">
        Search a school name or alias to see evidence-backed results.
      </p>
    );
  }

  if (schools.length === 0) {
    return (
      <section
        id="results"
        className="space-y-3 rounded-xl border border-border/80 bg-white px-4 py-5"
        data-testid="search-empty"
      >
        <p className="inline-flex items-center gap-2 text-base font-semibold text-confidence-unknown">
          <span aria-hidden>🔴</span> {copy.noMatch}
        </p>
        <p className="text-base leading-relaxed text-muted-foreground">
          {copy.noMatchHelp}
        </p>
      </section>
    );
  }

  return (
    <section id="results" className="space-y-3" data-testid="search-results">
      <p className="text-sm font-medium text-foreground">
        {schools.length} result{schools.length === 1 ? "" : "s"} for “{query}”
      </p>
      <ul className="space-y-3">
        {schools.map((school) => (
          <li key={school.id}>
            <SchoolCard
              id={school.id}
              name={school.displayName}
              city={school.city}
              curriculumHint={school.curriculumHint}
              isSynthetic={school.isSynthetic}
              fields={scoreSchool(school.id).map((row) => ({
                fieldName: row.fieldName,
                gradeBand: row.gradeBand,
                tier: row.result.tier,
              }))}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
