"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

type SchoolSearchFormProps = {
  initialQuery?: string;
  compact?: boolean;
};

export function SchoolSearchForm({
  initialQuery = "",
  compact = false,
}: SchoolSearchFormProps) {
  return (
    <form
      action="/"
      className={
        compact
          ? "flex w-full items-center gap-2"
          : "flex w-full flex-col gap-3 sm:flex-row"
      }
      role="search"
    >
      <label className="sr-only" htmlFor={compact ? "school-search-compact" : "school-search"}>
        {copy.searchLabel}
      </label>
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={compact ? "school-search-compact" : "school-search"}
          name="q"
          type="search"
          defaultValue={initialQuery}
          placeholder={copy.searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          className={
            compact
              ? "h-11 w-full rounded-lg border border-input bg-white pr-3 pl-11 text-sm text-foreground outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
              : "h-12 w-full rounded-lg border border-input bg-white pr-3 pl-11 text-base text-foreground outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
          }
        />
      </div>
      <Button
        type="submit"
        className={compact ? "h-11 min-w-20 px-4" : "h-12 min-w-28 px-6"}
      >
        {copy.searchButton}
      </Button>
    </form>
  );
}
