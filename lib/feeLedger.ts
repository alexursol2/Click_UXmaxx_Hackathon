/**
 * Fee ledger — Particle's transaction history does NOT expose per-tx fees, so
 * we record the quoted fee at charge time (keyed by the payment's transactionId)
 * and read it back in Billing history. Browser-only; a no-op during SSR.
 */

const KEY = "nimbus:fees";

type FeeMap = Record<string, number>;

function read(): FeeMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as FeeMap;
  } catch {
    return {};
  }
}

function write(map: FeeMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Storage full/blocked — fees are a nicety, not critical.
  }
}

/** Record the total fee (USD) paid for a charge, keyed by its transactionId. */
export function recordFee(transactionId: string, usd: number): void {
  if (!transactionId || !Number.isFinite(usd) || usd <= 0) return;
  const map = read();
  map[transactionId] = usd;
  write(map);
}

/** Fee for a specific transaction, or null if not recorded. */
export function getFee(transactionId: string): number | null {
  const v = read()[transactionId];
  return typeof v === "number" ? v : null;
}

/** All recorded fees (txId → USD). */
export function readFees(): FeeMap {
  return read();
}

/** Sum of the fees among the given transaction ids that we have on record. */
export function sumFees(transactionIds: string[]): number {
  const map = read();
  return transactionIds.reduce((acc, id) => acc + (map[id] ?? 0), 0);
}
