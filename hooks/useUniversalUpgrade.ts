"use client";

/**
 * useUniversalUpgrade — the product.
 *
 * Turns a Magic email EOA into a Particle Universal Account (EIP-7702 mode) and
 * exposes a unified, cross-chain balance. Drop it into any component:
 *
 *   const { upgrade, isUniversal, universalBalance } = useUniversalUpgrade();
 *
 * How the EIP-7702 "upgrade" actually works (important, and different from the
 * naive getEIP7702/signEIP7702/send mental model):
 *
 *   Particle does NOT expose a standalone "delegate my EOA" call. Instead, when
 *   you build a transaction, each userOp carries an `eip7702Auth` tuple
 *   {address, chainId, nonce} until the EOA is delegated. You sign that tuple
 *   with the wallet, serialize it, and pass the authorizations as the THIRD arg
 *   to `sendTransaction`. The on-chain delegation (setting 7702 code on the EOA)
 *   therefore commits together with the first transaction that spends.
 *
 *   So `upgrade()` here establishes the Universal Account context (initializes
 *   the SDK, resolves the smart-account address, loads the unified balance) and
 *   flips `isUniversal`. The actual on-chain type-4 delegation fires on the
 *   first `sendUniversalTransaction(...)` — which, in this demo, is the first
 *   $5 subscription charge. `isDelegated` reflects the real on-chain state
 *   (checked via eth_getCode) and becomes true after that first charge.
 *
 *   >>> DESIGN DECISION TO CONFIRM: if you'd rather `upgrade()` broadcast its
 *   own delegation transaction up front (separate from any payment), say so —
 *   it means bundling delegation with a zero-value self-call. I recommend the
 *   current approach: no wasted gas, and the single "Upgrade to Pro — $5/mo"
 *   button naturally carries the delegation on its first charge. <<<
 */

import { useCallback, useRef, useState } from "react";
import { Signature, JsonRpcProvider } from "ethers";
import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
  SUPPORTED_TOKEN_TYPE,
  type IAssetsResponse,
  type ITransaction,
  type EIP7702Authorization,
} from "@particle-network/universal-account-sdk";
import { TARGET_CHAIN, assertEnv } from "@/lib/config";
import {
  getOwnerAddress,
  isLoggedIn,
  signRootHash,
  sign7702Authorization,
} from "@/lib/magic";

/** Normalized, UI-friendly view of the unified cross-chain balance. */
export interface UniversalBalance {
  /** Total spendable value across every chain, in USD. */
  totalUsd: number;
  /** Per-asset breakdown (aggregated across chains) for optional detail. */
  assets: IAssetsResponse["assets"];
}

/** Minimal input for a cross-chain transfer (used by chargeSubscription). */
export interface TransferInput {
  token: { chainId: number; address: string };
  /** Human-readable token amount, e.g. "5" for 5 USDC. */
  amount: string;
  receiver: string;
}

export interface UseUniversalUpgrade {
  /** Establish the Universal Account for the logged-in Magic EOA. */
  upgrade: () => Promise<void>;
  /** True once the account is operating as a Universal Account. */
  isUniversal: boolean;
  /** Unified cross-chain balance, or null before it's loaded. */
  universalBalance: UniversalBalance | null;
  loading: boolean;
  error: Error | null;

  // --- supporting surface (consumed by chargeSubscription, step 4) ---
  /** The underlying Magic EOA address. */
  ownerAddress: string | null;
  /** The derived Universal (smart-account) address. */
  smartAccountAddress: string | null;
  /** True once the EOA has 7702 code set on-chain (post first charge). */
  isDelegated: boolean;
  /** Re-read the unified balance from Particle; resolves with the fresh value. */
  refreshBalance: () => Promise<UniversalBalance>;
  /** Build → authorize (7702) → sign → send a transfer. */
  sendUniversalTransaction: (
    input: TransferInput
  ) => Promise<{ transactionId: string }>;
  /**
   * Move value across chains inside the account (v2 "Convert"): rebalances
   * primary assets into `amount` of `tokenType` on `chainId`. This is how
   * cross-chain sourcing works on the v2 backend — convert first, then a
   * same-chain transfer pays the receiver.
   */
  sendConvertTransaction: (input: {
    chainId: number;
    tokenType: SUPPORTED_TOKEN_TYPE;
    amount: string;
  }) => Promise<{ transactionId: string }>;
  /**
   * Poll Particle until the transaction reaches a terminal status. Resolves on
   * FINISHED (7); rejects on failure statuses or timeout. `sendTransaction`
   * resolving only means "accepted" — cross-chain settlement is asynchronous,
   * so anything that depends on the funds must wait for this.
   */
  waitForSettlement: (
    transactionId: string,
    opts?: { timeoutMs?: number; intervalMs?: number }
  ) => Promise<void>;
  /** Fetch the account's Particle transaction history (newest first). */
  getHistory: () => Promise<HistoryEntry[]>;
}

