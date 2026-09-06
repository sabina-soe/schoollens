import Link from "next/link";
import { ClaimRow } from "@/components/ClaimRow";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { SchoolAsk } from "@/components/SchoolAsk";
import {
  emptyFieldScore,
  fieldScore,
  fieldScores,
  overviewCounts,
  sourcesForSchool,
  type CatalogSchool,
  type ScoredField,
} from "@/lib/catalog";
import { copy } from "@/lib/copy";
import { fieldLabel, gradeBandLabel, unknownCopy } from "@/lib/fields";
import { parseTuitionSplit } from "@/lib/tuition";

const JUMP = [
  { href: "#overview", label: copy.overviewTitle },
  { href: "#glance", label: copy.atAGlance },
  { href: "#academics", label: copy.academics },
  { href: "#tuition", label: copy.tuition },
  { href: "#students", label: copy.students },
  { href: "#registration", label: copy.registration },
  { href: "#sources", label: copy.sourcesTitle },
] as const;

const GLANCE_FIELDS = [
  { field: "curriculum", href: "#field-curriculum" },
  { field: "grades_offered", href: "#field-grades_offered" },
  { field: "established_year", href: "#field-established_year" },
  { field: "moe_registration", href: "#registration" },
] as const;

const TIER_DOT = {
  Supported: "🟢",
  Uncertain: "🟡",
  Unknown: "🔴",
} as const;

function overviewSentence(counts: {
  Supported: number;
  Uncertain: number;
  Unknown: number;
}) {
  return `We can stand behind ${counts.Supported} field${
    counts.Supported === 1 ? "" : "s"
  }, ${counts.Uncertain} need a closer look because sources disagree or are thin, and ${counts.Unknown} ${
    counts.Unknown === 1 ? "is" : "are"
  } still missing a cited value.`;
}

