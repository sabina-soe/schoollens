import Link from "next/link";
import { SchoolSearchForm } from "@/components/SchoolSearchForm";
import { copy } from "@/lib/copy";

type SiteHeaderProps = {
  compactSearch?: boolean;
};

export function SiteHeader({ compactSearch = false }: SiteHeaderProps) {
  return (
    <header className="border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center text-lg font-semibold tracking-tight text-primary"
        >
          {copy.appName}
        </Link>
        {compactSearch ? (
          <div className="min-w-0 flex-1">
            <SchoolSearchForm compact />
          </div>
        ) : null}
      </div>
    </header>
  );
}
