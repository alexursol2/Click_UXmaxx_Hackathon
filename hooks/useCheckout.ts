"use client";

/**
 * useCheckout — one-time, dynamic-amount charge for a storefront.
 *
 * Same cross-chain engine as useSubscription's charge, minus the subscription
 * state machine (no demo billing, cancel, or on-chain Pro derivation). A buy
 * pays an arbitrary USD amount to the merchant:
 *
 *   transfer (settlement chain) → on "insufficient primary token balance"
 *   → Convert the shortfall across chains → wait for settlement → transfer.
 *
 * Everything is signed headlessly (no wallet popups). If the Convert settles
 * but the follow-up transfer fails, the funds already moved onto the settlement
 * chain: we remember that and an immediate retry RESUMES at the transfer step
 * for the same amount instead of Converting (and paying) twice.
 *
 * Settlement assumes the configured settlement token's units ≈ USD (USDC, the
 * tested/default config), so the product's USD price is the transfer amount.
 */

import { useCallback, useRef, useState } from "react";
import { SUPPORTED_TOKEN_TYPE } from "@particle-network/universal-account-sdk";
import { useSubscriptionConfig } from "@/components/UniversalSubscriptionProvider";
import { classifyError, friendlyError } from "@/lib/utils";
import { recordFee } from "@/lib/feeLedger";
import {
  useUniversalUpgrade,
  type UseUniversalUpgrade,
} from "./useUniversalUpgrade";
import type { PayWith, AvailableToken, ChargeStage } from "./useSubscription";

/** The set of Particle "primary" token types (deep-liquidity, spendable). */
const PRIMARY_TYPES = new Set<string>(Object.values(SUPPORTED_TOKEN_TYPE));

export interface CheckoutResult {
  transactionId: string;
  feeUsd: number;
}

export interface UseCheckout extends Omit<UseUniversalUpgrade, "error"> {
  /** Pay `amountUsd` to the merchant. Resolves once settled on-chain. */
  checkout: (amountUsd: number) => Promise<CheckoutResult>;
  /** Withdraw `amountUsd` of the settlement token to an external address. */
  withdraw: (amountUsd: number, toAddress: string) => Promise<CheckoutResult>;
  charging: boolean;
  stage: ChargeStage;
  /** True when the in-flight (or last) charge needed cross-chain routing. */
  crossChain: boolean;
  /** UI-ready error string from the last charge, or null. */
  error: string | null;
  clearError: () => void;
  /** Currently selected pay-with source: a coin, or "auto" (optimal). */
  payWith: PayWith;
  setPayWith: (p: PayWith) => void;
  /** Primary tokens the user holds; the selector shows when there are 2+. */
  availableTokens: AvailableToken[];
}

