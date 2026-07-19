"use client";

/**
 * AccountModal — the "Account" panel that overlays the storefront.
 *
 * Signed out → the email login card. Signed in → the Click dashboard WITHOUT
 * the subscription bar: unified cross-chain balance, where to add funds, the
 * pay-with coin selector, and billing history. Rendered outside `.oc-root`, so
 * it keeps the Click theme (Quicksand + purple) rather than the storefront look.
 */

import { useEffect } from "react";
import { useStore } from "./StoreProvider";
import { LoginCard } from "./LoginCard";
import { UniversalBalanceCard } from "./UniversalBalanceCard";
import { PayWithSelector } from "./PayWithSelector";
import { BillingHistory } from "./BillingHistory";
import { LogoutIcon } from "./icons";

export function AccountModal() {
  const store = useStore();
  const { accountOpen, closeAccount, auth } = store;

  // Close on Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAccount();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountOpen, closeAccount]);

  if (!accountOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={closeAccount}
    >
      <div
        className="relative my-8 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={closeAccount}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-[color:var(--muted)] shadow-md transition-colors hover:text-[color:var(--text)]"
        >
          ✕
        </button>

        {auth === "in" ? <AccountDashboard /> : <LoginCard onLoggedIn={store.onLoggedIn} />}
      </div>
    </div>
  );
}

function AccountDashboard() {
  const store = useStore();

  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-white p-5 shadow-2xl sm:p-7">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Click" className="h-8 w-8 object-contain" />
          <span className="text-2xl font-bold tracking-tight text-[color:var(--purple)]">
            Account
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BillingHistory
            getHistory={store.getHistory}
            refreshKey={store.chargeCount}
          />
          <button
            onClick={() => void store.logout()}
            aria-label="Log out"
            title="Log out"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      <UniversalBalanceCard
        balance={store.universalBalance}
        loading={store.loading}
        address={store.ownerAddress}
        solanaAddress={store.solanaAddress}
      />

      <div className="mt-5">
        <PayWithSelector
          value={store.payWith}
          tokens={store.availableTokens}
          onChange={store.setPayWith}
          disabled={store.charging}
        />
      </div>

      <p className="mt-5 text-center text-xs text-[color:var(--muted)]">
        Pay for anything on the store in one click — funds are sourced from this
        unified balance across chains.
      </p>
    </div>
  );
}
