import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/80 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <p className="text-lg font-semibold tracking-tight text-primary">
            SchoolLens
          </p>
          <p className="text-xs text-muted-foreground">Shell deploy</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            SchoolLens
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Clear confidence signals on school claims — Supported, Uncertain, or
            Unknown — backed by sources you can check.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="school-search">
            Search schools
          </label>
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="school-search"
              name="q"
              type="search"
              disabled
              placeholder="Search schools (coming next)"
              className="h-12 w-full rounded-lg border border-input bg-white pr-3 pl-11 text-base text-foreground outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>
          <Button type="button" disabled className="h-12 min-w-28 px-6">
            Search
          </Button>
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
      </main>
    </div>
  );
}
