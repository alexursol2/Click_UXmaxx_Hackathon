/**
 * Public API of the chain-abstracted payments library.
 *
 * A host app needs exactly these: wrap once with the provider, then read the
 * hooks. Everything else in `components/` is demo UI, not part of the library.
 *
 *   import {
 *     UniversalSubscriptionProvider,
 *     useUniversalUpgrade,
 *     useCheckout,     // one-time, dynamic-amount charge (storefront)
 *     useSubscription, // recurring charge (subscription)
 *   } from "click-universal-subscriptions";
 */

// Provider + config injection
export {
  UniversalSubscriptionProvider,
  useSubscriptionConfig,
} from "./components/UniversalSubscriptionProvider";
export {
  configFromEnv,
  type UniversalSubscriptionConfig,
} from "./lib/subscriptionConfig";

// The core product: email EOA → Universal Account + unified cross-chain balance
export {
  useUniversalUpgrade,
  type UseUniversalUpgrade,
  type UniversalBalance,
  type TransferInput,
  type HistoryEntry,
} from "./hooks/useUniversalUpgrade";

// One-time checkout: pay an arbitrary amount to the merchant (storefront demo)
export {
  useCheckout,
  type UseCheckout,
  type CheckoutResult,
} from "./hooks/useCheckout";

// The subscription layer: charge, cancel/resume, pay-with, on-chain Pro state
export {
  useSubscription,
  type UseSubscription,
  type PayWith,
  type AvailableToken,
  type ChargeStage,
} from "./hooks/useSubscription";

// Error classification (calm, UI-ready copy + retry semantics)
export { classifyError, friendlyError, type ClassifiedError } from "./lib/utils";
