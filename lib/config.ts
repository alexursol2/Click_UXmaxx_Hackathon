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

const settleInEth =
  (process.env.NEXT_PUBLIC_SUBSCRIPTION_TOKEN || "usdc").toLowerCase() ===
  "eth";

export const SUBSCRIPTION = {
  priceUsd,
  priceEth,
  label: "Pro",
  interval: "month",
  /** Human price tag, denominated in the settlement token. */
  display: settleInEth ? `${priceEth} ETH` : `$${priceUsd}`,
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
const settlementChainId =
  Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_CHAIN_ID) || TARGET_CHAIN.id;

const USDC_BY_CHAIN: Record<number, string> = {
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC (Arbitrum One)
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC (Base)
};

export const SUBSCRIPTION_TOKEN = settleInEth
  ? ({
      chainId: settlementChainId,
      address: "0x0000000000000000000000000000000000000000", // native ETH
      symbol: "ETH",
      /** Fixed ETH amount per charge. */
      amount: String(SUBSCRIPTION.priceEth),
    } as const)
  : ({
      chainId: settlementChainId,
      address: USDC_BY_CHAIN[settlementChainId] ?? USDC_BY_CHAIN[42161],
      symbol: "USDC",
      /** USDC ≈ USD, so token units equal the price. */
      amount: String(SUBSCRIPTION.priceUsd),
    } as const);

/**
 * Where the $5 lands. Overridable via env so you can point it at your own
 * receiving address; falls back to a burn-ish placeholder for local demos.
 */
export const MERCHANT_ADDRESS =
  process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ||
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
