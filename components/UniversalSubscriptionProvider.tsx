"use client";

/**
 * UniversalSubscriptionProvider — the single integration point.
 *
 * A host app wraps its tree once and passes a config (or nothing, to use env
 * defaults). Every hook and component then reads the merged config via
 * `useSubscriptionConfig()`, so a merchant configures price, chain, token,
 * merchant address, and provider keys in ONE place:
 *
 *   <UniversalSubscriptionProvider config={{ merchant, price, ... }}>
 *     <App />
 *   </UniversalSubscriptionProvider>
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { configureMagic } from "@/lib/magic";
import {
  configFromEnv,
  type UniversalSubscriptionConfig,
} from "@/lib/subscriptionConfig";

const ConfigContext = createContext<UniversalSubscriptionConfig | null>(null);

export function UniversalSubscriptionProvider({
  config,
  children,
}: {
  /** Partial override; anything omitted falls back to the env default. */
  config?: Partial<UniversalSubscriptionConfig>;
  children: ReactNode;
}) {
  const merged = useMemo<UniversalSubscriptionConfig>(() => {
    const base = configFromEnv();
    const c: UniversalSubscriptionConfig = { ...base, ...config };
    // Hand the Magic-relevant bits to the wallet module (which is a singleton,
    // not a hook). Done here so every call site stays config-free.
    configureMagic({
      magicKey: c.magicKey,
      chainId: c.chain.id,
      rpcUrl: c.chain.rpcUrl,
    });
    return c;
  }, [config]);

  return (
    <ConfigContext.Provider value={merged}>{children}</ConfigContext.Provider>
  );
}

export function useSubscriptionConfig(): UniversalSubscriptionConfig {
  const c = useContext(ConfigContext);
  if (!c) {
    throw new Error(
      "useSubscriptionConfig must be used inside <UniversalSubscriptionProvider>."
    );
  }
  return c;
}
