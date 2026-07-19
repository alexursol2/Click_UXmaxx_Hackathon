"use client";

import type { ChargeStage } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

/**
 * Neutral, user-facing steps. The internal charge has more stages (sourcing,
 * converting, bridging, …) but the cross-chain conversion is an implementation
 * detail — surfacing "Converting across chains" / "Bridging" as an exchange
 * only confuses the user, so several internal stages collapse into a single
 * "Preparing payment" step here.
 */
const STEPS: { label: string; stages: ChargeStage[] }[] = [
  { label: "Preparing payment", stages: ["sourcing", "converting", "bridging"] },
  { label: "Paying merchant", stages: ["paying"] },
  { label: "Confirming on-chain", stages: ["confirming"] },
];

/**
 * Live stepper shown while a charge is in flight. Deliberately minimal: it
 * reflects progress without exposing the under-the-hood routing.
 */
export function ChargeProgress({ stage }: { stage: ChargeStage }) {
  if (stage === "idle") return null;
  const activeIdx = STEPS.findIndex((s) => s.stages.includes(stage));

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[#9b03f2]/[0.04] px-4 py-3">
      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={step.label} className="flex items-center gap-2.5 text-xs">
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
