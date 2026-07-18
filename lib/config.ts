/**
 * App configuration — single source of truth for the target chain and the
 * publishable provider keys. Everything is read from env; nothing is hardcoded.
 *
 * This demo is intentionally SINGLE-CHAIN. The user's assets can live on any
 * chain (that's what the Universal Account abstracts away), but delegation and
 * the merchant settlement chain are pinned to Arbitrum One.
 */

/** Target chain for EIP-7702 delegation + merchant settlement. */
export const TARGET_CHAIN = {
  id: 42161,
  name: "Arbitrum One",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrl: "https://arb1.arbitrum.io/rpc",
  blockExplorer: "https://arbiscan.io",
} as const;

/**
 * Fixed subscription price shown in the UI and charged per cycle.
 *
 * Defaults to $5. Override for cheap end-to-end testing by setting
 * NEXT_PUBLIC_SUBSCRIPTION_PRICE_USD (e.g. 0.01) in .env.local — the committed
 * default stays 5, so removing that line restores production pricing.
 */
const priceUsd = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_USD) || 5;

/** Fixed ETH price per cycle when settling in native ETH (override via env). */
const priceEth =
  Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_ETH) || 0.001;

/** Fixed SOL price per cycle when settling in native SOL on Solana. */
const priceSol =
  Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_SOL) || 0.01;

/** Settlement token: "usdc" (default) | "eth" | "sol". */
const settleToken = (
  process.env.NEXT_PUBLIC_SUBSCRIPTION_TOKEN || "usdc"
).toLowerCase();

export const SUBSCRIPTION = {
  priceUsd,
  priceEth,
  priceSol,
  label: "Pro",
  interval: "month",
  /** Human price tag, denominated in the settlement token. */
  display:
    settleToken === "eth"
      ? `${priceEth} ETH`
      : settleToken === "sol"
        ? `${priceSol} SOL`
        : `$${priceUsd}`,
} as const;

/**
 * The token the merchant settles in, on the target chain. The user's assets can
 * live on ANY chain — the Universal Account sources them and the merchant
 * receives exactly this token here.
 *
 * Settlement token is switchable via env for testing:
 *   NEXT_PUBLIC_SUBSCRIPTION_TOKEN=eth   → native ETH (amount converted from USD at charge time)
 *   NEXT_PUBLIC_SUBSCRIPTION_TOKEN=usdc  → USDC (default; token units ≈ USD)
 * The settlement chain can also be overridden (e.g. 8453 for same-chain tests):
 *   NEXT_PUBLIC_SUBSCRIPTION_CHAIN_ID=8453
 */
const SOLANA_MAINNET_ID = 101;
const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";

const settlementChainId =
  settleToken === "sol"
    ? SOLANA_MAINNET_ID
    : Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_CHAIN_ID) || TARGET_CHAIN.id;

const USDC_BY_CHAIN: Record<number, string> = {
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC (Arbitrum One)
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC (Base)
};

export const SUBSCRIPTION_TOKEN =
  settleToken === "eth"
    ? ({
        chainId: settlementChainId,
        address: NATIVE_ADDRESS, // native ETH
        symbol: "ETH",
        amount: String(SUBSCRIPTION.priceEth),
      } as const)
    : settleToken === "sol"
      ? ({
          chainId: SOLANA_MAINNET_ID,
          address: NATIVE_ADDRESS, // native SOL
          symbol: "SOL",
          amount: String(SUBSCRIPTION.priceSol),
        } as const)
      : ({
          chainId: settlementChainId,
          address: USDC_BY_CHAIN[settlementChainId] ?? USDC_BY_CHAIN[42161],
          symbol: "USDC",
          amount: String(SUBSCRIPTION.priceUsd),
        } as const);

/**
 * Where payments land. For SOL settlement the merchant must be a Solana
 * address (NEXT_PUBLIC_MERCHANT_ADDRESS_SOL); otherwise an EVM address.
 */
export const MERCHANT_ADDRESS =
  (settleToken === "sol"
    ? process.env.NEXT_PUBLIC_MERCHANT_ADDRESS_SOL
    : process.env.NEXT_PUBLIC_MERCHANT_ADDRESS) ||
  "0x000000000000000000000000000000000000dEaD";

/**
 * Demo billing: a compressed billing cycle so recurring can be watched live.
 * When intervalSeconds > 0, the app auto-charges every interval after the
 * first charge, up to maxCycles total charges in the session — no clicks,
 * no popups. Disabled when the env vars are unset.
 */
