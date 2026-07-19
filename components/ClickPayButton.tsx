"use client";

/**
 * ClickPayButton — a drop-in "pay from your unified balance" button.
 *
 *   <ClickPayButton amount={9.99} label="Pro plan" />
 *
 * Signed out → opens the login popup, then resumes the purchase automatically.
 * Signed in → charges silently; progress shows in the global status card.
 * Style it via `className`/`children`, or use the default purple button.
 */

import { useClickAccount } from "./ClickProvider";
import { formatUsd } from "@/lib/utils";

export function ClickPayButton({
  amount,
  label,
  className,
  children,
  disableWhileCharging = true,
}: {
  /** Amount to charge, in USD (settlement token units). */
  amount: number;
  /** Human label for the status card / receipt (e.g. product name). */
  label?: string;
  className?: string;
  children?: React.ReactNode;
  disableWhileCharging?: boolean;
}) {
  const { pay, charging } = useClickAccount();

  return (
    <button
      type="button"
      onClick={() => pay(amount, label ?? `Payment ${formatUsd(amount)}`)}
      disabled={disableWhileCharging && charging}
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--purple)] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[color:var(--purple-deep)] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {children ?? `Pay ${formatUsd(amount)} in one Click`}
    </button>
  );
}