export function useCheckout(): UseCheckout {
  const universal = useUniversalUpgrade();
  const config = useSubscriptionConfig();
  const TOKEN = config.settlement;
  const MERCHANT = config.merchant;
  const CROSS_CHAIN = config.crossChain;

  const [charging, setCharging] = useState(false);
  const [stage, setStage] = useState<ChargeStage>("idle");
  const [crossChain, setCrossChain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const [payWith, setPayWithState] = useState<PayWith>("auto");
  const payWithRef = useRef<PayWith>("auto");
  const setPayWith = useCallback((p: PayWith) => {
    payWithRef.current = p;
    setPayWithState(p);
  }, []);

  // Resume-safety: once a Convert has settled for an in-flight charge, remember
  // it (keyed by receiver+amount) so a retry finishes the transfer without
  // converting twice.
  const convertSettledRef = useRef(false);
  const pendingKeyRef = useRef<string | null>(null);
  const convertFeeRef = useRef(0);
  // The Universal Account must be established (smart-account + delegation state
  // resolved) BEFORE the first transaction is built, or the SDK signs a UserOp
  // against an uninitialized account and it fails on-chain validation ("AA24
  // signature error"). Mirrors the subscription's upgrade()-then-charge order.
  const initedRef = useRef(false);

  const tokenTypeFor = (): SUPPORTED_TOKEN_TYPE =>
    TOKEN.symbol === "ETH"
      ? SUPPORTED_TOKEN_TYPE.ETH
      : TOKEN.symbol === "SOL"
        ? SUPPORTED_TOKEN_TYPE.SOL
        : SUPPORTED_TOKEN_TYPE.USDC;

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

  /** How much of the settlement token already sits on the settlement chain. */
  const settlementChainHeld = useCallback((): number => {
    const assets = universal.universalBalance?.assets ?? [];
    const sym = TOKEN.symbol.toUpperCase();
    for (const a of assets) {
      if (a.tokenType.toUpperCase() !== sym) continue;
      for (const c of a.chainAggregation ?? []) {
        if (c.token?.chainId !== TOKEN.chainId) continue;
        const amt = Number((c as { amount?: unknown }).amount);
        if (Number.isFinite(amt) && amt > 0) return amt;
        const usd = Number(c.amountInUSD);
        return Number.isFinite(usd) && usd > 0 ? usd : 0;
      }
    }
    return 0;
  }, [universal.universalBalance]);

  /** Size the cross-chain Convert against real numbers for `priceNum` USD. */
  const sizeConvertAmount = useCallback(
    async (priceNum: number): Promise<string> => {
      const isEth = TOKEN.symbol === "ETH";
      const tokenType = tokenTypeFor();
      const buffer = isEth ? CROSS_CHAIN.bufferEth : CROSS_CHAIN.bufferUsd;

      const held = settlementChainHeld();
      const shortfall = Math.max(0, priceNum - held);

      let amount = (shortfall + buffer).toFixed(8);
      try {
        const chosen = payWithRef.current;
        const q = await universal.estimateConvert({
          chainId: TOKEN.chainId,
          tokenType,
          amount,
          usePrimaryTokens: chosen === "auto" ? undefined : [chosen],
        });
        const neededUsd = CROSS_CHAIN.gasFloorUsd;
        const arrivesHeadroomUsd = q.arrivesUsd - shortfall;
        if (!isEth && arrivesHeadroomUsd < neededUsd) {
          amount = (shortfall + buffer + (neededUsd - arrivesHeadroomUsd)).toFixed(8);
        }
      } catch {
        // Quote unavailable — fall back to the fixed floor; the transfer step
        // will still surface a clear error if it comes up short.
      }
      return amount;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [universal, settlementChainHeld]
  );

  /**
   * Core engine: move `amountUsd` of the settlement token to `receiver` from the
   * unified balance (direct transfer, or Convert-then-transfer if the funds live
   * on other chains). `receiver` = merchant for a checkout, or the user's own
   * external address for a withdrawal — the rails are identical.
   */
  const runCharge = useCallback(
    async (amountUsd: number, receiver: string): Promise<CheckoutResult> => {
      setCharging(true);
      setError(null);
      setCrossChain(false);
      const key = `${receiver.toLowerCase()}:${amountUsd}`;
      try {
        // Establish the UA once per session before building any transaction.
        if (!initedRef.current) {
          await universal.upgrade();
          initedRef.current = true;
        }

        const tokenType = tokenTypeFor();
        const transfer = () =>
          universal.sendUniversalTransaction({
            token: { chainId: TOKEN.chainId, address: TOKEN.address },
            amount: String(amountUsd),
            receiver,
          });

        let result: CheckoutResult;

        if (convertSettledRef.current && pendingKeyRef.current === key) {
          // RESUME: funds already Converted onto the settlement chain — just send.
          setCrossChain(true);
          setStage("paying");
          result = await transfer();
        } else {
          setStage("sourcing");
          try {
            result = await transfer();
          } catch (e) {
            if (classifyError(e).kind !== "insufficient") throw e;

            setCrossChain(true);
            setStage("converting");
            const convertAmount = await sizeConvertAmount(amountUsd);
            const chosen = payWithRef.current;
            let convert: CheckoutResult;
            try {
              convert = await universal.sendConvertTransaction({
                chainId: TOKEN.chainId,
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
                m.includes("no tx generated") ||
                m.includes("insufficient") ||
                m.includes("-32673");
              if (chosen !== "auto" && noRoute) {
                convert = await universal.sendConvertTransaction({
                  chainId: TOKEN.chainId,
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
            // Money is on the settlement chain now — a later failure is a
            // resumable PARTIAL payment.
            convertSettledRef.current = true;
            pendingKeyRef.current = key;

            setStage("paying");
            result = await transfer();
          }
        }

        setStage("confirming");
        await universal.waitForSettlement(result.transactionId);

        convertSettledRef.current = false;
        pendingKeyRef.current = null;
        recordFee(result.transactionId, convertFeeRef.current + result.feeUsd);
        convertFeeRef.current = 0;
        return result;
      } catch (e) {
        setError(friendlyError(e));
        throw e;
      } finally {
        setCharging(false);
        setStage("idle");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [universal, sizeConvertAmount]
  );

  /** Pay the merchant (the storefront's one-click checkout). */
  const checkout = useCallback(
    (amountUsd: number) => runCharge(amountUsd, MERCHANT),
    [runCharge, MERCHANT]
  );

  /** Withdraw `amountUsd` of the settlement token to an external address. */
  const withdraw = useCallback(
    (amountUsd: number, toAddress: string) => runCharge(amountUsd, toAddress),
    [runCharge]
  );

  return {
    ...universal,
    checkout,
    withdraw,
    charging,
    stage,
    crossChain,
    error,
    clearError,
    payWith,
    setPayWith,
    availableTokens,
  };
}
