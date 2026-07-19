"use client";

/**
 * AccountModal — the "Account" panel that overlays the storefront.
 *
 * Signed out → the email login card. Signed in → the Click dashboard WITHOUT
 * the subscription bar: unified cross-chain balance, where to add funds, the
 * pay-with coin selector, and billing history. Rendered outside `.oc-root`, so
 * it keeps the Click theme (Quicksand + purple) rather than the storefront look.
 */

import { useEffect, useState } from "react";
import { isAddress } from "ethers";
import { useStore } from "./StoreProvider";
import { useSubscriptionConfig } from "./UniversalSubscriptionProvider";
import { LoginCard } from "./LoginCard";
import { UniversalBalanceCard } from "./UniversalBalanceCard";
import { PayWithSelector } from "./PayWithSelector";
import { BillingHistory } from "./BillingHistory";
import { LogoutIcon } from "./icons";
import { chainName } from "@/lib/chains";
import { formatUsd } from "@/lib/utils";

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

      <WithdrawPanel />

      <p className="mt-5 text-center text-xs text-[color:var(--muted)]">
        Pay for anything on the store in one click — funds are sourced from this
        unified balance across chains.
      </p>
    </div>
  );
}

/**
 * Withdraw funds from the unified balance to an EXTERNAL wallet. Same rails as a
 * payment (transfer, or Convert-then-transfer across chains) — just the user's
 * own address instead of the merchant. Non-custodial: no lock-in.
 */
function WithdrawPanel() {
  const store = useStore();
  const { settlement } = useSubscriptionConfig();
  const isSol = settlement.symbol === "SOL";
  const net = chainName(settlement.chainId);
  const available = store.universalBalance?.totalUsd ?? 0;
  const maxWithdraw = Math.floor(available * 100) / 100; // don't round above balance

  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validAddress = (a: string) =>
    isSol ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) : isAddress(a);

  const submit = () => {
    setError(null);
    const addr = address.trim();
    const amt = Number(amount);
    if (!validAddress(addr)) {
      setError(`Enter a valid ${isSol ? "Solana" : "EVM"} address`);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    if (amt > available + 1e-9) {
      setError(`Amount exceeds your balance (${formatUsd(available)})`);
      return;
    }
    store.withdraw(amt, addr); // closes the panel + shows the status card
  };

  return (
    <div className="mt-5 rounded-2xl border border-[color:var(--border)] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-[color:var(--text)]">
          Withdraw to external wallet
        </span>
        <span className="text-xs text-[color:var(--muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
              Destination address · {net}
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isSol ? "Solana address" : "0x…"}
              spellCheck={false}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 font-mono text-sm text-[color:var(--text)] placeholder:text-gray-400 focus:border-[color:var(--purple)] focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
              <span>Amount · {settlement.symbol}</span>
              <button
                type="button"
                onClick={() => setAmount(String(maxWithdraw))}
                className="normal-case text-[color:var(--purple)] hover:underline"
              >
                Max {formatUsd(available)}
              </button>
            </div>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-[color:var(--text)] placeholder:text-gray-400 focus:border-[color:var(--purple)] focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={store.charging}
            className="w-full rounded-xl bg-[color:var(--purple)] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[color:var(--purple-deep)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Withdraw
          </button>

          <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
            Sent as {settlement.symbol} on {net}. Funds on other chains are
            converted first (a network fee applies). Non-custodial — these are
            your funds, going to an address you control.
          </p>
        </div>
      )}
    </div>
  );
}
