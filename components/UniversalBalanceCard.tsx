"use client";

import { useState } from "react";
import type { UniversalBalance } from "@/hooks/useUniversalUpgrade";
import { useHoverable } from "@/hooks/useHoverable";
import { chainName } from "@/lib/chains";
import { cn, formatUsd, shortAddress } from "@/lib/utils";
import { RefreshIcon } from "./icons";
import { TokenIcon } from "./TokenIcon";

const STABLE = new Set(["USDC", "USDT"]);

function formatToken(n: number): string {
  if (!n) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1)
    return n
      .toFixed(6)
      .replace(/0+$/, "")
      .replace(/\.$/, "");
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function UniversalBalanceCard({
  balance,
  loading,
  address,
  solanaAddress,
  onRefresh,
}: {
  balance: UniversalBalance | null;
  loading: boolean;
  address?: string | null;
  solanaAddress?: string | null;
  onRefresh?: () => Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

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
      {/* Refresh — top-right */}
      {onRefresh && (
        <button
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh balance"
          title="Refresh balance"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)] disabled:opacity-60"
        >
          <RefreshIcon className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </button>
      )}

      {/* Wallet addresses — EVM left, Solana right, each labelled by network */}
      {address && (
        <div className="pr-12">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <AddressChip label="Ethereum" address={address} />
            {solanaAddress && (
              <AddressChip label="Solana" address={solanaAddress} />
            )}
          </div>
          <div className="mt-2">
            <HowToAddFunds address={address} solanaAddress={solanaAddress} />
          </div>
        </div>
      )}

      {/* Unified balance — the hero number */}
      <div className="mt-8">
        {loading && !balance ? (
          <div className="h-16 w-56 animate-pulse rounded-xl bg-[#9b03f2]/10" />
        ) : (
          <div className="text-6xl font-bold leading-none tracking-tight text-[color:var(--text)] sm:text-7xl">
            {formatUsd(balance?.totalUsd ?? 0)}
          </div>
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
    </div>
  );
}

/** One wallet address, labelled by network, with its own copy button. */
function AddressChip({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* address is shown in full via title */
    }
  };
  return (
    <div>
      <p className="text-xs text-[color:var(--muted)]">{label}</p>
      <button
        onClick={copy}
        title={address}
        className="group mt-1 flex items-center gap-2"
      >
        <code className="font-mono text-lg font-semibold tracking-tight text-[color:var(--accent)] sm:text-xl">
          {shortAddress(address)}
        </code>
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            copied
              ? "text-emerald-600"
              : "text-[color:var(--muted)] group-hover:text-[color:var(--text)]"
          )}
        >
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
    </div>
  );
}

/**
 * "how to add funds?" — opens deposit info on hover (desktop) or tap (mobile).
 * Shows the EVM deposit address and (when known) the Solana deposit address —
 * both feed the same unified balance.
 */
function HowToAddFunds({
  address,
  solanaAddress,
}: {
  address: string;
  solanaAddress?: string | null;
}) {
  const hoverable = useHoverable();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-block"
      {...(hoverable
        ? {
            onMouseEnter: () => setOpen(true),
            onMouseLeave: () => setOpen(false),
          }
        : {})}
    >
      <button
        onClick={hoverable ? undefined : () => setOpen((v) => !v)}
        className="text-xs text-[color:var(--muted)] underline-offset-2 hover:underline"
      >
        how to add funds?
      </button>
      {open && (
        // pt-2 is a transparent "safe bridge" so moving the mouse from the
        // trigger onto the panel doesn't cross a gap and close it.
        <div className="absolute left-0 top-full z-30 pt-2">
          <div className="w-80 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-xl sm:w-[26rem]">
            <p className="text-xs text-[color:var(--muted)]">
              Deposit{" "}
              <span className="text-[color:var(--text)]">
                ETH, USDC, USDT, BNB or SOL
              </span>{" "}
              — it all becomes one spendable balance.
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent)]">
                  EVM
                </p>
                <p className="text-[10px] text-[color:var(--muted)]">
                  Ethereum · Base · Arbitrum · BNB · XLayer
                </p>
                <code className="mt-1.5 block break-all font-mono text-xs text-[color:var(--text)]">
                  {address}
                </code>
              </div>

              {solanaAddress && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent)]">
                    Solana
                  </p>
                  <p className="text-[10px] text-[color:var(--muted)]">
                    SOL · USDC
                  </p>
                  <code className="mt-1.5 block break-all font-mono text-xs text-[color:var(--text)]">
                    {solanaAddress}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
