"use client";

import { useEffect, useState } from "react";
import type {
  ChargeStage,
  PayWith,
  AvailableToken,
} from "@/hooks/useSubscription";
import { cn, formatUsd } from "@/lib/utils";
import { useHoverable } from "@/hooks/useHoverable";
import { useSubscriptionConfig } from "./UniversalSubscriptionProvider";
import { Button } from "./Button";
import { ChargeProgress } from "./ChargeProgress";
import { PayWithSelector } from "./PayWithSelector";

export interface SubscriptionPanelProps {
  active: boolean;
  upgrading: boolean;
  charging: boolean;
  stage: ChargeStage;
  chargeCount: number;
  nextChargeAt: number | null;
  error: string | null;
  partialPayment: boolean;
  lowBalancePaused: boolean;
  cancelled: boolean;
  paidUntil: number | null;
  payWith: PayWith;
  availableTokens: AvailableToken[];
  estimatedFee: number | null;
  estimatedCrossChain: boolean;
  estimating: boolean;
  onPayWith: (p: PayWith) => void;
  onUpgrade: () => void;
  onChargeAgain: () => void;
  onCancel: () => void;
  onResume: () => void;
}

const PERKS = [
  "Unlimited dashboards & alerts",
  "Real-time cross-chain analytics",
  "Priority support",
];

function useCountdown(target: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!target) {
      setLeft(null);
      return;
    }
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

/**
 * Subscription as a bottom bar. Collapsed it shows a headline + GET PRO button;
 * hovering the bar expands it to reveal the Pro benefits and the pay-with / fee
 * / management controls.
 */
export function SubscriptionBar(props: SubscriptionPanelProps) {
  const {
    active,
    upgrading,
    charging,
    stage,
    chargeCount,
    nextChargeAt,
    error,
    partialPayment,
    lowBalancePaused,
    cancelled,
    paidUntil,
    payWith,
    availableTokens,
    estimatedFee,
    estimatedCrossChain,
    estimating,
    onPayWith,
    onUpgrade,
    onChargeAgain,
    onCancel,
    onResume,
  } = props;

  const { price: SUBSCRIPTION, demoBilling: DEMO_BILLING } =
    useSubscriptionConfig();
  const hoverable = useHoverable();
  const [open, setOpen] = useState(false);
  const busy = upgrading || charging;
  const price = `${SUBSCRIPTION.display}/${SUBSCRIPTION.interval}`;
  const secondsLeft = useCountdown(nextChargeAt);
  const demoBilling = DEMO_BILLING.intervalSeconds > 0;
  const validUntil = formatValidUntil(paidUntil, demoBilling);

  const headline = active
    ? "CLICK PRO — ACTIVE"
    : "UPGRADE TO ACCESS PRO FEATURES";

  const subline = active
    ? validUntil
      ? demoBilling
        ? `Valid until ${validUntil} · cycle ${Math.min(chargeCount, DEMO_BILLING.maxCycles)}/${DEMO_BILLING.maxCycles}`
        : `Renews monthly · valid until ${validUntil} · cancel anytime`
      : price
    : price; // detailed fee lives under the pay-with selector when expanded

  return (
    <div
      {...(hoverable
        ? {
            onMouseEnter: () => setOpen(true),
            onMouseLeave: () => setOpen(false),
          }
        : {})}
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] px-5 py-4 transition-all sm:px-6"
    >
      {/* Top row — always visible; hover (desktop) or tap (mobile) to expand */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={hoverable ? undefined : () => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-wide text-[color:var(--text)]">
              {headline}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[color:var(--muted)]">
              {subline}
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "h-4 w-4 shrink-0 text-[color:var(--muted)] transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <div className="shrink-0">
          {charging ? (
            <span className="text-sm text-[color:var(--muted)]">
              Processing…
            </span>
          ) : active ? (
            secondsLeft !== null ? (
              <span className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 font-mono text-sm text-[color:var(--text)]">
                Next {secondsLeft}s
              </span>
            ) : (
              <Button variant="ghost" onClick={onChargeAgain}>
                Charge again
              </Button>
            )
          ) : (
            <Button onClick={onUpgrade} busy={busy}>
              GET PRO
            </Button>
          )}
        </div>
      </div>

      {/* Inline progress while charging */}
      {charging && (
        <div className="mt-4">
          <ChargeProgress stage={stage} />
        </div>
      )}

      {/* Banners */}
      {partialPayment && !charging && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
          <p className="text-sm font-medium text-amber-600">
            Funds moved, payment not finished
          </p>
          <Button variant="ghost" onClick={onChargeAgain} className="mt-2">
            Finish payment
          </Button>
        </div>
      )}
      {lowBalancePaused && !charging && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-xs text-amber-600">
          Auto-billing paused — balance running low. Add funds to resume.
        </div>
      )}

      {/* Hover-expanded details */}
      {open && !charging && (
        <div className="mt-4 space-y-4 border-t border-[color:var(--border)] pt-4">
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {PERKS.map((p) => (
              <li
                key={p}
                className="flex items-center gap-2 text-xs text-[color:var(--muted)]"
              >
                <span className="h-1 w-1 rounded-full bg-[color:var(--purple)]" />
                {p}
              </li>
            ))}
          </ul>

          {!active && !cancelled && (
            <div className="space-y-2">
              <PayWithSelector
                value={payWith}
                tokens={availableTokens}
                onChange={onPayWith}
                disabled={busy}
              />
              <FeeEstimate
                fee={estimatedFee}
                crossChain={estimatedCrossChain}
                estimating={estimating}
              />
            </div>
          )}

          {active &&
            (cancelled ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-amber-600">
                  Cancelled — no renewal
                  {validUntil ? `, access until ${validUntil}.` : "."}
                </p>
                <Button variant="ghost" onClick={onResume}>
                  Resume
                </Button>
              </div>
            ) : (
              <button
                onClick={onCancel}
                className="text-xs text-[color:var(--muted)] underline-offset-2 transition-colors hover:text-[color:var(--text)] hover:underline"
              >
                Cancel subscription
              </button>
            ))}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Predicted network fee for the next charge, shown under the pay-with selector.
 * Comes from a free read-only quote (no signature, no spend) and re-computes
 * when the balance or the chosen coin changes. Distinguishes a same-chain
 * transfer from a cross-chain route (which pays for a swap + a bridge).
 */
function FeeEstimate({
  fee,
  crossChain,
  estimating,
}: {
  fee: number | null;
  crossChain: boolean;
  estimating: boolean;
}) {
  if (estimating && fee == null) {
    return (
      <p className="text-xs text-[color:var(--muted)]">
        Estimating network fee…
      </p>
    );
  }
  if (fee == null) return null;
  return (
    <p className="text-xs text-[color:var(--muted)]">
      Est. network fee ~{formatUsd(fee)} ·{" "}
      <span className="text-[color:var(--text)]">
        {crossChain ? "cross-chain (swap + bridge)" : "same-chain"}
      </span>
    </p>
  );
}

function formatValidUntil(paidUntil: number | null, demo: boolean): string {
  if (!paidUntil) return "";
  const d = new Date(paidUntil);
  return demo
    ? d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}
