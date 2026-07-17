"use client";

import { useState } from "react";
import type { UniversalBalance } from "@/hooks/useUniversalUpgrade";
import { cn, formatUsd, shortAddress } from "@/lib/utils";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Chain",
  196: "XLayer",
  8453: "Base",
  42161: "Arbitrum",
  101: "Solana",
};

export function UniversalBalanceCard({
  balance,
  loading,
  address,
}: {
  balance: UniversalBalance | null;
  loading: boolean;
  address?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the address is still shown in full via title.
    }
  };

  const holdings = (balance?.assets ?? [])
    .filter((a) => a.amountInUSD > 0.005)
    .map((a) => ({
      symbol: a.tokenType.toUpperCase(),
      totalUsd: a.amountInUSD,
      chains: (a.chainAggregation ?? [])
        .filter((c) => c.amountInUSD > 0.005)
        .map((c) => ({
          name: CHAIN_NAMES[c.token?.chainId] ?? `Chain ${c.token?.chainId}`,
          usd: c.amountInUSD,
        }))
        .sort((x, y) => y.usd - x.usd),
    }))
    .sort((x, y) => y.totalUsd - x.totalUsd);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#aa00ff]/25 via-[#6600cc]/10 to-transparent p-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#aa00ff]/25 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#d580ff]/90">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#aa00ff]" />
          Unified balance · every chain
        </div>

        <div className="mt-3 flex items-end gap-3">
          {loading && !balance ? (
            <div className="h-14 w-48 animate-pulse rounded-xl bg-white/10" />
          ) : (
            <span className="bg-gradient-to-b from-white to-neutral-300 bg-clip-text text-6xl font-bold leading-none tracking-tight text-transparent">
              {formatUsd(balance?.totalUsd ?? 0)}
            </span>
          )}
        </div>

        <p className="mt-4 max-w-sm text-sm text-neutral-400">
          One spendable balance, sourced automatically from your assets on any
          chain. No bridging, no switching networks.
        </p>

        {holdings.length > 0 && (
          <div className="mt-5 space-y-2">
            {holdings.map((h) => (
              <div
                key={h.symbol}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-neutral-200">
                    {h.symbol}
                  </span>
                  <span className="text-sm font-medium text-neutral-300">
                    {formatUsd(h.totalUsd)}
                  </span>
                </div>
                {h.chains.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {h.chains.map((c) => (
                      <span
                        key={c.name}
                        className="text-xs text-neutral-500"
                      >
                        <span className="text-[#d580ff]/80">{c.name}</span>{" "}
                        {formatUsd(c.usd)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {address && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs text-neutral-500">
              Your wallet · add funds on any chain
            </p>
            <button
              onClick={copy}
              title={address}
              className={cn(
                "mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1 -ml-2",
                "transition-colors hover:bg-white/5"
              )}
            >
              <code className="font-mono text-sm text-neutral-200">
                {shortAddress(address)}
              </code>
              <span
                className={cn(
                  "text-xs font-medium",
                  copied ? "text-emerald-300" : "text-[#d580ff]"
                )}
              >
                {copied ? "Copied" : "Copy"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
