"use client";

/**
 * Magic embedded-wallet wiring (step 2).
 *
 * Everything here is browser-only. We expose a tiny, purpose-built surface:
 *  - email OTP login / logout / session check (no seed phrase, no password)
 *  - an ethers signer derived from Magic's EIP-1193 provider
 *  - `signRootHash` — signs a Universal Account transaction's root hash
 *  - `sign7702Authorization` — signs an EIP-7702 authorization tuple and adapts
 *    Magic's response into the shape Particle's SDK expects.
 *
 * Blind-signature note: the dedicated email embedded wallet (no wallet-widget)
 * signs headlessly — no confirmation popup — and Magic's 7702 methods are
 * explicitly headless. That satisfies the "no popups" requirement.
 */

import { Magic } from "magic-sdk";
import {
  BrowserProvider,
  getBytes,
  type Eip1193Provider,
  type JsonRpcSigner,
} from "ethers";
import { TARGET_CHAIN, assertEnv } from "./config";

/** Signature shape Particle's EIP-7702 handler consumes. */
export interface ParticleAuthResult {
  r: string;
  s: string;
  v: bigint;
  yParity: 0 | 1;
}

let magicSingleton: Magic | null = null;
let signerCache: JsonRpcSigner | null = null;

/** Runtime Magic config, set by the Provider. Falls back to env when unset. */
interface MagicRuntimeConfig {
  magicKey: string;
  chainId: number;
  rpcUrl: string;
}
let runtimeConfig: MagicRuntimeConfig | null = null;

/**
 * Inject the Magic-relevant config (called once by the Provider). If the key
 * changes, the singleton + signer are reset so the next call rebuilds them.
 */
export function configureMagic(cfg: MagicRuntimeConfig) {
  if (!cfg.magicKey) return;
  if (magicSingleton && runtimeConfig?.magicKey !== cfg.magicKey) {
    magicSingleton = null;
    signerCache = null;
  }
  runtimeConfig = cfg;
}

function resolveConfig(): MagicRuntimeConfig {
  if (runtimeConfig?.magicKey) return runtimeConfig;
  // Fallback for any call before the Provider mounts (identical to the default).
  const { magicKey } = assertEnv();
  return { magicKey, chainId: TARGET_CHAIN.id, rpcUrl: TARGET_CHAIN.rpcUrl };
}

/** Lazily construct the Magic client, pinned to the configured chain. */
export function getMagic(): Magic {
  if (typeof window === "undefined") {
    throw new Error("Magic is browser-only and cannot be used during SSR.");
  }
  if (!magicSingleton) {
    const cfg = resolveConfig();
    magicSingleton = new Magic(cfg.magicKey, {
      network: { rpcUrl: cfg.rpcUrl, chainId: cfg.chainId },
    });
  }
  return magicSingleton;
}

/** Send an email OTP challenge and complete login (opens Magic's OTP modal). */
export async function loginWithEmail(email: string): Promise<void> {
  await getMagic().auth.loginWithEmailOTP({ email });
  signerCache = null; // force a fresh signer for the new session
}

export async function logout(): Promise<void> {
  try {
    await getMagic().user.logout();
  } finally {
    // Reset the client + signer so the next isLoggedIn()/getMagic() rebuilds a
    // fresh, cleanly signed-out instance (a stale singleton can report stale
    // session state). runtimeConfig is kept so re-login needs no reconfigure.
    signerCache = null;
    magicSingleton = null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  return getMagic().user.isLoggedIn();
}

/** ethers signer backed by the Magic embedded wallet (cached per session). */
export async function getSigner(): Promise<JsonRpcSigner> {
  if (!signerCache) {
    const provider = new BrowserProvider(
      getMagic().rpcProvider as unknown as Eip1193Provider
    );
    signerCache = await provider.getSigner();
  }
  return signerCache;
}

export async function getOwnerAddress(): Promise<string> {
  return (await getSigner()).getAddress();
}

/**
 * Sign a Universal Account transaction root hash. We sign the raw 32 bytes
 * (via getBytes) to match Particle's quickstart signing convention.
 */
export async function signRootHash(rootHash: string): Promise<string> {
  const signer = await getSigner();
  return signer.signMessage(getBytes(rootHash));
}

/**
 * Sign an EIP-7702 authorization tuple with the Magic wallet and adapt the
 * result to Particle's expected {r, s, v, yParity}. Magic returns v as 27/28;
 * yParity is the low bit (v - 27). Runs headlessly (no popup).
 */
export async function sign7702Authorization(params: {
  contractAddress: string;
  chainId: number;
  nonce: number;
}): Promise<ParticleAuthResult> {
  const res = await getMagic().wallet.sign7702Authorization({
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    nonce: params.nonce,
  });
  const yParity = (res.v >= 27 ? res.v - 27 : res.v) as 0 | 1;
  return { r: res.r, s: res.s, v: BigInt(res.v), yParity };
}
