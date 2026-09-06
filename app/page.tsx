import Link from "next/link";
import { SchoolCard } from "@/components/SchoolCard";
import { SchoolSearchForm } from "@/components/SchoolSearchForm";
import { SiteHeader } from "@/components/SiteHeader";
import { scoreSchool, searchSchools } from "@/lib/catalog";
import { copy } from "@/lib/copy";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  { q: "MISY", label: "MISY" },
  { q: "YAIS", label: "YAIS" },
] as const;

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const schools = query ? searchSchools(query) : [];

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

        <SchoolSearchForm initialQuery={query} />

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

        {query ? (
          schools.length === 0 ? (
            <section className="space-y-3 rounded-xl border border-border/80 bg-white px-4 py-5">
              <p className="inline-flex items-center gap-2 text-base font-semibold text-confidence-unknown">
                <span aria-hidden>🔴</span> {copy.noMatch}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                {copy.noMatchHelp}
              </p>
            </section>
          ) : (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {schools.length} result{schools.length === 1 ? "" : "s"} for
                “{query}”
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
          )
        ) : null}
      </main>
    </div>
  );
}
