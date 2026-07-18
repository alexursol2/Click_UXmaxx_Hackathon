/**
 * The public config surface of the "universal subscriptions" library.
 *
 * A host app configures everything through one object, injected via
 * <UniversalSubscriptionProvider config={...}>. `configFromEnv()` builds the
 * default from NEXT_PUBLIC_* env vars, so the demo works with zero props while
 * any other business can drive it entirely from the config object.
 */

import {
  TARGET_CHAIN,
  SUBSCRIPTION,
  SUBSCRIPTION_TOKEN,
  MERCHANT_ADDRESS,
  DEMO_BILLING,
  CROSS_CHAIN,
  SUBSCRIPTION_MATCH,
  env,
} from "./config";

export interface UniversalSubscriptionConfig {
  /** Magic publishable key (embedded email wallet). */
  magicKey: string;
  /** Particle Universal Accounts project credentials. */
  particle: { projectId: string; clientKey: string; appId: string };
  /** Address that receives subscription payments. */
  merchant: string;
  /** Settlement chain the merchant is paid on. */
  chain: { id: number; rpcUrl: string };
  /** What/where/how much the merchant is paid. */
  settlement: typeof SUBSCRIPTION_TOKEN;
  /** Price + display metadata. */
  price: typeof SUBSCRIPTION;
  /** Compressed demo-billing cadence (0 disables auto-charging). */
  demoBilling: typeof DEMO_BILLING;
  /** Cross-chain buffer/guard knobs. */
  crossChain: typeof CROSS_CHAIN;
  /** How a settled payment is matched to "Pro active". */
  match: typeof SUBSCRIPTION_MATCH;
}

/** Build the default config from environment variables. */
export function configFromEnv(): UniversalSubscriptionConfig {
  return {
    magicKey: env.magicKey ?? "",
    particle: {
      projectId: env.particleProjectId ?? "",
      clientKey: env.particleClientKey ?? "",
      appId: env.particleAppId ?? "",
    },
    merchant: MERCHANT_ADDRESS,
    chain: { id: TARGET_CHAIN.id, rpcUrl: TARGET_CHAIN.rpcUrl },
    settlement: SUBSCRIPTION_TOKEN,
    price: SUBSCRIPTION,
    demoBilling: DEMO_BILLING,
    crossChain: CROSS_CHAIN,
    match: SUBSCRIPTION_MATCH,
  };
}
