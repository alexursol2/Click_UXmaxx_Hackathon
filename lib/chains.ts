/**
 * Shared chain metadata + helpers. Single source of truth so the balance card,
 * billing history, and charge visual all name chains identically.
 */

import type { UniversalBalance } from "@/hooks/useUniversalUpgrade";

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  137: "Polygon",
  196: "XLayer",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  59144: "Linea",
  101: "Solana",
};

export function chainName(id: number): string {
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

/** Join a list of chain ids to "Base + Arbitrum", de-duplicated. */
export function chainList(ids: number[]): string {
  return [...new Set(ids.map(chainName))].join(" + ");
}

/**
 * The chain the money most visibly travels FROM: the single chain holding the
 * largest USD value that ISN'T the settlement chain. Returns null when funds
 * already sit on the settlement chain (no cross-chain hop needed). This is what
 * makes the charge visual concrete — "Base → Arbitrum" instead of a vague hop.
 */
export function dominantSourceChain(
  balance: UniversalBalance | null,
  settlementChainId: number
): { chainId: number; name: string; usd: number } | null {
  if (!balance) return null;
  const byChain = new Map<number, number>();
  for (const asset of balance.assets ?? []) {
    for (const agg of asset.chainAggregation ?? []) {
      const cid = agg.token?.chainId;
      if (typeof cid !== "number" || cid === settlementChainId) continue;
      byChain.set(cid, (byChain.get(cid) ?? 0) + (agg.amountInUSD ?? 0));
    }
  }
  let best: { chainId: number; name: string; usd: number } | null = null;
  for (const [chainId, usd] of byChain) {
    if (usd <= 0.005) continue;
    if (!best || usd > best.usd) best = { chainId, name: chainName(chainId), usd };
  }
  return best;
}
