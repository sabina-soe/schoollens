type ClaimRowProps = {
  valueText: string;
  sourceName: string;
  status: string;
  sourceDate: string;
  evidenceNote?: string | null;
};

export function ClaimRow({
  valueText,
  sourceName,
  status,
  sourceDate,
  evidenceNote,
}: ClaimRowProps) {
  return (
    <li className="rounded-lg border border-border/70 bg-white px-3 py-3 text-base leading-relaxed">
      <p className="text-lg font-medium text-foreground">{valueText}</p>
      <p className="mt-1 text-base text-muted-foreground">
        <span className="text-foreground">{sourceName}</span>
        {" · "}
        {status}
        {" · "}
        <time dateTime={sourceDate}>{sourceDate}</time>
      </p>
      {evidenceNote ? (
        <p className="mt-1 text-muted-foreground">{evidenceNote}</p>
      ) : null}
    </li>
  );
}
