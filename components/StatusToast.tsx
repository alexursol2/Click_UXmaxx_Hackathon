"use client";

/**
 * StatusToast — the live payment status card (bottom-right). Mounted once by
 * <ClickProvider>, so any ClickPayButton (or a custom `pay()` call) surfaces
 * progress here without the host wiring any UI: Preparing → Paying → Confirming
 * → Paid ✓, with a Try-again on failure.
 */

import { useStore } from "./StoreProvider";
import { ChargeProgress } from "./ChargeProgress";
import { formatUsd } from "@/lib/utils";

export function StatusToast() {
  const store = useStore();
  const { status } = store;
  if (!status) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[250] w-[min(92vw,22rem)] rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-2xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">
            {status.kind === "charging" &&
              (status.mode === "withdraw" ? "Withdrawing…" : "Paying…")}
            {status.kind === "success" &&
              (status.mode === "withdraw" ? "Sent ✓" : "Paid ✓")}
            {status.kind === "error" &&
              (status.mode === "withdraw" ? "Withdrawal failed" : "Payment failed")}
          </p>
          <p className="text-xs text-[color:var(--muted)]">
            {status.mode === "withdraw" ? "To " : ""}
            {status.label} · {formatUsd(status.amountUsd)}
          </p>
        </div>
        {status.kind !== "charging" && (
          <button
            onClick={store.dismissStatus}
            aria-label="Dismiss"
            className="text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
          >
            ✕
          </button>
        )}
      </div>

      {status.kind === "charging" && (
        <>
          <ChargeProgress stage={store.stage === "idle" ? "sourcing" : store.stage} />
          {store.crossChain && (
            <p className="mt-2 text-[11px] text-[color:var(--accent)]/80">
              Routing funds across chains to the merchant…
            </p>
          )}
        </>
      )}

      {status.kind === "success" && (
        <p className="text-xs text-emerald-600">
          {status.mode === "withdraw"
            ? `Sent ${formatUsd(status.amountUsd)} to ${status.label} — from your unified cross-chain balance.`
            : `The merchant received ${formatUsd(status.amountUsd)} — sourced from your unified cross-chain balance.`}
        </p>
      )}

      {status.kind === "error" && (
        <div>
          <p className="mb-2 text-xs text-red-600">{status.message}</p>
          {status.retry && (
            <button
              onClick={status.retry}
              className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel)]"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
