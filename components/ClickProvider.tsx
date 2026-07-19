"use client";

/**
 * ClickProvider — drop Click into ANY site in one wrap.
 *
 *   import { ClickProvider, ClickPayButton, ClickAccountButton } from "click";
 *
 *   <ClickProvider config={{ merchant: "0xYourAddress" }}>
 *     <ClickAccountButton />                       // login / balance / add funds
 *     <ClickPayButton amount={9.99} label="Pro" /> // one-click pay
 *   </ClickProvider>
 *
 * It bundles everything the account needs: the config provider, the shared
 * session (auth + unified balance + checkout + login-gate), and — mounted once,
 * globally — the Account modal and the payment status card. So a host site only
 * places buttons; the login popup and the "Paying… → Paid ✓" card just work.
 *
 * Prefer the components (ClickPayButton / ClickAccountButton) for zero-UI
 * integration, or read `useClickAccount()` to build your own UI on top.
 */

import type { ReactNode } from "react";
import type { UniversalSubscriptionConfig } from "@/lib/subscriptionConfig";
import { UniversalSubscriptionProvider } from "./UniversalSubscriptionProvider";
import { StoreProvider } from "./StoreProvider";
import { AccountModal } from "./AccountModal";
import { StatusToast } from "./StatusToast";

export function ClickProvider({
  config,
  children,
}: {
  /** Partial override; anything omitted falls back to the env default. */
  config?: Partial<UniversalSubscriptionConfig>;
  children: ReactNode;
}) {
  return (
    <UniversalSubscriptionProvider config={config}>
      <StoreProvider>
        {children}
        {/* Mounted once so buttons anywhere trigger login + status with no host wiring */}
        <AccountModal />
        <StatusToast />
      </StoreProvider>
    </UniversalSubscriptionProvider>
  );
}

// The account hook: auth + unified balance + checkout + login-gate in one.
export { useStore as useClickAccount } from "./StoreProvider";
export type { StoreContextValue as ClickAccount } from "./StoreProvider";
