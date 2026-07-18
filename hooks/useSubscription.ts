"use client";

/**
 * useSubscription — subscription layer on top of useUniversalUpgrade.
 *
 * - chargeSubscription() pays the fixed price to the merchant. On the v2
 *   backend, transfers spend only settlement-chain holdings, so when funds
 *   live on other chains the charge runs Convert first (bridges the value),
 *   waits for settlement, then transfers. Every step is signed headlessly.
 * - Partial-failure safety: if the Convert settles but the follow-up transfer
 *   fails, the funds are already on the settlement chain. We remember that and
 *   a retry RESUMES at the transfer step — it never Converts (and pays) twice.
 * - Cross-chain sizing is quote-driven: before Converting we ask the SDK how
 *   much would actually arrive (estimateConvert) and top up the amount if a
 *   fixed buffer would fall short of price + settlement-chain gas.
 * - Subscription state is DERIVED FROM CHAIN HISTORY: on load we count
 *   settled transfers to the merchant, so "Pro" survives reloads with no
 *   backend — the chain is the database.
 * - Demo billing: when DEMO_BILLING.intervalSeconds > 0, after a successful
 *   charge the next one fires automatically every interval, up to maxCycles
 *   per session — live proof of recurring, zero clicks, zero popups. A
 *   low-balance guard pauses auto-billing before the demo wallet can drain.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
import { useSubscriptionConfig } from "@/components/UniversalSubscriptionProvider";
import { classifyError, friendlyError } from "@/lib/utils";
import { recordFee } from "@/lib/feeLedger";
import {
  useUniversalUpgrade,
  type UseUniversalUpgrade,
} from "./useUniversalUpgrade";

/** Which coin funds a charge: a specific primary token, or "auto" (optimal). */
export type PayWith = SUPPORTED_TOKEN_TYPE | "auto";

/** A primary token the user holds, for the pay-with selector. */
export interface AvailableToken {
  type: SUPPORTED_TOKEN_TYPE;
  symbol: string;
  usd: number;
}

/** The set of Particle "primary" token types (deep-liquidity, spendable). */
const PRIMARY_TYPES = new Set<string>(Object.values(SUPPORTED_TOKEN_TYPE));

/** What the charge is doing right now (drives the progress stepper). */
export type ChargeStage =
  | "idle"
  | "sourcing" // trying a direct transfer on the settlement chain
  | "converting" // cross-chain: moving funds via Convert
  | "bridging" // waiting for the Convert to settle on-chain
  | "paying" // transferring to the merchant
  | "confirming"; // waiting for the payment to settle on-chain

export interface UseSubscription extends UseUniversalUpgrade {
  chargeSubscription: () => Promise<void>;
  chargeAgain: () => Promise<void>;
  charging: boolean;
  stage: ChargeStage;
  subscriptionActive: boolean;
  /** Settled charges on record (derived from on-chain history). */
  chargeCount: number;
  lastChargeId: string | null;
  /** Epoch ms of the next scheduled auto-charge, or null. */
  nextChargeAt: number | null;
  /** Friendly message when a background auto-charge fails. */
  autoErrorMessage: string | null;
  /**
   * True when a charge Converted funds onto the settlement chain but the
   * payment itself didn't complete. The money has moved; retrying finishes the
   * payment WITHOUT converting again.
   */
  partialPayment: boolean;
  /** True when auto-billing paused itself because the balance is running low. */
  lowBalancePaused: boolean;
  /** Did the source of funds cross chains on the last/most-recent charge? */
  crossChainLastCharge: boolean;
  /**
   * True when the user turned off auto-renew. Access stays until the period
   * ends (subscriptionActive can still be true); no further charges are made.
   * Persisted per owner address so it survives reloads.
   */
  cancelled: boolean;
  /** Turn off auto-renew. Keeps Pro access until the current period ends. */
  cancelSubscription: () => void;
  /** Re-enable auto-renew after a cancel. */
  resumeSubscription: () => void;
  /** Epoch ms until which access is paid (last charge + one period); or null. */
  paidUntil: number | null;
  /** Currently selected pay-with source: a coin, or "auto" (optimal/cheapest). */
  payWith: PayWith;
  /** Choose which coin funds the charge (falls back to auto if it can't cover). */
  setPayWith: (p: PayWith) => void;
  /** Primary tokens the user holds; the selector shows when there are 2+. */
  availableTokens: AvailableToken[];
  /** Predicted network fee (USD) for the next charge, or null if unknown. */
  estimatedFee: number | null;
  /** Would the next charge need cross-chain routing (swap/bridge)? */
  estimatedCrossChain: boolean;
  /** True while (re)computing the fee estimate. */
  estimating: boolean;
}

