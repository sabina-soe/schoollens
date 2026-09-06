import type { ConfidenceResult } from "@/lib/confidence";
import { cn } from "@/lib/utils";

const TIER_ICON = {
  Supported: "🟢",
  Uncertain: "🟡",
  Unknown: "🔴",
} as const;

const TIER_COLOR = {
  Supported: "text-confidence-supported",
  Uncertain: "text-confidence-uncertain",
  Unknown: "text-confidence-unknown",
} as const;

type ConfidenceBadgeProps = {
  tier: ConfidenceResult["tier"];
  score?: number;
  reason?: string;
  compact?: boolean;
  className?: string;
};

export function ConfidenceBadge({
  tier,
  score,
  reason,
  compact = false,
  className,
}: ConfidenceBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-lg bg-muted/60",
        compact ? "min-h-9 px-2 py-1" : "min-h-11 px-3 py-2",
        className,
      )}
      role="status"
      title={compact ? reason : undefined}
      aria-label={`${tier}${score != null ? `, score ${score} of 100` : ""}`}
    >
      <span
        className={cn("leading-none", compact ? "text-base" : "text-xl")}
        aria-hidden
      >
        {TIER_ICON[tier]}
      </span>
      <span
        className={cn(
          "font-semibold",
          compact ? "text-sm" : "text-base",
          TIER_COLOR[tier],
        )}
      >
        {tier}
      </span>
      {score != null ? (
        <span className="text-sm text-muted-foreground">{score}/100</span>
      ) : null}
      {reason && !compact ? (
        <span className="basis-full text-sm leading-snug text-muted-foreground">
          {reason}
        </span>
      ) : null}
    </div>
  );
}
