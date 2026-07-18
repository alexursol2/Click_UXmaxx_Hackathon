"use client";

import type { ChargeStage } from "@/hooks/useSubscription";
import { useSubscriptionConfig } from "./UniversalSubscriptionProvider";
import { chainName } from "@/lib/chains";
import { cn } from "@/lib/utils";

const STEPS: { key: ChargeStage; label: string }[] = [
  { key: "sourcing", label: "Sourcing funds" },
  { key: "converting", label: "Converting across chains" },
  { key: "bridging", label: "Bridging" },
  { key: "paying", label: "Paying merchant" },
  { key: "confirming", label: "Confirming on-chain" },
];


/**
 * Live stepper shown while a charge is in flight. The steps mirror what the
 * Universal Account is actually doing — sourcing, converting, bridging,
 * paying, confirming — so the wait itself demonstrates chain abstraction.
 *
 * When the charge crosses chains, a "journey" banner sits on top making the
 * money's path explicit: it starts on another chain, gets converted + bridged,
 * and lands as the settlement token on the merchant's chain. That hop is the
 * whole point of a Universal Account, so we show it, we don't hide it.
 */
export function ChargeProgress({
  stage,
  crossChain = false,
  sourceChainName,
}: {
  stage: ChargeStage;
  crossChain?: boolean;
  sourceChainName?: string | null;
}) {
  const { settlement } = useSubscriptionConfig();
  const settlementName = chainName(settlement.chainId);

  if (stage === "idle") return null;
  const activeIdx = STEPS.findIndex((s) => s.key === stage);

  // Which end of the journey is "lit" right now.
  const traveling =
    stage === "sourcing" || stage === "converting" || stage === "bridging";
  const landed = stage === "paying" || stage === "confirming";
  const from = sourceChainName || "another chain";

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[#9b03f2]/[0.04] px-4 py-3">
      {crossChain && (
        <div className="mb-3 rounded-lg border border-[#9b03f2]/25 bg-[#9b03f2]/[0.08] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Source chain */}
            <div className="flex flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                  traveling
                    ? "bg-[#9b03f2]/25 text-[color:var(--text)]"
                    : "bg-[#9b03f2]/[0.05] text-[color:var(--muted)]"
                )}
              >
                {from}
              </span>
              <span className="text-[10px] text-[color:var(--muted)]">holds funds</span>
            </div>

            {/* Animated path */}
            <div className="relative mx-1 flex-1">
              <div className="h-px w-full bg-[#9b03f2]/40" />
              <div
                className={cn(
                  "absolute -top-[5px] h-2.5 w-2.5 rounded-full bg-[#ef6ffd] shadow-[0_0_10px_#9b03f2]",
                  traveling && "animate-[slide_1.4s_ease-in-out_infinite]",
                  landed && "right-0"
                )}
                style={!traveling && landed ? { right: 0 } : { left: 0 }}
              />
            </div>

            {/* Destination chain */}
            <div className="flex flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                  landed
                    ? "bg-emerald-400/20 text-emerald-700"
                    : "bg-[#9b03f2]/[0.05] text-[color:var(--muted)]"
                )}
              >
                {settlementName}
              </span>
              <span className="text-[10px] text-[color:var(--muted)]">merchant paid</span>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-[color:var(--accent)]/80">
            {landed
              ? `Merchant receiving ${settlement.symbol} on ${settlementName}`
              : `Moving ${from} funds → ${settlement.symbol} on ${settlementName}`}
          </p>
        </div>
      )}

      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={step.key} className="flex items-center gap-2.5 text-xs">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border",
                  done && "border-[#9b03f2] bg-[#9b03f2]",
                  active && "animate-pulse border-[#9b03f2] bg-[#9b03f2]/30",
                  !done && !active && "border-[color:var(--border)] bg-transparent"
                )}
              >
                {done && (
                  <svg
                    viewBox="0 0 20 20"
                    fill="white"
                    className="h-2.5 w-2.5"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </span>
              <span
                className={cn(
                  done && "text-[color:var(--muted)]",
                  active && "font-medium text-[color:var(--accent)]",
                  !done && !active && "text-[color:var(--muted)]"
                )}
              >
                {step.label}
                {active && "…"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
