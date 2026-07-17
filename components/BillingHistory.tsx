"use client";

import { useEffect, useState } from "react";
import type { HistoryEntry } from "@/hooks/useUniversalUpgrade";
import { MERCHANT_ADDRESS, SUBSCRIPTION_TOKEN } from "@/lib/config";
import { cn } from "@/lib/utils";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Chain",
  196: "XLayer",
  8453: "Base",
  42161: "Arbitrum",
  101: "Solana",
};

function chainList(ids: number[]): string {
  return [...new Set(ids.map((c) => CHAIN_NAMES[c] ?? `Chain ${c}`))].join(
    " + "
  );
}

/**
 * On-chain billing history: every row is a real settled (or failed)
 * transaction from Particle's ledger — payments to the merchant plus the
 * cross-chain conversions that funded them. No backend, no fake data.
 */
export function BillingHistory({
  getHistory,
  refreshKey,
}: {
  getHistory: () => Promise<HistoryEntry[]>;
  refreshKey: number;
}) {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    getHistory()
      .then((h) => {
        if (alive) setRows(h.slice(0, 8));
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h3 className="text-sm font-semibold text-neutral-200">
        Billing history
      </h3>
      <p className="mt-0.5 text-xs text-neutral-500">
        Straight from the chain — every row is a settled transaction.
      </p>

      <div className="mt-4 divide-y divide-white/5">
        {rows.map((r) => {
          const isPayment =
            r.tag.startsWith("transfer") &&
            r.to?.toLowerCase() === MERCHANT_ADDRESS.toLowerCase();
          const label = isPayment
            ? `Subscription payment · ${Math.abs(Number(r.amount))} ${SUBSCRIPTION_TOKEN.symbol}`
            : r.tag === "convert"
              ? `Funds sourced · ${chainList(r.fromChains)} → ${chainList(r.toChains)}`
              : `${r.tag} · ${r.amount}`;
          const when = r.createdAt
            ? new Date(r.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          return (
            <div
              key={r.transactionId}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-300">{label}</p>
                <p className="text-xs text-neutral-600">{when}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  r.settled &&
                    "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
                  r.failed && "border-red-400/30 bg-red-400/10 text-red-300",
                  !r.settled &&
                    !r.failed &&
                    "border-amber-400/30 bg-amber-400/10 text-amber-300"
                )}
              >
                {r.settled ? "Settled" : r.failed ? "Failed" : "Pending"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
