export default function SchoolDetailLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="h-72 animate-pulse bg-primary/80" />
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
