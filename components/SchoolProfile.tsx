import Link from "next/link";
import { ClaimRow } from "@/components/ClaimRow";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { SchoolAsk } from "@/components/SchoolAsk";
import {
  emptyFieldScore,
  fieldScore,
  overviewCounts,
  scoreSchool,
  type CatalogSchool,
  type ScoredField,
} from "@/lib/catalog";
import { copy } from "@/lib/copy";
import { fieldLabel, gradeBandLabel } from "@/lib/fields";

const JUMP = [
  { href: "#about", label: copy.about },
  { href: "#academics", label: copy.academics },
  { href: "#tuition", label: copy.tuition },
  { href: "#students", label: copy.students },
  { href: "#registration", label: copy.registration },
  { href: "#ask", label: copy.faqsTitle },
] as const;

const GLANCE_FIELDS = [
  "grades_offered",
  "tuition_fee",
  "student_teacher_ratio",
  "established_year",
] as const;

function FactCard({ field }: { field: ScoredField }) {
  return (
    <div className="min-h-28 rounded-xl border border-border/80 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {fieldLabel(field.fieldName)}
        {field.gradeBand ? ` · ${gradeBandLabel(field.gradeBand)}` : ""}
      </p>
      <p className="mt-1 text-lg font-semibold leading-snug text-foreground">
        {field.claims.length ? field.valueText : "Not listed yet"}
      </p>
      <div className="mt-2">
        <ConfidenceBadge
          compact
          tier={field.result.tier}
          score={field.result.score}
          reason={field.result.reason}
        />
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 space-y-4 rounded-xl border border-border/80 bg-white px-4 py-5 sm:px-6"
    >
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function FieldBlock({ field }: { field: ScoredField }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {fieldLabel(field.fieldName)}
          </h3>
          {field.gradeBand ? (
            <p className="text-sm text-muted-foreground">
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
          {copy.unknownNextStep}
        </p>
      ) : (
        <>
          {field.result.conflicts.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-confidence-uncertain/40 bg-amber-50/70 px-3 py-3">
              <p className="text-sm font-medium text-amber-950">
                Conflicting values
              </p>
              {field.result.conflicts.map((conflict) => (
                <p
                  key={`${conflict.a.id}-${conflict.b.id}`}
                  className="text-sm text-amber-900"
                >
                  {conflict.a.value_text} vs {conflict.b.value_text} —{" "}
                  {conflict.note}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xl font-semibold tracking-tight text-foreground">
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

function aboutBlurb(school: CatalogSchool, year: ScoredField | null) {
  const bits = [`${school.displayName} is an international school`];
  if (school.city) bits[0] += ` in ${school.city}`;
  bits[0] += ".";
  if (year?.claims.length) {
    bits.push(`Cited sources put the established year at ${year.valueText}.`);
  }
  bits.push(
    "The sections below show only facts we can cite, each with a Supported, Uncertain, or Unknown label.",
  );
  return bits.join(" ");
}

export function SchoolProfile({ school }: { school: CatalogSchool }) {
  const scored = scoreSchool(school.id);
  const counts = overviewCounts(school.id);
  const glance = GLANCE_FIELDS.map(
    (field) => fieldScore(school.id, field) ?? emptyFieldScore(field),
  );
  const academics = ["curriculum", "class_size"].map(
    (field) => fieldScore(school.id, field) ?? emptyFieldScore(field),
  );
  const tuition = scored.filter((row) => row.fieldName === "tuition_fee");
  const transport =
    fieldScore(school.id, "transportation") ?? emptyFieldScore("transportation");
  const students = ["student_teacher_ratio", "grades_offered"].map(
    (field) => fieldScore(school.id, field) ?? emptyFieldScore(field),
  );
  const moe =
    fieldScore(school.id, "moe_registration") ??
    emptyFieldScore("moe_registration");
  const aboutYear = fieldScore(school.id, "established_year");
  const total = counts.Supported + counts.Uncertain + counts.Unknown;

  return (
    <article className="flex flex-1 flex-col">
      <div className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 18% 20%, #02C39A 0%, transparent 42%), radial-gradient(circle at 88% 8%, #00A896 0%, transparent 38%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 pt-8 pb-28 sm:pt-10">
          <nav aria-label="Breadcrumb" className="text-sm text-primary-foreground/80">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="underline-offset-4 hover:underline">
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
              <span className="inline-flex min-h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-950">
                {copy.illustrative}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-base text-primary-foreground/85">
            {[school.city, copy.internationalPrivate, school.curriculumHint]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {school.aliases ? (
            <p className="mt-2 text-sm text-primary-foreground/75">
              Also known as {school.aliases}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-20 w-full max-w-5xl px-4">
        <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-md sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {copy.overviewTitle}
              </p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {copy.overviewHelp}
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 text-sm">
              <li>🟢 Supported {counts.Supported}</li>
              <li>🟡 Uncertain {counts.Uncertain}</li>
              <li>🔴 Unknown {counts.Unknown}</li>
            </ul>
          </div>
          <div
            className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Supported ${counts.Supported}, Uncertain ${counts.Uncertain}, Unknown ${counts.Unknown}`}
          >
            {counts.Supported ? (
              <div
                className="bg-confidence-supported"
                style={{ width: `${(counts.Supported / total) * 100}%` }}
              />
            ) : null}
            {counts.Uncertain ? (
              <div
                className="bg-confidence-uncertain"
                style={{ width: `${(counts.Uncertain / total) * 100}%` }}
              />
            ) : null}
            {counts.Unknown ? (
              <div
                className="bg-confidence-unknown"
                style={{ width: `${(counts.Unknown / total) * 100}%` }}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {copy.atAGlance}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {glance.map((field) => (
              <FactCard
                key={`${field.fieldName}-${field.gradeBand ?? ""}`}
                field={field}
              />
            ))}
          </div>
        </div>
      </div>

      <nav
        aria-label="On this page"
        className="sticky top-0 z-20 mt-6 border-y border-border/80 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {JUMP.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-muted"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-6">
          <Section id="about" title={`About ${school.displayName}`}>
            <p className="text-base leading-relaxed text-foreground">
              {aboutBlurb(school, aboutYear)}
            </p>
            {school.notes ? (
              <p className="text-sm text-muted-foreground">{school.notes}</p>
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
            {tuition.length > 1 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Grade band</th>
                      <th className="py-2 pr-3 font-medium">Tuition</th>
                      <th className="py-2 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tuition.map((row) => (
                      <tr
                        key={row.gradeBand ?? "unspecified"}
                        className="border-b border-border/70"
                      >
                        <td className="py-3 pr-3 font-medium">
                          {gradeBandLabel(row.gradeBand)}
                        </td>
                        <td className="py-3 pr-3">{row.valueText}</td>
                        <td className="py-3">
                          <ConfidenceBadge
                            compact
                            tier={row.result.tier}
                            score={row.result.score}
                            reason={row.result.reason}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <FieldBlock field={tuition[0] ?? emptyFieldScore("tuition_fee")} />
            )}
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

          <Section id="registration" title={copy.registration}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Status under Myanmar&apos;s Ministry of Education{" "}
              <span className="italic">
                Directive on Registration of Private Schools Teaching the
                International Curriculum
              </span>{" "}
              (November 2023), checked against the official approved list.
            </p>
            <FieldBlock field={moe} />
          </Section>

          <Section id="rankings" title={copy.rankingsTitle}>
            <p className="text-base leading-relaxed text-muted-foreground">
              {copy.rankingsBody}
            </p>
          </Section>

          <Section id="ask" title={copy.faqsTitle}>
            <SchoolAsk schoolId={school.id} schoolName={school.displayName} />
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border/80 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-foreground">On this page</p>
            <ul className="mt-2 space-y-1 text-sm">
              {JUMP.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-primary"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/80 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Key facts</p>
            <dl className="mt-3 space-y-3 text-sm">
              {glance.map((field) => (
                <div key={field.fieldName}>
                  <dt className="text-muted-foreground">{fieldLabel(field.fieldName)}</dt>
                  <dd className="font-medium text-foreground">
                    {field.claims.length ? field.valueText : "Unknown"}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">{fieldLabel("moe_registration")}</dt>
                <dd className="font-medium text-foreground">
                  {moe.claims.length ? moe.valueText : "Unknown"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </article>
  );
}
