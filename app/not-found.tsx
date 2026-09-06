import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          That page is not in SchoolLens.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary"
        >
          ← Back to {copy.appName}
        </Link>
      </main>
    </div>
  );
}
