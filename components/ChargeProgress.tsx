"use client";

import type { ChargeStage } from "@/hooks/useSubscription";
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
 */
export function ChargeProgress({ stage }: { stage: ChargeStage }) {
  if (stage === "idle") return null;
  const activeIdx = STEPS.findIndex((s) => s.key === stage);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={step.key} className="flex items-center gap-2.5 text-xs">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border",
                  done && "border-[#aa00ff] bg-[#aa00ff]",
                  active &&
                    "animate-pulse border-[#aa00ff] bg-[#aa00ff]/30",
                  !done && !active && "border-white/15 bg-transparent"
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
                  done && "text-neutral-400",
                  active && "font-medium text-[#d580ff]",
                  !done && !active && "text-neutral-600"
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
