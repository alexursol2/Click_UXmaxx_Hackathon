"use client";

import { useEffect, useState } from "react";
import type { UniversalBalance } from "@/hooks/useUniversalUpgrade";
import { chainName } from "@/lib/chains";
import { cn, formatUsd } from "@/lib/utils";
import { TokenIcon } from "./TokenIcon";

const STABLE = new Set(["USDC", "USDT"]);

/**
 * Human-readable token amount. Never uses scientific notation — tiny balances
 * (e.g. 0.0000988 ETH) are shown as a plain, trimmed decimal instead of
 * "9.88e-5", which reads as noise to a user.
 */
function formatToken(n: number): string {
  if (!n) return "0";
  if (n < 1) {
    // Up to 8 decimals, trailing zeros trimmed. Covers dust down to ~1e-8
    // without ever falling back to exponential form.
    const s = n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    return s === "0" ? "<0.00000001" : s;
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function UniversalBalanceCard({
  balance,
  loading,
  address,
  solanaAddress,
}: {
  balance: UniversalBalance | null;
  loading: boolean;
  address?: string | null;
  solanaAddress?: string | null;
}) {
  const [showAddFunds, setShowAddFunds] = useState(false);

  const holdings = (balance?.assets ?? [])
    .filter((a) => a.amountInUSD > 0.005)
    .map((a) => ({
      symbol: a.tokenType.toUpperCase(),
      usd: a.amountInUSD,
      amount: a.amount,
      chains: (a.chainAggregation ?? [])
        .filter((c) => c.amountInUSD > 0.005)
        .map((c) => chainName(c.token?.chainId))
        .filter((v, i, arr) => arr.indexOf(v) === i),
    }))
    .sort((x, y) => y.usd - x.usd);

  return (
    <div className="relative rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel)] p-6 sm:p-8">
      {/* Unified balance — the hero number — with Add funds opposite it */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
            Unified balance
          </p>
          <div className="mt-2">
            {loading && !balance ? (
              <div className="h-16 w-56 animate-pulse rounded-xl bg-[#9b03f2]/10" />
            ) : (
              <div className="text-6xl font-bold leading-none tracking-tight text-[color:var(--text)] sm:text-7xl">
                {formatUsd(balance?.totalUsd ?? 0)}
              </div>
            )}
          </div>
        </div>

        {address && (
          <button
            onClick={() => setShowAddFunds(true)}
            className="shrink-0 rounded-xl bg-[#9b03f2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7209a5] active:scale-[0.99]"
          >
            Add funds
          </button>
        )}
      </div>

      {/* Holdings — icon + coin/amount big & coloured; chain + native amount grey */}
      {holdings.length > 0 && (
        <div className="mt-10 space-y-5">
          {holdings.map((h) => (
            <div
              key={h.symbol}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <TokenIcon symbol={h.symbol} className="h-9 w-9" />
                <div>
                  <div className="text-2xl font-bold leading-tight text-[color:var(--text)]">
                    {h.symbol}
                  </div>
                  <div className="text-sm text-[color:var(--muted)]">
                    {h.chains.join(" · ")}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold leading-tight text-[color:var(--accent)]">
                  {formatUsd(h.usd)}
                </div>
                {!STABLE.has(h.symbol) && (
                  <div className="text-xs text-[color:var(--muted)]">
                    {formatToken(h.amount)} {h.symbol}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddFunds && address && (
        <AddFundsModal
          address={address}
          solanaAddress={solanaAddress}
          onClose={() => setShowAddFunds(false)}
        />
      )}
    </div>
  );
}

/**
 * Add-funds dialog: the deposit addresses (each copyable) plus a short guide on
 * how topping up works. Both addresses feed the same unified balance.
 */
function AddFundsModal({
  address,
  solanaAddress,
  onClose,
}: {
  address: string;
  solanaAddress?: string | null;
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add funds"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--text)]">
              Add funds
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Deposit{" "}
              <span className="text-[color:var(--text)]">
                ETH, USDC, USDT, BNB or SOL
              </span>{" "}
              — it all becomes one spendable balance.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-3 shrink-0 text-lg text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <AddressRow
            label="EVM address"
            networks="Ethereum · Base · Arbitrum · BNB · XLayer"
            address={address}
          />
          {solanaAddress && (
            <AddressRow
              label="Solana address"
              networks="SOL · USDC"
              address={solanaAddress}
            />
          )}
        </div>

        <div className="mt-6 border-t border-[color:var(--border)] pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            How to add funds
          </p>
          <ol className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
            <li className="flex gap-2">
              <StepDot n={1} />
              <span>
                Copy the address for the network your tokens are on.
              </span>
            </li>
            <li className="flex gap-2">
              <StepDot n={2} />
              <span>
                Send from any exchange or wallet — EVM tokens to the EVM address,
                {solanaAddress ? " SOL/USDC to the Solana address" : ""}.
              </span>
            </li>
            <li className="flex gap-2">
              <StepDot n={3} />
              <span>
                Funds land in your unified balance automatically, usually within
                a minute — no bridging or swapping needed.
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/** One deposit address, labelled by network, with a copy button. */
function AddressRow({
  label,
  networks,
  address,
}: {
  label: string;
  networks: string;
  address: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* address is shown in full below */
    }
  };
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[#9b03f2]/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent)]">
            {label}
          </p>
          <p className="text-[10px] text-[color:var(--muted)]">{networks}</p>
        </div>
        <button
          onClick={copy}
          className={cn(
            "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            copied
              ? "border-emerald-400/40 text-emerald-600"
              : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--text)]"
          )}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="mt-2 block break-all font-mono text-xs text-[color:var(--text)]">
        {address}
      </code>
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#9b03f2] text-[10px] font-bold text-white">
      {n}
    </span>
  );
}