/** Normalized view of one Particle transaction for history/receipts. */
export interface HistoryEntry {
  transactionId: string;
  createdAt: string;
  tag: string;
  status: number;
  settled: boolean;
  failed: boolean;
  amount: string;
  to: string | null;
  fromChains: number[];
  toChains: number[];
}

/** Terminal failure statuses from UA_TRANSACTION_STATUS. */
const FAILED_STATUSES = new Set([
  3, // WAIT_TO_REFUND
  6, // EXECUTION_FAILED
  8, // REFUND_LOCAL
  9, // REFUND_PENDING
  10, // REFUND_FAILED
  11, // REFUND_FINISHED
  14, // PENNY_FAILED
]);
const FINISHED_STATUS = 7;

/**
 * Build the EIP-7702 authorization list for a freshly-built transaction.
 * Mirrors Particle's reference handler: iterate userOps, sign each pending
 * authorization once (cached by nonce), serialize (r,s,v) into a hex string.
 */
async function buildAuthorizations(
  tx: ITransaction
): Promise<EIP7702Authorization[]> {
  const authorizations: EIP7702Authorization[] = [];
  const nonceMap = new Map<number, string>();

  for (const op of tx.userOps) {
    if (op.eip7702Auth && !op.eip7702Delegated) {
      let serialized = nonceMap.get(op.eip7702Auth.nonce);
      if (!serialized) {
        const auth = await sign7702Authorization({
          contractAddress: op.eip7702Auth.address,
          chainId: op.eip7702Auth.chainId,
          nonce: op.eip7702Auth.nonce,
        });
        serialized = Signature.from({
          r: auth.r,
          s: auth.s,
          v: auth.v,
          yParity: auth.yParity,
        }).serialized;
        nonceMap.set(op.eip7702Auth.nonce, serialized);
      }
      authorizations.push({
        userOpHash: op.userOpHash,
        signature: serialized,
      });
    }
  }

  return authorizations;
}