function Section({
  id,
  title,
  children,
  distinct = false,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  distinct?: boolean;
}) {
  return (
    <section
      id={id}
      className={
        distinct
          ? "scroll-mt-24 space-y-4 rounded-xl border-2 border-primary/40 bg-muted/40 px-4 py-5 sm:px-6"
          : "scroll-mt-24 space-y-4 rounded-xl border border-border/80 bg-white px-4 py-5 sm:px-6"
      }
    >
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldBlock({ field }: { field: ScoredField }) {
  return (
    <div
      id={
        field.gradeBand
          ? `field-${field.fieldName}-${field.gradeBand}`
          : `field-${field.fieldName}`
      }
      className="scroll-mt-24 space-y-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {fieldLabel(field.fieldName)}
          </h3>
          {field.gradeBand ? (
            <p className="text-base text-muted-foreground">
              {gradeBandLabel(field.gradeBand)}
            </p>
          ) : null}
        </div>
        <ConfidenceBadge
          compact
          tier={field.result.tier}
          score={field.result.score}
          reason={field.result.reason}
        />
      </div>
      {field.claims.length === 0 ? (
        <p className="text-base leading-relaxed text-muted-foreground">
          {unknownCopy(field.fieldName)}
        </p>
      ) : (
        <>
          {field.result.conflicts.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-confidence-uncertain/40 bg-amber-50/70 px-3 py-3">
              <p className="text-base font-medium text-amber-950">
                Conflicting values
              </p>
              {field.result.conflicts.map((conflict) => (
                <p
                  key={`${conflict.a.id}-${conflict.b.id}`}
                  className="text-base text-amber-900"
                >
                  {conflict.a.value_text} vs {conflict.b.value_text} —{" "}
                  {conflict.note}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-lg font-semibold tracking-tight text-foreground">
              {field.valueText}
            </p>
          )}
          <ul className="space-y-2">
            {field.claims.map((claim) => (
              <ClaimRow
                key={claim.id}
                valueText={claim.value_text}
                sourceName={claim.source_name}
                status={claim.status}
                sourceDate={claim.source_date}
                evidenceNote={claim.evidence_note}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function GlanceCard({
  field,
  href,
}: {
  field: ScoredField;
  href: string;
}) {
  const value = field.claims.length ? field.valueText : "Not listed yet";
  return (
    <a
      href={href}
      className="flex min-h-28 flex-col justify-between rounded-xl border border-border/80 bg-white px-4 py-3 shadow-sm"
    >
      <p className="text-base font-medium text-muted-foreground">
        {fieldLabel(field.fieldName)}
      </p>
      <p className="mt-2 text-lg font-semibold leading-snug text-foreground">
        {value}
      </p>
      <p className="mt-3 inline-flex min-h-11 items-center gap-2 text-base">
        <span aria-hidden>{TIER_DOT[field.result.tier]}</span>
        <span className="font-medium">{field.result.tier}</span>
        <span className="text-primary underline underline-offset-4">
          {copy.glanceHint}
        </span>
      </p>
    </a>
  );
}

export function SchoolProfile({ school }: { school: CatalogSchool }) {
  const counts = overviewCounts(school.id);
  const glance = GLANCE_FIELDS.map(({ field, href }) => ({
    href,
    field: fieldScore(school.id, field) ?? emptyFieldScore(field),
  }));
  const academics = ["curriculum", "class_size"].map(
    (field) => fieldScore(school.id, field) ?? emptyFieldScore(field),
  );
  const tuition = fieldScores(school.id, "tuition_fee");
  const transport =
    fieldScore(school.id, "transportation") ?? emptyFieldScore("transportation");
  const students = ["student_teacher_ratio", "grades_offered"].map(
    (field) => fieldScore(school.id, field) ?? emptyFieldScore(field),
  );
  const moe =
    fieldScore(school.id, "moe_registration") ??
    emptyFieldScore("moe_registration");
  const aboutYear = fieldScore(school.id, "established_year");
  const sources = sourcesForSchool(school.id);
  const hasGradeBands = tuition.some((row) => row.gradeBand);

  return (
    <article className="flex flex-1 flex-col text-base">
      <div className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 18% 20%, #02C39A 0%, transparent 42%), radial-gradient(circle at 88% 8%, #00A896 0%, transparent 38%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="text-base text-primary-foreground/80">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {copy.home}
                </Link>
              </li>
              <li aria-hidden>/</li>
              {school.city ? (
                <>
                  <li>{school.city}</li>
                  <li aria-hidden>/</li>
                </>
              ) : null}
              <li className="text-primary-foreground">{school.displayName}</li>
            </ol>
          </nav>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              {school.displayName}
            </h1>
            {school.isSynthetic ? (
              <span className="inline-flex min-h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-base font-medium text-amber-950">
                {copy.illustrative}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-base text-primary-foreground/85">
            {[school.city, copy.internationalPrivate, school.curriculumHint]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {school.address ? (
            <p className="mt-2 text-base text-primary-foreground/80">
              {copy.address}: {school.address}
            </p>
          ) : null}
          {school.aliases ? (
            <p className="mt-2 text-base text-primary-foreground/75">
              Also known as {school.aliases}
            </p>
          ) : null}
        </div>
      </div>

      <nav
        aria-label="On this page"
        className="sticky top-0 z-20 border-b border-border/80 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {JUMP.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-base font-medium text-primary underline underline-offset-4"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <section
          id="overview"
          className="scroll-mt-24 rounded-2xl border border-border/80 bg-white px-4 py-5 sm:px-6"
        >
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {copy.overviewTitle}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">{copy.overviewHelp}</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-green-50 px-4 py-4">
              <p className="text-4xl font-semibold text-confidence-supported">
                {counts.Supported}
              </p>
              <p className="mt-2 inline-flex min-h-11 items-center gap-2 text-base font-medium text-confidence-supported">
                <span aria-hidden>🟢</span> Supported
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-4">
              <p className="text-4xl font-semibold text-confidence-uncertain">
                {counts.Uncertain}
              </p>
              <p className="mt-2 inline-flex min-h-11 items-center gap-2 text-base font-medium text-confidence-uncertain">
                <span aria-hidden>🟡</span> Uncertain
              </p>
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-4">
              <p className="text-4xl font-semibold text-confidence-unknown">
                {counts.Unknown}
              </p>
              <p className="mt-2 inline-flex min-h-11 items-center gap-2 text-base font-medium text-confidence-unknown">
                <span aria-hidden>🔴</span> Unknown
              </p>
            </div>
          </div>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            {overviewSentence(counts)}
          </p>
        </section>

        <section id="glance" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {copy.atAGlance}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {glance.map(({ field, href }) => (
              <GlanceCard key={field.fieldName} field={field} href={href} />
            ))}
          </div>
        </section>

        <Section id="about" title={`About ${school.displayName}`}>
          <p className="text-base leading-relaxed text-foreground">
            {school.displayName} is an international school
            {school.city ? ` in ${school.city}` : ""}.
            {aboutYear?.claims.length
              ? ` Cited sources put the established year at ${aboutYear.valueText}.`
              : ""}{" "}
            Facts below are only what we can cite.
          </p>
          {school.address ? (
            <p className="text-base text-foreground">
              {copy.address}: {school.address}
            </p>
          ) : null}
          {school.notes ? (
            <p className="text-base text-muted-foreground">{school.notes}</p>
          ) : null}
          <FieldBlock
            field={
              fieldScore(school.id, "established_year") ??
              emptyFieldScore("established_year")
            }
          />
        </Section>

        <Section id="academics" title={copy.academics}>
          <div className="space-y-8">
            {academics.map((field) => (
              <FieldBlock key={field.fieldName} field={field} />
            ))}
          </div>
        </Section>

        <Section id="tuition" title={copy.tuition}>
          {hasGradeBands ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-base">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-3 pr-3 font-medium">Grade Band</th>
                    <th className="py-3 pr-3 font-medium">Annual</th>
                    <th className="py-3 pr-3 font-medium">Semester 1</th>
                    <th className="py-3 pr-3 font-medium">Semester 2</th>
                    <th className="py-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {tuition.map((row) => {
                    const split = parseTuitionSplit(
                      row.valueText,
                      row.claims[0]?.evidence_note,
                    );
                    return (
                      <tr
                        key={row.gradeBand ?? "unspecified"}
                        className="border-b border-border/70"
                      >
                        <td className="py-3 pr-3 font-medium">
                          {gradeBandLabel(row.gradeBand)}
                        </td>
                        <td className="py-3 pr-3 text-lg">{split.annual}</td>
                        <td className="py-3 pr-3">{split.semester1}</td>
                        <td className="py-3 pr-3">{split.semester2}</td>
                        <td className="py-3">
                          <span className="inline-flex min-h-11 items-center gap-2">
                            <span aria-hidden>{TIER_DOT[row.result.tier]}</span>
                            <span>{row.result.tier}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <FieldBlock field={tuition[0] ?? emptyFieldScore("tuition_fee")} />
          )}
          {hasGradeBands
            ? tuition.map((row) => (
                <FieldBlock
                  key={`evidence-${row.gradeBand ?? "none"}`}
                  field={row}
                />
              ))
            : null}
          <div className="pt-4">
            <FieldBlock field={transport} />
          </div>
        </Section>

        <Section id="students" title={copy.students}>
          <div className="space-y-8">
            {students.map((field) => (
              <FieldBlock key={field.fieldName} field={field} />
            ))}
          </div>
        </Section>

        <Section id="registration" title={copy.registration} distinct>
          <p className="text-base leading-relaxed text-muted-foreground">
            Status under Myanmar&apos;s Ministry of Education{" "}
            <span className="italic">
              Directive on Registration of Private Schools Teaching the
              International Curriculum
            </span>{" "}
            (November 2023), checked against the official approved list. This
            sits on its own because parents asked for registration first — it is
            not folded into academics.
          </p>
          <FieldBlock field={moe} />
        </Section>

        <Section id="rankings" title={copy.rankingsTitle}>
          <p className="text-base leading-relaxed text-muted-foreground">
            {copy.rankingsBody}
          </p>
        </Section>

        <Section id="sources" title={copy.sourcesTitle}>
          <p className="text-base text-muted-foreground">{copy.sourcesHelp}</p>
          {sources.length === 0 ? (
            <p className="text-base text-muted-foreground">
              No cited sources yet for this school.
            </p>
          ) : (
            <ul className="space-y-2">
              {sources.map((source) => (
                <li
                  key={`${source.name}-${source.sourceDate}-${source.fieldName}`}
                  className="rounded-lg border border-border/70 bg-white px-3 py-3 text-base"
                >
                  <p className="font-medium text-foreground">{source.name}</p>
                  <p className="text-muted-foreground">
                    {fieldLabel(source.fieldName)} · {source.status} ·{" "}
                    <time dateTime={source.sourceDate}>{source.sourceDate}</time>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="ask" title={copy.faqsTitle}>
          <SchoolAsk schoolId={school.id} schoolName={school.displayName} />
        </Section>
      </div>
    </article>
  );
}
