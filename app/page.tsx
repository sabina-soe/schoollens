import { Suspense } from "react";
import Link from "next/link";
import { SchoolSearchForm } from "@/components/SchoolSearchForm";
import { SchoolSearchResults } from "@/components/SchoolSearchResults";
import { SiteHeader } from "@/components/SiteHeader";
import { SchoolCard } from "@/components/SchoolCard";
import {
  listSchools,
  queryFromSearchParams,
  scoreSchool,
  searchSchools,
  type CatalogSchool,
} from "@/lib/catalog";
import { searchSchoolsSafe } from "@/lib/live-search";
import { copy } from "@/lib/copy";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  { q: "MISY", label: "MISY" },
  { q: "YAIS", label: "YAIS" },
] as const;

async function loadSchools(query: string): Promise<CatalogSchool[]> {
  if (!query) return [];
  const local = searchSchools(query);
  try {
    const live = await searchSchoolsSafe(query);
    return live.length > 0 ? live : local;
  } catch {
    // Windows Node often throws TypeError: fetch failed against Supabase.
    // Never surface that — show seed results instead.
    return local;
  }
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const resolved = await searchParams;
  const query = queryFromSearchParams(resolved);
  const schools = await loadSchools(query);
  const initialSchools = schools.map((school) => ({
    ...school,
    fields: scoreSchool(school.id).map((row) => ({
      fieldName: row.fieldName,
      gradeBand: row.gradeBand,
      tier: row.result.tier,
    })),
  }));

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-secondary">
            Myanmar international schools
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {copy.appName}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
            {copy.tagline}
          </p>
        </div>

        <SchoolSearchForm key={query} initialQuery={query} />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{copy.tryLabel}:</span>
          {EXAMPLES.map((example) => (
            <Link
              key={example.q}
              href={`/?q=${example.q}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-white px-3 font-medium text-primary"
            >
              {example.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-2 text-confidence-supported">
            <span aria-hidden>🟢</span> Supported
          </span>
          <span className="inline-flex items-center gap-2 text-confidence-uncertain">
            <span aria-hidden>🟡</span> Uncertain
          </span>
          <span className="inline-flex items-center gap-2 text-confidence-unknown">
            <span aria-hidden>🔴</span> Unknown
          </span>
        </div>

        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">Loading results…</p>
          }
        >
          <SchoolSearchResults
            initialQuery={query}
            initialSchools={initialSchools}
          />
        </Suspense>

        {!query ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {copy.directoryTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.directoryHelp} {listSchools().length} listed.
              </p>
            </div>
            <ul className="space-y-3">
              {listSchools().map((school) => (
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
        ) : null}
      </main>
    </div>
  );
}
