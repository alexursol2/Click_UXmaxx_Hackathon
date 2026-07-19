"use client";

import { useEffect, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import type { UniversalBalance } from "@/hooks/useUniversalUpgrade";
import { logout as magicLogout } from "@/lib/magic";
import { friendlyError } from "@/lib/utils";
import { UniversalBalanceCard } from "./UniversalBalanceCard";
import { SubscriptionBar } from "./SubscriptionBar";
import { BillingHistory } from "./BillingHistory";
import { LogoutIcon } from "./icons";

export function ProDashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const sub = useSubscription();
  const [uiError, setUiError] = useState<string | null>(null);

  // Show the unified balance immediately on entry, then keep it fresh with a
  // lightweight poll every 5s (replaces the manual refresh button).
  useEffect(() => {
    let alive = true;
    const tick = () => {
      sub.refreshBalance().catch(() => {
        if (alive) setUiError(friendlyError("network"));
      });
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Freeze the balance shown to the user while a charge is in flight. During a
  // charge the underlying balance dips mid-flight (funds are sourced/converted
  // before the payment settles); showing that would flash a wrong, lower number.
  // We snapshot the balance and only let the display catch up once the charge
  // finishes — so the number moves once, straight to its settled value.
  const [displayBalance, setDisplayBalance] = useState<UniversalBalance | null>(
    null
  );
  useEffect(() => {
    if (!sub.charging) setDisplayBalance(sub.universalBalance);
  }, [sub.universalBalance, sub.charging]);

  const onUpgrade = async () => {
    setUiError(null);
    try {
      await sub.upgrade(); // establish the Universal Account
      await sub.chargeSubscription(); // first charge (delegation rides along)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[upgrade failed] raw error:", e);
      setUiError(friendlyError(e));
    }
  };

  const onChargeAgain = async () => {
    setUiError(null);
    try {
      await sub.chargeSubscription();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[charge failed] raw error:", e);
      setUiError(friendlyError(e));
    }
  };

  const doLogout = async () => {
    await magicLogout();
    onLoggedOut();
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 flex items-center justify-between sm:mb-14">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Click"
            className="h-10 w-10 object-contain"
          />
          <span className="text-4xl font-bold tracking-tight text-[color:var(--purple)]">
            Click
          </span>
        </div>
        <div className="flex items-center gap-3">
          <BillingHistory
            getHistory={sub.getHistory}
            refreshKey={sub.chargeCount}
          />
          <button
            onClick={doLogout}
            aria-label="Log out"
            title="Log out"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      <UniversalBalanceCard
        balance={displayBalance}
        loading={sub.loading}
        address={sub.ownerAddress}
        solanaAddress={sub.solanaAddress}
      />

      <div className="mt-6">
        <SubscriptionBar
          active={sub.subscriptionActive}
          upgrading={sub.loading}
          charging={sub.charging}
          stage={sub.stage}
          chargeCount={sub.chargeCount}
          nextChargeAt={sub.nextChargeAt}
          error={uiError ?? sub.autoErrorMessage}
          partialPayment={sub.partialPayment}
          lowBalancePaused={sub.lowBalancePaused}
          cancelled={sub.cancelled}
          paidUntil={sub.paidUntil}
          payWith={sub.payWith}
          availableTokens={sub.availableTokens}
          estimatedFee={sub.estimatedFee}
          estimatedCrossChain={sub.estimatedCrossChain}
          estimating={sub.estimating}
          onPayWith={sub.setPayWith}
          onUpgrade={onUpgrade}
          onChargeAgain={onChargeAgain}
          onCancel={sub.cancelSubscription}
          onResume={sub.resumeSubscription}
        />
      </div>
    </div>
  );
}
