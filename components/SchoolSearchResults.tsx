"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SchoolCard, type SchoolCardFieldSummary } from "@/components/SchoolCard";
import {
  scoreSchool,
  searchSchools,
  type CatalogSchool,
} from "@/lib/catalog";
import { copy } from "@/lib/copy";

type SearchHit = CatalogSchool & { fields?: SchoolCardFieldSummary[] };

type SchoolSearchResultsProps = {
  initialQuery?: string;
  initialSchools?: SearchHit[];
};

function withFields(school: SearchHit): SearchHit {
  if (school.fields) return school;
  return {
    ...school,
    fields: scoreSchool(school.id).map((row) => ({
      fieldName: row.fieldName,
      gradeBand: row.gradeBand,
      tier: row.result.tier,
    })),
  };
}

export function SchoolSearchResults({
  initialQuery = "",
  initialSchools = [],
}: SchoolSearchResultsProps) {
  const params = useSearchParams();
  const query = (params.get("q") ?? initialQuery).trim();
  const localHits = query ? searchSchools(query).map(withFields) : [];
  const [live, setLive] = useState<{ query: string; schools: SearchHit[] } | null>(
    null,
  );

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();
    fetch(`/api/schools?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { schools?: SearchHit[] };
        if (payload.schools && payload.schools.length > 0) {
          setLive({ query, schools: payload.schools.map(withFields) });
        }
      })
      .catch(() => {
        /* Keep the seed catalog. Never surface TypeError: fetch failed. */
      });

    return () => controller.abort();
  }, [query]);

  const schools =
    live && live.query === query
      ? live.schools
      : initialQuery === query && initialSchools.length > 0
        ? initialSchools.map(withFields)
        : localHits;

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
              address={school.address}
              curriculumHint={school.curriculumHint}
              isSynthetic={school.isSynthetic}
              fields={school.fields ?? []}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
