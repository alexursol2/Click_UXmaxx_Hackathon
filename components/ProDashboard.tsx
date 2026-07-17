"use client";

import { useEffect, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { logout as magicLogout } from "@/lib/magic";
import { friendlyError } from "@/lib/utils";
import { UniversalBalanceCard } from "./UniversalBalanceCard";
import { SubscriptionCard } from "./SubscriptionCard";
import { BillingHistory } from "./BillingHistory";
import { Button } from "./Button";

export function ProDashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const sub = useSubscription();
  const [uiError, setUiError] = useState<string | null>(null);

  // Show the unified balance immediately on entry, before any upgrade.
  useEffect(() => {
    sub.refreshBalance().catch(() => setUiError(friendlyError("network")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <video
            src="/logo.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="h-9 w-9 rounded-xl object-cover"
          />
          <span className="text-lg font-semibold tracking-tight">Nimbus</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span className="hidden sm:inline">Signed in</span>
          <Button variant="subtle" onClick={doLogout} className="px-3 py-2">
            Log out
          </Button>
        </div>
      </header>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your Pro dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {sub.subscriptionActive
            ? "You're on Pro. Everything below is unlocked."
            : "Upgrade to unlock Pro — paid instantly from your unified balance."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <UniversalBalanceCard
          balance={sub.universalBalance}
          loading={sub.loading}
          address={sub.ownerAddress}
        />
        <SubscriptionCard
          active={sub.subscriptionActive}
          upgrading={sub.loading}
          charging={sub.charging}
          stage={sub.stage}
          chargeCount={sub.chargeCount}
          nextChargeAt={sub.nextChargeAt}
          error={uiError ?? sub.autoErrorMessage}
          onUpgrade={onUpgrade}
          onChargeAgain={onChargeAgain}
        />
      </div>

      <div className="mt-6">
        <BillingHistory
          getHistory={sub.getHistory}
          refreshKey={sub.chargeCount}
        />
      </div>
    </div>
  );
}