export const DEMO_BILLING = {
  intervalSeconds:
    Number(process.env.NEXT_PUBLIC_BILLING_INTERVAL_SECONDS) || 0,
  maxCycles: Number(process.env.NEXT_PUBLIC_BILLING_MAX_CYCLES) || 3,
} as const;

/**
 * Cross-chain buffer + safety knobs.
 *
 * When funds live off the settlement chain, a charge runs Convert first to move
 * `price + buffer` onto the settlement chain; the buffer must cover the
 * follow-up transfer's gas there. This is a FLOOR — the charge additionally
 * quotes the Convert (estimateConvert) and, if what actually arrives would fall
 * short of price + gas floor, tops the amount up to what the quote says is
 * needed. See README ("Why this is technically hard") for the failure bounds.
 *
 *   bufferEth / bufferUsd — the fixed floor added on top of the price.
 *   gasFloorUsd           — minimum settlement-chain gas we insist arrives on
 *                           top of the price before we attempt the transfer.
 *   lowBalanceStopUsd     — auto-billing pauses when the unified balance drops
 *                           below (price + this), so a demo can't drain a wallet
 *                           mid-run. Set to 0 to disable the guard.
 */
export const CROSS_CHAIN = {
  bufferEth: Number(process.env.NEXT_PUBLIC_CONVERT_BUFFER_ETH) || 0.0002,
  bufferUsd: Number(process.env.NEXT_PUBLIC_CONVERT_BUFFER_USD) || 0.4,
  gasFloorUsd: Number(process.env.NEXT_PUBLIC_CONVERT_GAS_FLOOR_USD) || 0.05,
  lowBalanceStopUsd:
    process.env.NEXT_PUBLIC_LOW_BALANCE_STOP_USD !== undefined
      ? Number(process.env.NEXT_PUBLIC_LOW_BALANCE_STOP_USD)
      : 0.5,
  /**
   * Estimated gas of the settlement-chain transfer that follows a Convert. The
   * Convert quote doesn't include it (the transfer can't be quoted until funds
   * land), so we add this to the cross-chain fee preview so it isn't understated.
   */
  settleGasUsd: Number(process.env.NEXT_PUBLIC_SETTLE_GAS_USD) || 0.03,
} as const;

/**
 * How we decide, from on-chain history alone, that "Pro" is active.
 *
 * A raw "any transfer to the merchant" check is too loose — a random transfer
 * of any size to the same address would light up Pro, and it would never
 * expire. We tighten on two axes:
 *
 *   1. AMOUNT — the settled transfer's amount must match the subscription price
 *      within `amountTolerance` (covers rounding / slippage on the settlement
 *      token). A $2 tip to the merchant no longer counts as a subscription.
 *   2. RECENCY — Pro is active only if a qualifying payment settled within the
 *      active window (one billing period + grace). Old payments mean "was Pro",
 *      not "is Pro". In compressed demo mode the real period is seconds, so the
 *      window widens to the whole session (a 10s demo shouldn't "expire" while
 *      the judge is watching).
 *
 * Documented limit: history amounts are the settlement-token units Particle
 * reports; if a merchant address is reused for non-subscription transfers of
 * the exact same amount within the window, those would still count. For a
 * single-merchant subscription demo this is acceptable; a production system
 * would tag payments with a memo/nonce or use a per-subscriber merchant sub-id.
 */
export const SUBSCRIPTION_MATCH = {
  amountTolerance: 0.05, // ±5% of price
  activeWindowMs:
    DEMO_BILLING.intervalSeconds > 0
      ? Number.POSITIVE_INFINITY
      : 31 * 24 * 60 * 60 * 1000, // ~one month + grace
} as const;

/**
 * Publishable client-side keys. These are read at module load so a missing key
 * fails loudly during development rather than deep inside an SDK call.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }
  return value;
}

export const env = {
  magicKey: process.env.NEXT_PUBLIC_MAGIC_KEY,
  particleProjectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  particleClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  particleAppId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
} as const;

/** Call inside client code right before initializing the SDKs. */
export function assertEnv() {
  requireEnv("NEXT_PUBLIC_MAGIC_KEY", env.magicKey);
  requireEnv("NEXT_PUBLIC_PARTICLE_PROJECT_ID", env.particleProjectId);
  requireEnv("NEXT_PUBLIC_PARTICLE_CLIENT_KEY", env.particleClientKey);
  requireEnv("NEXT_PUBLIC_PARTICLE_APP_ID", env.particleAppId);
  return env as { [K in keyof typeof env]: string };
}
