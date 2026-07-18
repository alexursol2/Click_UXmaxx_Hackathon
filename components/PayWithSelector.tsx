"use client";

import type { PayWith, AvailableToken } from "@/hooks/useSubscription";
import { cn, formatUsd } from "@/lib/utils";

/**
 * Pay-with selector — pick which coin funds the charge. "Auto" lets the SDK
 * source optimally (and combine coins); picking a coin pins the source, with an
 * automatic fallback to Auto if that coin alone can't cover it. Only shown when
 * the user holds 2+ primary tokens (otherwise there's nothing to choose).
 */
export function PayWithSelector({
  value,
  tokens,
  onChange,
  disabled,
}: {
  value: PayWith;
  tokens: AvailableToken[];
  onChange: (p: PayWith) => void;
  disabled?: boolean;
}) {
  if (tokens.length < 2) return null;

  const options: { key: PayWith; label: string; sub: string }[] = [
    { key: "auto", label: "Auto", sub: "optimal" },
    ...tokens.map((t) => ({
      key: t.type as PayWith,
      label: t.symbol,
      sub: formatUsd(t.usd),
    })),
  ];

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
        Pay with
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.key)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs transition-colors",
              value === o.key
                ? "border-[#9b03f2] bg-[#9b03f2]/15 text-[color:var(--text)]"
                : "border-[color:var(--border)] bg-[#9b03f2]/[0.05] text-[color:var(--text)] hover:bg-[#9b03f2]/[0.1]",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="font-medium">{o.label}</span>
            <span className="ml-1.5 text-[color:var(--muted)]">{o.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