/** localStorage key for the per-owner "auto-renew cancelled" flag. */
function cancelKey(owner: string | null | undefined): string | null {
  return owner ? `nimbus:cancelled:${owner.toLowerCase()}` : null;
}


export function useSubscription(): UseSubscription {
  const universal = useUniversalUpgrade();

  // Config comes from <UniversalSubscriptionProvider> (env defaults out of the
  // box). Aliased to stable local names so the logic below reads cleanly.
  const config = useSubscriptionConfig();
  const SUBSCRIPTION = config.price;
  const SUBSCRIPTION_TOKEN = config.settlement;
  const MERCHANT_ADDRESS = config.merchant;
  const DEMO_BILLING = config.demoBilling;
  const CROSS_CHAIN = config.crossChain;
  const SUBSCRIPTION_MATCH = config.match;
  const BILLING_PERIOD_MS =
    DEMO_BILLING.intervalSeconds > 0
      ? DEMO_BILLING.intervalSeconds * 1000 * 2
      : 31 * 24 * 60 * 60 * 1000;

  const [charging, setCharging] = useState(false);
  const [stage, setStage] = useState<ChargeStage>("idle");
  const [chargeCount, setChargeCount] = useState(0);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [lastChargeId, setLastChargeId] = useState<string | null>(null);
  const [nextChargeAt, setNextChargeAt] = useState<number | null>(null);
  const [autoErrorMessage, setAutoErrorMessage] = useState<string | null>(null);
  const [partialPayment, setPartialPayment] = useState(false);
  const [lowBalancePaused, setLowBalancePaused] = useState(false);
  const [crossChainLastCharge, setCrossChainLastCharge] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [paidUntil, setPaidUntil] = useState<number | null>(null);

  const [payWith, setPayWithState] = useState<PayWith>("auto");
  const payWithRef = useRef<PayWith>("auto");
  const setPayWith = useCallback((p: PayWith) => {
    payWithRef.current = p;
    setPayWithState(p);
  }, []);
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [estimatedCrossChain, setEstimatedCrossChain] = useState(false);
  const [estimating, setEstimating] = useState(false);
  // Fee of a settled Convert, carried so a resumed partial payment still
  // attributes the convert cost to the final payment's recorded total.
  const convertFeeRef = useRef(0);

  const sessionChargesRef = useRef(0);
  // Mirror of `cancelled` for use inside timer callbacks (avoids stale closure).
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyLoadedRef = useRef(false);
  // True once a Convert has settled for the CURRENT in-flight charge but the
  // pay-the-merchant step hasn't succeeded yet. Persists across retries so we
  // resume at the transfer instead of converting (and paying) a second time.
  const convertSettledRef = useRef(false);

  // Derive subscription state from chain history once per session.
  useEffect(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    (async () => {
      try {
        const history = await universal.getHistory();

        // A settled transfer to the merchant is a *candidate* payment.
        const toMerchant = history.filter(
          (h) =>
            h.settled &&
            h.tag.startsWith("transfer") &&
            h.to?.toLowerCase() === MERCHANT_ADDRESS.toLowerCase()
        );

        // Tighten by amount: it must match the subscription price (±tolerance).
        const price = Number(SUBSCRIPTION_TOKEN.amount);
        const tol = price * SUBSCRIPTION_MATCH.amountTolerance + 1e-6;
        const priced = toMerchant.filter((h) => {
          const amt = Math.abs(Number(h.amount));
          return Number.isFinite(amt) && Math.abs(amt - price) <= tol;
        });

        // Fallback: if amount parsing yields nothing but merchant transfers do
        // exist (units surprise us), don't regress — fall back to the looser
        // set so Pro still reflects reality. Flagged in config's documented
        // limit; verify against real history with scripts/tx-list.mjs.
        const qualifying = priced.length > 0 ? priced : toMerchant;

        if (qualifying.length > 0) {
          // Recency: Pro is active only if a qualifying payment is within the
          // active window (one period + grace; whole session in demo mode).
          const now = Date.now();
          const isActive = qualifying.some((h) => {
            const t = h.createdAt ? new Date(h.createdAt).getTime() : now;
            return now - t <= SUBSCRIPTION_MATCH.activeWindowMs;
          });
          setChargeCount(qualifying.length);
          setSubscriptionActive(isActive);
          setLastChargeId(qualifying[0].transactionId);
          const latest = qualifying.reduce((mx, h) => {
            const t = h.createdAt ? new Date(h.createdAt).getTime() : 0;
            return Math.max(mx, t);
          }, 0);
          if (latest) setPaidUntil(latest + BILLING_PERIOD_MS);
        }
      } catch {
        // History is a nicety — the user can still upgrade/charge without it.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never leave a pending auto-charge behind after unmount/logout.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Restore the "auto-renew cancelled" flag for this owner (survives reloads).
  useEffect(() => {
    const key = cancelKey(universal.ownerAddress);
    if (!key || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(key) === "1";
    cancelledRef.current = stored;
    setCancelled(stored);
    if (stored && timerRef.current) {
      clearTimeout(timerRef.current);
      setNextChargeAt(null);
    }
  }, [universal.ownerAddress]);

  // Let access actually lapse once the paid period ends (matters after cancel;
  // while auto-renewing, paidUntil keeps moving forward so this never fires).
  useEffect(() => {
    if (!subscriptionActive || paidUntil == null) return;
    const id = setInterval(() => {
      if (Date.now() > paidUntil) setSubscriptionActive(false);
    }, 1000);
    return () => clearInterval(id);
  }, [subscriptionActive, paidUntil]);

  // Primary tokens the user actually holds (drives the pay-with selector).
  const availableTokens: AvailableToken[] = (
    universal.universalBalance?.assets ?? []
  )
    .filter(
      (a) => a.amountInUSD > 0.005 && PRIMARY_TYPES.has(a.tokenType.toLowerCase())
    )
    .map((a) => ({
      type: a.tokenType.toLowerCase() as SUPPORTED_TOKEN_TYPE,
      symbol: a.tokenType.toUpperCase(),
      usd: a.amountInUSD,
    }))
    .sort((x, y) => y.usd - x.usd);

  // Predict the next charge's fee (read-only quote; free). Re-runs when the
  // balance loads or the pay-with choice changes, but never mid-charge.
  useEffect(() => {
    if (charging) return;
    if (!universal.universalBalance) return;
    let alive = true;
    setEstimating(true);
    (async () => {
      const settlementToken = {
        chainId: SUBSCRIPTION_TOKEN.chainId,
        address: SUBSCRIPTION_TOKEN.address,
      };
      const tokenType =
        SUBSCRIPTION_TOKEN.symbol === "ETH"
          ? SUPPORTED_TOKEN_TYPE.ETH
          : SUPPORTED_TOKEN_TYPE.USDC;
      try {
        // Same-chain transfer first — no routing, minimal fee.
        const { feeUsd } = await universal.quoteTransfer({
          token: settlementToken,
          amount: SUBSCRIPTION_TOKEN.amount,
          receiver: MERCHANT_ADDRESS,
        });
        if (alive) {
          setEstimatedFee(feeUsd);
          setEstimatedCrossChain(false);
        }
      } catch (e) {
        if (classifyError(e).kind !== "insufficient") {
          if (alive) setEstimatedFee(null);
          return;
        }
        // Needs cross-chain sourcing — quote the Convert (with pay-with; fall
        // back to auto so the estimate still shows if the chosen coin is short).
        const chosen = payWithRef.current;
        try {
          const amount = await sizeConvertAmount();
          let q;
          try {
            q = await universal.estimateConvert({
              chainId: SUBSCRIPTION_TOKEN.chainId,
              tokenType,
              amount,
              usePrimaryTokens: chosen === "auto" ? undefined : [chosen],
            });
          } catch {
            q = await universal.estimateConvert({
              chainId: SUBSCRIPTION_TOKEN.chainId,
              tokenType,
              amount,
            });
          }
          if (alive) {
            // Convert fee (dominant) + the settlement-chain transfer's gas that
            // the Convert quote doesn't cover — so the preview isn't understated.
            setEstimatedFee(q.feeUsd + CROSS_CHAIN.settleGasUsd);
            setEstimatedCrossChain(true);
          }
        } catch {
          if (alive) setEstimatedFee(null);
        }
      } finally {
        if (alive) setEstimating(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universal.universalBalance?.totalUsd, payWith, charging]);

  /**
   * Size the cross-chain Convert against real numbers. Start from price + a
   * fixed buffer (the floor), ask the SDK what would actually arrive, and if
   * that's short of price + gas floor, top the amount up by the shortfall.
   * Returns the amount to Convert (string, in settlement-token units).
   */
  const sizeConvertAmount = useCallback(async (): Promise<string> => {
    const price = Number(SUBSCRIPTION_TOKEN.amount);
    const isEth = SUBSCRIPTION_TOKEN.symbol === "ETH";
    const tokenType = isEth ? SUPPORTED_TOKEN_TYPE.ETH : SUPPORTED_TOKEN_TYPE.USDC;
    const buffer = isEth ? CROSS_CHAIN.bufferEth : CROSS_CHAIN.bufferUsd;

    let amount = (price + buffer).toFixed(8);
    try {
      const chosen = payWithRef.current;
      const q = await universal.estimateConvert({
        chainId: SUBSCRIPTION_TOKEN.chainId,
        tokenType,
        amount,
        usePrimaryTokens: chosen === "auto" ? undefined : [chosen],
      });
      // How much value must land so the follow-up transfer of `price` clears
      // its own settlement-chain gas. For USDC, price≈USD so the check is
      // direct; for ETH we compare the quote's USD arrival to the buffer's USD
      // floor (gasFloorUsd) as a proxy.
      const neededUsd = CROSS_CHAIN.gasFloorUsd; // headroom above the price
      const arrivesHeadroomUsd = q.arrivesUsd - price; // for USDC price≈USD
      if (!isEth && arrivesHeadroomUsd < neededUsd) {
        const shortfallUsd = neededUsd - arrivesHeadroomUsd;
        amount = (price + buffer + shortfallUsd).toFixed(8);
      }
    } catch {
      // Quote unavailable (maintenance, etc.) — fall back to the fixed floor.
      // The transfer step will still surface a clear error if it's short.
    }
    return amount;
  }, [universal]);

  const runCharge = useCallback(async (): Promise<void> => {
    setCharging(true);
    setPartialPayment(false);
    try {
      const transfer = () =>
        universal.sendUniversalTransaction({
          token: {
            chainId: SUBSCRIPTION_TOKEN.chainId,
            address: SUBSCRIPTION_TOKEN.address,
          },
          amount: SUBSCRIPTION_TOKEN.amount,
          receiver: MERCHANT_ADDRESS,
        });

      let result: { transactionId: string; feeUsd: number };

      if (convertSettledRef.current) {
        // RESUME PATH: a previous attempt already Converted funds onto the
        // settlement chain. Don't Convert again — just finish the payment.
        setStage("paying");
        result = await transfer();
      } else {
        setStage("sourcing");
        try {
          result = await transfer();
          setCrossChainLastCharge(false);
        } catch (e) {
          // v2 backend: transfers only spend tokens already on the settlement
          // chain. Convert rebalances funds across chains first; the buffer
          // covers the follow-up transfer's gas on the settlement chain.
          const kind = classifyError(e).kind;
          if (kind !== "insufficient") throw e;

          const tokenType =
            SUBSCRIPTION_TOKEN.symbol === "ETH"
              ? SUPPORTED_TOKEN_TYPE.ETH
              : SUPPORTED_TOKEN_TYPE.USDC;

          setStage("converting");
          const convertAmount = await sizeConvertAmount();
          const chosen = payWithRef.current;
          let convert: { transactionId: string; feeUsd: number };
          try {
            convert = await universal.sendConvertTransaction({
              chainId: SUBSCRIPTION_TOKEN.chainId,
              tokenType,
              amount: convertAmount,
              usePrimaryTokens: chosen === "auto" ? undefined : [chosen],
            });
          } catch (convErr) {
            // Chosen coin can't cover it alone → combine coins (auto source).
            const m = (
              convErr instanceof Error ? convErr.message : String(convErr)
            ).toLowerCase();
            const noRoute =
              m.includes("no tx generated") || m.includes("insufficient");
            if (chosen !== "auto" && noRoute) {
              convert = await universal.sendConvertTransaction({
                chainId: SUBSCRIPTION_TOKEN.chainId,
                tokenType,
                amount: convertAmount,
              });
            } else {
              throw convErr;
            }
          }
          convertFeeRef.current = convert.feeUsd;
          setStage("bridging");
          await universal.waitForSettlement(convert.transactionId);
          // Money is now on the settlement chain. From here on, a failure is a
          // PARTIAL payment (funds moved, merchant unpaid) — resumable.
          convertSettledRef.current = true;
          setCrossChainLastCharge(true);

          setStage("paying");
          result = await transfer();
        }
      }

      // Only report success once the payment itself settled on-chain.
      setStage("confirming");
      await universal.waitForSettlement(result.transactionId);

      // Fully settled — clear the resume flag and record the charge + its fee.
      convertSettledRef.current = false;
      setPartialPayment(false);
      recordFee(result.transactionId, convertFeeRef.current + result.feeUsd);
      convertFeeRef.current = 0;
      setLastChargeId(result.transactionId || null);
      setChargeCount((n) => n + 1);
      setSubscriptionActive(true);
      setPaidUntil(Date.now() + BILLING_PERIOD_MS);
      sessionChargesRef.current += 1;
    } catch (e) {
      // If we'd already Converted, the value is sitting on the settlement chain
      // and the merchant wasn't paid: flag it so the UI offers a safe resume.
      if (convertSettledRef.current) setPartialPayment(true);
      throw e;
    } finally {
      setCharging(false);
      setStage("idle");
    }
  }, [universal, sizeConvertAmount]);

  /** Is there enough unified balance to safely attempt another charge? */
  const hasHeadroomForNextCharge = useCallback((): boolean => {
    if (CROSS_CHAIN.lowBalanceStopUsd <= 0) return true;
    const total = universal.universalBalance?.totalUsd;
    if (typeof total !== "number") return true; // unknown — don't block
    return total >= SUBSCRIPTION.priceUsd + CROSS_CHAIN.lowBalanceStopUsd;
  }, [universal.universalBalance]);

  /** Schedule the next demo-billing cycle, if enabled and under the cap. */
  const scheduleNext = useCallback(() => {
    if (DEMO_BILLING.intervalSeconds <= 0) return;
    if (cancelledRef.current) {
      // Auto-renew is off — no more charges.
      setNextChargeAt(null);
      return;
    }
    if (sessionChargesRef.current >= DEMO_BILLING.maxCycles) {
      setNextChargeAt(null);
      return;
    }
    // Burn-rate guard: stop before a live demo can drain the wallet.
    if (!hasHeadroomForNextCharge()) {
      setNextChargeAt(null);
      setLowBalancePaused(true);
      return;
    }
    const at = Date.now() + DEMO_BILLING.intervalSeconds * 1000;
    setNextChargeAt(at);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setNextChargeAt(null);
      if (cancelledRef.current) return; // cancelled between scheduling and firing
      try {
        await runCharge();
        scheduleNext();
      } catch (e) {
        // A background cycle failed. If it's a transient (maintenance/network),
        // give it one automatic retry before surfacing anything — a live demo
        // shouldn't die on a momentary blip. Otherwise, surface calmly & stop.
        const c = classifyError(e);
        if (c.retryable) {
          try {
            await new Promise((r) => setTimeout(r, 6000));
            await runCharge();
            scheduleNext();
            return;
          } catch (e2) {
            setAutoErrorMessage(friendlyError(e2));
            return;
          }
        }
        setAutoErrorMessage(c.message);
      }
    }, DEMO_BILLING.intervalSeconds * 1000);
  }, [runCharge, hasHeadroomForNextCharge]);

  const chargeSubscription = useCallback(async () => {
    setAutoErrorMessage(null);
    setLowBalancePaused(false);
    await runCharge();
    scheduleNext();
  }, [runCharge, scheduleNext]);

  /** Turn off auto-renew: stop scheduled charges, keep access until period end. */
  const cancelSubscription = useCallback(() => {
    cancelledRef.current = true;
    setCancelled(true);
    setNextChargeAt(null);
    setLowBalancePaused(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    const key = cancelKey(universal.ownerAddress);
    if (key && typeof window !== "undefined")
      window.localStorage.setItem(key, "1");
  }, [universal.ownerAddress]);

  /** Re-enable auto-renew and resume the demo-billing schedule. */
  const resumeSubscription = useCallback(() => {
    cancelledRef.current = false;
    setCancelled(false);
    const key = cancelKey(universal.ownerAddress);
    if (key && typeof window !== "undefined")
      window.localStorage.removeItem(key);
    scheduleNext();
  }, [universal.ownerAddress, scheduleNext]);

  return {
    ...universal,
    chargeSubscription,
    chargeAgain: chargeSubscription,
    charging,
    stage,
    subscriptionActive,
    chargeCount,
    lastChargeId,
    nextChargeAt,
    autoErrorMessage,
    partialPayment,
    lowBalancePaused,
    crossChainLastCharge,
    cancelled,
    cancelSubscription,
    resumeSubscription,
    paidUntil,
    payWith,
    setPayWith,
    availableTokens,
    estimatedFee,
    estimatedCrossChain,
    estimating,
  };
}
