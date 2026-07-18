"use client";

import { useEffect, useState } from "react";
import type { HistoryEntry } from "@/hooks/useUniversalUpgrade";
import { useSubscriptionConfig } from "./UniversalSubscriptionProvider";
import { cn, formatUsd } from "@/lib/utils";
import { chainList } from "@/lib/chains";
import { getFee } from "@/lib/feeLedger";
import { HistoryIcon } from "./icons";

/**
 * On-chain billing history, in a side drawer that expands on click. Every row
 * is a real settled/failed transaction from Particle's ledger — payments plus
 * the cross-chain conversions that funded them. Fees are read from the local
 * fee ledger (Particle's history doesn't expose them).
 */
export function BillingHistory({
  getHistory,
  refreshKey,
}: {
  getHistory: () => Promise<HistoryEntry[]>;
  refreshKey: number;
}) {
  const { merchant: MERCHANT_ADDRESS, settlement: SUBSCRIPTION_TOKEN } =
    useSubscriptionConfig();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getHistory()
      .then((h) => alive && setRows(h.slice(0, 12)))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshKey]);

  const totalFees = (rows ?? []).reduce((acc, r) => {
    const isPayment =
      r.tag.startsWith("transfer") &&
      r.to?.toLowerCase() === MERCHANT_ADDRESS.toLowerCase();
    return acc + (isPayment ? (getFee(r.transactionId) ?? 0) : 0);
  }, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Billing history"
        title="Billing history"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
      >
        <HistoryIcon />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md animate-[drawer-in_0.25s_ease-out] flex-col overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--panel)] p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[color:var(--text)]">
                Billing history
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Straight from the chain — every row is a real transaction.
            </p>

            <div className="mt-5 divide-y divide-[color:var(--border)]">
              {rows === null && (
                <p className="py-6 text-sm text-[color:var(--muted)]">Loading…</p>
              )}
              {rows?.length === 0 && (
                <p className="py-6 text-sm text-[color:var(--muted)]">No charges yet.</p>
              )}
              {rows?.map((r) => {
                const isPayment =
                  r.tag.startsWith("transfer") &&
                  r.to?.toLowerCase() === MERCHANT_ADDRESS.toLowerCase();
                const label = isPayment
                  ? `Payment · ${Math.abs(Number(r.amount))} ${SUBSCRIPTION_TOKEN.symbol}`
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
                const fee = isPayment ? getFee(r.transactionId) : null;
                return (
                  <div
                    key={r.transactionId}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[color:var(--text)]">{label}</p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {when}
                        {fee != null && ` · fee ${formatUsd(fee)}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        r.settled &&
                          "border-emerald-400/30 bg-emerald-400/10 text-emerald-600",
                        r.failed &&
                          "border-red-400/30 bg-red-400/10 text-red-600",
                        !r.settled &&
                          !r.failed &&
                          "border-amber-400/30 bg-amber-400/10 text-amber-600"
                      )}
                    >
                      {r.settled ? "Settled" : r.failed ? "Failed" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>

            {totalFees > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border)] pt-4 text-sm">
                <span className="text-[color:var(--muted)]">Total network fees paid</span>
                <span className="font-medium text-[color:var(--text)]">
                  {formatUsd(totalFees)}
                </span>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
