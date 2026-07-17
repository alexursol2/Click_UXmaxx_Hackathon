"use client";

import { useEffect, useState } from "react";
import { SUBSCRIPTION, DEMO_BILLING } from "@/lib/config";
import type { ChargeStage } from "@/hooks/useSubscription";
import { Button } from "./Button";
import { ChargeProgress } from "./ChargeProgress";

interface Props {
  active: boolean;
  upgrading: boolean;
  charging: boolean;
  stage: ChargeStage;
  chargeCount: number;
  nextChargeAt: number | null;
  error: string | null;
  onUpgrade: () => void;
  onChargeAgain: () => void;
}

const perks = [
  "Unlimited dashboards & alerts",
  "Real-time cross-chain analytics",
  "Priority support",
];

/** 1s ticker for the "next charge in…" countdown. */
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

export function SubscriptionCard({
  active,
  upgrading,
  charging,
  stage,
  chargeCount,
  nextChargeAt,
  error,
  onUpgrade,
  onChargeAgain,
}: Props) {
  const busy = upgrading || charging;
  const price = `${SUBSCRIPTION.display}/${SUBSCRIPTION.interval}`;
  const secondsLeft = useCountdown(nextChargeAt);
  const demoBilling = DEMO_BILLING.intervalSeconds > 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Nimbus Pro</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Everything in Free, plus the good stuff — {price}.
          </p>
        </div>
        {active && (
          <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            ● Pro active
          </span>
        )}
      </div>

      <ul className="mt-5 space-y-2">
        {perks.map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm text-neutral-300">
            <CheckIcon />
            {p}
          </li>
        ))}
      </ul>

      <div className="mt-7 space-y-4">
        {charging && <ChargeProgress stage={stage} />}

        {!active ? (
          <>
            <Button
              onClick={onUpgrade}
              busy={busy}
              className="w-full text-base"
            >
              {charging ? "Processing payment…" : `Upgrade to Pro — ${price}`}
            </Button>
            <p className="text-center text-xs text-neutral-500">
              Paid from your unified balance. No popups, no gas token juggling.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
              <CheckIcon className="text-emerald-300" />
              <div className="text-sm">
                <p className="font-medium text-emerald-200">
                  Payment confirmed
                </p>
                <p className="text-emerald-300/70">
                  {price} · renews automatically
                </p>
              </div>
            </div>

            {secondsLeft !== null && !charging ? (
              <div className="flex items-center justify-between rounded-xl border border-[#aa00ff]/30 bg-[#aa00ff]/10 px-4 py-3">
                <span className="text-sm text-[#d580ff]">
                  Next billing cycle
                </span>
                <span className="font-mono text-sm font-semibold text-white">
                  {secondsLeft}s
                </span>
              </div>
            ) : (
              !charging && (
                <Button
                  variant="ghost"
                  onClick={onChargeAgain}
                  busy={charging}
                  className="w-full"
                >
                  Simulate next month&apos;s charge
                </Button>
              )
            )}

            <p className="text-center text-xs text-neutral-500">
              {chargeCount} recurring{" "}
              {chargeCount === 1 ? "charge" : "charges"} settled on-chain —
              each with zero popups.
              {demoBilling &&
                ` Demo mode bills every ${DEMO_BILLING.intervalSeconds}s.`}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-5 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckIcon({ className = "text-[#d580ff]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 ${className}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
