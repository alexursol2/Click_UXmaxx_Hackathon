"use client";

/**
 * useSubscription — subscription layer on top of useUniversalUpgrade.
 *
 * - chargeSubscription() pays the fixed price to the merchant. On the v2
 *   backend, transfers spend only settlement-chain holdings, so when funds
 *   live on other chains the charge runs Convert first (bridges the value),
 *   waits for settlement, then transfers. Every step is signed headlessly.
 * - Subscription state is DERIVED FROM CHAIN HISTORY: on load we count
 *   settled transfers to the merchant, so "Pro" survives reloads with no
 *   backend — the chain is the database.
 * - Demo billing: when DEMO_BILLING.intervalSeconds > 0, after a successful
 *   charge the next one fires automatically every interval, up to maxCycles
 *   per session — live proof of recurring, zero clicks, zero popups.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
import {
  SUBSCRIPTION,
  SUBSCRIPTION_TOKEN,
  MERCHANT_ADDRESS,
  DEMO_BILLING,
} from "@/lib/config";
import { friendlyError } from "@/lib/utils";
import {
  useUniversalUpgrade,
  type UseUniversalUpgrade,
} from "./useUniversalUpgrade";

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
}

export function useSubscription(): UseSubscription {
  const universal = useUniversalUpgrade();

  const [charging, setCharging] = useState(false);
  const [stage, setStage] = useState<ChargeStage>("idle");
  const [chargeCount, setChargeCount] = useState(0);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [lastChargeId, setLastChargeId] = useState<string | null>(null);
  const [nextChargeAt, setNextChargeAt] = useState<number | null>(null);
  const [autoErrorMessage, setAutoErrorMessage] = useState<string | null>(null);

  const sessionChargesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyLoadedRef = useRef(false);

  // Derive subscription state from chain history once per session.
  useEffect(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    (async () => {
      try {
        const history = await universal.getHistory();
        const paid = history.filter(
          (h) =>
            h.settled &&
            h.tag.startsWith("transfer") &&
            h.to?.toLowerCase() === MERCHANT_ADDRESS.toLowerCase()
        );
        if (paid.length > 0) {
          setChargeCount(paid.length);
          setSubscriptionActive(true);
          setLastChargeId(paid[0].transactionId);
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

  const runCharge = useCallback(async (): Promise<void> => {
    setCharging(true);
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

      setStage("sourcing");
      let result: { transactionId: string };
      try {
        result = await transfer();
      } catch (e) {
        // v2 backend: transfers only spend tokens already on the settlement
        // chain. Convert rebalances funds across chains first; buffer covers
        // the follow-up transfer's gas on the settlement chain.
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("Insufficient primary token balance")) throw e;

        const tokenType =
          SUBSCRIPTION_TOKEN.symbol === "ETH"
            ? SUPPORTED_TOKEN_TYPE.ETH
            : SUPPORTED_TOKEN_TYPE.USDC;
        const buffer = SUBSCRIPTION_TOKEN.symbol === "ETH" ? 0.0002 : 0.4;
        const convertAmount = (
          Number(SUBSCRIPTION_TOKEN.amount) + buffer
        ).toFixed(8);

        setStage("converting");
        const convert = await universal.sendConvertTransaction({
          chainId: SUBSCRIPTION_TOKEN.chainId,
          tokenType,
          amount: convertAmount,
        });
        setStage("bridging");
        await universal.waitForSettlement(convert.transactionId);
        setStage("paying");
        result = await transfer();
      }

      // Only report success once the payment itself settled on-chain.
      setStage("confirming");
      await universal.waitForSettlement(result.transactionId);

      setLastChargeId(result.transactionId || null);
      setChargeCount((n) => n + 1);
      setSubscriptionActive(true);
      sessionChargesRef.current += 1;
    } finally {
      setCharging(false);
      setStage("idle");
    }
  }, [universal]);

  /** Schedule the next demo-billing cycle, if enabled and under the cap. */
  const scheduleNext = useCallback(() => {
    if (DEMO_BILLING.intervalSeconds <= 0) return;
    if (sessionChargesRef.current >= DEMO_BILLING.maxCycles) {
      setNextChargeAt(null);
      return;
    }
    const at = Date.now() + DEMO_BILLING.intervalSeconds * 1000;
    setNextChargeAt(at);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setNextChargeAt(null);
      try {
        await runCharge();
        scheduleNext();
      } catch (e) {
        // A background cycle failed — surface it calmly and stop the demo.
        setAutoErrorMessage(friendlyError(e));
      }
    }, DEMO_BILLING.intervalSeconds * 1000);
  }, [runCharge]);

  const chargeSubscription = useCallback(async () => {
    setAutoErrorMessage(null);
    await runCharge();
    scheduleNext();
  }, [runCharge, scheduleNext]);

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
  };
}

/** Re-exported for convenience in the UI. */
export { SUBSCRIPTION };