export function useUniversalUpgrade(): UseUniversalUpgrade {
  const uaRef = useRef<UniversalAccount | null>(null);

  const [isUniversal, setIsUniversal] = useState(false);
  const [universalBalance, setUniversalBalance] =
    useState<UniversalBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null
  );
  const [isDelegated, setIsDelegated] = useState(false);

  /** Construct the Universal Account once, in EIP-7702 mode. */
  const ensureUA = useCallback(async (): Promise<UniversalAccount> => {
    if (uaRef.current) return uaRef.current;
    const cfg = assertEnv();
    const owner = await getOwnerAddress();
    const ua = new UniversalAccount({
      projectId: cfg.particleProjectId,
      projectClientKey: cfg.particleClientKey,
      projectAppUuid: cfg.particleAppId,
      smartAccountOptions: {
        useEIP7702: true,
        name: "UNIVERSAL",
        version: UNIVERSAL_ACCOUNT_VERSION,
        ownerAddress: owner,
      },
      // v2 note: `universalGas` was removed — gas is sourced from the unified
      // balance by default on the v2 backend.
      tradeConfig: { slippageBps: 100 },
    });
    uaRef.current = ua;
    setOwnerAddress(owner);
    return ua;
  }, []);

  /** Check whether the EOA has 7702 delegation code set on-chain. */
  const updateDelegation = useCallback(async (owner: string) => {
    try {
      const provider = new JsonRpcProvider(TARGET_CHAIN.rpcUrl);
      const code = await provider.getCode(owner);
      setIsDelegated(code !== "0x" && code.length > 2);
    } catch {
      // Non-fatal: delegation status is informational for the UI.
    }
  }, []);

  const smartAcctRef = useRef<string | null>(null);

  const refreshBalance = useCallback(async () => {
    const ua = await ensureUA();
    // Resolve the deposit (smart-account) address once, so the UI can show
    // users where to fund. In EIP-7702 mode this matches the owner EOA.
    if (!smartAcctRef.current) {
      try {
        const opts = await ua.getSmartAccountOptions();
        if (opts.smartAccountAddress) {
          smartAcctRef.current = opts.smartAccountAddress;
          setSmartAccountAddress(opts.smartAccountAddress);
        }
      } catch {
        // Non-fatal: address panel falls back to the owner EOA.
      }
    }
    const res = await ua.getPrimaryAssets();
    const fresh: UniversalBalance = {
      totalUsd: res.totalAmountInUSD ?? 0,
      assets: res.assets ?? [],
    };
    setUniversalBalance(fresh);
    return fresh;
  }, [ensureUA]);

  const upgrade = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!(await isLoggedIn())) {
        throw new Error("Sign in with your email before upgrading.");
      }
      const ua = await ensureUA();
      const owner = await getOwnerAddress();

      const opts = await ua.getSmartAccountOptions();
      setSmartAccountAddress(opts.smartAccountAddress ?? null);

      const assets = await ua.getPrimaryAssets();
      setUniversalBalance({
        totalUsd: assets.totalAmountInUSD ?? 0,
        assets: assets.assets ?? [],
      });

      await updateDelegation(owner);
      setIsUniversal(true);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ensureUA, updateDelegation]);

  /** Shared tail of every send: authorize (7702) → sign root hash → send. */
  const signAndSend = useCallback(
    async (
      ua: UniversalAccount,
      transaction: ITransaction
    ): Promise<{ transactionId: string }> => {
      const authorizations = await buildAuthorizations(transaction);
      const signature = await signRootHash(transaction.rootHash);
      const result = await ua.sendTransaction(
        transaction,
        signature,
        authorizations
      );
      if (ownerAddress) await updateDelegation(ownerAddress);
      await refreshBalance();
      return { transactionId: result?.transactionId ?? "" };
    },
    [ownerAddress, refreshBalance, updateDelegation]
  );

  const sendUniversalTransaction = useCallback(
    async (input: TransferInput): Promise<{ transactionId: string }> => {
      setError(null);
      try {
        const ua = await ensureUA();
        const transaction = await ua.createTransferTransaction({
          token: {
            chainId: input.token.chainId,
            address: input.token.address,
          },
          amount: input.amount,
          receiver: input.receiver,
        });
        return await signAndSend(ua, transaction);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      }
    },
    [ensureUA, signAndSend]
  );

  const sendConvertTransaction = useCallback(
    async (input: {
      chainId: number;
      tokenType: SUPPORTED_TOKEN_TYPE;
      amount: string;
    }): Promise<{ transactionId: string }> => {
      setError(null);
      try {
        const ua = await ensureUA();
        const transaction = await ua.createConvertTransaction({
          chainId: input.chainId,
          expectToken: { type: input.tokenType, amount: input.amount },
        });
        return await signAndSend(ua, transaction);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      }
    },
    [ensureUA, signAndSend]
  );

  const waitForSettlement = useCallback(
    async (
      transactionId: string,
      opts?: { timeoutMs?: number; intervalMs?: number }
    ): Promise<void> => {
      const timeoutMs = opts?.timeoutMs ?? 240_000;
      const intervalMs = opts?.intervalMs ?? 4_000;
      const ua = await ensureUA();
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const tx = await ua.getTransaction(transactionId).catch(() => null);
        const status = tx?.status ?? tx?.data?.status;
        if (status === FINISHED_STATUS) return;
        if (typeof status === "number" && FAILED_STATUSES.has(status)) {
          throw new Error(
            `Transaction ${transactionId} failed to settle (status ${status}).`
          );
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      throw new Error(
        `Timed out waiting for transaction ${transactionId} to settle.`
      );
    },
    [ensureUA]
  );

  const getHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    const ua = await ensureUA();
    const res = await ua.getTransactions(1, 50).catch(() => null);
    const rows: any[] = res?.data ?? [];
    return rows.map((t) => ({
      transactionId: t.transactionId ?? "",
      createdAt: t.createdAt ?? "",
      tag: t.tag ?? "",
      status: Number(t.status),
      settled: Number(t.status) === FINISHED_STATUS,
      failed: FAILED_STATUSES.has(Number(t.status)),
      amount: String(t.change?.amount ?? ""),
      to: t.change?.to ?? null,
      fromChains: t.fromChains ?? [],
      toChains: t.toChains ?? [],
    }));
  }, [ensureUA]);

  return {
    upgrade,
    isUniversal,
    universalBalance,
    loading,
    error,
    ownerAddress,
    smartAccountAddress,
    isDelegated,
    refreshBalance,
    sendUniversalTransaction,
    sendConvertTransaction,
    waitForSettlement,
    getHistory,
  };
}
